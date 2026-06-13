/* ==========================================================================
   topTracks — loads Andy's current top 10 from public/data/top-tracks.json,
   which is refreshed on a schedule by GitHub Actions (see
   tools/spotify-data/). Kept tiny and defensive: any missing/malformed field
   yields null so the Music window can fall back to its built-in list and never
   render a broken row.
   ========================================================================== */

export type TopTrack = {
  title: string;
  artist: string;
  album: string;
  /** display duration, mm:ss */
  time: string;
  /** canonical Spotify track URL, when known */
  url?: string;
};

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Coerce one raw record into a TopTrack, or null if it isn't usable. */
function toTrack(raw: unknown): TopTrack | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = str(r.title).trim();
  if (!title) return null; // a row with no title is useless
  return {
    title,
    artist: str(r.artist),
    album: str(r.album),
    time: str(r.time) || '0:00',
    url: str(r.url) || undefined,
  };
}

/** Fetch the published top-tracks JSON. Resolves null on any failure so the
    caller can keep its fallback list. */
export async function loadTopTracks(): Promise<TopTrack[] | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}data/top-tracks.json`, {
      cache: 'no-cache',
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const rawList = (data as { tracks?: unknown })?.tracks;
    if (!Array.isArray(rawList)) return null;
    const tracks = rawList
      .map(toTrack)
      .filter((t): t is TopTrack => t !== null);
    return tracks.length > 0 ? tracks : null;
  } catch {
    return null;
  }
}
