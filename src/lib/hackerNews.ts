/* ==========================================================================
   hackerNews — shared client for the public Algolia HN Search API (no key
   required). Used by both the News window and the menu-bar headline ticker.
   ========================================================================== */

export type HNStory = {
  objectID: string;
  title: string;
  url: string | null;
  points: number;
  author: string;
  num_comments: number;
  created_at: string;
};

/** Fetch today's Hacker News front page, most prominent stories first. */
export async function fetchFrontPage(hitsPerPage = 30): Promise<HNStory[]> {
  const res = await fetch(
    `https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=${hitsPerPage}`,
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: { hits: HNStory[] } = await res.json();
  return data.hits.filter((h) => h.title);
}
