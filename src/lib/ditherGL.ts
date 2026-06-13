/* ==========================================================================
   ditherGL — a tiny WebGL2 renderer that draws the asteroid map in grayscale
   off-screen, then snaps it to 1-bit black & white with a 4×4 Bayer
   ordered-dither shader. Mid-grays become the classic Macintosh stipple, so
   trail fades, the day/night terminator on the globe, and faint reference
   rings all "shade" themselves with pure black pixels.

   Scene model: everything lives in a small world space with Earth at the
   origin. The camera orbits the origin (yaw about Y, pitch about X) at a
   fixed distance and perspective-projects onto the canvas. Two point clouds
   (static: orbit paths; dynamic: the bodies + trails, re-uploaded each frame)
   plus one ray-traced sphere for Earth, drawn as a billboard whose fragment
   shader solves the ray–sphere intersection, lights it by the real Sun
   direction, and writes true per-fragment depth so asteroids correctly pass
   in front of and behind the globe.
   ========================================================================== */

export type Camera = {
  yaw: number;
  pitch: number;
  /** Camera distance from the origin, world units */
  camDist: number;
  /** Focal length in CSS pixels (already includes zoom) */
  focal: number;
};

/** Floats per point in the packed buffers: x, y, z, size, shade. */
export const POINT_STRIDE = 5;

/** Camera rotation (pitch about X ∘ yaw about Y) as a column-major mat3 —
    must stay in lockstep with `projectPoint` and the vertex shader. */
export function rotationMatrix(yaw: number, pitch: number): Float32Array {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  // prettier-ignore
  return new Float32Array([
    cy,       sy * sp, -sy * cp,
    0,        cp,       sp,
    sy,      -cy * sp,  cy * cp,
  ]);
}

export type ProjectedPoint = {
  /** CSS-pixel canvas coordinates */
  x: number;
  y: number;
  /** Camera-space z (larger = nearer the viewer) */
  z: number;
  /** CSS pixels per world unit at this depth */
  scale: number;
};

/** CPU mirror of the vertex-shader projection, for hit-testing and overlays. */
export function projectPoint(
  px: number,
  py: number,
  pz: number,
  rot: Float32Array,
  cam: Camera,
  wCss: number,
  hCss: number,
): ProjectedPoint {
  const x = rot[0] * px + rot[3] * py + rot[6] * pz;
  const y = rot[1] * px + rot[4] * py + rot[7] * pz;
  const z = rot[2] * px + rot[5] * py + rot[8] * pz;
  const scale = cam.focal / Math.max(1, cam.camDist - z);
  return { x: wCss / 2 + x * scale, y: hCss / 2 - y * scale, z, scale };
}

/* --- shaders ---------------------------------------------------------------- */

const POINT_VS = `#version 300 es
precision highp float;
layout(location=0) in vec3 aPos;
layout(location=1) in float aSize;
layout(location=2) in float aShade;
uniform mat3 uRot;
uniform float uCamDist;
uniform float uFocal;     // css px
uniform vec2 uHalfView;   // css px
uniform float uDpr;
out float vShade;
void main() {
  vec3 p = uRot * aPos;
  float scale = uFocal / max(1.0, uCamDist - p.z);
  vec2 screen = p.xy * scale;            // css px from centre, y up
  float depth = (uCamDist - p.z) / (2.0 * uCamDist);
  gl_Position = vec4(screen / uHalfView, depth * 2.0 - 1.0, 1.0);
  // aSize is in CSS px at the origin's depth: dots keep their size as you
  // zoom, but still swell/shrink with perspective depth.
  gl_PointSize = max(uDpr, aSize * uDpr * uCamDist / max(1.0, uCamDist - p.z));
  vShade = aShade;
}`;

const POINT_FS = `#version 300 es
precision highp float;
in float vShade;
out vec4 outColor;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  if (dot(c, c) > 0.25) discard;        // round dots
  outColor = vec4(vec3(vShade), 1.0);
}`;

const EARTH_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;     // ±1 quad
uniform float uEarthR;                  // world units
uniform float uCamDist;
uniform float uFocal;
uniform vec2 uHalfView;
out vec2 vPlane;                        // camera-space xy on the z=0 plane
void main() {
  float s = uEarthR * 1.08;
  vPlane = aCorner * s;
  float scale = uFocal / max(1.0, uCamDist);
  // Depth is refined per-fragment; the quad just needs to land near z≈0.
  gl_Position = vec4(vPlane * scale / uHalfView, 0.0, 1.0);
}`;

const EARTH_FS = `#version 300 es
precision highp float;
in vec2 vPlane;
uniform float uEarthR;
uniform float uCamDist;
uniform vec3 uSunCam;                   // sun direction in camera space
out vec4 outColor;
void main() {
  // Ray from the camera (0,0,camDist) through this fragment's plane point.
  vec3 C = vec3(0.0, 0.0, uCamDist);
  vec3 D = normalize(vec3(vPlane, 0.0) - C);
  float b = dot(C, D);
  float disc = b * b - (dot(C, C) - uEarthR * uEarthR);
  if (disc < 0.0) discard;
  float t = -b - sqrt(disc);
  vec3 h = C + t * D;
  vec3 n = h / uEarthR;
  // Day side nearly white, night side nearly black, soft terminator.
  float l = smoothstep(-0.12, 0.35, dot(n, uSunCam));
  float lum = mix(0.10, 0.93, l);
  // Ink outline at the limb so the globe always reads against white.
  float rim = smoothstep(0.0, 0.16, sqrt(disc) / uEarthR);
  lum *= rim;
  outColor = vec4(vec3(lum), 1.0);
  gl_FragDepth = clamp((uCamDist - h.z) / (2.0 * uCamDist), 0.0, 1.0);
}`;

const DITHER_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;        // fullscreen triangle
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const DITHER_FS = `#version 300 es
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform float uCell;                    // dither cell size, device px
out vec4 outColor;
const float BAYER[16] = float[16](
   0.0,  8.0,  2.0, 10.0,
  12.0,  4.0, 14.0,  6.0,
   3.0, 11.0,  1.0,  9.0,
  15.0,  7.0, 13.0,  5.0
);
void main() {
  float lum = texture(uTex, vUv).r;
  vec2 cell = floor(gl_FragCoord.xy / uCell);
  int idx = int(mod(cell.x, 4.0)) + int(mod(cell.y, 4.0)) * 4;
  float threshold = (BAYER[idx] + 0.5) / 16.0;
  float bit = lum > threshold ? 1.0 : 0.0;
  outColor = vec4(vec3(bit), 1.0);
}`;

/* --- renderer ---------------------------------------------------------------- */

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const sh = gl.createShader(type);
  if (!sh) throw new Error('shader alloc failed');
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(sh) ?? 'shader compile failed');
  }
  return sh;
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const prog = gl.createProgram();
  if (!prog) throw new Error('program alloc failed');
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(prog) ?? 'program link failed');
  }
  return prog;
}

export class DitherRenderer {
  private gl: WebGL2RenderingContext;
  private pointProg: WebGLProgram;
  private earthProg: WebGLProgram;
  private ditherProg: WebGLProgram;
  private staticVao: WebGLVertexArrayObject;
  private staticBuf: WebGLBuffer;
  private staticCount = 0;
  private dynVao: WebGLVertexArrayObject;
  private dynBuf: WebGLBuffer;
  private dynCount = 0;
  private quadVao: WebGLVertexArrayObject;
  private screenVao: WebGLVertexArrayObject;
  private fbo: WebGLFramebuffer;
  private fboTex: WebGLTexture;
  private fboDepth: WebGLRenderbuffer;
  private fboW = 0;
  private fboH = 0;
  private wCss = 1;
  private hCss = 1;
  private dpr = 1;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      depth: false, // default framebuffer never needs depth; the FBO has its own
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;

    this.pointProg = link(gl, POINT_VS, POINT_FS);
    this.earthProg = link(gl, EARTH_VS, EARTH_FS);
    this.ditherProg = link(gl, DITHER_VS, DITHER_FS);

    const makePointVao = (): [WebGLVertexArrayObject, WebGLBuffer] => {
      const vao = gl.createVertexArray();
      const buf = gl.createBuffer();
      if (!vao || !buf) throw new Error('vao alloc failed');
      gl.bindVertexArray(vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const stride = POINT_STRIDE * 4;
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(1, 1, gl.FLOAT, false, stride, 12);
      gl.enableVertexAttribArray(2);
      gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 16);
      gl.bindVertexArray(null);
      return [vao, buf];
    };
    [this.staticVao, this.staticBuf] = makePointVao();
    [this.dynVao, this.dynBuf] = makePointVao();

    // Earth billboard quad (two triangles).
    const quadVao = gl.createVertexArray();
    const quadBuf = gl.createBuffer();
    if (!quadVao || !quadBuf) throw new Error('vao alloc failed');
    gl.bindVertexArray(quadVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.quadVao = quadVao;

    // Fullscreen triangle for the dither pass.
    const screenVao = gl.createVertexArray();
    const screenBuf = gl.createBuffer();
    if (!screenVao || !screenBuf) throw new Error('vao alloc failed');
    gl.bindVertexArray(screenVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, screenBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.screenVao = screenVao;

    const fbo = gl.createFramebuffer();
    const fboTex = gl.createTexture();
    const fboDepth = gl.createRenderbuffer();
    if (!fbo || !fboTex || !fboDepth) throw new Error('fbo alloc failed');
    this.fbo = fbo;
    this.fboTex = fboTex;
    this.fboDepth = fboDepth;
  }

  resize(wCss: number, hCss: number, dpr: number): void {
    const gl = this.gl;
    this.wCss = Math.max(1, wCss);
    this.hCss = Math.max(1, hCss);
    this.dpr = dpr;
    const w = Math.max(1, Math.round(wCss * dpr));
    const h = Math.max(1, Math.round(hCss * dpr));
    if (w === this.fboW && h === this.fboH) return;
    this.fboW = w;
    this.fboH = h;

    gl.canvas.width = w;
    gl.canvas.height = h;

    gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.bindRenderbuffer(gl.RENDERBUFFER, this.fboDepth);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.fboTex, 0);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.fboDepth);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /** Upload the orbit-path point cloud (changes only on data/scale changes). */
  setStaticPoints(data: Float32Array): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.staticBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    this.staticCount = data.length / POINT_STRIDE;
  }

  /** Upload this frame's body + trail points. */
  setDynamicPoints(data: Float32Array, count: number): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dynBuf);
    gl.bufferData(gl.ARRAY_BUFFER, data.subarray(0, count * POINT_STRIDE), gl.DYNAMIC_DRAW);
    this.dynCount = count;
  }

  render(cam: Camera, earthR: number, sunWorld: [number, number, number]): void {
    const gl = this.gl;
    const rot = rotationMatrix(cam.yaw, cam.pitch);
    // Sun direction in camera space (for the globe's lighting).
    const sx = rot[0] * sunWorld[0] + rot[3] * sunWorld[1] + rot[6] * sunWorld[2];
    const sy = rot[1] * sunWorld[0] + rot[4] * sunWorld[1] + rot[7] * sunWorld[2];
    const sz = rot[2] * sunWorld[0] + rot[5] * sunWorld[1] + rot[8] * sunWorld[2];

    /* Pass 1 — grayscale scene into the FBO. */
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.fboW, this.fboH);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(1, 1, 1, 1);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.useProgram(this.pointProg);
    gl.uniformMatrix3fv(gl.getUniformLocation(this.pointProg, 'uRot'), false, rot);
    gl.uniform1f(gl.getUniformLocation(this.pointProg, 'uCamDist'), cam.camDist);
    gl.uniform1f(gl.getUniformLocation(this.pointProg, 'uFocal'), cam.focal);
    gl.uniform2f(gl.getUniformLocation(this.pointProg, 'uHalfView'), this.wCss / 2, this.hCss / 2);
    gl.uniform1f(gl.getUniformLocation(this.pointProg, 'uDpr'), this.dpr);
    if (this.staticCount > 0) {
      gl.bindVertexArray(this.staticVao);
      gl.drawArrays(gl.POINTS, 0, this.staticCount);
    }
    if (this.dynCount > 0) {
      gl.bindVertexArray(this.dynVao);
      gl.drawArrays(gl.POINTS, 0, this.dynCount);
    }

    gl.useProgram(this.earthProg);
    gl.uniform1f(gl.getUniformLocation(this.earthProg, 'uEarthR'), earthR);
    gl.uniform1f(gl.getUniformLocation(this.earthProg, 'uCamDist'), cam.camDist);
    gl.uniform1f(gl.getUniformLocation(this.earthProg, 'uFocal'), cam.focal);
    gl.uniform2f(gl.getUniformLocation(this.earthProg, 'uHalfView'), this.wCss / 2, this.hCss / 2);
    const slen = Math.hypot(sx, sy, sz) || 1;
    gl.uniform3f(gl.getUniformLocation(this.earthProg, 'uSunCam'), sx / slen, sy / slen, sz / slen);
    gl.bindVertexArray(this.quadVao);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    /* Pass 2 — Bayer dither to 1-bit on the default framebuffer. */
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.fboW, this.fboH);
    gl.disable(gl.DEPTH_TEST);
    gl.useProgram(this.ditherProg);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.fboTex);
    gl.uniform1i(gl.getUniformLocation(this.ditherProg, 'uTex'), 0);
    gl.uniform1f(gl.getUniformLocation(this.ditherProg, 'uCell'), Math.max(1, Math.round(this.dpr)));
    gl.bindVertexArray(this.screenVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    gl.deleteProgram(this.pointProg);
    gl.deleteProgram(this.earthProg);
    gl.deleteProgram(this.ditherProg);
    gl.deleteFramebuffer(this.fbo);
    gl.deleteTexture(this.fboTex);
    gl.deleteRenderbuffer(this.fboDepth);
  }
}
