import { useEffect, useMemo, useState } from 'react';
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

type Card = { title: string; desc: string; link?: string };

// Initialize theme synchronously before component renders
function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function App() {
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

  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayLocation, setDisplayLocation] = useState(location.pathname);
  const [shouldFadeOut, setShouldFadeOut] = useState(false);

  // Sync theme state when navigating back to home from other pages
  useEffect(() => {
    if (location.pathname === '/') {
      const saved = localStorage.getItem('theme');
      const currentDark = saved === 'dark' ? true : saved === 'light' ? false : window.matchMedia('(prefers-color-scheme: dark)').matches;
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
          <Route path="/" element={<Home dark={dark} toggleTheme={toggleTheme} cards={cards} year={year} isTransitioning={isTransitioning} shouldFadeOut={shouldFadeOut} />} />
        </Routes>
      </div>
    </OverlayScrollbarsComponent>
  );
}

function TransitionLink({ to, children, className, style }: { to: string; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (location.pathname === to) return;
    navigate(to);
  };

  return (
    <a href={to} onClick={handleClick} className={className} style={style}>
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

  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), isTransitioning ? 400 : 10);
    return () => clearTimeout(timer);
  }, [location.pathname, isTransitioning]);

  return (
    <div className="min-h-screen bg-beige-gradient text-beige-text flex flex-col">
      <header className={`w-full max-w-5xl mx-auto px-4 sm:px-6 py-2 sm:py-3 md:py-4 lg:py-6 flex items-center justify-between flex-shrink-0 transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`} style={{ transitionDelay: shouldFadeOut ? '0ms' : '400ms' }}>
        <h1 className="text-lg sm:text-xl md:text-2xl font-semibold tracking-tight">andyxu</h1>

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

      <main className="max-w-5xl mx-auto px-4 sm:px-6 flex-1 w-full flex items-center min-h-0">
        <div className="w-full">
          <section
            className={`rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 shadow-lg bg-beige-surface-70 transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
            style={{ borderRadius: '1.25rem', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', transitionDelay: shouldFadeOut ? '100ms' : '450ms' }}
          >
            <div className="flex flex-col md:flex-row gap-4 md:gap-6 lg:gap-8 items-start">
              <div className="flex-1 w-full md:w-auto">
                <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold mb-2 sm:mb-3">Hello, I&apos;m Andy Xu!</h2>
                <p className="opacity-90 leading-relaxed text-xs sm:text-sm md:text-base">I'm a current CMU senior studying Business + CS. I'm interested in building AI products and working on something meaningful. In the past, I've worked as an AI Engineer at IBM.</p>
              </div>
              <div className="w-full md:w-auto flex justify-center md:justify-start">
                <img src={portrait2} alt="Portrait" className="rounded-2xl w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48 lg:w-56 lg:h-56 object-cover" />
              </div>
            </div>
          </section>

          <section className={`mt-4 sm:mt-5 md:mt-6 lg:mt-8 grid gap-3 sm:gap-4 md:gap-5 lg:gap-6 grid-cols-3 transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`} style={{ transitionDelay: shouldFadeOut ? '200ms' : '500ms' }}>
          {cards.map((c, index) => {
            const CardContent = (
              <>
                <h3 className="text-base sm:text-lg md:text-xl font-semibold mb-1">{c.title}</h3>
                <p className="opacity-80 text-xs sm:text-sm md:text-base">{c.desc}</p>
              </>
            );

            const fadeDelay = shouldFadeOut ? `${100 + index * 50}ms` : `${500 + index * 50}ms`;
            
            return c.link ? (
              c.link.startsWith('/') ? (
                <TransitionLink key={c.title}
                      to={c.link}
                      className={`rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 border border-black/5 dark:border-white/10
                                 bg-white/70
                                 hover:translate-y-[-2px] transition-all duration-[2000ms] ease-in-out
                                 cursor-pointer block transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
                      style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)', transitionDelay: fadeDelay }}>
                  {CardContent}
                </TransitionLink>
              ) : (
                <a key={c.title}
                   href={c.link}
                   target={typeof c.link === 'string' && c.link.startsWith('http') ? '_blank' : undefined}
                   rel={typeof c.link === 'string' && c.link.startsWith('http') ? 'noreferrer' : undefined}
                   download={typeof c.link === 'string' && c.link.endsWith('.pdf') ? true : c.title === 'Contact' ? true : undefined}
                   className={`rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 border border-black/5 dark:border-white/10
                              bg-white/70
                              hover:translate-y-[-2px] transition-all duration-[2000ms] ease-in-out
                              cursor-pointer block transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
                   style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)', transitionDelay: fadeDelay }}>
                  {CardContent}
                </a>
              )
            ) : (
              <div key={c.title}
                   className={`rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 border border-black/5 dark:border-white/10
                              bg-white/70
                              hover:translate-y-[-2px] transition-all duration-[2000ms] ease-in-out transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
                   style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)', transitionDelay: fadeDelay }}>
                {CardContent}
              </div>
            );
          })}
          </section>
        </div>
      </main>

      <footer className={`w-full max-w-5xl mx-auto px-4 sm:px-6 py-2 sm:py-3 md:py-4 lg:py-6 flex-shrink-0 transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`} style={{ transitionDelay: shouldFadeOut ? '300ms' : '600ms' }}>
        <div className="flex flex-wrap gap-2 sm:gap-2.5 md:gap-3 justify-center mb-2 sm:mb-3 md:mb-4 lg:mb-6">
          <a href="https://github.com/ayzxu" target="_blank" rel="noreferrer"
             className="rounded-xl p-2 sm:p-2.5 md:p-3 border-2 border-black dark:border-white/15 hover:scale-105 transition-transform"
             style={{ backgroundColor: dark ? '#000000' : '#ffffff' }}>
            <img src={dark ? githubWhiteIcon : githubIcon} alt="GitHub" className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </a>
          <a href="https://www.linkedin.com/in/ayzxu/" target="_blank" rel="noreferrer"
             className="rounded-xl p-2 sm:p-2.5 md:p-3 border-2 border-black dark:border-white/15 hover:scale-105 transition-transform"
             style={{ backgroundColor: dark ? '#000000' : '#ffffff' }}>
            <img src={linkedinIcon} alt="LinkedIn" className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </a>
          <a href="mailto:andyxu@cmu.edu"
             className="rounded-xl p-2 sm:p-2.5 md:p-3 border-2 border-black dark:border-white/15 hover:scale-105 transition-transform"
             style={{ backgroundColor: dark ? '#000000' : '#ffffff' }}>
            <img src={emailIcon} alt="Email" className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
          </a>
        </div>
        <p className="opacity-70 text-center text-xs sm:text-sm md:text-base">© {year} Andy Xu</p>
      </footer>
    </div>
  );
}
