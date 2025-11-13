import { useEffect, useState, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import sunMoonAnimation from './assets/icons/icons8-sun.json';
import './App.css';
import gusfring from './assets/art/gusfring.jpg';
import stevejobs from './assets/art/stevejobs.png';
import vagabondshoes from './assets/art/vagabondshoes.png';
import walterwhite from './assets/art/walterwhite.jpg';
import valorantIcon from './assets/icons/valorant.png';
import clashRoyaleIcon from './assets/icons/cr.avif';
import chessIcon from './assets/icons/chess.png';
import gymVideo1 from './assets/gym/IMG_6232.mov';
import gymVideo2 from './assets/gym/IMG_6418.MOV';
import volleyballVideo1 from './assets/volleyball/VB1.mov';
import volleyballImage1 from './assets/volleyball/HS2A3950_Original.jpg';
import volleyballImage2 from './assets/volleyball/HS2A4018_Original.jpg';

// Initialize theme synchronously before component renders
function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function Fun({ isTransitioning, shouldFadeOut }: { isTransitioning: boolean; shouldFadeOut: boolean }) {
  const [dark, setDark] = useState(getInitialTheme);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ src: string; alt: string; type: 'image' | 'video' } | null>(null);
  const location = useLocation();
  const lottieRef = useRef<any>(null);
  const prevDarkRef = useRef<boolean | null>(null);
  const isAnimatingRef = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);

  // Memoize the onComplete callback to prevent re-renders
  const handleAnimationComplete = useMemo(() => () => {
    isAnimatingRef.current = false;
  }, []);

  // Capture initial dark value and memoize initialSegment to prevent it from changing on re-renders
  const initialDarkRef = useRef(dark);
  const initialSegment = useMemo(() => (initialDarkRef.current ? [14, 14] : [0, 0]), []);

  // Apply theme class immediately on mount and when it changes
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  // Update Lottie animation when theme changes (but not on initial mount)
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (!isInitializedRef.current) {
      // Initial mount - just set the frame without animating
      prevDarkRef.current = dark;
      // Try to set frame immediately if animation is already loaded
      if (lottieRef.current) {
        lottieRef.current.goToAndStop(dark ? 14 : 0, true);
        isInitializedRef.current = true;
      } else {
        // If not loaded yet, wait a bit and try again
        timer = setTimeout(() => {
          if (lottieRef.current) {
            lottieRef.current.goToAndStop(dark ? 14 : 0, true);
            isInitializedRef.current = true;
          }
        }, 50);
      }
    } else if (prevDarkRef.current !== dark) {
      // Theme actually changed - play the animation
      prevDarkRef.current = dark;
      isAnimatingRef.current = true;
      
      timer = setTimeout(() => {
        if (lottieRef.current) {
          // Stop any ongoing animation first
          lottieRef.current.stop();
          // Set animation speed to 1.33x (0.75x duration = 1/0.75 speed)
          lottieRef.current.setSpeed(1.33);
          // Set the starting frame
          const startFrame = dark ? 0 : 14;
          const endFrame = dark ? 14 : 0;
          lottieRef.current.goToAndStop(startFrame, true);
          // Then play the animation
          lottieRef.current.playSegments([startFrame, endFrame], true);
        }
      }, 100);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [dark]);

  // Fade in on mount
  useEffect(() => {
    setIsVisible(false);
    const timer = setTimeout(() => setIsVisible(true), isTransitioning ? 400 : 10);
    return () => clearTimeout(timer);
  }, [location.pathname, isTransitioning]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (selectedMedia) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedMedia]);

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
        <a href="/" onClick={handleHomeClick} className="text-2xl sm:text-3xl md:text-4xl font-lemonmilk font-semibold tracking-tight hover:opacity-80 transition-opacity">
          andyxu
        </a>

        <div className="theme-switch-container">
          <div 
            className={`theme-switch-animation ${dark ? 'moon-white' : ''}`}
            onClick={toggleTheme}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggleTheme();
              }
            }}
            aria-label="Toggle dark mode"
          >
            <Lottie
              key="theme-animation"
              lottieRef={lottieRef}
              animationData={sunMoonAnimation}
              loop={false}
              autoplay={false}
              initialSegment={initialSegment}
              style={{ width: '2.25em', height: '2.25em', opacity: 1 }}
              onComplete={handleAnimationComplete}
              onLoadedData={() => {
                // Ensure correct frame is set immediately when animation loads
                if (lottieRef.current) {
                  if (!isInitializedRef.current) {
                    lottieRef.current.goToAndStop(dark ? 14 : 0, true);
                    isInitializedRef.current = true;
                  }
                }
              }}
            />
          </div>
          <div className="theme-switch-wrapper">
            <input
              type="checkbox"
              id="theme-check-fun"
              className="theme-checkbox"
              checked={dark}
              onChange={toggleTheme}
              aria-label="Toggle dark mode"
            />
            <label htmlFor="theme-check-fun" className="switch">
              <svg viewBox="0 0 212.4992 84.4688" overflow="visible" xmlns="http://www.w3.org/2000/svg">
                <path
                  pathLength={360}
                  fill="none"
                  stroke="currentColor"
                  d="M 42.2496 0 A 42.24 42.24 90 0 0 0 42.2496 A 42.24 42.24 90 0 0 42.2496 84.4688 A 42.24 42.24 90 0 0 84.4992 42.2496 A 42.24 42.24 90 0 0 42.2496 0 A 42.24 42.24 90 0 0 0 42.2496 A 42.24 42.24 90 0 0 42.2496 84.4688 L 170.2496 84.4688 A 42.24 42.24 90 0 0 212.4992 42.2496 A 42.24 42.24 90 0 0 170.2496 0 A 42.24 42.24 90 0 0 128 42.2496 A 42.24 42.24 90 0 0 170.2496 84.4688 A 42.24 42.24 90 0 0 212.4992 42.2496 A 42.24 42.24 90 0 0 170.2496 0 L 42.2496 0"
                />
              </svg>
            </label>
          </div>
        </div>
      </header>

      <main className={`max-w-5xl mx-auto px-4 sm:px-6 flex-1 w-full transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`} style={{ transitionDelay: shouldFadeOut ? '100ms' : '450ms' }}>
        <div className="py-4 sm:py-6">
          <section className="mb-8 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">Fun</h1>
            <p className="text-base sm:text-lg opacity-90">What I do outside of work and school: Art, Gym, Volleyball, Gaming, Chess, etc.</p>
          </section>

          <section className="space-y-6 sm:space-y-8">
            {[
              {
                title: 'Art',
                description: 'I like drawing bald or nearly bald guys and painting shoes.',
                images: [
                  { src: gusfring, alt: 'Gus Fring' },
                  { src: stevejobs, alt: 'Steve Jobs' },
                  { src: vagabondshoes, alt: 'Vagabond Shoes' },
                  { src: walterwhite, alt: 'Walter White' }
                ],
                links: [
                  { name: 'Portfolio', url: 'https://axuportfolio.weebly.com' }
                ],
                delay: 200
              },
              {
                title: 'Gym',
                description: <>
                Current Lifting Stats: <br />
                295lbs Bench, <br />
                385lbs Squat, <br />
                405lbs Deadlift. <br />
                Just trying to stay healthy and get stronger!
                </>,
                media: [
                  { src: gymVideo1, alt: '365 Squat for 2!', type: 'video' as const },
                  { src: gymVideo2, alt: '295 Bench!', type: 'video' as const }
                ],
                delay: 250
              },
              {
                title: 'Volleyball',
                description: 'Playing competitive volleyball as a captain as part of CMU Men\'s Club Volleyball team. Led the team to top 15 in Division II of National Club Volleyball Foundation in 2023, 2025.',
                media: [
                  { src: volleyballImage1, alt: 'Phoenix Nationals 2025', type: 'image' as const },
                  { src: volleyballImage2, alt: 'Phoenix Nationals 2025 as well', type: 'image' as const },
                  { src: volleyballVideo1, alt: 'Clip from Phoenix Nationals 2025', type: 'video' as const }
                ],
                delay: 300
              },
              {
                title: 'Gaming',
                description: (
                  <>
                    Previously Immortal 2 in Valorant.<br />
                    Previously top 63 global in Clash Royale.
                  </>
                ),
                links: [
                  { name: 'Valorant Tracker', url: 'https://tracker.gg/valorant/profile/riot/nuts%23deep/overview?platform=pc&playlist=competitive', icon: valorantIcon },
                  { name: 'Clash Royale Profile', url: 'https://royaleapi.com/player/8C9QQGVCR', icon: clashRoyaleIcon }
                ],
                delay: 350
              },
              {
                title: 'Chess',
                description: 'Currently rated 1450 Blitz, 1400 Rapid, 1300 Blitz. Just trying to get better at chess!',
                links: [
                  { name: 'Chess.com Profile', url: 'https://www.chess.com/member/chokeonbanana', icon: chessIcon }
                ],
                delay: 400
              }
            ].map((item, index) => (
              <div
                key={item.title}
                className={`rounded-2xl p-6 sm:p-8 border border-black/5 dark:border-white/10
                            bg-white/70
                            hover:translate-y-[-2px] transition-all duration-[2000ms] ease-in-out transition-opacity duration-300 ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
                style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)', transitionDelay: shouldFadeOut ? `${item.delay}ms` : `${500 + index * 50}ms` }}
              >
                <h2 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3">{item.title}</h2>
                <p className="opacity-80 text-sm sm:text-base mb-3">{item.description}</p>
                {item.images && (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4">
                    {item.images.map((img: { src: string; alt: string }, imgIndex: number) => (
                      <div
                        key={imgIndex}
                        className="relative rounded-lg overflow-hidden cursor-pointer group"
                        onClick={() => setSelectedMedia({ ...img, type: 'image' })}
                      >
                        <img
                          src={img.src}
                          alt={img.alt}
                          className="w-full h-32 sm:h-40 md:h-48 object-cover transition-all duration-150 group-hover:scale-105 group-hover:brightness-75"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-150 flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-sm sm:text-base font-medium px-4 text-center">
                            {img.alt}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {item.media && (
                  <div className="grid grid-cols-2 gap-3 sm:gap-4 mt-4">
                    {item.media.map((media: { src: string; alt: string; type: 'image' | 'video' }, mediaIndex: number) => {
                      const isImage = media.type === 'image';
                      // For volleyball section: images are small, video is large (spans 2 rows on right)
                      const isLargeItem = item.title === 'Volleyball' && !isImage;
                      // For gym section: videos are square
                      const isGymVideo = item.title === 'Gym' && !isImage;
                      return (
                        <div
                          key={mediaIndex}
                          className={`relative ${isGymVideo ? 'rounded-2xl' : 'rounded-lg'} overflow-hidden cursor-pointer group ${isLargeItem ? 'col-start-2 row-span-2 row-start-1' : ''}`}
                          onClick={() => setSelectedMedia(media)}
                        >
                          {isImage ? (
                            <img
                              src={media.src}
                              alt={media.alt}
                              className={`w-full ${isLargeItem ? 'h-[268px] sm:h-[336px] md:h-[400px]' : 'h-32 sm:h-40 md:h-48'} object-cover transition-all duration-150 group-hover:scale-105 group-hover:brightness-75`}
                            />
                          ) : (
                            <video
                              src={media.src}
                              className={`w-full ${isGymVideo ? 'aspect-square' : isLargeItem ? 'h-[268px] sm:h-[336px] md:h-[400px]' : 'h-32 sm:h-40 md:h-48'} object-cover transition-all duration-150 group-hover:scale-105 group-hover:brightness-75`}
                              muted
                              playsInline
                            />
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-150 flex items-center justify-center">
                            <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 text-sm sm:text-base font-medium px-4 text-center">
                              {media.alt}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {item.links && (
                  <div className="flex flex-wrap gap-3 sm:gap-4 mt-3">
                    {item.links.map((link: { name: string; url: string; icon?: string }) => (
                      <a
                        key={link.name}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm sm:text-base opacity-70 hover:opacity-100 transition-opacity inline-flex items-center gap-2"
                      >
                        {link.icon && (
                          <img src={link.icon} alt="" className="w-4 h-4 sm:w-5 sm:h-5 object-contain" />
                        )}
                        {link.name} →
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </section>
        </div>
      </main>

      {/* Media Modal/Lightbox */}
      {selectedMedia && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedMedia(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setSelectedMedia(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors text-2xl font-bold"
              aria-label="Close"
            >
              ×
            </button>
            {selectedMedia.type === 'image' ? (
              <img
                src={selectedMedia.src}
                alt={selectedMedia.alt}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <video
                src={selectedMedia.src}
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                controls
                autoPlay
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

