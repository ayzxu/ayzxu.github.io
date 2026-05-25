/* ==========================================================================
   useChessGame — pulls live data from the public Chess.com API for the Fun
   window's chess panel: current ratings and the final position of the most
   recent game (PGN → FEN via chess.js). Logic preserved from the original
   Fun route; only repackaged as a reusable hook.
   ========================================================================== */

import { useEffect, useState } from 'react';
import { Chess } from 'chess.js';

const USERNAME = 'mozandyque';
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export type ChessRatings = { bullet: number; rapid: number; blitz: number };

export type LatestGame = {
  url: string;
  opponent: string;
  result: string;
  fen: string;
  userColor: 'white' | 'black';
};

/* Minimal shape of a game object as returned by the Chess.com API. */
type ChessComGame = {
  url: string;
  pgn?: string;
  fen?: string;
  white: { username: string; result: string };
  black: { username: string; result: string };
};

/* Derive the final board position for a Chess.com game object. */
async function getFinalFenFromGame(lastGame: ChessComGame): Promise<string> {
  const chess = new Chess();
  let finalFen: string | undefined;

  // Strategy 1: parse the PGN the API returns directly on the game object
  if (lastGame.pgn && typeof lastGame.pgn === 'string') {
    try {
      if (
        lastGame.pgn.startsWith('http://') ||
        lastGame.pgn.startsWith('https://')
      ) {
        // Rare case: PGN provided as a URL — fetch it first
        try {
          const url = new URL(lastGame.pgn);
          const pgnResponse = await fetch(url.toString());
          if (pgnResponse.ok) {
            const pgnText = await pgnResponse.text();
            if (pgnText && pgnText.trim()) {
              chess.loadPgn(pgnText);
              if (chess.history().length > 0) finalFen = chess.fen();
            }
          }
        } catch (e) {
          console.error('Error fetching PGN URL:', e);
        }
      } else {
        try {
          chess.loadPgn(lastGame.pgn);
          if (chess.history().length > 0) finalFen = chess.fen();
        } catch (e) {
          console.error('Error loading PGN from API response:', e);
        }
      }
    } catch (e) {
      console.error('Error processing PGN:', e);
    }
  }

  // Strategy 2: fall back to an API-provided FEN
  if (!finalFen && lastGame.fen) finalFen = lastGame.fen;

  // Final fallback: the starting position
  return finalFen ?? START_FEN;
}

/* Build a LatestGame record from a raw Chess.com game object. */
async function toLatestGame(lastGame: ChessComGame): Promise<LatestGame> {
  const isWhite =
    lastGame.white.username.toLowerCase() === USERNAME.toLowerCase();
  const opponent = isWhite
    ? lastGame.black.username
    : lastGame.white.username;
  const myResult = isWhite ? lastGame.white.result : lastGame.black.result;

  let result = 'Draw';
  if (myResult === 'win') result = 'Won';
  else if (
    ['checkmated', 'resigned', 'timeout', 'abandoned'].includes(myResult)
  )
    result = 'Lost';

  return {
    url: lastGame.url,
    opponent,
    result,
    fen: await getFinalFenFromGame(lastGame),
    userColor: isWhite ? 'white' : 'black',
  };
}

export function useChessGame() {
  const [ratings, setRatings] = useState<ChessRatings>({
    bullet: 1450,
    rapid: 1400,
    blitz: 1300,
  });
  const [latestGame, setLatestGame] = useState<LatestGame | null>(null);

  useEffect(() => {
    // Ratings
    fetch(`https://api.chess.com/pub/player/${USERNAME}/stats`)
      .then((res) => res.json())
      .then((data) => {
        setRatings({
          bullet: data.chess_bullet?.last?.rating || 1450,
          rapid: data.chess_rapid?.last?.rating || 1400,
          blitz: data.chess_blitz?.last?.rating || 1300,
        });
      })
      .catch((err) => console.error('Failed to fetch chess stats:', err));

    // Most recent game — newest monthly archive, then current month as backup
    fetch(`https://api.chess.com/pub/player/${USERNAME}/games/archives`)
      .then((res) => res.json())
      .then(async (archivesData) => {
        if (archivesData.archives?.length > 0) {
          const latestArchiveUrl =
            archivesData.archives[archivesData.archives.length - 1];
          const gamesData = await (await fetch(latestArchiveUrl)).json();
          if (gamesData.games?.length > 0) {
            const lastGame = gamesData.games[gamesData.games.length - 1];
            setLatestGame(await toLatestGame(lastGame));
          }
        }
      })
      .catch(async (err) => {
        console.error('Failed to fetch games:', err);
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        try {
          const data = await (
            await fetch(
              `https://api.chess.com/pub/player/${USERNAME}/games/${year}/${month}`,
            )
          ).json();
          if (data.games?.length > 0) {
            const lastGame = data.games[data.games.length - 1];
            setLatestGame(await toLatestGame(lastGame));
          }
        } catch (fallbackErr) {
          console.error('Failed to fetch games (fallback):', fallbackErr);
        }
      });
  }, []);

  const boardFen = latestGame ? latestGame.fen : START_FEN;
  return { ratings, latestGame, boardFen };
}
