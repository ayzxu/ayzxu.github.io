/* ==========================================================================
   MusicWindow — "AndyMusic", a System 1 take on iTunes. Andy's top 10 from
   Spotify in a classic song list with an LCD now-playing display, transport
   controls and a volume slider. The play button performs an original
   procedurally-generated chiptune "preview" of each song's vibe (we are NOT
   streaming — nor transcribing — the real tracks).
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import {
  setChiptuneVolume,
  getChiptuneVolume,
  startChiptune,
  stopChiptune,
  type ChiptuneSpec,
} from '../lib/chiptune';
import { unlockAchievement } from '../lib/achievements';

type Track = {
  title: string;
  artist: string;
  album: string;
  /** display duration of the real song, mm:ss */
  time: string;
  spec: ChiptuneSpec;
};

/* Andy's top 10 (via Spotify). Chiptune specs are vibe-matched: bpm, key
   and style only — the melodies are generated, original, and 1-bit. */
const TRACKS: Track[] = [
  {
    title: "DON'T BELIEVE IT",
    artist: 'John Summit, Absolutely',
    album: 'CTRL ESCAPE',
    time: '3:11',
    spec: { seed: 11, bpm: 126, root: 45, minor: true, style: 'house' },
  },
  {
    title: 'Where You Are',
    artist: 'John Summit, HAYLA',
    album: 'Comfort In Chaos',
    time: '3:34',
    spec: { seed: 22, bpm: 124, root: 47, minor: true, style: 'house' },
  },
  {
    title: 'how2fly',
    artist: 'ISOxo',
    album: 'kidsgonemad!',
    time: '3:06',
    spec: { seed: 33, bpm: 145, root: 44, minor: true, style: 'rave' },
  },
  {
    title: 'Whisper My Name',
    artist: 'Drake',
    album: 'ICEMAN',
    time: '3:28',
    spec: { seed: 44, bpm: 86, root: 43, minor: true, style: 'trap' },
  },
  {
    title: 'Go Back (feat. Julia Church)',
    artist: 'John Summit, Sub Focus, Julia Church',
    album: 'Comfort In Chaos',
    time: '3:42',
    spec: { seed: 55, bpm: 140, root: 46, minor: true, style: 'rave' },
  },
  {
    title: 'Shiver',
    artist: 'John Summit, HAYLA',
    album: 'Comfort In Chaos',
    time: '3:47',
    spec: { seed: 66, bpm: 126, root: 45, minor: true, style: 'house' },
  },
  {
    title: 'End of Line',
    artist: 'Daft Punk',
    album: 'TRON: Legacy',
    time: '2:36',
    spec: { seed: 77, bpm: 110, root: 43, minor: true, style: 'house' },
  },
  {
    title: 'New Light',
    artist: 'John Mayer',
    album: 'Sob Rock',
    time: '3:37',
    spec: { seed: 88, bpm: 96, root: 48, minor: false, style: 'pop' },
  },
  {
    title: "The Man Who Can't Be Moved",
    artist: 'The Script',
    album: 'The Script',
    time: '4:02',
    spec: { seed: 99, bpm: 100, root: 46, minor: false, style: 'ballad' },
  },
  {
    title: 'Delilah (pull me out of this)',
    artist: 'Fred again.., Delilah Montagu',
    album: 'Actual Life 3',
    time: '3:55',
    spec: { seed: 110, bpm: 124, root: 45, minor: true, style: 'house' },
  },
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

export default function MusicWindow() {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(() => Math.round(getChiptuneVolume() * 100));

  const tickRef = useRef<number | null>(null);
  const playingRef = useRef<number | null>(null);
  playingRef.current = playing;

  const clearTick = () => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
  };

  /* stop audio when the window unmounts (closed) */
  useEffect(
    () => () => {
      stopChiptune();
      clearTick();
    },
    [],
  );

  const stop = () => {
    stopChiptune();
    clearTick();
    setPlaying(null);
    setElapsed(0);
    setDuration(0);
  };

  const play = (i: number) => {
    clearTick();
    const track = TRACKS[i];
    const dur = startChiptune(track.spec, () => {
      // auto-advance like iTunes; stop after the last song
      const cur = playingRef.current;
      if (cur !== null && cur + 1 < TRACKS.length) play(cur + 1);
      else stop();
    });
    setPlaying(i);
    setSelected(i);
    setElapsed(0);
    setDuration(dur);
    unlockAchievement('music-play');
    const startedAt = Date.now();
    tickRef.current = window.setInterval(
      () => setElapsed((Date.now() - startedAt) / 1000),
      250,
    );
  };

  const onPlayPause = () => {
    if (playing !== null) stop();
    else play(selected);
  };

  const skip = (dir: 1 | -1) => {
    const base = playing ?? selected;
    const next = (base + dir + TRACKS.length) % TRACKS.length;
    if (playing !== null) play(next);
    else setSelected(next);
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    setChiptuneVolume(v / 100);
  };

  const now = playing !== null ? TRACKS[playing] : null;
  const progress = duration > 0 ? Math.min(1, elapsed / duration) : 0;

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
            aria-label={playing !== null ? 'Stop' : 'Play'}
          >
            {playing !== null ? '■' : '▶'}
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
              <div className="music-lcd-progress">
                <span className="music-lcd-time">{fmt(elapsed)}</span>
                <span className="music-progress-track">
                  <span
                    className="music-progress-fill"
                    style={{ width: `${progress * 100}%` }}
                  />
                </span>
                <span className="music-lcd-time">{fmt(duration)}</span>
              </div>
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
            onChange={(e) => changeVolume(Number(e.target.value))}
            aria-label="Preview volume"
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
              playing === i ? ' playing' : ''
            }`}
            onClick={() => setSelected(i)}
            onDoubleClick={() => play(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') play(i);
            }}
          >
            <span className="music-cell-num">{playing === i ? '♪' : i + 1}</span>
            <span className="music-cell-title">{t.title}</span>
            <span>{t.artist}</span>
            <span>{t.album}</span>
            <span className="music-cell-time">{t.time}</span>
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
              Hear the real thing ↗
            </a>
          ) : (
            'Double-click a song to preview'
          )}
        </span>
      </div>
    </div>
  );
}
