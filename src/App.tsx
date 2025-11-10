import { useEffect, useMemo, useState } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import githubIcon from './assets/github.png';
import linkedinIcon from './assets/linkedin.png';
import emailIcon from './assets/email.png';
import portrait2 from './assets/portrait2.jpg';
import resume from './assets/Xu_Andy Resume.pdf';
import Projects from './Projects';

type Card = { title: string; desc: string; link?: string };

export default function App() {
  const [dark, setDark] = useState(false);

  // Hydrate from saved theme or system
  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark') setDark(true);
    else if (saved === 'light') setDark(false);
    else setDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
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
    { title: 'Fun',  desc: 'What I do outside of work and school: Gym, Volleyball, Art' },
    { title: 'Talks',    desc: 'Boards, pitches, and workshops.' },
    { title: 'Contact',  desc: 'Freelance, collaborations, coffee.', link: resume },
  ];

  const year = useMemo(() => new Date().getFullYear(), []);

  const location = useLocation();
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayLocation, setDisplayLocation] = useState(location.pathname);
  const [shouldFadeOut, setShouldFadeOut] = useState(false);

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

  return (
    <div className="page-transition-container bg-beige-gradient min-h-screen">
      <Routes location={{ pathname: displayLocation } as any} key={displayLocation}>
        <Route path="/projects" element={<Projects isTransitioning={isTransitioning} shouldFadeOut={shouldFadeOut} />} />
        <Route path="/" element={<Home dark={dark} toggleTheme={toggleTheme} cards={cards} year={year} isTransitioning={isTransitioning} shouldFadeOut={shouldFadeOut} />} />
      </Routes>
    </div>
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
    <div className="min-h-screen bg-beige-gradient text-beige-text">
      <header className={`max-w-5xl mx-auto px-6 py-8 flex items-center justify-between transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`} style={{ transitionDelay: shouldFadeOut ? '0ms' : '400ms' }}>
        <h1 className="text-2xl font-semibold tracking-tight">andyxu</h1>

        <button
          onClick={toggleTheme}
          aria-pressed={dark}
          className="rounded-2xl px-4 py-2 border border-black/10 dark:border-white/20
                     bg-white/60 dark:bg-gray-800/90 backdrop-blur
                     text-black dark:text-white font-medium
                     hover:scale-[1.02] active:scale-[0.98] transition"
        >
          {dark ? 'Light mode' : 'Dark mode'}
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-24">
        <section
          className={`rounded-2xl p-8 md:p-12 shadow-lg bg-beige-surface-70 transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
          style={{ borderRadius: '1.25rem', boxShadow: '0 8px 30px rgba(0,0,0,0.08)', transitionDelay: shouldFadeOut ? '100ms' : '450ms' }}
        >
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex-1">
              <h2 className="text-3xl md:text-4xl font-bold mb-3">Hello, I&apos;m Andy Xu!</h2>
              <p className="opacity-90 leading-relaxed">I'm a current CMU senior studying Business + CS. I'm interested in building AI products and working on something meaningful. In the past, I've worked as an AI Engineer at IBM.</p>
            </div>
            <div>
              <img src={portrait2} alt="Portrait" className="rounded-2xl w-64 h-64 object-cover" />
            </div>
          </div>
        </section>

        <section className={`mt-10 grid gap-6 md:grid-cols-2 transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`} style={{ transitionDelay: shouldFadeOut ? '200ms' : '500ms' }}>
          {cards.map((c, index) => {
            const CardContent = (
              <>
                <h3 className="text-xl font-semibold mb-1">{c.title}</h3>
                <p className="opacity-80">{c.desc}</p>
              </>
            );

            const fadeDelay = shouldFadeOut ? `${100 + index * 50}ms` : `${500 + index * 50}ms`;
            
            return c.link ? (
              c.link.startsWith('/') ? (
                <TransitionLink key={c.title}
                      to={c.link}
                      className={`rounded-2xl p-6 border border-black/5 dark:border-white/10
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
                   className={`rounded-2xl p-6 border border-black/5 dark:border-white/10
                              bg-white/70
                              hover:translate-y-[-2px] transition-all duration-[2000ms] ease-in-out
                              cursor-pointer block transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
                   style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)', transitionDelay: fadeDelay }}>
                  {CardContent}
                </a>
              )
            ) : (
              <div key={c.title}
                   className={`rounded-2xl p-6 border border-black/5 dark:border-white/10
                              bg-white/70
                              hover:translate-y-[-2px] transition-all duration-[2000ms] ease-in-out transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
                   style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)', transitionDelay: fadeDelay }}>
                {CardContent}
              </div>
            );
          })}
        </section>
      </main>

      <footer className={`max-w-5xl mx-auto px-6 pb-10 transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`} style={{ transitionDelay: shouldFadeOut ? '300ms' : '600ms' }}>
        <div className="flex flex-wrap gap-3 justify-center mb-6">
          <a href="https://github.com/ayzxu" target="_blank" rel="noreferrer"
             className="rounded-xl p-3 border-2 border-black dark:border-white/15 bg-black dark:bg-white hover:scale-105 transition-transform">
            <img src={githubIcon} alt="GitHub" className="w-6 h-6" />
          </a>
          <a href="https://www.linkedin.com/in/ayzxu/" target="_blank" rel="noreferrer"
             className="rounded-xl p-3 border-2 border-black dark:border-white/15 hover:scale-105 transition-transform">
            <img src={linkedinIcon} alt="LinkedIn" className="w-6 h-6" />
          </a>
          <a href="mailto:andyxu@cmu.edu"
             className="rounded-xl p-3 border-2 border-black dark:border-white/15 hover:scale-105 transition-transform">
            <img src={emailIcon} alt="Email" className="w-6 h-6" />
          </a>
        </div>
        <p className="opacity-70 text-center">© {year} Andy Xu</p>
      </footer>
    </div>
  );
}
