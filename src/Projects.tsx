import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

// Initialize theme synchronously before component renders
function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function Projects({ isTransitioning, shouldFadeOut }: { isTransitioning: boolean; shouldFadeOut: boolean }) {
  const [dark, setDark] = useState(getInitialTheme);
  const [isVisible, setIsVisible] = useState(false);
  const location = useLocation();

  // Apply theme class immediately on mount and when it changes
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
    <div className="min-h-screen bg-beige-gradient text-beige-text flex flex-col">
      <header className={`w-full max-w-5xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex items-center justify-between flex-shrink-0 transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`} style={{ transitionDelay: shouldFadeOut ? '0ms' : '400ms' }}>
        <a href="/" onClick={handleHomeClick} className="text-xl sm:text-2xl font-semibold tracking-tight hover:opacity-80 transition-opacity">
          andyxu
        </a>

        <button
          onClick={toggleTheme}
          aria-pressed={dark}
          className="rounded-2xl px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base border border-black/10 dark:border-white/20
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

      <main className={`max-w-5xl mx-auto px-4 sm:px-6 flex-1 w-full transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`} style={{ transitionDelay: shouldFadeOut ? '100ms' : '450ms' }}>
        <div className="py-4 sm:py-6">
          <section className="mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">Projects</h1>
            <p className="text-base sm:text-lg opacity-90">AI sidequests from IBM and personal side projects.</p>
          </section>

          <section className="space-y-6 sm:space-y-8">
            {[
              {
                title: 'Full-stack Spoiler-block Chrome Extension',
                date: 'Nov 2024 - Ongoing',
                description: 'NLP-based Chrome extension that blocks spoilers with 40% efficiency increase.',
                link: 'https://github.com/ayzxu/spoilerblock',
                delay: 200
              },
              {
                title: 'Brawl Stars Agent - Supercell Game',
                date: 'Nov 2024 - Ongoing',
                description: 'AI-powered bot using computer vision and reinforcement learning to play Brawl Stars.',
                delay: 250
              },
              {
                title: 'ThreeGL Planet – WebGL Game World',
                date: 'Sep 2025',
                description: 'Browser-based 3D game world built with React, Three.js, and WebGL. Features an asset pipeline with GLTF + Draco/KTX2 compression.',
                link: 'https://github.com/ayzxu/threegl-planet',
                delay: 300
              },
              {
                title: 'Chess AI',
                date: 'Dec 2022',
                description: 'AI opponent using minimax algorithm with alpha-beta pruning. Supports human vs. human and human vs. AI game modes.',
                link: 'https://www.github.com/ayzxu/chess',
                delay: 350
              }
            ].map((project, index) => (
              <div
                key={project.title}
                className={`rounded-2xl p-6 sm:p-8 border border-black/5 dark:border-white/10
                            bg-white/70
                            hover:translate-y-[-2px] transition-all duration-[2000ms] ease-in-out transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
                style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)', transitionDelay: shouldFadeOut ? `${project.delay}ms` : `${500 + index * 50}ms` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-4 mb-3">
                  <h2 className="text-xl sm:text-2xl font-semibold">{project.title}</h2>
                  <span className="text-sm sm:text-base opacity-60 whitespace-nowrap">{project.date}</span>
                </div>
                <p className="opacity-80 text-sm sm:text-base mb-3">{project.description}</p>
                {project.link && (
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm sm:text-base opacity-70 hover:opacity-100 transition-opacity inline-flex items-center gap-1"
                  >
                    View on GitHub →
                  </a>
                )}
              </div>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}

