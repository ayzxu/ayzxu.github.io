import { useEffect, useMemo, useState, useRef, useLayoutEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { OverlayScrollbarsComponent } from 'overlayscrollbars-react';
import githubIcon from './assets/icons/github.png';
import githubWhiteIcon from './assets/icons/githubwhite.png';
import linkedinIcon from './assets/icons/linkedin.png';
import emailIcon from './assets/icons/email.png';
import portrait2 from './assets/portraits/portrait2.jpg';
import Projects from './Projects';
import About from './About';
import Fun from './Fun';
import Test from './Test';
// Preload large video files used in Fun page
import gymVideo1 from './assets/gym/IMG_6232.mov';
import gymVideo2 from './assets/gym/IMG_6418.MOV';
import volleyballVideo1 from './assets/volleyball/VB1.mov';

type Card = { title: string; desc: string; link?: string };

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function scaleFromHorizon(cy: number, horizon: number, height: number) {
  const d = clamp((cy - horizon) / height, -0.5, 0.6);
  return 0.75 + d * 0.9;
}

// Initialize theme synchronously before component renders
function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return true; // Default to dark mode
}

export default function App() {
  const [dark, setDark] = useState(getInitialTheme);

  // Preload large video files when app loads
  useEffect(() => {
    const videos = [gymVideo1, gymVideo2, volleyballVideo1];
    videos.forEach((videoSrc) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'video';
      link.href = videoSrc;
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    });
  }, []);

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

  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayLocation, setDisplayLocation] = useState(location.pathname);
  const [shouldFadeOut, setShouldFadeOut] = useState(false);

  // Sync theme state when navigating back to home from other pages
  useEffect(() => {
    if (location.pathname === '/') {
      const saved = localStorage.getItem('theme');
      const currentDark = saved === 'dark' ? true : saved === 'light' ? false : true; // Default to dark mode
      if (currentDark !== dark) {
        setDark(currentDark);
      }
    }
  }, [location.pathname, dark]);

  useEffect(() => {
    if (location.pathname !== displayLocation) {
      // Start fade-out
      setShouldFadeOut(true);
      setIsTransitioning(true);
      // Wait for fade-out (400ms) then update location and fade in
      const timer = setTimeout(() => {
        setDisplayLocation(location.pathname);
        setShouldFadeOut(false);
        setIsTransitioning(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, displayLocation]);

  const scrollbarOptions = {
    scrollbars: {
      theme: 'os-theme-dark',
      autoHide: 'never' as const,
      autoHideDelay: 0,
    },
    overflow: {
      x: 'hidden' as const,
      y: 'scroll' as const,
    },
  };

  return (
    <OverlayScrollbarsComponent options={scrollbarOptions} className="h-screen">
      <div className="page-transition-container bg-beige-gradient min-h-screen">
        <Routes location={{ pathname: displayLocation } as any} key={displayLocation}>
          <Route path="/projects" element={<Projects isTransitioning={isTransitioning} shouldFadeOut={shouldFadeOut} />} />
          <Route path="/fun" element={<Fun isTransitioning={isTransitioning} shouldFadeOut={shouldFadeOut} />} />
          <Route path="/about" element={<About isTransitioning={isTransitioning} shouldFadeOut={shouldFadeOut} />} />
          <Route path="/test" element={<Test />} />
          <Route path="/" element={<Home dark={dark} toggleTheme={toggleTheme} cards={cards} year={year} isTransitioning={isTransitioning} shouldFadeOut={shouldFadeOut} />} />
        </Routes>
      </div>
    </OverlayScrollbarsComponent>
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
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();
  const cardsSectionRef = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState({ w: 0, h: 0 });
  const [mousePos, setMousePos] = useState(() => ({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
  }));

  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), isTransitioning ? 400 : 10);
    return () => clearTimeout(timer);
  }, [location.pathname, isTransitioning]);

  // Track container size
  useLayoutEffect(() => {
    const el = cardsSectionRef.current;
    if (!el) return;
    
    const updateSize = () => {
      const width = el.clientWidth || window.innerWidth;
      const height = el.clientHeight || window.innerHeight;
      setSz({ w: width, h: height });
    };
    
    updateSize();
    
    const ro = new ResizeObserver(() => {
      updateSize();
    });
    ro.observe(el);
    
    return () => {
      ro.disconnect();
    };
  }, []);

  // Track mouse position globally
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: e.clientX,
        y: e.clientY,
      });
    };

    // Initialize to center of screen
    setMousePos({
      x: typeof window !== 'undefined' ? window.innerWidth / 2 : 0,
      y: typeof window !== 'undefined' ? window.innerHeight / 2 : 0,
    });

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return (
    <div className="min-h-screen bg-beige-gradient text-beige-text flex flex-col relative">
      <header className={`w-full max-w-5xl mx-auto px-4 sm:px-6 py-2 sm:py-3 md:py-4 lg:py-6 flex items-center justify-between flex-shrink-0 transition-opacity duration-300 relative z-10 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`} style={{ transitionDelay: shouldFadeOut ? '0ms' : '400ms' }}>
        <h1 className="text-lg sm:text-xl md:text-2xl font-lemonmilk font-semibold tracking-tight">andyxu</h1>

        <button
          onClick={toggleTheme}
          aria-pressed={dark}
          className="rounded-2xl px-2.5 py-1 sm:px-3 sm:py-1.5 md:px-4 md:py-2 text-xs sm:text-sm md:text-base border border-black/10 dark:border-white/20
                     backdrop-blur
                     font-medium
                     hover:scale-[1.02] active:scale-[0.98] transition"
          style={{ 
            backgroundColor: dark ? '#ede5d8' : '#080808',
            color: dark ? '#2b2b2b' : '#ffffff'
          }}
        >
          {dark ? 'Light mode' : 'Dark mode'}
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 flex-1 w-full flex items-center min-h-0 relative z-10">
        <div className="w-full">
          <section
            className={`rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 shadow-lg bg-beige-surface-70 transition-opacity duration-300 relative z-10 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
            style={{ borderRadius: '1.25rem', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', transitionDelay: shouldFadeOut ? '100ms' : '450ms' }}
          >
            <div className="flex flex-col md:flex-row gap-4 md:gap-6 lg:gap-8 items-start">
              <div className="flex-1 w-full md:w-auto">
                <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3">Hello, I&apos;m Andy!</h2>
                <p className="opacity-90 leading-relaxed text-xs sm:text-sm md:text-base">I'm a current CMU senior studying Business + CS. I'm interested in building AI products and working on something meaningful.
                   <br /> In the past, I've worked as an AI Engineer at IBM.</p>
              </div>
              <div className="w-full md:w-auto flex justify-center md:justify-start">
                <img src={portrait2} alt="Portrait" className="rounded-2xl w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 object-cover" />
              </div>
            </div>
          </section>

          <section 
            ref={cardsSectionRef}
            className={`mt-2 sm:mt-2 md:mt-3 lg:mt-3 relative transition-opacity duration-300 z-10 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`} 
            style={{ 
              transitionDelay: shouldFadeOut ? '200ms' : '500ms',
              minHeight: '260px',
              height: '260px'
            }}
          >
          {cards.map((c, index) => {
            const CardContent = (
              <>
                <h3 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-semibold mb-1">{c.title}</h3>
                <p className="opacity-80 text-sm sm:text-base md:text-lg lg:text-xl">{c.desc}</p>
              </>
            );

            const fadeDelay = shouldFadeOut ? `${100 + index * 50}ms` : `${500 + index * 50}ms`;
            
            // Calculate card position and scale
            const effectiveW = sz.w > 0 ? sz.w : (typeof window !== 'undefined' ? window.innerWidth : 1200);
            const effectiveH = sz.h > 0 ? sz.h : 260;
            const hasValidSize = effectiveW > 0 && effectiveH > 0;
            
            // Card positions: left, center, right
            const cardPositions = [
              { xPct: 0.166, yPct: 0.5 }, // Left card
              { xPct: 0.5, yPct: 0.5 },   // Center card
              { xPct: 0.834, yPct: 0.5 }, // Right card
            ];
            const pos = cardPositions[index] || { xPct: 0.5, yPct: 0.5 };
            
            const baseX = pos.xPct * effectiveW;
            const baseY = pos.yPct * effectiveH;
            
            // Base scale from horizon (using center of container as horizon)
            const horizonY = effectiveH * 0.5;
            const baseScale = scaleFromHorizon(baseY, horizonY, effectiveH);
            
            // Cursor-based scaling: cards closer to cursor get bigger
            const scaleBoost = 0.1; // Reduced from 0.25 for more subtle effect
            const windowWidth = typeof window !== 'undefined' ? window.innerWidth : effectiveW;
            const mouseXNormalized = windowWidth > 0 ? Math.max(0, Math.min(1, mousePos.x / windowWidth)) : 0.5;
            
            let finalScaleFactor = 1;
            if (index === 0) { // Projects (left card)
              finalScaleFactor = 1 + scaleBoost * (1 - mouseXNormalized * 1.4);
            } else if (index === 2) { // About Me (right card)
              finalScaleFactor = 1 + scaleBoost * (mouseXNormalized * 1.4 - 0.4);
            } else { // Fun (middle card)
              const distanceFromCenter = Math.abs(mouseXNormalized - 0.5);
              const normalizedDistance = distanceFromCenter * 2;
              finalScaleFactor = 1 + scaleBoost * (1 - normalizedDistance * 1.4);
            }
            
            finalScaleFactor = Math.max(0.95, Math.min(1.1, finalScaleFactor));
            
            const finalScale = baseScale * finalScaleFactor;
            
            // Calculate card dimensions
            const cardW = Math.min(700, effectiveW * 0.4);
            const cardH = 220;
            
            // Calculate transform position (center of card)
            const translateX = baseX - cardW / 2;
            const translateY = baseY - cardH / 2;
            
            const cardStyle: React.CSSProperties = {
              position: 'absolute',
              width: cardW,
              height: cardH,
              top: 0,
              left: 0,
              transformOrigin: 'center center',
              transform: `translate(${translateX}px, ${translateY}px) scale(${finalScale})`,
              boxShadow: '0 8px 30px rgba(0,0,0,0.08)',
              transition: 'background-color 0.05s ease-in-out, opacity 0.3s ease-in-out',
            };
            
            return c.link ? (
              c.link.startsWith('/') ? (
                <TransitionLink 
                  key={c.title}
                  to={c.link}
                  className={`absolute rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 border border-black/5 dark:border-white/10
                             bg-white/70
                             cursor-pointer transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')} ${c.title === 'Projects' ? 'projects-card-hover' : ''}`}
                  style={{ 
                    ...cardStyle,
                    transitionProperty: 'background-color, opacity',
                    transitionDuration: '0.05s, 0.3s',
                    transitionDelay: `0s, ${fadeDelay}`,
                  }}
                  onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    if (c.title === 'Projects' || c.title === 'Fun' || c.title === 'About Me') {
                      if (dark) {
                        e.currentTarget.style.setProperty('background-color', 'rgba(60, 60, 60, 0.7)', 'important');
                      } else {
                        e.currentTarget.style.backgroundColor = 'rgba(220, 210, 195, 0.9)';
                      }
                    }
                  }}
                  onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => {
                    if (c.title === 'Projects' || c.title === 'Fun' || c.title === 'About Me') {
                      e.currentTarget.style.removeProperty('background-color');
                    }
                  }}>
                  {CardContent}
                </TransitionLink>
              ) : (
                <a 
                  key={c.title}
                  href={c.link}
                  target={typeof c.link === 'string' && c.link.startsWith('http') ? '_blank' : undefined}
                  rel={typeof c.link === 'string' && c.link.startsWith('http') ? 'noreferrer' : undefined}
                  download={typeof c.link === 'string' && c.link.endsWith('.pdf') ? true : c.title === 'Contact' ? true : undefined}
                  className={`absolute rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 border border-black/5 dark:border-white/10
                             bg-white/70
                             cursor-pointer transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
                  style={{ 
                    ...cardStyle,
                    transitionProperty: 'background-color, opacity',
                    transitionDuration: '0.05s, 0.3s',
                    transitionDelay: `0s, ${fadeDelay}`,
                  }}>
                  {CardContent}
                </a>
              )
            ) : (
              <div 
                key={c.title}
                className={`absolute rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 border border-black/5 dark:border-white/10
                           bg-white/70
                           transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
                style={{ 
                  ...cardStyle,
                  transitionProperty: 'background-color, opacity',
                  transitionDuration: '0.05s, 0.3s',
                  transitionDelay: `0s, ${fadeDelay}`,
                }}>
                {CardContent}
              </div>
            );
          })}
          </section>
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
