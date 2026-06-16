# Portfolio — Ranked Ideas (June 2026)

**Goal lens:** every idea below is scored for two outcomes you care about — (1) **landing FDE / engineering roles** (recruiters, hiring managers, interview talking points) and (2) **impressing technical peers** (engineers/designers who read the repo and poke at the details). Ideas that only serve novelty are ranked lower.

**How to read the scores.** *Feasibility* = how cheap and safe it is to ship (5 = a few hours, no new infra; 1 = multi-day, new backend/cost/abuse surface). *Result* = expected impact toward the two goals above (5 = moves the needle a lot; 1 = nice-to-have). The recommendation column is my opinionated call as the person running this site.

---

## The one-line verdict

The site is already in the top ~1% of personal portfolios — the Macintosh System 1 metaphor, the hand-written chess engine, the AndyWrite word processor, the Asteroids/orrery tie-in. The risk now is **not** "it's not impressive enough." The two real gaps are:

1. **Recruiter conversion friction** — a recruiter with 90 seconds may not realize they have to double-click to find your experience and résumé. Delight for peers, a maze for someone scanning ten candidates.
2. **You can't see what's working** — there's no analytics, so every decision (including this one) is a guess.

So the highest-leverage moves are cheap conversion + measurement first, then deepening the chess centerpiece (your single best differentiator), then one genuinely on-brand AI feature that *demonstrates* the FDE/AI skillset rather than just claiming it.

---

## Ranked summary

| # | Idea | Feasibility | Result | Verdict |
|---|------|:-----------:|:------:|---------|
| 1 | Recruiter fast-path (menu-bar Résumé + first-run hint) | 5 | 5 | **Do first** |
| 2 | Privacy-friendly analytics + event tracking | 5 | 4 | **Do first** |
| 3 | CI quality gate (lint + typecheck + Playwright smoke + Lighthouse) | 4 | 4 | **Do first** — the repo *is* part of the portfolio |
| 4 | Deepen project case studies + surface the chess write-up | 4 | 5 | **Do first** |
| 5 | Chess: post-game analysis + shareable result card | 3 | 5 | **Do next** — biggest differentiator |
| 6 | "Ask Andy" AI terminal (RAG over résumé/projects) | 2 | 5 | **Do next** — most on-brand for FDE/AI, but infra/cost/safety |
| 7 | Performance + code-split pass | 4 | 3 | High-value cleanup |
| 8 | Per-route dynamic OG share cards | 3 | 3 | Worth it for shareability |
| 9 | Accessibility deepening (keyboard window mgmt, focus traps) | 3 | 3 | Craft signal + broader reach |
| 10 | Living "Now" window (chess rating, now-playing, current work) | 3 | 3 | Signals you're active |
| 11 | Writings expansion + RSS + per-essay routes/OG | 3 | 3 | SEO + peer cred over time |
| 12 | Themed contact / "Send Andy a note" | 4 | 3 | Lowers the cost of reaching you |
| 13 | Chess "eras" (Andy 2019 vs Andy 2026 strength) | 3 | 4 | Great story, medium build |
| 14 | More easter eggs / achievements / Konami | 5 | 2 | Cheap delight, low ROI |
| 15 | Theme/era switcher (System 1 → Mac OS 8 → Aqua) | 1 | 4 | Huge wow, huge effort — a "someday" flex |
| 16 | Live multiplayer cursors / visitor presence | 2 | 2 | Novelty, needs realtime backend |

---

## Tier 1 — Do first (high result, high feasibility)

### 1. Recruiter fast-path
**Problem.** The desktop metaphor is a delight filter that works *against* a time-boxed recruiter. Deep links exist (`/projects`, `/resume`, `/chess`…) but a first-time visitor on the homepage has to *discover* the double-click interaction before they reach anything decision-relevant.

**What to build.** (Note: the résumé *is* reachable today via `MenuBar.tsx` → **File → Open Résumé** — but it's buried in a dropdown a recruiter has to think to open. The gap is first-glance discoverability, not existence.)
- A persistent, top-level affordance to the two things a recruiter wants: **Résumé** and **Experience** — e.g. promote "Résumé" to a visible menu-bar title (not nested under File), or surface it in the Apple menu next to "About This Macintosh."
- A **first-run hint**: you already track visited state in `localStorage` (`Desktop.tsx`, `VISITED_STORAGE_KEY`). On first visit, a subtle one-time nudge ("Double-click to open — or press ? for shortcuts") removes the "what do I do?" beat without nagging repeat visitors.
- Optional "boss key": a keyboard shortcut (e.g. `R`) that opens the résumé window instantly. On-brand for a Mac OS, and a nice peer-facing detail.

**Why it ranks #1.** Directly attacks the only thing that could lose you a role you'd otherwise get — and it's a few hours of work against content that already exists. Feasibility 5 / Result 5.

### 2. Privacy-friendly analytics
**Problem.** No analytics anywhere in the repo. You're flying blind on the exact questions that should drive this roadmap: do people find the chess bot? Do mobile users bounce at the boot animation? Which projects get opened?

**What to build.** A cookieless, lightweight tracker (Plausible, Umami, or Cloudflare Web Analytics — all GitHub-Pages friendly, no consent banner needed). Fire a handful of custom events: window opened (by id), chess game started/finished, résumé viewed, deep-link entry path, mobile vs desktop.

**Why.** Cheap, reversible, and it turns every future decision (including which ideas here to build) from opinion into evidence. Feasibility 5 / Result 4.

### 3. CI quality gate
**Problem.** `deploy.yml` builds and ships, but doesn't run `eslint` or `tsc`, and there are no tests. For a portfolio whose **repo is public and unusually well-commented**, the repo itself is a work sample — and right now it has no green checks.

**What to build.** A `check` job in Actions: `npm run lint` + `tsc --noEmit` + a tiny **Playwright smoke test** that boots the desktop and opens each window without console errors, + a **Lighthouse CI** budget on the built site. Add the badges to the README.

**Why.** Peers who open the repo see engineering rigor, not just a pretty front end; it also catches regressions before they hit `andyxu.dev`. Feasibility 4 / Result 4.

### 4. Deepen project case studies + surface the chess write-up
**Problem.** `src/data/projects.ts` has four solid projects, but the descriptions are 2–3 sentences. Meanwhile `tools/chess-data/README.md` and the repo README contain a genuinely excellent engineering narrative (opening book + style profile + negamax/alpha-beta + quiescence + humanizer) that a hiring manager never sees inside the desktop UI.

**What to build.** For each project, expand `ProjectWindow` content into a real case study: **problem → approach → architecture → outcome/metrics → what I'd do differently.** Pull the chess narrative into its own case-study window (a diagram of the data pipeline → engine → humanizer would be a standout). Add real metrics where you have them.

**Why.** This is the single biggest credibility lever for FDE interviews — it's the difference between "built a chess bot" and "here's how I made a search engine play like a human at a target ELO." Pure writing/markup effort, no new infra. Feasibility 4 / Result 5.

---

## Tier 2 — Do next (high result, medium effort — the differentiators)

### 5. Chess: post-game analysis + shareable result card
The chess bot is your strongest, most memorable asset; squeeze more out of it.
- **Post-game analysis.** After a game, show accuracy, where the player blundered, and — uniquely — *"this is the move Andy actually plays most here"* using the existing `opening-book.json` / `style-profile.json`. No other portfolio can do this because the data is *you*.
- **Shareable result card.** Generate a 1200×630 image ("I drew Andy's bot in 31 moves") with the final position. You already ship `jspdf`; a canvas render is cheap. This is the realistic viral hook for LinkedIn/Twitter and it pulls traffic back to the site.

Feasibility 3 / Result 5.

### 6. "Ask Andy" AI terminal (RAG)
You have a `TerminalWindow` already. Wire in an assistant that answers recruiter questions grounded in your résumé/projects/writings ("Does Andy have production React experience?", "What did he do at Endeavor?"). For a **Forward Deployed / AI Engineer**, a working RAG assistant *is* the portfolio piece — it demonstrates the exact skill the role wants.

**Caveats (why feasibility is 2, not higher).** GitHub Pages is static, so this needs a serverless endpoint (Cloudflare Worker / Vercel function) holding the API key. Budget for: cost caps + rate limiting, prompt-injection/abuse hardening, and a strict "I don't know" fallback so it never invents facts about you. Build it small and grounded.

Feasibility 2 / Result 5.

### 7. Performance + code-split pass
The bundle carries a lot: `AsteroidsWindow.tsx` alone is ~1,140 lines, plus Three.js, chess.js, a WebGL ditherer, audio, and video. Lazy-load each window/app behind `React.lazy`, defer audio/video (`preload="none"` already used for some), and set a Lighthouse budget. Buttery performance is itself a craft signal, and faster first paint reduces mobile bounce. Feasibility 4 / Result 3.

---

## Tier 3 — Worthwhile, lower priority

**8. Per-route OG share cards (F3/R3).** One static `og-image.png` today. Generate per-window cards (chess, each project) so shared links preview richly. Pairs naturally with the chess result card (#5).

**9. Accessibility deepening (F3/R3).** Good foundation (75 aria/role/alt usages, `prefers-reduced-motion` handled). A desktop metaphor is hard for keyboard/SR users — add focus traps per window, keyboard window cycling, a skip-to-content path, and an alt-text audit. Broadens reach and reads as craft.

**10. Living "Now" window (F3/R3).** A small status window: current Chess.com rating (live via the API you already pull), now-playing (`nowPlaying.ts` exists), and a one-liner on what you're building. A site that's visibly *current* signals an engaged engineer.

**11. Writings expansion + RSS + per-essay routes (F3/R3).** Add essays, give each a real route + OG image, and ship an RSS feed. Compounds SEO and peer credibility over time.

**12. Themed contact / "Send Andy a note" (F4/R3).** Lower the cost of reaching you beyond a `mailto:` — a themed note window backed by Formspree or a Worker. Small build, removes friction at the exact moment a recruiter is convinced.

**13. Chess "eras" (F3/R4).** Train multiple style profiles ("Andy 2019" vs "Andy 2026") so the difficulty slider is honestly *you at different strengths*. Perfectly on-brand with "the bot improves when I do." Medium pipeline work.

---

## Tier 4 — High wow, low feasibility (the "someday" flexes)

**14. More easter eggs / achievements / Konami (F5/R2).** Cheap delight; you already have an achievements system to extend. Low ROI toward the two goals, but fun and on-brand.

**15. Theme/era switcher: System 1 → Mac OS 8 platinum → Aqua (F1/R4).** Enormous craft flex, genuinely shareable — but a near-rebuild of the visual layer. Park it as a long-term ambition, not now.

**16. Live multiplayer cursors / visitor presence (F2/R2).** Fun novelty, needs a realtime backend, and doesn't really advance the two goals.

---

## If I could only do four things this month

1. **Recruiter fast-path (#1)** — stop losing time-boxed recruiters.
2. **Analytics (#2)** — so the rest of this list is driven by data, not vibes.
3. **Deepen case studies + chess write-up (#4)** — your credibility lives here.
4. **Chess post-game analysis + share card (#5)** — lean into your single best differentiator and give people a reason to share it.

Everything else is upside on top of a site that's already excellent.
