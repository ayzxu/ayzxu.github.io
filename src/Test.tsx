import { useEffect, useMemo, useRef, useLayoutEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import githubIcon from './assets/icons/github.png';
import githubWhiteIcon from './assets/icons/githubwhite.png';
import linkedinIcon from './assets/icons/linkedin.png';
import emailIcon from './assets/icons/email.png';
import portrait2 from './assets/portraits/portrait2.jpg';

type Card = { title: string; desc: string; link?: string };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

/** 2D-only "perspective" helpers */
function scaleFromHorizon(cy: number, horizon: number, height: number) {
  // cy below horizon → larger; above horizon → smaller (clamped).
  const d = clamp((cy - horizon) / height, -0.5, 0.6);
  // map d ~ [-0.5..0.6] to a comfortable scale range
  return 0.75 + d * 0.9; // ~0.3 .. ~1.29
}

function skewTowardVP(cx: number, cy: number, vpX: number, vpY: number) {
  // Signed angle from card center → vanishing point
  const ang = Math.atan2(vpY - cy, vpX - cx); // radians
  // Convert to degrees, dampen to keep elegant (2D shear)
  const deg = (ang * 180) / Math.PI;
  // We only want a subtle vertical shear to suggest depth
  return clamp(deg * 0.25, -14, 14); // degrees for skewY
}

function shadowFor(
  cx: number,
  cy: number,
  horizon: number,
  light: { x: number; y: number },
  depthScale: number
) {
  // Vector from light to card center
  const lx = cx - light.x;
  const ly = cy - light.y;
  // Normalize
  const len = Math.hypot(lx, ly) || 1;
  const ux = lx / len;
  const uy = ly / len;
  // Shadow length increases the farther the card is from the horizon
  const horizonFactor = clamp((cy - horizon) / 300, 0.2, 1.2);
  const length = 24 * horizonFactor * depthScale; // px
  const offsetX = ux * length;
  const offsetY = uy * length;
  // Blur a bit with "depth"
  const blur = 22 * horizonFactor * (0.6 + 0.4 * depthScale);
  const alpha = clamp(0.4 + 0.3 * horizonFactor, 0.35, 0.6); // More apparent shadows
  return { offsetX, offsetY, blur, alpha };
}

// Initialize theme synchronously before component renders
function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function Test() {
  const [dark, setDark] = useState(getInitialTheme);

  // Reflect state to <html> class
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved) return;
    
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        setDark(e.matches);
      }
    };
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  const toggleTheme = () => {
    setDark(prev => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const cards: Card[] = [
    { title: 'Projects', desc: 'AI sidequests from IBM and personal side projects.', link: '/projects' },
    { title: 'Fun',  desc: 'What I do outside of work and school: Art, Gym, Volleyball, Gaming, Chess, etc.', link: '/fun' },
    { title: 'About Me',  desc: 'Some of my background and experiences.', link: '/about' },
  ];

  const year = useMemo(() => new Date().getFullYear(), []);

  return (
    <Home dark={dark} toggleTheme={toggleTheme} cards={cards} year={year} isTransitioning={false} shouldFadeOut={false} />
  );
}

function TransitionLink({ to, children, className, style, onMouseEnter, onMouseLeave }: { 
  to: string; 
  children: React.ReactNode; 
  className?: string; 
  style?: React.CSSProperties;
  onMouseEnter?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === to) return;
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} className={className} style={style} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {children}
    </a>
  );
}

function Home({ dark, toggleTheme, cards, year, isTransitioning, shouldFadeOut }: { 
  dark: boolean; 
  toggleTheme: () => void;
  cards: Card[];
  year: number;
  isTransitioning: boolean;
  shouldFadeOut: boolean;
}) {
  const [isVisible, setIsVisible] = useState(true); // Start visible for testing
  const location = useLocation();
  const sceneRef = useRef<HTMLDivElement>(null);
  const themeButtonRef = useRef<HTMLButtonElement>(null);
  const [sz, setSz] = useState({ w: 0, h: 0 });
  const [mousePos, setMousePos] = useState({ x: -1, y: -1 }); // Initialize to -1 to indicate no mouse movement yet

  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), isTransitioning ? 400 : 10);
    return () => clearTimeout(timer);
  }, [location.pathname, isTransitioning]);

  // Update theme button colors when dark changes
  useEffect(() => {
    if (themeButtonRef.current) {
      themeButtonRef.current.style.setProperty('background-color', dark ? '#ede5d8' : '#080808', 'important');
      themeButtonRef.current.style.setProperty('color', dark ? '#2b2b2b' : '#ffffff', 'important');
    }
  }, [dark]);



  useLayoutEffect(() => {
    const el = sceneRef.current;
    if (!el) return;
    
    // Set initial size immediately and synchronously
    const updateSize = () => {
      const width = el.clientWidth || window.innerWidth;
      const height = el.clientHeight || window.innerHeight;
      setSz({ w: width, h: height });
    };
    
    updateSize();
    
    // ResizeObserver callback - updates immediately
    const ro = new ResizeObserver(() => {
      updateSize();
    });
    ro.observe(el);
    
    return () => {
      ro.disconnect();
    };
  }, []);

  // Track mouse position for parallax and tilt effects
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const el = sceneRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    const handleMouseEnter = () => {
      // Initialize mouse position to center when entering
      const el = sceneRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        setMousePos(prev => {
          if (prev.x < 0) {
            return {
              x: rect.width / 2,
              y: rect.height / 2,
            };
          }
          return prev;
        });
      }
    };

    const el = sceneRef.current;
    if (el) {
      el.addEventListener('mousemove', handleMouseMove, { passive: true });
      el.addEventListener('mouseenter', handleMouseEnter);
      return () => {
        el.removeEventListener('mousemove', handleMouseMove);
        el.removeEventListener('mouseenter', handleMouseEnter);
      };
    }
  }, []);

  // Use window dimensions as fallback if container size not available
  const effectiveW = sz.w > 0 ? sz.w : (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const effectiveH = sz.h > 0 ? sz.h : (typeof window !== 'undefined' ? window.innerHeight * 0.7 : 700);
  const hasValidSize = effectiveW > 0 && effectiveH > 0;

  const horizonY = useMemo(() => Math.round(effectiveH * 0.5), [effectiveH]);
  const vpL = { x: -effectiveW * 0.35, y: horizonY };
  const vpR = { x: effectiveW * 1.35, y: horizonY };
  const light = useMemo(
    () => ({ x: effectiveW * 0.5, y: effectiveH * 0.12 }),
    [effectiveW, effectiveH]
  );

  // Intro section position - background card near horizon
  const introCx = effectiveW * 0.5; // Centered horizontally
  // Position center so card extends just barely behind other cards
  // Cards are at effectiveH * 0.75, so position intro card to just reach behind them
  const introCy = effectiveH * 0.35; // Higher position
  const introW = Math.min(effectiveW * 1.7, 2400); // 2x larger: was 0.85, now 1.7, max 2400px
  const introH = 600; // Just tall enough to extend behind the cards
  const introToward = introCx < effectiveW / 2 ? vpL : vpR;
  const introScale = scaleFromHorizon(introCy, horizonY, effectiveH);
  const introSkew = 0; // No skew for background card
  const introShadow = shadowFor(introCx, introCy, horizonY, light, introScale * 0.9);
  // With transformOrigin center, translate to position the center of the scaled element
  const introTranslateX = introCx - introW / 2; // Center horizontally
  const introTranslateY = introCy - introH / 2; // Center vertically, extends downward

  return (
    <div className="min-h-screen bg-beige-gradient text-beige-text flex flex-col relative">
      <header className={`w-full max-w-5xl mx-auto px-4 sm:px-6 py-2 sm:py-3 md:py-4 lg:py-6 flex items-center justify-between flex-shrink-0 transition-opacity duration-300 relative z-10 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`} style={{ transitionDelay: shouldFadeOut ? '0ms' : '400ms' }}>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-lemonmilk font-semibold tracking-tight">andyxu</h1>

        <button
          ref={themeButtonRef}
          onClick={toggleTheme}
          aria-pressed={dark}
          className="rounded-2xl px-2.5 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 text-xs sm:text-sm md:text-base border border-black/10 dark:border-white/20
                     backdrop-blur
                     font-medium
                     hover:scale-[1.02] active:scale-[0.98] transition"
          style={{ 
            backgroundColor: dark ? '#ede5d8' : '#080808',
            color: dark ? '#2b2b2b' : '#ffffff',
            transition: 'background-color 0.3s ease-in-out, color 0.3s ease-in-out'
          }}
        >
          {dark ? 'Light mode' : 'Dark mode'}
        </button>
      </header>

      <main className="flex-1 w-full relative z-10" style={{ minHeight: '620px', height: '100%', overflow: 'visible' }} ref={sceneRef}>
        <div className="relative w-full h-full" style={{ minHeight: '620px', overflow: 'visible' }}>
          {/* Soft vignette */}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1200px_600px_at_50%_-20%,rgba(0,0,0,0.08),transparent_60%)] dark:bg-[radial-gradient(1200px_600px_at_50%_-20%,rgba(0,0,0,0.25),transparent_60%)]" />

          {/* Horizon divider */}
          <div
            className="absolute left-0 right-0 border-t border-black/10 dark:border-white/10"
            style={{ top: horizonY }}
          />

          {/* Perspective guide lines */}
          <svg
            className="pointer-events-none absolute inset-0"
            width={effectiveW}
            height={effectiveH}
            viewBox={`0 0 ${effectiveW} ${effectiveH}`}
          >
            <line
              x1={0}
              y1={horizonY}
              x2={vpL.x}
              y2={vpL.y}
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeDasharray="6 8"
            />
            <line
              x1={sz.w}
              y1={horizonY}
              x2={vpR.x}
              y2={vpR.y}
              stroke="currentColor"
              strokeOpacity="0.25"
              strokeDasharray="6 8"
            />
          </svg>

          {/* Intro section with perspective - background card */}
          {hasValidSize && (
          <>
            {/* 3D ground shadow for intro card */}
            <div
              className="absolute pointer-events-none"
              style={{
                width: introW * introScale * 1.8, // Shadow is much wider than card to encompass full width
                height: introW * introScale * 0.6, // Shadow height (ellipse)
                top: 0,
                left: 0,
                transformOrigin: 'center center',
                // Position shadow below the card, centered and closer (lower) for perspective
                transform: `
                  translate(${introCx - (introW * introScale * 1.8) / 2}px, ${introTranslateY + introH * introScale * 0.5 - 20}px) 
                  scale(${introScale}) 
                  scaleY(0.25) 
                  skewY(-2deg)
                `,
                background: `radial-gradient(ellipse, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.45) 30%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.1) 85%, transparent 100%)`,
                borderRadius: '50%',
                zIndex: 0, // Behind everything
                filter: 'blur(25px)',
                opacity: shouldFadeOut ? 0 : (isVisible ? 1 : 0),
                transitionDelay: shouldFadeOut ? '100ms' : '450ms',
                transition: 'opacity 0.3s ease-in-out, transform 0.1s ease-out'
              }}
            />
            <section
              className={`absolute rounded-2xl p-6 sm:p-8 md:p-10 lg:p-12 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md border border-black/5 dark:border-white/10 transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
              style={{
                width: introW,
                height: introH,
                top: 0,
                left: 0,
                transformOrigin: 'center center',
                transform: `translate(${introTranslateX}px, ${introTranslateY}px) scale(${introScale})`,
                boxShadow: `${introShadow.offsetX}px ${introShadow.offsetY}px ${introShadow.blur}px rgba(0,0,0,${introShadow.alpha})`,
                backgroundColor: dark ? 'rgba(16, 16, 16, 1)' : '#FFB38A',
                borderRadius: '1.25rem',
                zIndex: 1, // Behind the other cards (they have z-index 10)
                transitionDelay: shouldFadeOut ? '100ms' : '450ms',
                transition: 'background-color 0.3s ease-in-out, opacity 0.3s ease-in-out'
              }}
            >
            <div className="flex flex-col md:flex-row gap-12 md:gap-16 lg:gap-20 items-center justify-center h-full">
              <div className="flex-1 w-full md:w-auto text-center md:text-left">
                <h2 className="text-6xl sm:text-8xl md:text-10xl lg:text-12xl font-bold mb-6 sm:mb-8">Hello, I&apos;m Andy!</h2>
                <p className="opacity-90 leading-relaxed text-2xl sm:text-3xl md:text-4xl">I'm a current CMU senior studying Business + CS. I'm interested in building AI products and working on something meaningful. In the past, I've worked as an AI Engineer at IBM.</p>
              </div>
              <div className="w-full md:w-auto flex justify-center md:justify-start">
                <img src={portrait2} alt="Portrait" className="rounded-2xl w-80 h-80 sm:w-96 sm:h-96 md:w-[28rem] md:h-[28rem] lg:w-[32rem] lg:h-[32rem] object-cover" />
              </div>
            </div>
          </section>
          </>
          )}

          {/* Cards with perspective */}
          {hasValidSize && cards.map((c, index) => {
            const cardPositions = [
              { xPct: 0.2, yPct: 0.78 },
              { xPct: 0.5, yPct: 0.78 },
              { xPct: 0.8, yPct: 0.78 },
            ];
            const pos = cardPositions[index] || { xPct: 0.5, yPct: 0.78 };
            
            // Base position (aligned at same y) - moved up a bit to prevent cutoff
            const baseY = effectiveH * 0.75; // All cards at same y position
            const baseX = pos.xPct * effectiveW;
            
            // Parallax effect: cards move based on cursor position
            // Cards further from center move more
            const parallaxStrength = 0.3; // Adjust for more/less parallax
            
            let cardOffsetX = 0;
            let cardOffsetY = 0;
            let cursorSkewY = 0;
            
            if (mousePos.x >= 0 && mousePos.y >= 0) {
              const mouseXNormalized = (mousePos.x / effectiveW - 0.5) * 2; // -1 to 1
              const mouseYNormalized = (mousePos.y / effectiveH - 0.5) * 2; // -1 to 1
              
              // Each card moves differently based on its position
              cardOffsetX = (baseX / effectiveW - 0.5) * parallaxStrength * mouseXNormalized * 30;
              cardOffsetY = mouseYNormalized * parallaxStrength * 15;
              
              // Remove vertical skew - cards should not tilt based on mouse Y position
              // Only apply horizontal effects, no vertical tilting
              cursorSkewY = 0;
            }
            
            const cx = baseX + cardOffsetX;
            const cy = baseY + cardOffsetY;
            
            // Base scale from horizon
            const baseScale = scaleFromHorizon(cy, horizonY, effectiveH);
            
            // Cursor-based scaling: cards closer to cursor get bigger
            // When mouse is on left, Projects (index 0) should be biggest
            // When mouse is on right, About Me (index 2) should be biggest
            const scaleBoost = 0.25; // How much bigger cards can get
            
            // Cursor-based scaling - always apply if we have valid dimensions
            let finalScaleFactor = 1;
            if (effectiveW > 0 && effectiveH > 0) {
              // Use center as default if mouse hasn't moved yet
              const currentMouseX = mousePos.x >= 0 ? mousePos.x : effectiveW / 2;
              
              // Normalize mouse X position (0 to 1)
              const mouseXNormalized = Math.max(0, Math.min(1, currentMouseX / effectiveW));
              
              if (index === 0) { // Projects (left card)
                // Bigger when mouse is on left side
                // Map: mouse at 0 (left) -> scale 1.25, mouse at 1 (right) -> scale 0.9
                finalScaleFactor = 1 + scaleBoost * (1 - mouseXNormalized * 1.4);
              } else if (index === 2) { // About Me (right card)
                // Bigger when mouse is on right side
                // Map: mouse at 0 (left) -> scale 0.9, mouse at 1 (right) -> scale 1.25
                finalScaleFactor = 1 + scaleBoost * (mouseXNormalized * 1.4 - 0.4);
              } else { // Fun (middle card)
                // Largest when mouse is near middle (0.5), smoothly decreases as mouse moves away
                // Use a bell curve-like function: peak at 0.5, decreases as distance from center increases
                const distanceFromCenter = Math.abs(mouseXNormalized - 0.5); // 0 to 0.5
                const normalizedDistance = distanceFromCenter * 2; // 0 to 1 (0 = center, 1 = edge)
                // Scale factor: 1.25 at center, 0.9 at edges, smooth transition
                finalScaleFactor = 1 + scaleBoost * (1 - normalizedDistance * 1.4);
              }
              
              // Clamp scale factor to reasonable bounds
              finalScaleFactor = Math.max(0.9, Math.min(1.25, finalScaleFactor));
            }
            
            const s = baseScale * finalScaleFactor;
            
            // Start with no base skew - all cards face forward
            // Only apply cursor-based skew
            const finalSkew = cursorSkewY;
            
            const { offsetX, offsetY, blur, alpha } = shadowFor(cx, cy, horizonY, light, s);
            
            const cardW = Math.min(420, effectiveW * 0.32); // Bigger cards
            const cardH = 220; // Taller cards
            // Position card center at (cx, cy), then apply scale and skew
            const translateX = cx;
            const translateY = cy;

            const CardContent = (
              <>
                <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-1">{c.title}</h3>
                <p className="opacity-80 text-xs sm:text-sm md:text-base">{c.desc}</p>
              </>
            );

            const cardStyle: React.CSSProperties = {
              width: cardW,
              height: cardH,
              top: 0,
              left: 0,
              transformOrigin: 'center center',
              transform: `translate(${translateX - cardW/2}px, ${translateY - cardH/2}px) scale(${s}) skewY(${finalSkew}deg)`,
              boxShadow: `${offsetX}px ${offsetY}px ${blur}px rgba(0,0,0,${alpha})`,
              backgroundColor: dark ? 'rgba(16, 16, 16, 1)' : '#FFB38A',
              zIndex: 10,
              transition: 'transform 0.1s ease-out, background-color 0.4s ease-in-out',
            };

            // Perspective shadow calculation
            // Shadow should be an ellipse positioned below the card
            const shadowOffsetY = cardH * s * 0.5 + 10; // Position shadow below card
            const shadowWidth = cardW * s * 1.2; // Shadow is wider than card
            const shadowHeight = cardH * s * 0.4; // Shadow is shorter (ellipse)
            const shadowSkew = finalSkew; // Shadow follows card's skew
            // Shadow opacity based on scale - bigger cards have darker shadows
            const shadowOpacity = 0.5 * finalScaleFactor; // More apparent shadows
            
            const shadowStyle: React.CSSProperties = {
              position: 'absolute',
              width: shadowWidth,
              height: shadowHeight,
              top: 0,
              left: 0,
              transformOrigin: 'center center',
              transform: `translate(${translateX - shadowWidth/2}px, ${translateY + shadowOffsetY}px) skewY(${shadowSkew}deg) scaleY(0.5)`,
              background: `radial-gradient(ellipse, rgba(0,0,0,${shadowOpacity}) 0%, rgba(0,0,0,${shadowOpacity * 0.5}) 50%, transparent 100%)`,
              borderRadius: '50%',
              zIndex: 1,
              pointerEvents: 'none',
              transition: 'transform 0.1s ease-out, opacity 0.1s ease-out',
            };

            return (
              <div key={c.title} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
                {/* Perspective shadow */}
                <div style={shadowStyle} />
                
                {c.link ? (
                  c.link.startsWith('/') ? (
                    <TransitionLink
                      to={c.link}
                      className={`absolute rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 border border-black/5 dark:border-white/10 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md cursor-pointer transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : 'opacity-100'}`}
                      style={{
                        ...cardStyle,
                        pointerEvents: 'auto',
                        transitionDelay: shouldFadeOut ? `${100 + index * 50}ms` : `${500 + index * 50}ms`,
                        transition: 'opacity 0.2s ease-in-out, transform 0.1s ease-out, background-color 0.4s ease-in-out'
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                        if (dark) {
                          e.currentTarget.style.setProperty('background-color', 'rgba(60, 60, 60, 0.85)', 'important');
                        } else {
                          e.currentTarget.style.setProperty('background-color', '#F59E74', 'important');
                        }
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                        // Restore original background color
                        e.currentTarget.style.setProperty('background-color', dark ? 'rgba(16, 16, 16, 1)' : '#FFB38A', 'important');
                      }}
                    >
                      {CardContent}
                    </TransitionLink>
                  ) : (
                    <a
                      href={c.link}
                      target={typeof c.link === 'string' && c.link.startsWith('http') ? '_blank' : undefined}
                      rel={typeof c.link === 'string' && c.link.startsWith('http') ? 'noreferrer' : undefined}
                      className={`absolute rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 border border-black/5 dark:border-white/10 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md cursor-pointer transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : 'opacity-100'}`}
                      style={{
                        ...cardStyle,
                        pointerEvents: 'auto',
                        transitionDelay: shouldFadeOut ? `${100 + index * 50}ms` : `${500 + index * 50}ms`,
                        transition: 'opacity 0.2s ease-in-out, transform 0.1s ease-out, background-color 0.4s ease-in-out'
                      }}
                      ref={(el) => {
                        if (el) {
                          el.style.setProperty('background-color', dark ? 'rgba(16, 16, 16, 1)' : '#FFB38A', 'important');
                        }
                      }}
                      onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                        if (dark) {
                          e.currentTarget.style.setProperty('background-color', 'rgba(60, 60, 60, 0.85)', 'important');
                        } else {
                          e.currentTarget.style.setProperty('background-color', '#F59E74', 'important');
                        }
                      }}
                      onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                        e.currentTarget.style.setProperty('background-color', dark ? 'rgba(16, 16, 16, 1)' : '#FFB38A', 'important');
                      }}
                    >
                      {CardContent}
                    </a>
                  )
                ) : (
                  <div
                    className={`absolute rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 border border-black/5 dark:border-white/10 backdrop-blur supports-[backdrop-filter]:backdrop-blur-md transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : 'opacity-100'}`}
                    style={{
                      ...cardStyle,
                      pointerEvents: 'auto',
                      transitionDelay: shouldFadeOut ? `${100 + index * 50}ms` : `${500 + index * 50}ms`,
                      transition: 'opacity 0.2s ease-in-out, transform 0.1s ease-out, background-color 0.4s ease-in-out'
                    }}
                    ref={(el) => {
                      if (el) {
                        el.style.setProperty('background-color', dark ? 'rgba(16, 16, 16, 0.7)' : 'rgba(255, 255, 250, 0.7)', 'important');
                      }
                    }}
                    onMouseEnter={(e: React.MouseEvent<HTMLDivElement>) => {
                      if (dark) {
                        e.currentTarget.style.setProperty('background-color', 'rgba(60, 60, 60, 0.85)', 'important');
                      } else {
                        e.currentTarget.style.setProperty('background-color', '#F59E74', 'important');
                      }
                    }}
                    onMouseLeave={(e: React.MouseEvent<HTMLDivElement>) => {
                      e.currentTarget.style.setProperty('background-color', dark ? 'rgba(16, 16, 16, 0.7)' : 'rgba(255, 255, 250, 0.7)', 'important');
                    }}
                  >
                    {CardContent}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      <footer className={`w-full max-w-5xl mx-auto px-4 sm:px-6 py-2 sm:py-3 md:py-4 lg:py-6 flex-shrink-0 transition-opacity duration-300 relative z-10 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`} style={{ transitionDelay: shouldFadeOut ? '300ms' : '600ms' }}>
        <div className="flex flex-wrap gap-2 sm:gap-2.5 md:gap-3 justify-center mb-2 sm:mb-3 md:mb-4 lg:mb-6">
          <a href="https://github.com/ayzxu" target="_blank" rel="noreferrer"
             className="rounded-xl p-2 sm:p-2.5 md:p-3 border-2 border-black dark:border-white/15 hover:scale-105 transition-transform"
             style={{ 
               backgroundColor: dark ? '#000000' : '#ffffff',
               transition: 'background-color 0.3s ease-in-out, transform 0.3s ease-in-out'
             }}
             key={`github-${dark}`}
             onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
               if (dark) {
                 // Dark mode: lighten to lighter gray
                 e.currentTarget.style.backgroundColor = 'rgba(60, 60, 60, 1)';
               } else {
                 // Light mode: darken
                 e.currentTarget.style.backgroundColor = 'rgba(220, 210, 195, 1)';
               }
             }}
             onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
               // Reset to original
               e.currentTarget.style.backgroundColor = dark ? '#000000' : '#ffffff';
             }}>
            <img src={dark ? githubWhiteIcon : githubIcon} alt="GitHub" className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </a>
          <a href="https://www.linkedin.com/in/ayzxu/" target="_blank" rel="noreferrer"
             className="rounded-xl p-2 sm:p-2.5 md:p-3 border-2 border-black dark:border-white/15 hover:scale-105 transition-transform"
             style={{ 
               backgroundColor: dark ? '#000000' : '#ffffff',
               transition: 'background-color 0.3s ease-in-out, transform 0.3s ease-in-out'
             }}
             key={`linkedin-${dark}`}
             onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
               if (dark) {
                 // Dark mode: lighten to lighter gray
                 e.currentTarget.style.backgroundColor = 'rgba(60, 60, 60, 1)';
               } else {
                 // Light mode: darken
                 e.currentTarget.style.backgroundColor = 'rgba(220, 210, 195, 1)';
               }
             }}
             onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
               // Reset to original
               e.currentTarget.style.backgroundColor = dark ? '#000000' : '#ffffff';
             }}>
            <img src={linkedinIcon} alt="LinkedIn" className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </a>
          <a href="mailto:andyxu@cmu.edu"
             className="rounded-xl p-2 sm:p-2.5 md:p-3 border-2 border-black dark:border-white/15 hover:scale-105 transition-transform"
             style={{ 
               backgroundColor: dark ? '#000000' : '#ffffff',
               transition: 'background-color 0.3s ease-in-out, transform 0.3s ease-in-out'
             }}
             key={`email-${dark}`}
             onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
               if (dark) {
                 // Dark mode: lighten to lighter gray
                 e.currentTarget.style.backgroundColor = 'rgba(60, 60, 60, 1)';
               } else {
                 // Light mode: darken
                 e.currentTarget.style.backgroundColor = 'rgba(220, 210, 195, 1)';
               }
             }}
             onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
               // Reset to original
               e.currentTarget.style.backgroundColor = dark ? '#000000' : '#ffffff';
             }}>
            <img src={emailIcon} alt="Email" className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </a>
        </div>
        <p className="opacity-70 text-center text-xs sm:text-sm md:text-base">© {year} Andy Xu</p>
      </footer>
    </div>
  );
}

