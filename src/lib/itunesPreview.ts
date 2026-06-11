/* ==========================================================================
   itunesPreview — resolves real 30-second song previews via Apple's public
   iTunes Search API (no key, no auth). Requests go out as JSONP (the API's
   officially supported callback mechanism) so CORS can never bite us, and
   results are cached per track for the session.
   ========================================================================== */

export type PreviewInfo = {
  previewUrl: string;
  trackName: string;
  artistName: string;
  /** Real full-song length, ms (for the song list's Time column) */
  trackTimeMillis: number;
};

type ItunesResult = {
  previewUrl?: string;
  trackName?: string;
  artistName?: string;
  collectionName?: string;
  trackTimeMillis?: number;
};

const JSONP_TIMEOUT_MS = 8000;

function jsonp(url: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const cb = `__itunes_cb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const w = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');

    let timer = 0;
    const cleanup = () => {
      window.clearTimeout(timer);
      delete w[cb];
      script.remove();
    };

    w[cb] = (data: unknown) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('iTunes request failed'));
    };
    timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('iTunes request timed out'));
    }, JSONP_TIMEOUT_MS);

    script.src = `${url}&callback=${cb}`;
    document.head.appendChild(script);
  });
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, ' ') // drop "(feat. …)" etc.
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** Crude relevance score: does the result look like the song we asked for? */
function score(r: ItunesResult, title: string, artist: string): number {
  if (!r.previewUrl) return -1;
  const t = norm(r.trackName ?? '');
  const a = norm(r.artistName ?? '');
  const wantT = norm(title);
  const wantA = norm(artist.split(',')[0]); // primary artist
  let s = 0;
  if (t === wantT) s += 4;
  else if (t.startsWith(wantT) || wantT.startsWith(t)) s += 2;
  else if (t.includes(wantT) || wantT.includes(t)) s += 1;
  if (a.includes(wantA) || wantA.includes(a)) s += 3;
  return s;
}

const cache = new Map<string, Promise<PreviewInfo | null>>();

/** Find the best preview for a song. Resolves null when nothing matches. */
export function findPreview(
  title: string,
  artist: string,
): Promise<PreviewInfo | null> {
  const key = `${title}::${artist}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const term = encodeURIComponent(`${norm(title)} ${norm(artist.split(',')[0])}`);
  const url = `https://itunes.apple.com/search?term=${term}&media=music&entity=song&limit=8`;

  const p = jsonp(url)
    .then((data) => {
      const results =
        data && typeof data === 'object' && Array.isArray((data as { results?: unknown }).results)
          ? ((data as { results: ItunesResult[] }).results)
          : [];
      let best: ItunesResult | null = null;
      let bestScore = 0;
      for (const r of results) {
        const s = score(r, title, artist);
        if (s > bestScore) {
          best = r;
          bestScore = s;
        }
      }
      if (!best?.previewUrl) return null;
      return {
        previewUrl: best.previewUrl,
        trackName: best.trackName ?? title,
        artistName: best.artistName ?? artist,
        trackTimeMillis: best.trackTimeMillis ?? 0,
      };
    })
    .catch(() => {
      cache.delete(key); // transient failure — allow a retry
      return null;
    });

  cache.set(key, p);
  return p;
}
