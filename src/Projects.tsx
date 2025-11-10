import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Projects({ isTransitioning, shouldFadeOut }: { isTransitioning: boolean; shouldFadeOut: boolean }) {
  const [dark, setDark] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();

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

  // Fade in on mount
  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), isTransitioning ? 400 : 10);
    return () => clearTimeout(timer);
  }, [location.pathname, isTransitioning]);

  const toggleTheme = () => {
    setDark(prev => {
      const next = !prev;
      localStorage.setItem('theme', next ? 'dark' : 'light');
      return next;
    });
  };

  const navigate = useNavigate();

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-beige-gradient text-beige-text">
      <header className={`max-w-5xl mx-auto px-6 py-8 flex items-center justify-between transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`} style={{ transitionDelay: shouldFadeOut ? '0ms' : '400ms' }}>
        <a href="/" onClick={handleHomeClick} className="text-2xl font-semibold tracking-tight hover:opacity-80 transition-opacity">
          andyxu
        </a>

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

      <main className={`max-w-5xl mx-auto px-6 pb-24 transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`} style={{ transitionDelay: shouldFadeOut ? '100ms' : '450ms' }}>
        <section className="mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Projects</h1>
          <p className="text-lg opacity-90">AI sidequests from IBM and personal side projects.</p>
        </section>

        <section className="space-y-8">
          <div className={`rounded-2xl p-8 border border-black/5 dark:border-white/10
                          bg-white/70
                          hover:translate-y-[-2px] transition-all duration-[2000ms] ease-in-out transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
               style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)', transitionDelay: shouldFadeOut ? '200ms' : '500ms' }}>
            <h2 className="text-2xl font-semibold mb-3">Coming Soon</h2>
            <p className="opacity-80">Projects will be displayed here soon.</p>
          </div>
        </section>
      </main>
    </div>
  );
}

