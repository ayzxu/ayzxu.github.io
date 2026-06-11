/* ==========================================================================
   PaintWindow — a MacPaint-style 1-bit paint program. Every pixel on the
   canvas is pure black or pure white; "grayscale" and "opacity" are achieved
   the way 1984 did it — ordered (Bayer 8×8) dithering. Ink darkness × opacity
   decides how dense the dither pattern is.

   Tools: pencil, brush, spray, eraser, line, rectangle, oval, bucket fill.
   Plus undo (⌘/Ctrl+Z), clear, and save-as-PNG.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';

/* Logical canvas size — fixed, classic-small. Rendered 1:1 where possible. */
const CANVAS_W = 512;
const CANVAS_H = 342; // original Macintosh screen height

const UNDO_LIMIT = 15;

/* 8×8 Bayer matrix, thresholds normalised to 0..1 (64 distinct levels) */
const BAYER8: number[][] = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
].map((row) => row.map((v) => (v + 0.5) / 64)) as unknown as number[][];

function bayer(x: number, y: number): number {
  return BAYER8[((y % 8) + 8) % 8][((x % 8) + 8) % 8];
}

type Tool =
  | 'pencil'
  | 'brush'
  | 'spray'
  | 'eraser'
  | 'line'
  | 'rect'
  | 'oval'
  | 'fill';

const TOOLS: { id: Tool; label: string }[] = [
  { id: 'pencil', label: 'Pencil' },
  { id: 'brush', label: 'Brush' },
  { id: 'spray', label: 'Spray' },
  { id: 'eraser', label: 'Eraser' },
  { id: 'line', label: 'Line' },
  { id: 'rect', label: 'Rect' },
  { id: 'oval', label: 'Oval' },
  { id: 'fill', label: 'Fill' },
];

const SHAPE_TOOLS: Tool[] = ['line', 'rect', 'oval'];

/* 8 ink swatches, darkest → lightest */
const INK_LEVELS = [1, 0.875, 0.75, 0.625, 0.5, 0.375, 0.25, 0.125];

const BRUSH_SIZES = [1, 2, 4, 8, 14];

type Pt = { x: number; y: number };

export default function PaintWindow() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const [tool, setTool] = useState<Tool>('brush');
  const [ink, setInk] = useState(1); // swatch darkness 0..1
  const [opacity, setOpacity] = useState(1); // slider 0..1
  const [size, setSize] = useState(4);
  const [canUndo, setCanUndo] = useState(false);

  /* Refs for values needed inside pointer handlers without re-binding */
  const toolRef = useRef(tool);
  const inkRef = useRef(ink);
  const opacityRef = useRef(opacity);
  const sizeRef = useRef(size);
  toolRef.current = tool;
  inkRef.current = ink;
  opacityRef.current = opacity;
  sizeRef.current = size;

  const drawing = useRef(false);
  const lastPt = useRef<Pt>({ x: 0, y: 0 });
  const shapeStart = useRef<Pt>({ x: 0, y: 0 });
  const shapeSnapshot = useRef<ImageData | null>(null);
  const undoStack = useRef<ImageData[]>([]);
  const sprayTimer = useRef<number | null>(null);
  const sprayPos = useRef<Pt>({ x: 0, y: 0 });

  /* --- canvas bootstrap --------------------------------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctxRef.current = ctx;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    return () => {
      if (sprayTimer.current !== null) window.clearInterval(sprayTimer.current);
    };
  }, []);

  /* --- helpers ------------------------------------------------------------ */

  const darkness = () => inkRef.current * opacityRef.current;

  const pushUndo = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    undoStack.current.push(ctx.getImageData(0, 0, CANVAS_W, CANVAS_H));
    if (undoStack.current.length > UNDO_LIMIT) undoStack.current.shift();
    setCanUndo(true);
  };

  const undo = () => {
    const ctx = ctxRef.current;
    const prev = undoStack.current.pop();
    if (ctx && prev) ctx.putImageData(prev, 0, 0);
    setCanUndo(undoStack.current.length > 0);
  };

  /** Stamp one brush footprint. Dithered black where the pattern says so;
      pixels that miss the pattern threshold are left untouched, so light
      inks build up gradually like real paint. */
  const stamp = (cx: number, cy: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const t = toolRef.current;
    const r = t === 'pencil' ? 0 : Math.floor(sizeRef.current / 2);
    const d = darkness();

    if (t === 'eraser') {
      const s = Math.max(4, sizeRef.current * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(cx - s / 2), Math.round(cy - s / 2), s, s);
      return;
    }

    ctx.fillStyle = '#000000';
    if (r === 0) {
      ctx.fillRect(Math.round(cx), Math.round(cy), 1, 1);
      return;
    }
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy > r * r) continue;
        const px = Math.round(cx + dx);
        const py = Math.round(cy + dy);
        if (px < 0 || py < 0 || px >= CANVAS_W || py >= CANVAS_H) continue;
        if (d >= bayer(px, py)) ctx.fillRect(px, py, 1, 1);
      }
    }
  };

  /** Stamp along the segment a→b so fast strokes stay continuous */
  const stampLine = (a: Pt, b: Pt) => {
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const steps = Math.max(1, Math.ceil(dist));
    for (let i = 0; i <= steps; i++) {
      stamp(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
    }
  };

  const sprayBurst = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const radius = Math.max(6, sizeRef.current * 2.5);
    const d = darkness();
    ctx.fillStyle = '#000000';
    const dots = Math.round(10 + radius);
    for (let i = 0; i < dots; i++) {
      const ang = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * radius;
      if (Math.random() > d) continue;
      const px = Math.round(sprayPos.current.x + Math.cos(ang) * rr);
      const py = Math.round(sprayPos.current.y + Math.sin(ang) * rr);
      if (px >= 0 && py >= 0 && px < CANVAS_W && py < CANVAS_H) {
        ctx.fillRect(px, py, 1, 1);
      }
    }
  };

  const drawShape = (from: Pt, to: Pt) => {
    const t = toolRef.current;
    if (t === 'line') {
      stampLine(from, to);
    } else if (t === 'rect') {
      stampLine(from, { x: to.x, y: from.y });
      stampLine({ x: to.x, y: from.y }, to);
      stampLine(to, { x: from.x, y: to.y });
      stampLine({ x: from.x, y: to.y }, from);
    } else if (t === 'oval') {
      const cx = (from.x + to.x) / 2;
      const cy = (from.y + to.y) / 2;
      const rx = Math.abs(to.x - from.x) / 2;
      const ry = Math.abs(to.y - from.y) / 2;
      const steps = Math.max(24, Math.ceil((rx + ry) * 2));
      let prev: Pt | null = null;
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const p = { x: cx + Math.cos(a) * rx, y: cy + Math.sin(a) * ry };
        if (prev) stampLine(prev, p);
        prev = p;
      }
    }
  };

  /** Scanline-free simple flood fill on the 1-bit raster. The clicked
      region's colour class (black/white) is replaced with the current
      dither pattern. */
  const floodFill = (sx: number, sy: number) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const img = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    const data = img.data;
    const isBlack = (i: number) => data[i * 4] < 128;
    const start = sy * CANVAS_W + sx;
    const targetBlack = isBlack(start);
    const d = darkness();
    const visited = new Uint8Array(CANVAS_W * CANVAS_H);
    const stack = [start];
    visited[start] = 1;

    while (stack.length > 0) {
      const idx = stack.pop()!;
      const x = idx % CANVAS_W;
      const y = (idx / CANVAS_W) | 0;

      const paintBlack = d >= bayer(x, y);
      const o = idx * 4;
      const v = paintBlack ? 0 : 255;
      data[o] = v;
      data[o + 1] = v;
      data[o + 2] = v;
      data[o + 3] = 255;

      const neighbours = [
        x > 0 ? idx - 1 : -1,
        x < CANVAS_W - 1 ? idx + 1 : -1,
        y > 0 ? idx - CANVAS_W : -1,
        y < CANVAS_H - 1 ? idx + CANVAS_W : -1,
      ];
      for (const n of neighbours) {
        if (n >= 0 && !visited[n] && isBlack(n) === targetBlack) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  };

  /* --- pointer plumbing ----------------------------------------------------
     Canvas may be CSS-scaled down on small windows; map client coords back
     to logical pixels through the bounding rect. */
  const toCanvas = (e: React.PointerEvent): Pt => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.min(
        CANVAS_W - 1,
        Math.max(0, ((e.clientX - rect.left) / rect.width) * CANVAS_W),
      ),
      y: Math.min(
        CANVAS_H - 1,
        Math.max(0, ((e.clientY - rect.top) / rect.height) * CANVAS_H),
      ),
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx) return;
    canvas.setPointerCapture(e.pointerId);
    const p = toCanvas(e);
    pushUndo();
    drawing.current = true;
    lastPt.current = p;

    const t = toolRef.current;
    if (t === 'fill') {
      floodFill(Math.floor(p.x), Math.floor(p.y));
      drawing.current = false;
      return;
    }
    if (SHAPE_TOOLS.includes(t)) {
      shapeStart.current = p;
      shapeSnapshot.current = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
      return;
    }
    if (t === 'spray') {
      sprayPos.current = p;
      sprayBurst();
      sprayTimer.current = window.setInterval(sprayBurst, 50);
      return;
    }
    stamp(p.x, p.y);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = ctxRef.current;
    if (!ctx) return;
    const p = toCanvas(e);
    const t = toolRef.current;

    if (SHAPE_TOOLS.includes(t)) {
      if (shapeSnapshot.current) ctx.putImageData(shapeSnapshot.current, 0, 0);
      drawShape(shapeStart.current, p);
    } else if (t === 'spray') {
      sprayPos.current = p;
    } else {
      stampLine(lastPt.current, p);
    }
    lastPt.current = p;
  };

  const endStroke = () => {
    drawing.current = false;
    shapeSnapshot.current = null;
    if (sprayTimer.current !== null) {
      window.clearInterval(sprayTimer.current);
      sprayTimer.current = null;
    }
  };

  /* --- actions ------------------------------------------------------------ */

  const clearCanvas = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    pushUndo();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  };

  const savePng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.download = 'painting.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    }
  };

  /* --- render ------------------------------------------------------------- */
  return (
    <div className="paint-content" tabIndex={0} onKeyDown={onKeyDown}>
      <div className="paint-main">
        {/* tool column */}
        <div className="paint-tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`paint-tool${tool === t.id ? ' selected' : ''}`}
              onClick={() => setTool(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* the 1-bit canvas */}
        <div className="paint-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="paint-canvas"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
            onPointerLeave={(e) => {
              // keep drawing while captured; stop if capture was lost
              if (!e.currentTarget.hasPointerCapture(e.pointerId)) endStroke();
            }}
          />
        </div>
      </div>

      {/* bottom bar: inks, opacity, sizes, actions */}
      <div className="paint-bar">
        <div className="paint-swatches" title="Ink (dithered gray level)">
          {INK_LEVELS.map((level) => (
            <InkSwatch
              key={level}
              level={level}
              selected={ink === level}
              onSelect={() => setInk(level)}
            />
          ))}
        </div>

        <label className="paint-opacity">
          <span className="paint-bar-label">Opacity</span>
          <input
            type="range"
            className="menu-volume-slider"
            min={5}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={(e) => setOpacity(Number(e.target.value) / 100)}
            aria-label="Brush opacity"
          />
          <span className="paint-bar-label">{Math.round(opacity * 100)}%</span>
        </label>

        <div className="paint-sizes" title="Brush size">
          {BRUSH_SIZES.map((s) => (
            <button
              key={s}
              type="button"
              className={`paint-size${size === s ? ' selected' : ''}`}
              onClick={() => setSize(s)}
              aria-label={`Brush size ${s}`}
            >
              <span
                className="paint-size-dot"
                style={{ width: Math.max(2, s), height: Math.max(2, s) }}
              />
            </button>
          ))}
        </div>

        <div className="paint-actions">
          <button
            type="button"
            className="mac-button"
            onClick={undo}
            disabled={!canUndo}
          >
            Undo
          </button>
          <button type="button" className="mac-button" onClick={clearCanvas}>
            Clear
          </button>
          <button type="button" className="mac-button" onClick={savePng}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

/* A swatch renders its own dither pattern on a tiny canvas, so the palette
   shows exactly what the ink will paint. */
function InkSwatch({
  level,
  selected,
  onSelect,
}: {
  level: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = '#000000';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        if (level >= bayer(x, y)) ctx.fillRect(x, y, 1, 1);
      }
    }
  }, [level]);

  return (
    <button
      type="button"
      className={`paint-swatch${selected ? ' selected' : ''}`}
      onClick={onSelect}
      aria-label={`Ink ${Math.round(level * 100)}% black`}
    >
      <canvas ref={ref} width={16} height={16} className="paint-swatch-chip" />
    </button>
  );
}
