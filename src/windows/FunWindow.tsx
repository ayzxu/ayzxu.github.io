/* ==========================================================================
   FunWindow — the Fun folder contents. Renders each interest as a content
   block; the Chess block is special-cased to show a live board reflecting the
   most recent Chess.com game (see useChessGame).
   ========================================================================== */

import { useMemo } from 'react';
import { Chessboard } from 'react-chessboard';
import type { ChessboardOptions } from 'react-chessboard';
import { funItems } from '../data/fun';
import Thumb from '../components/Thumb';
import { useChessGame } from '../components/useChessGame';

type FunWindowProps = {
  onOpenImage: (src: string, alt: string) => void;
};

/* 50%-gray dither for the dark squares — pure 1-bit Macintosh texture */
const DITHER = {
  backgroundColor: '#ffffff',
  backgroundImage:
    'repeating-conic-gradient(#000000 0% 25%, #ffffff 0% 50%)',
  backgroundSize: '6px 6px',
} as const;

export default function FunWindow({ onOpenImage }: FunWindowProps) {
  const { ratings, latestGame, boardFen } = useChessGame();

  // Board is static (display only) and styled to match the 1-bit desktop
  const chessOptions: ChessboardOptions = useMemo(
    () => ({
      position: boardFen,
      boardOrientation: latestGame?.userColor ?? 'white',
      allowDragging: false,
      allowDrawingArrows: false,
      showNotation: false,
      animationDurationInMs: 0,
      darkSquareStyle: DITHER,
      lightSquareStyle: { backgroundColor: '#ffffff' },
    }),
    [boardFen, latestGame?.userColor],
  );

  return (
    <>
      {funItems.map((item, i) => (
        <div key={item.title} className="win-block">
          <div className="win-sub">{item.title}</div>

          <div style={{ marginTop: 6 }}>
            {item.description.map((line, j) => (
              <p key={j} style={{ margin: '2px 0' }}>
                {line}
              </p>
            ))}
          </div>

          {/* Chess block: live board + current ratings */}
          {item.live && (
            <>
              <p style={{ margin: '2px 0' }}>
                Currently rated {ratings.bullet} Bullet, {ratings.rapid}{' '}
                Rapid, {ratings.blitz} Blitz.
              </p>
              <div className="chess-board-wrap">
                <Chessboard
                  key={`board-${boardFen}`}
                  options={chessOptions}
                />
              </div>
              {latestGame && (
                <p className="win-meta" style={{ marginTop: 6 }}>
                  Last game: {latestGame.result} vs {latestGame.opponent} —{' '}
                  <a href={latestGame.url} target="_blank" rel="noreferrer">
                    review
                  </a>
                </p>
              )}
            </>
          )}

          {/* Plain photo galleries */}
          {item.images && item.images.length > 0 && (
            <div className="thumb-row">
              {item.images.map((img) => (
                <Thumb
                  key={img.src}
                  src={img.src}
                  alt={img.alt}
                  onOpen={onOpenImage}
                />
              ))}
            </div>
          )}

          {/* Mixed media — images enlarge, videos play inline */}
          {item.media && item.media.length > 0 && (
            <div className="thumb-row">
              {item.media.map((m) =>
                m.type === 'video' ? (
                  <video
                    key={m.src}
                    controls
                    muted
                    playsInline
                    preload="none"
                    poster={m.poster}
                    className="bw-img media-video"
                  >
                    <source src={m.src} type="video/webm" />
                    {m.mp4 && <source src={m.mp4} type="video/mp4" />}
                  </video>
                ) : (
                  <Thumb
                    key={m.src}
                    src={m.src}
                    alt={m.alt}
                    onOpen={onOpenImage}
                  />
                ),
              )}
            </div>
          )}

          {/* External links */}
          {item.links && item.links.length > 0 && (
            <p style={{ marginTop: 8 }}>
              {item.links.map((l, k) => (
                <span key={l.name}>
                  <a href={l.url} target="_blank" rel="noreferrer">
                    {l.name}
                  </a>
                  {k < item.links!.length - 1 ? '  •  ' : ''}
                </span>
              ))}
            </p>
          )}

          {i < funItems.length - 1 && <hr className="mac-rule" />}
        </div>
      ))}
    </>
  );
}
