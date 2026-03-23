import { useEffect, useState, useRef, useMemo, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import sunMoonAnimation from './assets/icons/icons8-sun.json';
import './App.css';
import { useTheme } from './ThemeContext';
import squatformAnalyze from './assets/projectpics/squatform/analyze.png';
import squatformFeedback from './assets/projectpics/squatform/feedback.png';
import spoilerblockExtension from './assets/projectpics/spoilerblock/extension.png';
import spoilerblockRedacted from './assets/projectpics/spoilerblock/redacted.png';
import spoilerblockFurtherRedaction from './assets/projectpics/spoilerblock/furtherredaction.png';
import threeglWorld from './assets/projectpics/threegl/world.webp';
import chessaiGameplay from './assets/projectpics/chessai/gameplay.png';

export default function Projects({ isTransitioning, shouldFadeOut }: { isTransitioning: boolean; shouldFadeOut: boolean }) {
  const { dark, toggleTheme } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const location = useLocation();
  const lottieRef = useRef<any>(null);
  const prevDarkRef = useRef<boolean | null>(null);
  const isAnimatingRef = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);

  const handleAnimationComplete = useMemo(() => () => {
    isAnimatingRef.current = false;
  }, []);

  const initialDarkRef = useRef(dark);
  const initialSegment = useMemo(() => (initialDarkRef.current ? [14, 14] : [0, 0]), []);

  useLayoutEffect(() => {
    if (lottieRef.current && !isInitializedRef.current) {
      lottieRef.current.goToAndStop(dark ? 14 : 0, true);
      isInitializedRef.current = true;
      prevDarkRef.current = dark;
    }
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    
    if (!isInitializedRef.current) {
      prevDarkRef.current = dark;
      if (lottieRef.current) {
        lottieRef.current.goToAndStop(dark ? 14 : 0, true);
        isInitializedRef.current = true;
      } else {
        timer = setTimeout(() => {
          if (lottieRef.current) {
            lottieRef.current.goToAndStop(dark ? 14 : 0, true);
            isInitializedRef.current = true;
          }
        }, 50);
      }
    } else if (prevDarkRef.current !== dark) {
      prevDarkRef.current = dark;
      isAnimatingRef.current = true;
      
      if (lottieRef.current) {
        lottieRef.current.stop();
        lottieRef.current.setSpeed(1.33);
        const startFrame = dark ? 0 : 14;
        const endFrame = dark ? 14 : 0;
        lottieRef.current.goToAndStop(startFrame, true);
        lottieRef.current.playSegments([startFrame, endFrame], true);
      }
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

  // Prevent body scroll when lightbox is open and handle ESC key
  useEffect(() => {
    if (selectedImage) {
      document.body.style.overflow = 'hidden';
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setSelectedImage(null);
        }
      };
      window.addEventListener('keydown', handleEscape);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleEscape);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [selectedImage]);

  const navigate = useNavigate();

  const handleHomeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    navigate('/');
  };

  // Memoize projects array to prevent recreation on every render
  const projects = useMemo(() => [
    {
      title: 'Squat Form Analyzer',
      date: 'Nov 2025',
      description: 'Python + OpenCV web application that analyzes squat form from uploaded videos using MediaPipe pose estimation. Provides detailed ratings (0-100) and actionable feedback on knee tracking, back angle, depth, and alignment.',
      link: 'https://github.com/ayzxu/squatform',
      images: [
        { src: squatformAnalyze, alt: 'Squat Form Analysis Interface' },
        { src: squatformFeedback, alt: 'Detailed Feedback Display' }
      ],
      delay: 200
    },
    {
      title: 'Spoiler-block Chrome Extension',
      date: 'Nov 2024 - Ongoing',
      description: 'NLP-based Chrome extension that blocks spoilers with 40% efficiency increase.',
      link: 'https://github.com/ayzxu/spoilerblock',
      images: [
        { src: spoilerblockExtension, alt: 'Extension Interface' },
        { src: spoilerblockRedacted, alt: 'Spoiler Redaction Example' },
        { src: spoilerblockFurtherRedaction, alt: 'Advanced Redaction Features' }
      ],
      delay: 250
    },
    {
      title: 'Brawl Stars Agent - Supercell Game',
      date: 'Nov 2024 - Ongoing',
      description: 'AI-powered bot using computer vision and reinforcement learning to play Brawl Stars.',
      delay: 300
    },
    {
      title: 'ThreeGL Planet – WebGL Game World',
      date: 'Sep 2025',
      description: 'Browser-based 3D game world built with React, Three.js, and WebGL. Features an asset pipeline with GLTF + Draco/KTX2 compression.',
      link: 'https://github.com/ayzxu/threegl-planet',
      images: [
        { src: threeglWorld, alt: '3D Game World Screenshot' }
      ],
      delay: 350
    },
    {
      title: 'Chess AI',
      date: 'Dec 2022',
      description: 'AI opponent using minimax algorithm with alpha-beta pruning. Supports human vs. human and human vs. AI game modes.',
      link: 'https://www.github.com/ayzxu/chess',
      images: [
        { src: chessaiGameplay, alt: 'Chess AI Gameplay' }
      ],
      delay: 400
    }
  ], []);

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
                    prevDarkRef.current = dark;
                  }
                }
              }}
            />
          </div>
          <div className="theme-switch-wrapper">
            <input
              type="checkbox"
              id="theme-check-projects"
              className="theme-checkbox"
              checked={dark}
              onChange={toggleTheme}
              aria-label="Toggle dark mode"
            />
            <label htmlFor="theme-check-projects" className="switch">
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
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-3 sm:mb-4">Projects</h1>
            <p className="text-base sm:text-lg opacity-90">AI sidequests from IBM and personal side projects.</p>
          </section>

          <section className="space-y-6 sm:space-y-8">
            {projects.map((project, index) => (
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
                {project.images && project.images.length > 0 && (
                  <div className={`grid gap-3 sm:gap-4 mt-4 ${project.images.length === 1 ? 'grid-cols-1' : project.images.length === 2 ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {project.images.map((img, imgIndex) => (
                      <div
                        key={imgIndex}
                        className="relative rounded-lg overflow-hidden cursor-pointer group"
                        onClick={() => setSelectedImage(img)}
                      >
                        <img
                          src={img.src}
                          alt={img.alt}
                          className="w-full h-48 sm:h-56 md:h-64 object-cover transition-all duration-300 group-hover:scale-105 group-hover:brightness-75"
                          loading="lazy"
                          style={{ willChange: 'transform' }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center">
                          <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-sm sm:text-base font-medium px-4 text-center">
                            {img.alt}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {project.link && (
                  <a
                    href={project.link}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm sm:text-base opacity-70 hover:opacity-100 transition-opacity inline-flex items-center gap-1 mt-3"
                  >
                    View on GitHub →
                  </a>
                )}
              </div>
            ))}
          </section>
        </div>
      </main>

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors text-3xl sm:text-4xl font-bold z-10"
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

