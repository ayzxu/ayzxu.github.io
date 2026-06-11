/* ==========================================================================
   MusicWindow — "AndyMusic", a System 1 take on iTunes. Andy's top 10 from
   Spotify in a classic song list with an LCD now-playing display, transport
   controls and a volume slider. Playback is the real songs: 30-second
   previews resolved at runtime from Apple's public iTunes Search API.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { findPreview } from '../lib/itunesPreview';
import { unlockAchievement } from '../lib/achievements';

type Track = {
  title: string;
  artist: string;
  album: string;
  /** display duration, mm:ss — refined with iTunes' real length once known */
  time: string;
};

/* Andy's top 10 (via Spotify) */
const TRACKS: Track[] = [
  { title: "DON'T BELIEVE IT", artist: 'John Summit, Absolutely', album: 'CTRL ESCAPE', time: '3:11' },
  { title: 'Where You Are', artist: 'John Summit, HAYLA', album: 'Comfort In Chaos', time: '3:34' },
  { title: 'how2fly', artist: 'ISOxo', album: 'kidsgonemad!', time: '3:06' },
  { title: 'Whisper My Name', artist: 'Drake', album: 'ICEMAN', time: '3:28' },
  { title: 'Go Back (feat. Julia Church)', artist: 'John Summit, Sub Focus, Julia Church', album: 'Comfort In Chaos', time: '3:42' },
  { title: 'Shiver', artist: 'John Summit, HAYLA', album: 'Comfort In Chaos', time: '3:47' },
  { title: 'End of Line', artist: 'Daft Punk', album: 'TRON: Legacy', time: '2:36' },
  { title: 'New Light', artist: 'John Mayer', album: 'Sob Rock', time: '3:37' },
  { title: "The Man Who Can't Be Moved", artist: 'The Script', album: 'The Script', time: '4:02' },
  { title: 'Delilah (pull me out of this)', artist: 'Fred again.., Delilah Montagu', album: 'Actual Life 3', time: '3:55' },
];

const PROFILE_URL = 'https://open.spotify.com/user/supersaiyanandy';

function spotifySearchUrl(t: Track): string {
  return `https://open.spotify.com/search/${encodeURIComponent(
    `${t.title} ${t.artist.split(',')[0]}`,
  )}`;
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

type PlayState = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

export default function MusicWindow() {
  const [selected, setSelected] = useState(0);
  const [current, setCurrent] = useState<number | null>(null);
  const [state, setState] = useState<PlayState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  /** real song lengths from iTunes, by track index */
  const [realTimes, setRealTimes] = useState<Record<number, string>>({});

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playSeq = useRef(0); // voids stale async loads after skip/close
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const fadeRaf = useRef<number | null>(null);

  /** Cancel a running fade. A cancelled fade must never leave the element
      stuck near volume 0 — that reads as "the player went mute" — so unless
      the caller is about to start a new fade, snap to the slider level. */
  const cancelFade = (restoreVolume: boolean) => {
    if (fadeRaf.current !== null) {
      cancelAnimationFrame(fadeRaf.current);
      fadeRaf.current = null;
    }
    if (restoreVolume && audioRef.current) {
      audioRef.current.volume = volumeRef.current / 100;
    }
  };

  /** Ease the volume from 0 up to the slider level over the first ~0.5s.
      Tracks the slider live, so adjusting it mid-fade still lands right. */
  const fadeIn = (a: HTMLAudioElement, ms = 500) => {
    cancelFade(false);
    const t0 = performance.now();
    a.volume = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      a.volume = (volumeRef.current / 100) * k;
      if (k < 1) {
        fadeRaf.current = requestAnimationFrame(step);
      } else {
        fadeRaf.current = null;
      }
    };
    fadeRaf.current = requestAnimationFrame(step);
  };

  const ensureAudio = (): HTMLAudioElement => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = 'auto';
      a.addEventListener('timeupdate', () => setElapsed(a.currentTime));
      a.addEventListener('loadedmetadata', () => setDuration(a.duration || 30));
      audioRef.current = a;
    }
    return audioRef.current;
  };

  /* keep the element's volume in step with the slider (unless mid-fade —
     the fade reads the slider live and lands on it anyway) */
  useEffect(() => {
    if (audioRef.current && fadeRaf.current === null) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  /* halt playback when the window unmounts (closed / home button) */
  useEffect(
    () => () => {
      playSeq.current++;
      cancelFade(false);
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute('src');
      }
    },
    [],
  );

  const stop = () => {
    playSeq.current++;
    cancelFade(true);
    const a = audioRef.current;
    if (a) a.pause();
    setCurrent(null);
    setState('idle');
    setElapsed(0);
    setDuration(0);
  };

  /** On any failure, surface it briefly then move to the next song —
      never strand the player in a silent dead-end. */
  const failAndAdvance = (seq: number, i: number) => {
    if (seq !== playSeq.current) return;
    setState('error');
    if (i + 1 < TRACKS.length) {
      window.setTimeout(() => {
        if (seq === playSeq.current) void play(i + 1);
      }, 1200);
    }
  };

  const play = async (i: number) => {
    const seq = ++playSeq.current;

    // Silence the outgoing track *synchronously*: kill its fade, detach its
    // onended (so it can't auto-advance underneath us) and pause it. Without
    // this, the old song kept playing through the new track's lookup — and a
    // fade cancelled here used to leave the volume stuck near zero.
    cancelFade(true);
    const prevAudio = audioRef.current;
    if (prevAudio) {
      prevAudio.onended = null;
      prevAudio.pause();
    }

    const track = TRACKS[i];
    setSelected(i);
    setCurrent(i);
    setState('loading');
    setElapsed(0);
    setDuration(0);

    const info = await findPreview(track.title, track.artist);
    if (seq !== playSeq.current) return; // user moved on meanwhile

    if (!info) {
      failAndAdvance(seq, i);
      return;
    }

    if (info.trackTimeMillis > 0) {
      setRealTimes((prev) =>
        prev[i] ? prev : { ...prev, [i]: fmt(info.trackTimeMillis / 1000) },
      );
    }

    const a = ensureAudio();
    a.onended = () => {
      if (seq !== playSeq.current) return;
      if (i + 1 < TRACKS.length) void play(i + 1);
      else stop();
    };
    a.src = info.previewUrl;
    // Pre-mute so playback can't pop at full volume before the fade begins.
    a.volume = 0;
    try {
      await a.play();
      if (seq !== playSeq.current) return;
      // Start the ramp only once audio is actually rolling — previously it
      // raced the network and could finish (or be cancelled) before sound.
      fadeIn(a);
      setState('playing');
      unlockAchievement('music-play');
    } catch {
      // Rejected play() (aborted load / autoplay policy) — the element was
      // pre-muted above, so restore the volume and recover instead of
      // leaving a silent "playing" state.
      a.volume = volumeRef.current / 100;
      failAndAdvance(seq, i);
    }
  };

  const onPlayPause = () => {
    const a = audioRef.current;
    if (state === 'playing' && a) {
      a.pause();
      setState('paused');
    } else if (state === 'paused' && a) {
      fadeIn(a, 300); // gentler, quicker ramp on resume
      a.play().then(
        () => setState('playing'),
        () => {
          cancelFade(true);
          setState('paused');
        },
      );
    } else {
      void play(selected);
    }
  };

  /** Scrub the preview: map pointer x → playback position. Works for a
      click or a held drag, playing or paused. */
  const seekTo = (e: React.PointerEvent<HTMLElement>) => {
    const a = audioRef.current;
    if (!a || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    a.currentTime = frac * duration;
    setElapsed(frac * duration);
  };

  const skip = (dir: 1 | -1) => {
    const base = current ?? selected;
    const next = (base + dir + TRACKS.length) % TRACKS.length;
    if (current !== null) void play(next);
    else setSelected(next);
  };

  const now = current !== null ? TRACKS[current] : null;
  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0;
  const active = state === 'playing' || state === 'paused';

  return (
    <div className="music-content">
      {/* transport + LCD */}
      <div className="music-deck">
        <div className="music-transport">
          <button
            type="button"
            className="mac-button music-btn"
            onClick={() => skip(-1)}
            aria-label="Previous track"
          >
            ⏮
          </button>
          <button
            type="button"
            className="mac-button music-btn music-btn-play"
            onClick={onPlayPause}
            aria-label={state === 'playing' ? 'Pause' : 'Play'}
          >
            {state === 'playing' ? '❚❚' : '▶'}
          </button>
          <button
            type="button"
            className="mac-button music-btn"
            onClick={() => skip(1)}
            aria-label="Next track"
          >
            ⏭
          </button>
        </div>

        <div className="music-lcd">
          {now ? (
            <>
              <div className="music-lcd-title">{now.title}</div>
              <div className="music-lcd-sub">
                {now.artist} — {now.album}
              </div>
              {state === 'loading' && (
                <div className="music-lcd-sub">Dropping the needle…</div>
              )}
              {state === 'error' && (
                <div className="music-lcd-sub">No preview found — skipping</div>
              )}
              {active && (
                <div className="music-lcd-progress">
                  <span className="music-lcd-time">{fmt(elapsed)}</span>
                  <span
                    className="music-progress-track music-progress-seek"
                    role="slider"
                    aria-label="Seek"
                    aria-valuemin={0}
                    aria-valuemax={Math.round(duration)}
                    aria-valuenow={Math.round(elapsed)}
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      seekTo(e);
                    }}
                    onPointerMove={(e) => {
                      if (e.buttons & 1) seekTo(e);
                    }}
                  >
                    <span
                      className="music-progress-fill"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </span>
                  <span className="music-lcd-time">{fmt(duration)}</span>
                </div>
              )}
            </>
          ) : (
            <div className="music-lcd-idle">♫ AndyMusic</div>
          )}
        </div>

        <label className="music-volume" title="Volume">
          <span className="paint-bar-label">Vol</span>
          <input
            type="range"
            className="menu-volume-slider"
            min={0}
            max={100}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            aria-label="Volume"
          />
        </label>
      </div>

      {/* song list */}
      <div className="music-table" role="listbox" aria-label="Top 10 songs">
        <div className="music-row music-row-head">
          <span className="music-cell-num">#</span>
          <span>Song</span>
          <span>Artist</span>
          <span>Album</span>
          <span className="music-cell-time">Time</span>
        </div>
        {TRACKS.map((t, i) => (
          <div
            key={t.title}
            role="option"
            aria-selected={selected === i}
            tabIndex={0}
            className={`music-row${selected === i ? ' selected' : ''}${
              current === i ? ' playing' : ''
            }`}
            onClick={() => setSelected(i)}
            onDoubleClick={() => void play(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void play(i);
            }}
          >
            <span className="music-cell-num">{current === i ? '♪' : i + 1}</span>
            <span className="music-cell-title">{t.title}</span>
            <span>{t.artist}</span>
            <span>{t.album}</span>
            <span className="music-cell-time">{realTimes[i] ?? t.time}</span>
          </div>
        ))}
      </div>

      {/* status bar */}
      <div className="music-statusbar">
        <span className="win-meta">
          10 songs · top tracks from{' '}
          <a href={PROFILE_URL} target="_blank" rel="noreferrer">
            Andy&apos;s Spotify
          </a>
        </span>
        <span className="win-meta">
          {now ? (
            <a href={spotifySearchUrl(now)} target="_blank" rel="noreferrer">
              Full song on Spotify ↗
            </a>
          ) : (
            'Double-click a song · 30s previews via iTunes'
          )}
        </span>
      </div>
    </div>
  );
}
