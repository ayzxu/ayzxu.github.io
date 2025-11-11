import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import portrait3 from './assets/portraits/portrait3.jpg';
import portrait4 from './assets/portraits/portrait4.JPEG';

// Initialize theme synchronously before component renders
function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function About({ isTransitioning, shouldFadeOut }: { isTransitioning: boolean; shouldFadeOut: boolean }) {
  const [dark, setDark] = useState(getInitialTheme);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
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

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (selectedImage) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedImage]);

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
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">About Me</h1>
            <p className="text-base sm:text-lg opacity-90">Some of my background and experiences.</p>
          </section>

          <section className="space-y-6 sm:space-y-8">
            <div className={`rounded-2xl p-6 sm:p-8 border border-black/5 dark:border-white/10
                            bg-white/70
                            transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
                 style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)', transitionDelay: shouldFadeOut ? '200ms' : '500ms' }}>
              <div className="flex flex-col gap-4 sm:gap-6">
                <div className="w-full flex gap-3 sm:gap-4">
                  <div
                    className="relative rounded-2xl overflow-hidden cursor-pointer group flex-1"
                    onClick={() => setSelectedImage({ src: portrait4, alt: 'Andy Xu' })}
                  >
                    <img 
                      src={portrait4} 
                      alt="Andy Xu" 
                      className="w-full h-64 sm:h-72 md:h-80 lg:h-96 object-cover transition-all duration-150 group-hover:scale-105 group-hover:brightness-75" 
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-150 flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-sm sm:text-base font-medium px-4 text-center">
                        New York City, October 2025
                      </span>
                    </div>
                  </div>
                  <div
                    className="relative rounded-2xl overflow-hidden cursor-pointer group flex-1"
                    onClick={() => setSelectedImage({ src: portrait3, alt: 'Andy Xu' })}
                  >
                    <img 
                      src={portrait3} 
                      alt="Andy Xu" 
                      className="w-full h-64 sm:h-72 md:h-80 lg:h-96 object-cover transition-all duration-150 group-hover:scale-105 group-hover:brightness-75" 
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-150 flex items-center justify-center">
                      <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-sm sm:text-base font-medium px-4 text-center">
                        Me and my scooter, September 2025
                      </span>
                    </div>
                  </div>
                </div>
                <div className="w-full">
                  <h2 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3">Background</h2>
                  <p className="opacity-80 text-sm sm:text-base mb-4">
                    I grew up in the Bay Area, California, and attended Lynbrook High School. I'm currently a senior at Carnegie Mellon University studying Business + Computer Science, with a passion for building AI products and working on meaningful projects. I also scooter around campus sometimes, so there's that.
                  </p>
                  <p className="opacity-80 text-sm sm:text-base">
                    In the past, I've worked as an AI Engineer at IBM, where I gained experience developing AI solutions and working on innovative technology projects. I'm always looking for opportunities to combine my technical skills with business acumen to create impactful products.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Image Modal/Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors text-2xl font-bold"
              aria-label="Close"
            >
              ×
            </button>
            <img
              src={selectedImage.src}
              alt={selectedImage.alt}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

