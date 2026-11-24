/* evaluate.ts — static evaluation for the core engine, in centipawns from the
   side to move's point of view.

   PeSTO's tapered material + piece-square tables are kept incrementally by the
   Position; on top of those, one pass over the board adds what tables can't
   see: pawn structure (doubled, isolated, passed), the bishop pair, rooks on
   open files, piece mobility, the king's pawn shield, and pressure on the
   king's zone. All terms are tapered between middlegame and endgame. */

import {
  BISHOP,
  BLACK,
  BLACK_BIT,
  KING,
  KNIGHT,
  PAWN,
  Position,
  QUEEN,
  ROOK,
  WHITE,
} from './position';
import { PHASE_MAX } from './tables';

const KNIGHT_DIRS = [33, 31, 18, 14, -33, -31, -18, -14];
const BISHOP_DIRS = [17, 15, -17, -15];
const ROOK_DIRS = [16, -16, 1, -1];
const QUEEN_DIRS = [17, 16, 15, 1, -1, -15, -16, -17];

/* Pawn structure */
const DOUBLED_MG = 10;
const DOUBLED_EG = 20;
const ISOLATED_MG = 10;
const ISOLATED_EG = 12;
/** Passed-pawn bonus by rank from the pawn's own side (PeSTO already rewards
    advancement, so these stay modest) */
const PASSED_MG = [0, 2, 5, 10, 18, 30, 50, 0];
const PASSED_EG = [0, 6, 12, 22, 38, 60, 90, 0];

const BISHOP_PAIR_MG = 30;
const BISHOP_PAIR_EG = 50;
const ROOK_OPEN_MG = 25;
const ROOK_OPEN_EG = 10;
const ROOK_SEMI_MG = 12;
const ROOK_SEMI_EG = 6;

/* Mobility: per reachable square, relative to a typical count */
const MOB_MG = [0, 0, 4, 5, 2, 1, 0];
const MOB_EG = [0, 0, 4, 5, 4, 2, 0];
const MOB_CENTER = [0, 0, 4, 6, 7, 13, 0];

/* King safety: attack units per square of the king zone a piece hits */
const ATTACK_UNITS = [0, 0, 2, 2, 3, 5, 0];
const SHIELD_NEAR = 12;
const SHIELD_FAR = 6;
const SHIELD_MISSING = 14;

const TEMPO = 12;

/* Scratch space, reused every call */
const pawnCount = [new Int8Array(8), new Int8Array(8)];
/** lowest / highest rank (0..7) of each side's pawns per file */
const pawnMin = [new Int8Array(8), new Int8Array(8)];
const pawnMax = [new Int8Array(8), new Int8Array(8)];

/** Each square's membership of the two king zones (bit 1 = around White's
    king, bit 2 = around Black's), rebuilt each call */
const zone = new Uint8Array(128);
const KING_RING = [0, 17, 16, 15, 1, -1, -15, -16, -17];

export function evaluate(pos: Position): number {
  const b = pos.board;
  let mg = pos.mg[WHITE] - pos.mg[BLACK];
  let eg = pos.eg[WHITE] - pos.eg[BLACK];

  for (let c = 0; c < 2; c++) {
    pawnCount[c].fill(0);
    pawnMin[c].fill(8);
    pawnMax[c].fill(-1);
  }

  let bishops0 = 0;
  let bishops1 = 0;
  let pawns = 0;
  let minors0 = 0;
  let minors1 = 0;
  let majors = 0;

  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = b[sq];
    if (!p) continue;
    const t = p & 7;
    const c = p & BLACK_BIT ? BLACK : WHITE;
    if (t === PAWN) {
      const f = sq & 7;
      const r = sq >> 4;
      pawnCount[c][f]++;
      if (r < pawnMin[c][f]) pawnMin[c][f] = r;
      if (r > pawnMax[c][f]) pawnMax[c][f] = r;
      pawns++;
    } else if (t === BISHOP) {
      if (c === WHITE) bishops0++;
      else bishops1++;
      if (c === WHITE) minors0++;
      else minors1++;
    } else if (t === KNIGHT) {
      if (c === WHITE) minors0++;
      else minors1++;
    } else if (t === ROOK || t === QUEEN) {
      majors++;
    }
  }

  // Bare minors can't win: call it a draw.
  if (pawns === 0 && majors === 0 && minors0 <= 1 && minors1 <= 1) return 0;

  if (bishops0 >= 2) {
    mg += BISHOP_PAIR_MG;
    eg += BISHOP_PAIR_EG;
  }
  if (bishops1 >= 2) {
    mg -= BISHOP_PAIR_MG;
    eg -= BISHOP_PAIR_EG;
  }

  // Pawn structure, file by file.
  for (let c = 0; c < 2; c++) {
    const sign = c === WHITE ? 1 : -1;
    const own = pawnCount[c];
    const them = c ^ 1;
    for (let f = 0; f < 8; f++) {
      const n = own[f];
      if (!n) continue;
      if (n > 1) {
        mg -= sign * DOUBLED_MG * (n - 1);
        eg -= sign * DOUBLED_EG * (n - 1);
      }
      const left = f > 0 ? own[f - 1] : 0;
      const right = f < 7 ? own[f + 1] : 0;
      if (!left && !right) {
        mg -= sign * ISOLATED_MG * n;
        eg -= sign * ISOLATED_EG * n;
      }
      // The front-most pawn on the file is passed if no enemy pawn on this or
      // an adjacent file stands in front of it.
      const front = c === WHITE ? pawnMax[c][f] : pawnMin[c][f];
      let passed = true;
      for (let ff = Math.max(0, f - 1); ff <= Math.min(7, f + 1) && passed; ff++) {
        if (!pawnCount[them][ff]) continue;
        if (c === WHITE ? pawnMax[them][ff] > front : pawnMin[them][ff] < front) passed = false;
      }
      if (passed) {
        const rel = c === WHITE ? front : 7 - front;
        mg += sign * PASSED_MG[rel];
        eg += sign * PASSED_EG[rel];
      }
    }
  }

  // Pieces: mobility, rooks on open files, pressure on the enemy king.
  zone.fill(0);
  for (let c = 0; c < 2; c++) {
    const k = pos.kings[c];
    for (let i = 0; i < 9; i++) {
      const sq = k + KING_RING[i];
      if (!(sq & 0x88)) zone[sq] |= 1 << c;
    }
  }
  const units = [0, 0];
  const attackers = [0, 0];
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = b[sq];
    if (!p) continue;
    const t = p & 7;
    if (t === PAWN || t === KING) continue;
    const c = p & BLACK_BIT ? BLACK : WHITE;
    const sign = c === WHITE ? 1 : -1;
    const ubit = c === WHITE ? 0 : BLACK_BIT;
    const enemyZone = 1 << (c ^ 1);
    let mob = 0;
    let zoneHits = 0;

    if (t === KNIGHT) {
      for (let i = 0; i < 8; i++) {
        const to = sq + KNIGHT_DIRS[i];
        if (to & 0x88) continue;
        const q = b[to];
        if (!q || (q & BLACK_BIT) !== ubit) mob++;
        if (zone[to] & enemyZone) zoneHits++;
      }
    } else {
      const dirs = t === BISHOP ? BISHOP_DIRS : t === ROOK ? ROOK_DIRS : QUEEN_DIRS;
      for (let i = 0; i < dirs.length; i++) {
        const d = dirs[i];
        let to = sq + d;
        while (!(to & 0x88)) {
          const q = b[to];
          if (zone[to] & enemyZone) zoneHits++;
          if (q) {
            if ((q & BLACK_BIT) !== ubit) mob++;
            break;
          }
          mob++;
          to += d;
        }
      }
      if (t === ROOK) {
        const f = sq & 7;
        if (!pawnCount[c][f]) {
          if (!pawnCount[c ^ 1][f]) {
            mg += sign * ROOK_OPEN_MG;
            eg += sign * ROOK_OPEN_EG;
          } else {
            mg += sign * ROOK_SEMI_MG;
            eg += sign * ROOK_SEMI_EG;
          }
        }
      }
    }

    mg += sign * MOB_MG[t] * (mob - MOB_CENTER[t]);
    eg += sign * MOB_EG[t] * (mob - MOB_CENTER[t]);
    if (zoneHits) {
      units[c] += ATTACK_UNITS[t] * zoneHits;
      attackers[c]++;
    }
  }

  // King safety (middlegame): attack pressure and the pawn shield.
  for (let c = 0; c < 2; c++) {
    const sign = c === WHITE ? 1 : -1;
    const u = units[c ^ 1];
    if (attackers[c ^ 1] >= 2) mg -= sign * Math.min(500, Math.round((u * u) / 6.5));

    const k = pos.kings[c];
    const kf = k & 7;
    const kr = k >> 4;
    const homeRank = c === WHITE ? kr <= 1 : kr >= 6;
    if (homeRank && (kf <= 2 || kf >= 5)) {
      const up = c === WHITE ? 1 : -1;
      let shield = 0;
      for (let f = Math.max(0, kf - 1); f <= Math.min(7, kf + 1); f++) {
        const near = b[(kr + up) * 16 + f];
        const far = kr + 2 * up >= 0 && kr + 2 * up <= 7 ? b[(kr + 2 * up) * 16 + f] : 0;
        const pawn = PAWN | (c === WHITE ? 0 : BLACK_BIT);
        if (near === pawn) shield += SHIELD_NEAR;
        else if (far === pawn) shield += SHIELD_FAR;
        else shield -= SHIELD_MISSING;
      }
      mg += sign * shield;
    }
  }

  const phase = Math.min(PHASE_MAX, pos.phase);
  const score = Math.round((mg * phase + eg * (PHASE_MAX - phase)) / PHASE_MAX);
  return (pos.side === WHITE ? score : -score) + TEMPO;
}
