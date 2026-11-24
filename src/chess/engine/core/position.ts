/* position.ts — a fast board for the engine: 0x88 mailbox, pseudo-legal move
   generation, in-place make/unmake, Zobrist hashing and incrementally kept
   material + piece-square totals.

   chess.js is lovely for rules and SAN at the edges, but generating moves
   through it is far too slow to search more than a couple of plies. This is
   the engine's own board; chess.js is only used to talk to the UI.

   Squares are 0x88: sq = rank * 16 + file, a1 = 0, h1 = 7, a8 = 112. A square
   is on the board iff (sq & 0x88) === 0.

   Pieces: type 1..6 (P N B R Q K); black adds 8. 0 is empty.

   Moves are packed ints:
     bits 0-6   from
     bits 7-13  to
     bits 14-16 promotion piece type (0 = none)
     bits 17-20 flags (CAPTURE, DOUBLE, EP, CASTLE) */

import { PST_EG, PST_MG, PHASE_WEIGHT } from './tables';

export const WHITE = 0;
export const BLACK = 1;

export const PAWN = 1;
export const KNIGHT = 2;
export const BISHOP = 3;
export const ROOK = 4;
export const QUEEN = 5;
export const KING = 6;
export const BLACK_BIT = 8;

export const F_CAPTURE = 1;
export const F_DOUBLE = 2;
export const F_EP = 4;
export const F_CASTLE = 8;

export const moveFrom = (m: number) => m & 0x7f;
export const moveTo = (m: number) => (m >> 7) & 0x7f;
export const movePromo = (m: number) => (m >> 14) & 7;
export const moveFlags = (m: number) => (m >> 17) & 0xf;
export const isCaptureMove = (m: number) => ((m >> 17) & (F_CAPTURE | F_EP)) !== 0;

const encode = (from: number, to: number, promo: number, flags: number) =>
  from | (to << 7) | (promo << 14) | (flags << 17);

export const colorOf = (p: number) => (p & BLACK_BIT ? BLACK : WHITE);
export const typeOf = (p: number) => p & 7;

export const sqFile = (sq: number) => sq & 7;
export const sqRank = (sq: number) => sq >> 4;
export const sqName = (sq: number) => 'abcdefgh'[sq & 7] + ((sq >> 4) + 1);
export function parseSq(name: string): number {
  return (name.charCodeAt(1) - 49) * 16 + (name.charCodeAt(0) - 97);
}

/** 0x88 square -> 0..63 index with a1 = 0 (for the 64-entry tables) */
export const sq64 = (sq: number) => (sq >> 4) * 8 + (sq & 7);

const KNIGHT_DIRS = [33, 31, 18, 14, -33, -31, -18, -14];
const BISHOP_DIRS = [17, 15, -17, -15];
const ROOK_DIRS = [16, -16, 1, -1];
const KING_DIRS = [17, 16, 15, 1, -1, -15, -16, -17];

const CASTLE_WK = 1;
const CASTLE_WQ = 2;
const CASTLE_BK = 4;
const CASTLE_BQ = 8;

/** Castling rights that survive a move touching each square */
const CASTLE_MASK = new Int8Array(128).fill(15);
CASTLE_MASK[0x00] = 15 & ~CASTLE_WQ; // a1
CASTLE_MASK[0x07] = 15 & ~CASTLE_WK; // h1
CASTLE_MASK[0x04] = 15 & ~(CASTLE_WK | CASTLE_WQ); // e1
CASTLE_MASK[0x70] = 15 & ~CASTLE_BQ; // a8
CASTLE_MASK[0x77] = 15 & ~CASTLE_BK; // h8
CASTLE_MASK[0x74] = 15 & ~(CASTLE_BK | CASTLE_BQ); // e8

/* --- Zobrist keys: two 32-bit halves, from a fixed seed ------------------- */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return (t ^ (t >>> 14)) | 0;
  };
}
const rnd = mulberry32(0x5eed);
const Z_PIECE_LO = new Int32Array(16 * 128);
const Z_PIECE_HI = new Int32Array(16 * 128);
for (let i = 0; i < 16 * 128; i++) {
  Z_PIECE_LO[i] = rnd();
  Z_PIECE_HI[i] = rnd();
}
const Z_SIDE_LO = rnd();
const Z_SIDE_HI = rnd();
const Z_CASTLE_LO = Int32Array.from({ length: 16 }, rnd);
const Z_CASTLE_HI = Int32Array.from({ length: 16 }, rnd);
const Z_EP_LO = Int32Array.from({ length: 8 }, rnd);
const Z_EP_HI = Int32Array.from({ length: 8 }, rnd);

const MAX_HISTORY = 1024;

export class Position {
  board = new Int8Array(128);
  side = WHITE;
  castling = 0;
  /** en-passant target square, or -1 */
  ep = -1;
  halfmove = 0;
  fullmove = 1;
  kings = [0, 0];
  hashLo = 0;
  hashHi = 0;
  /** material + piece-square totals per colour, midgame and endgame */
  mg = [0, 0];
  eg = [0, 0];
  /** game phase from remaining non-pawn material: 24 = all pieces, 0 = none */
  phase = 0;

  /* Undo stack (and the hash history repetition checks walk back through) */
  ply = 0;
  private sMove = new Int32Array(MAX_HISTORY);
  private sCaptured = new Int8Array(MAX_HISTORY);
  private sCastling = new Int8Array(MAX_HISTORY);
  private sEp = new Int16Array(MAX_HISTORY);
  private sHalf = new Int16Array(MAX_HISTORY);
  hLo = new Int32Array(MAX_HISTORY);
  hHi = new Int32Array(MAX_HISTORY);

  static fromFen(fen: string): Position {
    const p = new Position();
    p.setFen(fen);
    return p;
  }

  setFen(fen: string): void {
    const [placement, side, castling, ep, half, full] = fen.trim().split(/\s+/);
    this.board.fill(0);
    this.mg = [0, 0];
    this.eg = [0, 0];
    this.phase = 0;
    this.hashLo = 0;
    this.hashHi = 0;
    let rank = 7;
    let file = 0;
    for (const ch of placement) {
      if (ch === '/') {
        rank--;
        file = 0;
      } else if (ch >= '1' && ch <= '8') {
        file += Number(ch);
      } else {
        const lower = ch.toLowerCase();
        const type = ' pnbrqk'.indexOf(lower);
        const piece = type | (ch === lower ? BLACK_BIT : 0);
        this.put(piece, rank * 16 + file);
        file++;
      }
    }
    this.side = side === 'b' ? BLACK : WHITE;
    if (this.side === BLACK) {
      this.hashLo ^= Z_SIDE_LO;
      this.hashHi ^= Z_SIDE_HI;
    }
    this.castling = 0;
    if (castling && castling !== '-') {
      if (castling.includes('K')) this.castling |= CASTLE_WK;
      if (castling.includes('Q')) this.castling |= CASTLE_WQ;
      if (castling.includes('k')) this.castling |= CASTLE_BK;
      if (castling.includes('q')) this.castling |= CASTLE_BQ;
    }
    this.hashLo ^= Z_CASTLE_LO[this.castling];
    this.hashHi ^= Z_CASTLE_HI[this.castling];
    this.ep = ep && ep !== '-' ? parseSq(ep) : -1;
    if (this.ep >= 0) {
      this.hashLo ^= Z_EP_LO[this.ep & 7];
      this.hashHi ^= Z_EP_HI[this.ep & 7];
    }
    this.halfmove = Number(half ?? 0) || 0;
    this.fullmove = Number(full ?? 1) || 1;
    this.ply = 0;
    this.hLo[0] = this.hashLo;
    this.hHi[0] = this.hashHi;
  }

  toFen(): string {
    let s = '';
    for (let r = 7; r >= 0; r--) {
      let empty = 0;
      for (let f = 0; f < 8; f++) {
        const p = this.board[r * 16 + f];
        if (!p) {
          empty++;
          continue;
        }
        if (empty) {
          s += empty;
          empty = 0;
        }
        const ch = ' pnbrqk'[typeOf(p)];
        s += colorOf(p) === WHITE ? ch.toUpperCase() : ch;
      }
      if (empty) s += empty;
      if (r) s += '/';
    }
    let c = '';
    if (this.castling & CASTLE_WK) c += 'K';
    if (this.castling & CASTLE_WQ) c += 'Q';
    if (this.castling & CASTLE_BK) c += 'k';
    if (this.castling & CASTLE_BQ) c += 'q';
    return `${s} ${this.side === WHITE ? 'w' : 'b'} ${c || '-'} ${
      this.ep >= 0 ? sqName(this.ep) : '-'
    } ${this.halfmove} ${this.fullmove}`;
  }

  /* --- piece placement, keeping hash and eval totals in step ------------- */
  private put(piece: number, sq: number): void {
    this.board[sq] = piece;
    const c = colorOf(piece);
    const t = typeOf(piece);
    const i = c === WHITE ? sq64(sq) : sq64(sq) ^ 56;
    this.mg[c] += PST_MG[t][i];
    this.eg[c] += PST_EG[t][i];
    this.phase += PHASE_WEIGHT[t];
    if (t === KING) this.kings[c] = sq;
    this.hashLo ^= Z_PIECE_LO[piece * 128 + sq];
    this.hashHi ^= Z_PIECE_HI[piece * 128 + sq];
  }

  private remove(sq: number): void {
    const piece = this.board[sq];
    const c = colorOf(piece);
    const t = typeOf(piece);
    const i = c === WHITE ? sq64(sq) : sq64(sq) ^ 56;
    this.mg[c] -= PST_MG[t][i];
    this.eg[c] -= PST_EG[t][i];
    this.phase -= PHASE_WEIGHT[t];
    this.hashLo ^= Z_PIECE_LO[piece * 128 + sq];
    this.hashHi ^= Z_PIECE_HI[piece * 128 + sq];
    this.board[sq] = 0;
  }

  /* --- attacks ------------------------------------------------------------ */

  /** Is `sq` attacked by any piece of colour `by`? */
  attacked(sq: number, by: number): boolean {
    const b = this.board;
    const cbit = by === BLACK ? BLACK_BIT : 0;
    // Pawns: a white pawn attacks up-left/up-right, so look down from sq.
    if (by === WHITE) {
      if (!((sq - 15) & 0x88) && b[sq - 15] === PAWN) return true;
      if (!((sq - 17) & 0x88) && b[sq - 17] === PAWN) return true;
    } else {
      if (!((sq + 15) & 0x88) && b[sq + 15] === (PAWN | BLACK_BIT)) return true;
      if (!((sq + 17) & 0x88) && b[sq + 17] === (PAWN | BLACK_BIT)) return true;
    }
    for (const d of KNIGHT_DIRS) {
      const t = sq + d;
      if (!(t & 0x88) && b[t] === (KNIGHT | cbit)) return true;
    }
    for (const d of KING_DIRS) {
      const t = sq + d;
      if (!(t & 0x88) && b[t] === (KING | cbit)) return true;
    }
    for (const d of BISHOP_DIRS) {
      let t = sq + d;
      while (!(t & 0x88)) {
        const p = b[t];
        if (p) {
          if (p === (BISHOP | cbit) || p === (QUEEN | cbit)) return true;
          break;
        }
        t += d;
      }
    }
    for (const d of ROOK_DIRS) {
      let t = sq + d;
      while (!(t & 0x88)) {
        const p = b[t];
        if (p) {
          if (p === (ROOK | cbit) || p === (QUEEN | cbit)) return true;
          break;
        }
        t += d;
      }
    }
    return false;
  }

  inCheck(side: number = this.side): boolean {
    return this.attacked(this.kings[side], side ^ 1);
  }

  /* --- move generation ---------------------------------------------------- */

  /** Pseudo-legal moves into `out` from index `n`; returns the new count.
      With `capturesOnly`, only captures and queen promotions. */
  generate(out: Int32Array, n: number, capturesOnly = false): number {
    const b = this.board;
    const us = this.side;
    const them = us ^ 1;
    const ubit = us === BLACK ? BLACK_BIT : 0;
    const up = us === WHITE ? 16 : -16;
    const startRank = us === WHITE ? 1 : 6;
    const promoRank = us === WHITE ? 7 : 0;

    for (let sq = 0; sq < 128; sq++) {
      if (sq & 0x88) {
        sq += 7;
        continue;
      }
      const p = b[sq];
      if (!p || (p & BLACK_BIT) !== ubit) continue;
      const t = p & 7;

      if (t === PAWN) {
        const one = sq + up;
        if (!(one & 0x88) && !b[one]) {
          if (sqRank(one) === promoRank) {
            n = this.addPromotions(out, n, sq, one, 0, capturesOnly);
          } else if (!capturesOnly) {
            out[n++] = encode(sq, one, 0, 0);
            const two = one + up;
            if (sqRank(sq) === startRank && !b[two]) out[n++] = encode(sq, two, 0, F_DOUBLE);
          }
        }
        for (const side of [up - 1, up + 1]) {
          const to = sq + side;
          if (to & 0x88) continue;
          const target = b[to];
          if (target && colorOf(target) === them) {
            if (sqRank(to) === promoRank) {
              n = this.addPromotions(out, n, sq, to, F_CAPTURE, capturesOnly);
            } else out[n++] = encode(sq, to, 0, F_CAPTURE);
          } else if (to === this.ep) {
            out[n++] = encode(sq, to, 0, F_EP);
          }
        }
        continue;
      }

      if (t === KNIGHT || t === KING) {
        const dirs = t === KNIGHT ? KNIGHT_DIRS : KING_DIRS;
        for (const d of dirs) {
          const to = sq + d;
          if (to & 0x88) continue;
          const target = b[to];
          if (!target) {
            if (!capturesOnly) out[n++] = encode(sq, to, 0, 0);
          } else if (colorOf(target) === them) out[n++] = encode(sq, to, 0, F_CAPTURE);
        }
        continue;
      }

      const dirs = t === BISHOP ? BISHOP_DIRS : t === ROOK ? ROOK_DIRS : KING_DIRS;
      for (const d of dirs) {
        let to = sq + d;
        while (!(to & 0x88)) {
          const target = b[to];
          if (!target) {
            if (!capturesOnly) out[n++] = encode(sq, to, 0, 0);
          } else {
            if (colorOf(target) === them) out[n++] = encode(sq, to, 0, F_CAPTURE);
            break;
          }
          to += d;
        }
      }
    }

    if (!capturesOnly) n = this.addCastles(out, n);
    return n;
  }

  private addPromotions(
    out: Int32Array,
    n: number,
    from: number,
    to: number,
    flags: number,
    capturesOnly: boolean,
  ): number {
    out[n++] = encode(from, to, QUEEN, flags);
    if (!capturesOnly) {
      out[n++] = encode(from, to, KNIGHT, flags);
      out[n++] = encode(from, to, ROOK, flags);
      out[n++] = encode(from, to, BISHOP, flags);
    }
    return n;
  }

  private addCastles(out: Int32Array, n: number): number {
    const b = this.board;
    if (this.side === WHITE) {
      if (this.castling & CASTLE_WK && !b[5] && !b[6] && b[7] === ROOK &&
          !this.attacked(4, BLACK) && !this.attacked(5, BLACK) && !this.attacked(6, BLACK)) {
        out[n++] = encode(4, 6, 0, F_CASTLE);
      }
      if (this.castling & CASTLE_WQ && !b[3] && !b[2] && !b[1] && b[0] === ROOK &&
          !this.attacked(4, BLACK) && !this.attacked(3, BLACK) && !this.attacked(2, BLACK)) {
        out[n++] = encode(4, 2, 0, F_CASTLE);
      }
    } else {
      if (this.castling & CASTLE_BK && !b[0x75] && !b[0x76] && b[0x77] === (ROOK | BLACK_BIT) &&
          !this.attacked(0x74, WHITE) && !this.attacked(0x75, WHITE) && !this.attacked(0x76, WHITE)) {
        out[n++] = encode(0x74, 0x76, 0, F_CASTLE);
      }
      if (this.castling & CASTLE_BQ && !b[0x73] && !b[0x72] && !b[0x71] && b[0x70] === (ROOK | BLACK_BIT) &&
          !this.attacked(0x74, WHITE) && !this.attacked(0x73, WHITE) && !this.attacked(0x72, WHITE)) {
        out[n++] = encode(0x74, 0x72, 0, F_CASTLE);
      }
    }
    return n;
  }

  /* --- make / unmake ------------------------------------------------------ */

  /** Play a pseudo-legal move. Returns false (and leaves the position as it
      was) if it would leave the mover's king in check. */
  make(m: number): boolean {
    const from = m & 0x7f;
    const to = (m >> 7) & 0x7f;
    const promo = (m >> 14) & 7;
    const flags = (m >> 17) & 0xf;
    const us = this.side;
    const piece = this.board[from];

    const i = this.ply;
    this.sMove[i] = m;
    this.sCastling[i] = this.castling;
    this.sEp[i] = this.ep;
    this.sHalf[i] = this.halfmove;

    // Clear the old en-passant and castling keys; re-added below.
    if (this.ep >= 0) {
      this.hashLo ^= Z_EP_LO[this.ep & 7];
      this.hashHi ^= Z_EP_HI[this.ep & 7];
    }
    this.hashLo ^= Z_CASTLE_LO[this.castling];
    this.hashHi ^= Z_CASTLE_HI[this.castling];

    let captured = 0;
    if (flags & F_EP) {
      const capSq = to + (us === WHITE ? -16 : 16);
      captured = this.board[capSq];
      this.remove(capSq);
    } else if (this.board[to]) {
      captured = this.board[to];
      this.remove(to);
    }
    this.sCaptured[i] = captured;

    this.remove(from);
    this.put(promo ? promo | (us === BLACK ? BLACK_BIT : 0) : piece, to);

    if (flags & F_CASTLE) {
      // Move the rook alongside the king.
      if (to === from + 2) {
        const rook = this.board[from + 3];
        this.remove(from + 3);
        this.put(rook, from + 1);
      } else {
        const rook = this.board[from - 4];
        this.remove(from - 4);
        this.put(rook, from - 1);
      }
    }

    this.castling &= CASTLE_MASK[from] & CASTLE_MASK[to];
    this.ep = flags & F_DOUBLE ? (from + to) >> 1 : -1;
    if (this.ep >= 0) {
      this.hashLo ^= Z_EP_LO[this.ep & 7];
      this.hashHi ^= Z_EP_HI[this.ep & 7];
    }
    this.hashLo ^= Z_CASTLE_LO[this.castling];
    this.hashHi ^= Z_CASTLE_HI[this.castling];

    this.halfmove = (piece & 7) === PAWN || captured ? 0 : this.halfmove + 1;
    if (us === BLACK) this.fullmove++;
    this.side ^= 1;
    this.hashLo ^= Z_SIDE_LO;
    this.hashHi ^= Z_SIDE_HI;
    this.ply++;
    this.hLo[this.ply] = this.hashLo;
    this.hHi[this.ply] = this.hashHi;

    if (this.attacked(this.kings[us], us ^ 1)) {
      this.unmake();
      return false;
    }
    return true;
  }

  unmake(): void {
    this.ply--;
    const i = this.ply;
    const m = this.sMove[i];
    const from = m & 0x7f;
    const to = (m >> 7) & 0x7f;
    const promo = (m >> 14) & 7;
    const flags = (m >> 17) & 0xf;
    this.side ^= 1;
    const us = this.side;
    if (us === BLACK) this.fullmove--;

    const moved = this.board[to];
    this.remove(to);
    this.put(promo ? PAWN | (us === BLACK ? BLACK_BIT : 0) : moved, from);

    const captured = this.sCaptured[i];
    if (captured) {
      this.put(captured, flags & F_EP ? to + (us === WHITE ? -16 : 16) : to);
    }
    if (flags & F_CASTLE) {
      if (to === from + 2) {
        const rook = this.board[from + 1];
        this.remove(from + 1);
        this.put(rook, from + 3);
      } else {
        const rook = this.board[from - 1];
        this.remove(from - 1);
        this.put(rook, from - 4);
      }
    }

    this.castling = this.sCastling[i];
    this.ep = this.sEp[i];
    this.halfmove = this.sHalf[i];
    this.hashLo = this.hLo[i];
    this.hashHi = this.hHi[i];
  }

  /** A "pass" for null-move pruning. Must be undone with unmakeNull(). */
  makeNull(): void {
    const i = this.ply;
    this.sMove[i] = 0;
    this.sEp[i] = this.ep;
    this.sHalf[i] = this.halfmove;
    this.sCastling[i] = this.castling;
    if (this.ep >= 0) {
      this.hashLo ^= Z_EP_LO[this.ep & 7];
      this.hashHi ^= Z_EP_HI[this.ep & 7];
    }
    this.ep = -1;
    this.side ^= 1;
    this.hashLo ^= Z_SIDE_LO;
    this.hashHi ^= Z_SIDE_HI;
    this.halfmove++;
    this.ply++;
    this.hLo[this.ply] = this.hashLo;
    this.hHi[this.ply] = this.hashHi;
  }

  unmakeNull(): void {
    this.ply--;
    const i = this.ply;
    this.side ^= 1;
    this.ep = this.sEp[i];
    this.halfmove = this.sHalf[i];
    this.hashLo = this.hLo[i];
    this.hashHi = this.hHi[i];
  }

  /** Has this position occurred before within the reversible stretch?
      (One earlier occurrence is enough to call it a draw inside the search.) */
  isRepetition(): boolean {
    const stop = Math.max(0, this.ply - this.halfmove);
    for (let i = this.ply - 2; i >= stop; i -= 2) {
      if (this.hLo[i] === this.hashLo && this.hHi[i] === this.hashHi) return true;
    }
    return false;
  }

  /** All legal moves (slow path, for the root and the edges). */
  legalMoves(): number[] {
    const buf = new Int32Array(256);
    const n = this.generate(buf, 0);
    const out: number[] = [];
    for (let k = 0; k < n; k++) {
      if (this.make(buf[k])) {
        this.unmake();
        out.push(buf[k]);
      }
    }
    return out;
  }

  /** Find the legal move matching from/to/promotion (UCI-style), or 0. */
  findMove(from: string, to: string, promotion?: string): number {
    const f = parseSq(from);
    const t = parseSq(to);
    const pr = promotion ? ' pnbrqk'.indexOf(promotion.toLowerCase()) : 0;
    for (const m of this.legalMoves()) {
      if (moveFrom(m) === f && moveTo(m) === t && movePromo(m) === (pr > 0 ? pr : 0)) {
        return m;
      }
    }
    return 0;
  }
}

/** UCI-ish text for a move: e2e4, e7e8q */
export function moveToUci(m: number): string {
  const pr = movePromo(m);
  return sqName(moveFrom(m)) + sqName(moveTo(m)) + (pr ? ' pnbrqk'[pr] : '');
}
