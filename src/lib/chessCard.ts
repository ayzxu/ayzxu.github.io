/* ==========================================================================
   chessCard.ts — render a 1200×630 shareable result card for a finished game
   against the Andy Chess Bot. Pure <canvas>, drawn in the same 1-bit System 1
   look as the live board: white squares, a 25%-stipple for dark squares, hard
   black borders, and newspaper-diagram chess glyphs (outline = white pieces,
   solid = black pieces). The output is a PNG Blob for navigator.share or a
   download.
   ========================================================================== */

import { Chess, type Color, type PieceSymbol } from 'chess.js';

export type ResultCardOptions = {
  /** FEN of the final position to draw. */
  fen: string;
  /** Orient the board from this side's perspective. */
  orientation: 'white' | 'black';
  /** Big result line, e.g. "I drew Andy's bot in 31 moves". */
  headline: string;
  /** One or two short stat lines under the headline. */
  sublines: string[];
  /** Footer line, e.g. the site URL. */
  footer: string;
};

const W = 1200;
const H = 630;
const MARGIN = 56;
const BOARD = 512; // 8 × 64
const SQUARE = BOARD / 8;

/* Newspaper-diagram glyphs: outline for White, solid for Black, all inked black
   so White pieces read as outlines on the light board. */
const GLYPH: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

/** True for the dark square at (file, rank) with a1 dark. */
function isDark(file: number, rank: number): boolean {
  return (file + rank) % 2 === 0;
}

/** A 25%-black stipple pattern matching the live board's dithered dark squares. */
function makeStipple(ctx: CanvasRenderingContext2D): CanvasPattern | string {
  const tile = document.createElement('canvas');
  tile.width = 2;
  tile.height = 2;
  const tctx = tile.getContext('2d');
  if (!tctx) return '#cccccc';
  tctx.fillStyle = '#ffffff';
  tctx.fillRect(0, 0, 2, 2);
  tctx.fillStyle = '#000000';
  tctx.fillRect(0, 0, 1, 1); // one of four px → 25% ink
  return ctx.createPattern(tile, 'repeat') ?? '#cccccc';
}

async function ensureFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  try {
    await Promise.all([
      document.fonts.load('400 64px "VT323"'),
      document.fonts.load('400 20px "Press Start 2P"'),
      document.fonts.ready,
    ]);
  } catch {
    /* fall back to system monospace */
  }
}

function drawBoard(
  ctx: CanvasRenderingContext2D,
  fen: string,
  orientation: 'white' | 'black',
  x0: number,
  y0: number,
): void {
  const stipple = makeStipple(ctx);
  const board = new Chess(fen).board(); // row 0 = rank 8, col 0 = file a

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      // Map screen cell → board indices, honouring orientation.
      const boardRow = orientation === 'white' ? r : 7 - r;
      const boardCol = orientation === 'white' ? f : 7 - f;
      const x = x0 + f * SQUARE;
      const y = y0 + r * SQUARE;

      // Square fill: file index a=0…h=7 → rank number is 8-boardRow.
      const fileIdx = boardCol;
      const rankNum = 8 - boardRow;
      ctx.fillStyle = isDark(fileIdx, rankNum - 1) ? (stipple as string) : '#ffffff';
      ctx.fillRect(x, y, SQUARE, SQUARE);

      const piece = board[boardRow][boardCol];
      if (piece) {
        ctx.fillStyle = '#000000';
        ctx.font =
          `${Math.round(SQUARE * 0.78)}px "Segoe UI Symbol","Apple Symbols",` +
          '"Noto Sans Symbols2","DejaVu Sans",sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(
          GLYPH[piece.color][piece.type],
          x + SQUARE / 2,
          y + SQUARE / 2 + SQUARE * 0.04,
        );
      }
    }
  }

  // Grid + hard outer border.
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  for (let i = 1; i < 8; i++) {
    ctx.beginPath();
    ctx.moveTo(x0 + i * SQUARE, y0);
    ctx.lineTo(x0 + i * SQUARE, y0 + BOARD);
    ctx.moveTo(x0, y0 + i * SQUARE);
    ctx.lineTo(x0 + BOARD, y0 + i * SQUARE);
    ctx.stroke();
  }
  ctx.lineWidth = 4;
  ctx.strokeRect(x0 - 2, y0 - 2, BOARD + 4, BOARD + 4);
}

/** Draw `text` at `size`, shrinking until it fits `maxWidth`. Returns the size used. */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  size: number,
  maxWidth: number,
  fontFamily: string,
  minSize = 24,
): number {
  let s = size;
  for (; s > minSize; s -= 2) {
    ctx.font = `400 ${s}px ${fontFamily}`;
    if (ctx.measureText(text).width <= maxWidth) break;
  }
  ctx.font = `400 ${s}px ${fontFamily}`;
  return s;
}

/** Build the result card and resolve to a PNG Blob. */
export async function buildResultCard(opts: ResultCardOptions): Promise<Blob> {
  await ensureFonts();

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Card background + frame.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, W - 6, H - 6);

  // Board on the left, vertically centred.
  const boardX = MARGIN;
  const boardY = (H - BOARD) / 2;
  drawBoard(ctx, opts.fen, opts.orientation, boardX, boardY);

  // Text column on the right.
  const tx = boardX + BOARD + 48;
  const maxW = W - tx - MARGIN;
  ctx.textAlign = 'left';
  ctx.fillStyle = '#000000';

  // Kicker.
  ctx.textBaseline = 'alphabetic';
  ctx.font = '400 20px "Press Start 2P", monospace';
  ctx.fillText('ANDY CHESS BOT', tx, 132);

  // Headline (auto-fit, wrap to two lines on whitespace if needed).
  const family = '"VT323", monospace';
  let y = 210;
  const headlineSize = fitText(ctx, opts.headline, 76, maxW, family, 40);
  if (ctx.measureText(opts.headline).width <= maxW) {
    ctx.fillText(opts.headline, tx, y);
    y += headlineSize + 6;
  } else {
    // Greedy two-line wrap.
    const words = opts.headline.split(' ');
    let line = '';
    const lines: string[] = [];
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    for (const l of lines.slice(0, 2)) {
      ctx.fillText(l, tx, y);
      y += headlineSize - 4;
    }
    y += 12;
  }

  // Sublines.
  ctx.font = `400 38px ${family}`;
  for (const line of opts.sublines) {
    y += 46;
    ctx.fillText(line, tx, y);
  }

  // Footer pinned to the bottom of the text column.
  ctx.font = `400 32px ${family}`;
  ctx.fillText(opts.footer, tx, H - 70);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode card image'));
    }, 'image/png');
  });
}

/** Share the card via the Web Share API when available, else download it.
    Returns 'shared' | 'downloaded'. */
export async function shareOrDownloadCard(
  blob: Blob,
  text: string,
  filename = 'andy-chess.png',
): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
  };
  if (nav.canShare && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: 'Andy Chess Bot', text });
      return 'shared';
    } catch {
      /* user cancelled or share failed — fall through to download */
    }
  }
  downloadCard(blob, filename);
  return 'downloaded';
}

/** Force a PNG download of the card. */
export function downloadCard(blob: Blob, filename = 'andy-chess.png'): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
