/* ==========================================================================
   NewsWindow — a System 1 newspaper that pulls the Hacker News front page
   from the public Algolia HN Search API (no key required). Stories link out
   to the original article; the comment count links to the HN discussion.
   ========================================================================== */

import { useCallback, useEffect, useState } from 'react';
import { fetchFrontPage, type HNStory } from '../lib/hackerNews';

type FetchState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; stories: HNStory[]; fetchedAt: Date };

/** "5 min ago" / "3 hr ago" / "2 days ago" — terse, period-appropriate */
function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 3600) return `${Math.max(1, Math.floor(seconds / 60))} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  const days = Math.floor(seconds / 86400);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** "news.ycombinator.com" → bare hostname for the source tag */
function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

export default function NewsWindow() {
  const [state, setState] = useState<FetchState>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const stories = await fetchFrontPage(30);
      setState({ status: 'ready', stories, fetchedAt: new Date() });
    } catch {
      setState({ status: 'error' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="news-content">
      <div className="news-masthead">
        <div className="win-h">The Daily Hacker</div>
        <div className="win-meta news-dateline">
          {new Date().toLocaleDateString([], {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
          {' · '}front page via Hacker News
        </div>
      </div>

      <hr className="mac-rule" />

      {state.status === 'loading' && (
        <p className="news-status">Receiving the wire&hellip;</p>
      )}

      {state.status === 'error' && (
        <div className="news-status">
          <p>The presses have jammed — couldn&apos;t reach the news wire.</p>
          <button type="button" className="mac-button" onClick={() => void load()}>
            Try Again
          </button>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          <ol className="news-list">
            {state.stories.map((story, i) => {
              const hnUrl = `https://news.ycombinator.com/item?id=${story.objectID}`;
              const host = hostOf(story.url);
              return (
                <li key={story.objectID} className="news-item">
                  <span className="news-rank">{i + 1}.</span>
                  <span className="news-body">
                    <a
                      href={story.url ?? hnUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="news-headline"
                    >
                      {story.title}
                    </a>
                    {host && <span className="news-source"> ({host})</span>}
                    <span className="news-byline">
                      {story.points} points by {story.author}
                      {' · '}
                      {timeAgo(story.created_at)}
                      {' · '}
                      <a href={hnUrl} target="_blank" rel="noreferrer">
                        {story.num_comments} comments
                      </a>
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>

          <hr className="mac-rule" />
          <div className="news-footer">
            <button
              type="button"
              className="mac-button"
              onClick={() => void load()}
            >
              Refresh
            </button>
            <span className="win-meta">
              Last updated{' '}
              {state.fetchedAt.toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
