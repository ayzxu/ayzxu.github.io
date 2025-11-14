import { useEffect, useState, useRef, useMemo, useLayoutEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import sunMoonAnimation from './assets/icons/icons8-sun.json';
import portrait3 from './assets/portraits/portrait3.png';
import portrait4 from './assets/portraits/portrait4.png';
import azukiIcon from './assets/icons/azuki.png';
import ibmIcon from './assets/icons/ibm.svg';
// Experience images
import azuki1 from './assets/experiencepics/azuki/azuki1.png';
import azuki2 from './assets/experiencepics/azuki/azuki2.png';
import ibm12 from './assets/experiencepics/ibm1/ibm12.png';
import ibm13 from './assets/experiencepics/ibm1/ibm13.png';
import ibm14 from './assets/experiencepics/ibm1/ibm14.png';
import ibm21 from './assets/experiencepics/ibm2/ibm21.png';
import ibm22 from './assets/experiencepics/ibm2/ibm22.png';
import ibm23 from './assets/experiencepics/ibm2/ibm23.png';
import './App.css';

// Initialize theme synchronously before component renders
function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return true; // Default to dark mode
}

export default function About({ isTransitioning, shouldFadeOut }: { isTransitioning: boolean; shouldFadeOut: boolean }) {
  const [dark, setDark] = useState(getInitialTheme);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<{ src: string; alt: string } | null>(null);
  const location = useLocation();
  const lottieRef = useRef<any>(null);
  const prevDarkRef = useRef<boolean | null>(null);
  const isAnimatingRef = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);

  // Memoize image arrays to prevent recreation on every render
  const ibm1Images = useMemo(() => [
    { src: ibm21, text: 'Avey and Satvik!' },
    { src: ibm22, text: 'Boat Cruise Event in SF' },
    { src: ibm23, text: 'Ping Pong Tournament Champion 😎' }
  ], []);

  const ibm2Images = useMemo(() => [
    { src: ibm12, text: 'First day of work at IBM!' },
    { src: ibm13, text: 'SF Giants Game with interns!' },
    { src: ibm14, text: 'Escape Room with interns!' }
  ], []);

  const azukiImages = useMemo(() => [
    { src: azuki1, text: 'First day of work at Azuki!' },
    { src: azuki2, text: 'The old office in LA' }
  ], []);

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

  // Use layout effect to ensure frame is set synchronously before paint
  useLayoutEffect(() => {
    if (lottieRef.current && !isInitializedRef.current) {
      lottieRef.current.goToAndStop(dark ? 14 : 0, true);
      isInitializedRef.current = true;
      prevDarkRef.current = dark;
    }
  }, []);

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
                  } else {
                    // Ensure frame is correct even if already initialized
                    lottieRef.current.goToAndStop(dark ? 14 : 0, true);
                  }
                }
              }}
              onDOMLoaded={() => {
                // Additional callback to ensure frame is set when DOM is ready
                if (lottieRef.current && !isInitializedRef.current) {
                  lottieRef.current.goToAndStop(dark ? 14 : 0, true);
                  isInitializedRef.current = true;
                  prevDarkRef.current = dark;
                }
              }}
            />
          </div>
          <div className="theme-switch-wrapper">
            <input
              type="checkbox"
              id="theme-check-about"
              className="theme-checkbox"
              checked={dark}
              onChange={toggleTheme}
              aria-label="Toggle dark mode"
            />
            <label htmlFor="theme-check-about" className="switch">
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
                      loading="lazy"
                      style={{ willChange: 'transform' }}
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
                      loading="lazy"
                      style={{ willChange: 'transform' }}
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
                  <p className="opacity-80 text-sm sm:text-base mb-6">
                    I grew up in the Bay Area, California, and attended Lynbrook High School. I'm currently a senior at Carnegie Mellon University studying Business + Computer Science, with a passion for building AI products and working on meaningful projects. I also scooter around campus sometimes, so there's that.
                  </p>
                  
                  <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Work Experience</h3>
                  <div className="space-y-6 sm:space-y-8">
                    {/* AI Engineer Intern - IBM */}
                    <div className="flex items-start gap-3 sm:gap-4">
                      <a href="https://www.ibm.com" target="_blank" rel="noreferrer" className="flex-shrink-0">
                        <img src={ibmIcon} alt="IBM" className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover hover:opacity-80 transition-opacity" />
                      </a>
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-2">
                          <h4 className="text-base sm:text-lg font-medium">AI Engineer Intern</h4>
                          <span className="text-xs sm:text-sm opacity-60">May 2025 - Aug 2025</span>
                        </div>
                        <p className="text-sm sm:text-base opacity-70 mb-3">IBM • San Francisco, CA</p>
                        <ul className="space-y-2 opacity-80 text-sm sm:text-base list-disc list-inside">
                          <li>Developed an intelligent document processing pipeline leveraging <strong>OCR</strong>, <strong>Tensorflow</strong>, and <strong>Granite-8B</strong> to decrease costs by <strong>80%</strong> and speed up by <strong>150%</strong> when compared to GPT-4o</li>
                          <li>Created a semantic search pipeline and chatbot utilizing <strong>watsonx.ai</strong>, <strong>Pytorch</strong>, and <strong>Puppeteer</strong> for Minnesota Government</li>
                          <li>Engineered full-stack automated recording summarization platform integrating <strong>watsonx.ai</strong> with <strong>Flask</strong> and <strong>ThreadPoolExecutor</strong> parallel processing, achieving <strong>80%</strong> faster transcription and <strong>90%</strong> time savings</li>
                          <li>Built internal AI OneDrive document chat system using <strong>LangChain</strong> and <strong>vectorized Lucene database</strong></li>
                        </ul>
                        {/* Experience Images */}
                        <div className="flex gap-2 mt-4">
                          {ibm1Images.map((item, idx) => (
                            <div
                              key={idx}
                              className="relative flex-1 h-48 rounded-lg overflow-hidden cursor-pointer group"
                              onClick={() => setSelectedImage({ src: item.src, alt: `IBM Experience ${idx + 1}` })}
                            >
                              <img
                                src={item.src}
                                alt={`IBM Experience ${idx + 1}`}
                                className="w-full h-full object-cover transition-all duration-200 group-hover:scale-110 group-hover:brightness-75"
                                loading="lazy"
                                style={{ willChange: 'transform' }}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                                <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-sm sm:text-base font-medium px-4 text-center">
                                  {item.text}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Data and AI Specialist Intern - IBM */}
                    <div className="flex items-start gap-3 sm:gap-4">
                      <a href="https://www.ibm.com" target="_blank" rel="noreferrer" className="flex-shrink-0">
                        <img src={ibmIcon} alt="IBM" className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover hover:opacity-80 transition-opacity" />
                      </a>
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-2">
                          <h4 className="text-base sm:text-lg font-medium">Data and AI Specialist Intern</h4>
                          <span className="text-xs sm:text-sm opacity-60">May 2024 - Aug 2024</span>
                        </div>
                        <p className="text-sm sm:text-base opacity-70 mb-3">IBM • San Francisco, CA</p>
                        <ul className="space-y-2 opacity-80 text-sm sm:text-base list-disc list-inside">
                          <li>Ensured client readiness for Data and AI infrastructure with technical solutions, reducing deployment time by <strong>20%</strong></li>
                          <li>Prospected <strong>10+</strong> use cases and demos for IBM's <strong>watsonx.ai</strong>, <strong>watsonx.data</strong>, and <strong>watsonx.gov</strong> in Python and SQL</li>
                          <li>Built fullstack application with <strong>Node.js, HTML</strong>, and <strong>CSS</strong> for manipulating sales CSV files using <strong>Pandas</strong> in Python</li>
                          <li>Constructed custom Excel spreadsheet with macros to assist sales team with <strong>40+</strong> clients</li>
                        </ul>
                        {/* Experience Images */}
                        <div className="flex gap-2 mt-4">
                          {ibm2Images.map((item, idx) => (
                            <div
                              key={idx}
                              className="relative flex-1 h-48 rounded-lg overflow-hidden cursor-pointer group"
                              onClick={() => setSelectedImage({ src: item.src, alt: `IBM Experience ${idx + 1}` })}
                            >
                              <img
                                src={item.src}
                                alt={`IBM Experience ${idx + 1}`}
                                className="w-full h-full object-cover transition-all duration-200 group-hover:scale-110 group-hover:brightness-75"
                                loading="lazy"
                                style={{ willChange: 'transform' }}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                                <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-sm sm:text-base font-medium px-4 text-center">
                                  {item.text}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    {/* Software Engineering and Marketing Intern - Chiru Labs/Azuki */}
                    <div className="flex items-start gap-3 sm:gap-4">
                      <a href="https://www.azuki.com" target="_blank" rel="noreferrer" className="flex-shrink-0">
                        <img src={azukiIcon} alt="Azuki" className="w-12 h-12 sm:w-14 sm:h-14 rounded-lg object-cover hover:opacity-80 transition-opacity" />
                      </a>
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1 mb-2">
                          <h4 className="text-base sm:text-lg font-medium">Software Engineering and Marketing Intern</h4>
                          <span className="text-xs sm:text-sm opacity-60">Jun 2023 - Aug 2023</span>
                        </div>
                        <p className="text-sm sm:text-base opacity-70 mb-3">Chiru Labs (Azuki) • Los Angeles, CA</p>
                        <ul className="space-y-2 opacity-80 text-sm sm:text-base list-disc list-inside">
                          <li>Built a client-facing website using <strong>React.js</strong> and a <strong>Python</strong> backend, improved UX with responsive animated UI</li>
                          <li>Conducted web3 market research that identified <strong>10+</strong> key customer segments, resulting in a <strong>15%</strong> increase in revenue</li>
                        </ul>
                        {/* Experience Images */}
                        <div className="flex gap-2 mt-4">
                          {azukiImages.map((item, idx) => (
                            <div
                              key={idx}
                              className="relative flex-1 h-48 rounded-lg overflow-hidden cursor-pointer group"
                              onClick={() => setSelectedImage({ src: item.src, alt: `Azuki Experience ${idx + 1}` })}
                            >
                              <img
                                src={item.src}
                                alt={`Azuki Experience ${idx + 1}`}
                                className="w-full h-full object-cover transition-all duration-200 group-hover:scale-110 group-hover:brightness-75"
                                loading="lazy"
                                style={{ willChange: 'transform' }}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                                <span className="text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-sm sm:text-base font-medium px-4 text-center">
                                  {item.text}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <p className="opacity-80 text-sm sm:text-base mt-6">
                    I'm always looking for opportunities to combine my technical skills with my business acumen to create impactful products! Contact me if you'd like to chat or collaborate.
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

