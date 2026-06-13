/* ==========================================================================
   itunesPreview — resolves real 30-second song previews via Apple's public
   iTunes Search API (no key, no auth). The API serves CORS headers
   (Access-Control-Allow-Origin: *), so we fetch it directly; if that ever
   fails (CORS hiccup, blocked network), we fall back to the API's officially
   supported JSONP callback. Results are cached per track for the session.
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

const REQUEST_TIMEOUT_MS = 8000;

/** Pull the results array out of an iTunes Search API payload, shape-checked. */
function extractResults(data: unknown): ItunesResult[] {
  return data &&
    typeof data === 'object' &&
    Array.isArray((data as { results?: unknown }).results)
    ? (data as { results: ItunesResult[] }).results
    : [];
}

/** JSONP fallback — survives CORS by loading the API's response as a script
    that calls back into a one-shot global. */
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
    }, REQUEST_TIMEOUT_MS);

    script.src = `${url}&callback=${cb}`;
    document.head.appendChild(script);
  });
}

/** Fetch search results: CORS fetch first, JSONP as a fallback. */
async function fetchResults(url: string): Promise<ItunesResult[]> {
  // Primary: a plain CORS fetch. The iTunes Search API returns
  // Access-Control-Allow-Origin: *, so this works straight from the browser.
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      if (res.ok) {
        // The API sometimes serves the JSON as text/javascript; parse leniently.
        const text = await res.text();
        return extractResults(JSON.parse(text));
      }
    } finally {
      window.clearTimeout(timer);
    }
  } catch {
    // CORS rejection, abort, or a network blip — drop to the JSONP fallback.
  }

  // Fallback: JSONP via the API's supported callback mechanism.
  return extractResults(await jsonp(url));
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

  const p = fetchResults(url)
    .then((results) => {
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
