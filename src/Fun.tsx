import React, { useEffect, useState, useRef, useMemo, useLayoutEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import sunMoonAnimation from './assets/icons/icons8-sun.json';
import './App.css';
import gusfring from './assets/art/gusfring.png';
import stevejobs from './assets/art/stevejobs.png';
import vagabondshoes from './assets/art/vagabondshoes.png';
import walterwhite from './assets/art/walterwhite.png';
import valorantIcon from './assets/icons/valorant.png';
import clashRoyaleIcon from './assets/icons/cr.avif';
import chessIcon from './assets/icons/chess.png';
import { Chessboard } from 'react-chessboard';
import { Chess } from 'chess.js';
import gymVideo1 from './assets/gym/IMG_6232.mov';
import gymVideo2 from './assets/gym/IMG_6418.MOV';
import volleyballVideo1 from './assets/volleyball/VB1.mov';
import volleyballImage1 from './assets/volleyball/HS2A3950_Original.png';
import volleyballImage2 from './assets/volleyball/HS2A4018_Original.png';

// Chessboard wrapper component
const ChessboardWrapper = ({ options, boardKey }: { options: any; boardKey: string }) => (
  <div style={{ pointerEvents: 'none', userSelect: 'none' }}>
    <Chessboard
      options={options}
      key={boardKey}
    />
  </div>
);

// Initialize theme synchronously before component renders
function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false;
  const saved = localStorage.getItem('theme');
  if (saved === 'dark') return true;
  if (saved === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

async function getFinalFenFromGame(lastGame: any): Promise<string> {
  const chess = new Chess();
  let finalFen;

  // Strategy 1: Parse PGN directly from API response (like the Python code)
  // The Chess.com API returns PGN directly in the game object
  if (lastGame.pgn && typeof lastGame.pgn === 'string') {
    try {
      // If it's a URL, fetch it first
      if (lastGame.pgn.startsWith('http://') || lastGame.pgn.startsWith('https://')) {
        try {
          const url = new URL(lastGame.pgn);
          const pgnResponse = await fetch(url.toString());
          if (pgnResponse.ok) {
            const pgnText = await pgnResponse.text();
            if (pgnText && pgnText.trim()) {
              chess.loadPgn(pgnText);
              if (chess.history().length > 0) {
                finalFen = chess.fen();
              }
            }
          }
        } catch (e) {
          console.error('Error fetching PGN URL:', e);
        }
      } else {
        // It's PGN text directly from the API
        try {
          chess.loadPgn(lastGame.pgn);
          if (chess.history().length > 0) {
            finalFen = chess.fen();
          }
        } catch (e) {
          console.error('Error loading PGN from API response:', e);
        }
      }
    } catch (e) {
      console.error('Error processing PGN:', e);
    }
  }

  // Strategy 2: Try Chess.com API-provided FEN (if available)
  if (!finalFen && lastGame.fen) {
    finalFen = lastGame.fen;
  }

  // Final fallback: starting position
  if (!finalFen) {
    finalFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  }

  return finalFen;
}

export default function Fun({ isTransitioning, shouldFadeOut }: { isTransitioning: boolean; shouldFadeOut: boolean }) {
  const [dark, setDark] = useState(getInitialTheme);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ src: string; alt: string; type: 'image' | 'video' } | null>(null);
  const [visibleVideos, setVisibleVideos] = useState<Set<string>>(new Set());
  const [videoThumbnails, setVideoThumbnails] = useState<Map<string, string>>(new Map());
  const location = useLocation();
  const lottieRef = useRef<any>(null);
  const prevDarkRef = useRef<boolean | null>(null);
  const isAnimatingRef = useRef<boolean>(false);
  const isInitializedRef = useRef<boolean>(false);
  const videoObserverRef = useRef<IntersectionObserver | null>(null);

  // Memoize the onComplete callback to prevent re-renders
  const handleAnimationComplete = useMemo(() => () => {
    isAnimatingRef.current = false;
  }, []);

  // Capture initial dark value and memoize initialSegment to prevent it from changing on re-renders
  const initialDarkRef = useRef(dark);
  const initialSegment = useMemo(() => (initialDarkRef.current ? [14, 14] : [0, 0]) as [number, number], []);

  // Apply theme class immediately on mount and when it changes
  useLayoutEffect(() => {
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
    let timer: ReturnType<typeof setTimeout>;

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

  // Generate thumbnails for videos
  useEffect(() => {
    const generateThumbnail = (videoSrc: string): Promise<string> => {
      return new Promise((resolve) => {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';
        video.muted = true;
        video.playsInline = true;
        
        video.onloadedmetadata = () => {
          video.currentTime = 0.1; // Seek to first frame
        };
        
        video.onseeked = () => {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
            resolve(thumbnail);
          } else {
            resolve('');
          }
          video.remove();
        };
        
        video.onerror = () => {
          resolve('');
          video.remove();
        };
        
        video.src = videoSrc;
      });
    };

    // Generate thumbnails for known video sources
    const videoSources = [
      gymVideo1,
      gymVideo2,
      volleyballVideo1
    ];

    videoSources.forEach(videoSrc => {
      if (!videoThumbnails.has(videoSrc)) {
        generateThumbnail(videoSrc).then(thumbnail => {
          if (thumbnail) {
            setVideoThumbnails(prev => new Map(prev).set(videoSrc, thumbnail));
          }
        });
      }
    });
  }, [videoThumbnails]);

  // Lazy load videos when they enter viewport
  useEffect(() => {
    // Use setTimeout to ensure DOM is updated
    const timer = setTimeout(() => {
      const videoElements = document.querySelectorAll('video[data-lazy-video]');
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const video = entry.target as HTMLVideoElement;
            const src = video.getAttribute('data-lazy-video');
            if (src && !video.src) {
              video.src = src;
              video.load();
              setVisibleVideos(prev => new Set(prev).add(src));
            }
            observer.unobserve(video);
          }
        });
      }, { rootMargin: '50px' });

      videoElements.forEach((video) => observer.observe(video));
      videoObserverRef.current = observer;
    }, 100);

    return () => {
      clearTimeout(timer);
      if (videoObserverRef.current) {
        const videoElements = document.querySelectorAll('video[data-lazy-video]');
        videoElements.forEach((video) => videoObserverRef.current?.unobserve(video));
        videoObserverRef.current.disconnect();
        videoObserverRef.current = null;
      }
    };
  });

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

  const [chessRatings, setChessRatings] = useState({
    bullet: 1450,
    rapid: 1400,
    blitz: 1300
  });

  const [latestGame, setLatestGame] = useState<{
    url: string;
    opponent: string;
    result: string;
    fen: string;
    userColor: 'white' | 'black';
  } | null>(null);
  const [boardFen, setBoardFen] = useState<string>('start');
  
  // Memoize chessboard options to prevent recreation on every render
  const chessboardOptions = useMemo(() => {
    if (!latestGame) return null;
    
    const positionToUse = boardFen === 'start' 
      ? 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
      : boardFen;
    
    return {
      position: positionToUse,
      draggable: false,
      arePiecesDraggable: false,
      boardOrientation: latestGame.userColor,
      animationDuration: 0,
      onPieceClick: () => false,
      onSquareClick: () => false,
      onPieceDrop: () => false,
      onSquareRightClick: () => false
    };
  }, [boardFen, latestGame?.userColor]);

  useEffect(() => {
    fetch('https://api.chess.com/pub/player/chokeonbanana/stats')
      .then(res => res.json())
      .then(data => {
        setChessRatings({
          bullet: data.chess_bullet?.last?.rating || 1450,
          rapid: data.chess_rapid?.last?.rating || 1400,
          blitz: data.chess_blitz?.last?.rating || 1300
        });
      })
      .catch(err => console.error('Failed to fetch chess stats:', err));

    // Get game archives first, then fetch the latest archive (matching Python pattern)
    fetch('https://api.chess.com/pub/player/chokeonbanana/games/archives')
      .then(res => res.json())
      .then(async (archivesData) => {
        if (archivesData.archives && archivesData.archives.length > 0) {
          // Get the latest archive URL (last in the array)
          const latestArchiveUrl = archivesData.archives[archivesData.archives.length - 1];
          
          // Fetch games from the latest archive
          const gamesResponse = await fetch(latestArchiveUrl);
          const gamesData = await gamesResponse.json();
          
          if (gamesData.games && gamesData.games.length > 0) {
            // Get the most recent game (last in the array, matching Python: games[-1])
            const lastGame = gamesData.games[gamesData.games.length - 1];
            
            const isWhite = lastGame.white.username.toLowerCase() === 'chokeonbanana';
            const opponent = isWhite ? lastGame.black.username : lastGame.white.username;
            const myResult = isWhite ? lastGame.white.result : lastGame.black.result;

            let resultText = 'Draw';
            if (myResult === 'win') resultText = 'Won';
            else if (['checkmated', 'resigned', 'timeout', 'abandoned'].includes(myResult)) resultText = 'Lost';

            // Get PGN directly from the game object (matching Python: games[-1]['pgn'])
            const finalFen = await getFinalFenFromGame(lastGame);

            setLatestGame({
              url: lastGame.url,
              opponent,
              result: resultText,
              fen: finalFen,
              userColor: isWhite ? 'white' : 'black'
            });
            setBoardFen(finalFen);
          }
        }
      })
      .catch(err => {
        console.error('Failed to fetch games:', err);
        // Fallback to current month approach if archives fail
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');

        fetch(`https://api.chess.com/pub/player/chokeonbanana/games/${year}/${month}`)
          .then(res => res.json())
          .then(async (data) => {
            if (data.games && data.games.length > 0) {
              const lastGame = data.games[data.games.length - 1];
              const isWhite = lastGame.white.username.toLowerCase() === 'chokeonbanana';
              const opponent = isWhite ? lastGame.black.username : lastGame.white.username;
              const myResult = isWhite ? lastGame.white.result : lastGame.black.result;

              let resultText = 'Draw';
              if (myResult === 'win') resultText = 'Won';
              else if (['checkmated', 'resigned', 'timeout', 'abandoned'].includes(myResult)) resultText = 'Lost';

              const finalFen = await getFinalFenFromGame(lastGame);

              setLatestGame({
                url: lastGame.url,
                opponent,
                result: resultText,
                fen: finalFen,
                userColor: isWhite ? 'white' : 'black'
              });
              setBoardFen(finalFen);
            }
          })
          .catch(fallbackErr => console.error('Failed to fetch games (fallback):', fallbackErr));
      });
  }, []);

  // Memoize chess description separately to prevent recreation on theme changes
  const chessDescription = useMemo(() => (
    <>
      <span className="flex items-center gap-2">
        Currently rated {chessRatings.bullet} Bullet, {chessRatings.rapid} Rapid, {chessRatings.blitz} Blitz.
        <span className="flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          LIVE
        </span>
      </span>
      Just trying to get better at chess!
      {latestGame && (
        <div className="mt-4 w-full max-w-[300px]">
          <div className="mb-2 text-sm opacity-90">
            Most recent game: <a href={latestGame.url} target="_blank" rel="noreferrer" className="underline hover:text-blue-600 dark:hover:text-blue-400 transition-colors">{latestGame.result} vs {latestGame.opponent}</a>
          </div>
          <div className="rounded-lg overflow-hidden shadow-lg border border-black/10 dark:border-white/10" style={{ pointerEvents: 'none' }}>
            {chessboardOptions && (
              <ChessboardWrapper 
                options={chessboardOptions}
                boardKey={`board-${boardFen}-${latestGame.userColor}`}
              />
            )}
          </div>
        </div>
      )}
    </>
  ), [chessRatings, latestGame, boardFen, chessboardOptions]);

  // Memoize items array to prevent recreation on every render
  const items = useMemo(() => [
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
      description: chessDescription,
      links: [
        { name: 'Chess.com Profile', url: 'https://www.chess.com/member/chokeonbanana', icon: chessIcon }
      ],
      delay: 400
    }
  ], [chessDescription]);

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
            {items.map((item, index) => (
              <div
                key={item.title}
                className={`rounded-2xl p-6 sm:p-8 border border-black/5 dark:border-white/10
                            bg-white/70
                            hover:translate-y-[-2px] transition-opacity duration-300 transition-transform duration-200 ease-in-out ${shouldFadeOut ? 'opacity-0' : (isVisible ? 'opacity-100' : 'opacity-0')}`}
                style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.08)', transitionDelay: shouldFadeOut ? `${item.delay}ms` : `${500 + index * 50}ms` }}
              >
                <h2 className="text-xl sm:text-2xl font-semibold mb-2 sm:mb-3">{item.title}</h2>
                {typeof item.description === 'string' ? (
                  <p className="opacity-80 text-sm sm:text-base mb-3">{item.description}</p>
                ) : (
                  <div className="opacity-80 text-sm sm:text-base mb-3">{item.description}</div>
                )}
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
                          loading="lazy"
                          style={{ willChange: 'transform' }}
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
                              loading="lazy"
                              decoding="async"
                              style={{ willChange: 'transform' }}
                            />
                          ) : (
                            <div className="relative w-full h-full">
                              {videoThumbnails.has(media.src) ? (
                                <img
                                  src={videoThumbnails.get(media.src)}
                                  alt={media.alt}
                                  className={`w-full ${isGymVideo ? 'aspect-square' : isLargeItem ? 'h-[268px] sm:h-[336px] md:h-[400px]' : 'h-32 sm:h-40 md:h-48'} object-cover transition-all duration-150 group-hover:scale-105 group-hover:brightness-75`}
                                  style={{ willChange: 'transform' }}
                                />
                              ) : (
                                <div className={`w-full ${isGymVideo ? 'aspect-square' : isLargeItem ? 'h-[268px] sm:h-[336px] md:h-[400px]' : 'h-32 sm:h-40 md:h-48'} bg-gray-200 dark:bg-gray-700 flex items-center justify-center`}>
                                  <span className="text-gray-400 text-sm">Loading thumbnail...</span>
                                </div>
                              )}
                              <video
                                data-lazy-video={media.src}
                                src={visibleVideos.has(media.src) ? media.src : ''}
                                className={`absolute inset-0 w-full h-full object-cover transition-all duration-150 group-hover:scale-105 group-hover:brightness-75 ${visibleVideos.has(media.src) ? 'opacity-100' : 'opacity-0'}`}
                                muted
                                playsInline
                                preload="none"
                                onMouseEnter={(e) => {
                                  // Load video on hover for better UX
                                  const video = e.currentTarget;
                                  if (!video.src && video.getAttribute('data-lazy-video')) {
                                    video.src = video.getAttribute('data-lazy-video') || '';
                                    video.load();
                                    setVisibleVideos(prev => new Set(prev).add(media.src));
                                  }
                                }}
                                onLoadedData={(e) => {
                                  // Fade in video when loaded
                                  e.currentTarget.style.opacity = '1';
                                }}
                              />
                            </div>
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

