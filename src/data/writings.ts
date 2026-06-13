/* ==========================================================================
   Writings — essays shipped as "AndyWrite documents". Each post is a
   document icon in the Writings folder that opens in a read-only AndyWrite
   window (the word processor doubles as the reader).

   Body blocks: 'h' renders as a section heading, 'p' as a paragraph.
   ========================================================================== */

export type WritingBlock = { type: 'h' | 'p'; text: string };

export type Writing = {
  /** Stable id — also forms the reader window id (`writing-<slug>`) */
  slug: string;
  title: string;
  date: string;
  /** Approximate read time shown in the folder and the reader status bar */
  readTime: string;
  /** One-line teaser shown under the icon label in the Writings folder */
  blurb: string;
  body: WritingBlock[];
};

export const writings: Writing[] = [
  {
    slug: 'asteroids',
    title: 'The Sky Is Closer Than You Think',
    date: 'Jun 2026',
    readTime: '5 min read',
    blurb: 'From a middle-school astronomy event to a live orrery of today\u2019s near misses.',
    body: [
      {
        type: 'p',
        text:
          'In middle school I did Reach for the Stars, the astronomy event in Science ' +
          'Olympiad. You memorize constellations, deep-sky objects, the names of stars that ' +
          'have been dead for longer than there have been people to name them. Most of it I ' +
          'studied off flashcards under fluorescent lights. But the part that actually stuck ' +
          'was the first time I went outside afterward and recognized something. Orion was ' +
          'not a flashcard anymore. It was up there, and I knew it. That is the whole hook of ' +
          'looking up: the sky stops being decoration and starts being a place with addresses.',
      },
      {
        type: 'p',
        text:
          'I still have not seen the thing I most want to see. The dream is Iceland, in ' +
          'winter, far enough from any town that the aurora fills the whole sky instead of ' +
          'smudging one corner of it. I have watched enough shaky phone footage to know the ' +
          'footage is lying to me, and that the only way to actually have it is to stand ' +
          'there and be cold. I have not gone yet. The Asteroids window on this site is, if I ' +
          'am honest, the thing I built while waiting to go.',
      },
      { type: 'h', text: 'The orbits are real' },
      {
        type: 'p',
        text:
          'It would have been easy to make a pretty starfield and call the rocks decorative. ' +
          'I did the harder version. The app pulls NASA\u2019s NeoWs feed, the Near Earth ' +
          'Object Web Service, and asks a simple question: what is making a close approach to ' +
          'Earth today, closest first. Then for each object it fetches the real Keplerian ' +
          'elements from JPL\u2019s small-body solution and propagates them by solving ' +
          'Kepler\u2019s equation, with Earth placed by a standard analytic ephemeris. Every ' +
          'trajectory on screen is the actual geocentric path of that rock over a ' +
          'forty-eight-hour window on either side of the encounter. A time bar lets you scrub ' +
          'through the flyby, or fast-forward it, and watch the geometry change.',
      },
      { type: 'h', text: 'Two ways of seeing the same sky' },
      {
        type: 'p',
        text:
          'There is a scale toggle, and it is the most honest control in the whole project. ' +
          'The classic view is the original System 1 toy: every asteroid sweeps a decorative ' +
          'ring at its catalogued miss distance, busy and hypnotic and proudly unphysical. ' +
          'The real view propagates the true orbital elements and draws everything to scale, ' +
          'with the Moon\u2019s orbit included for reference. The honest picture is humbling. ' +
          'Most of these rocks miss us by several times the distance to the Moon, which is ' +
          'either reassuring or terrifying depending on how you feel about the word ' +
          '"several." The toy version is more fun to look at. Both are true to something.',
      },
      { type: 'h', text: 'Drawing 1984 in WebGL' },
      {
        type: 'p',
        text:
          'The rendering is where the astronomy meets the Macintosh. The scene is drawn in ' +
          'grayscale off-screen in WebGL2, then snapped to one-bit black and white by a Bayer ' +
          'ordered-dither shader. That single shader does a lot of work: it shades the day and ' +
          'night terminator across the globe and it stipples the asteroid trails into the kind ' +
          'of dotted texture a 1984 screen would have produced. Labels, hazard rings, and the ' +
          'little pick-rings you click live on a separate 2D overlay, because text wants to ' +
          'stay crisp while the sky gets dithered. The constraint of one-bit graphics turned ' +
          'out to be a gift again. A real telescope view would be noise. A dithered one reads ' +
          'as a diagram.',
      },
      { type: 'h', text: 'Why bother' },
      {
        type: 'p',
        text:
          'The thing I keep coming back to is that none of this required a personal API key ' +
          'or a server. It runs on NASA\u2019s public demo endpoint and a pile of orbital ' +
          'mechanics that have been settled science for three hundred years. A kid with ' +
          'flashcards and a browser can watch the actual rocks go by today. I built it ' +
          'because the same feeling from that first night outside is still the point: the ' +
          'sky is not decoration. It has addresses, the rocks keep real appointments, and you ' +
          'can go check. Iceland is still on the list. This was practice for paying attention.',
      },
    ],
  },
  {
    slug: 'chess-bot',
    title: 'How I Trained a Chess Bot on My Own Games',
    date: 'Jun 2026',
    readTime: '6 min read',
    blurb: 'Turning my Chess.com history into an engine that blunders like me.',
    body: [
      {
        type: 'p',
        text:
          'There are plenty of chess engines you can lose to. I wanted to build the only ' +
          'one where losing feels like losing to me specifically. Strength was never the ' +
          'goal for Andy Chess Bot. Recognizability was. A visitor should finish a game ' +
          'thinking "that felt like playing Andy": my opening repertoire, my taste for ' +
          'sharp open positions, and, critically, my ~1500-rated mistakes.',
      },
      { type: 'h', text: 'Why not Stockfish?' },
      {
        type: 'p',
        text:
          'The obvious approach is Stockfish plus a "style layer." I rejected it for three ' +
          'reasons. First, hosting reality. This site is a static GitHub Pages deployment, ' +
          'which cannot set the cross-origin isolation headers multi-threaded Stockfish ' +
          'needs, and the workarounds add a multi-megabyte download for strength I would ' +
          'then throw away. Second, the goal fights the tool. Corrupting a 3200-rated ' +
          'oracle down to 1500 looks less human than starting from a deliberately modest ' +
          'engine and shaping it. Third, control. A handwritten evaluation gives me direct, ' +
          'legible knobs for aggression, materialism, and blunder rate. Every "feels like ' +
          'Andy" lever is a number in a JSON file, not an opaque neural-network weight.',
      },
      { type: 'h', text: 'Three layers' },
      {
        type: 'p',
        text:
          'The bot is three cooperating layers. An opening book, built statistically from ' +
          'my real games, makes it prefer my repertoire: the Italian as White, the King\'s ' +
          'Indian against 1.d4. A style-shaped search (handcrafted evaluation, shallow ' +
          'alpha-beta with quiescence, plus a bounded style bonus) makes it play like my ' +
          'middlegame taste. And a humanizer makes it miss things like a 1500. A blunder ' +
          'roll occasionally picks a natural-looking but clearly inferior move, and even ' +
          '"good" play is softmax-sampled from the top few candidates so it has lifelike ' +
          'variety instead of robotic repetition.',
      },
      { type: 'h', text: 'The data pipeline' },
      {
        type: 'p',
        text:
          'An offline pipeline in the repo fetches my monthly game archives from the ' +
          'Chess.com public API, parses the PGNs, and emits two artifacts: an opening book ' +
          '(every move I played in the first 24 half-moves, keyed by position, weighted by ' +
          'frequency and result) and a style profile (capture, check, development, and ' +
          'attacking rates mapped onto the engine\'s knobs). The pipeline even reads the ' +
          'clock tags Chess.com stamps on every move and fits a think-time model per ' +
          'context bucket. So the bot snaps off recaptures, tanks in sharp middlegames, ' +
          'and speeds up under imaginary time pressure. The artifacts are committed JSON. ' +
          'Rerun the pipeline and the bot gets more like present-day me.',
      },
      { type: 'h', text: 'What I learned' },
      {
        type: 'p',
        text:
          'Modeling weakness honestly is harder than modeling strength. The single biggest ' +
          'fidelity lever left is calibrating the blunder rate against real centipawn loss, ' +
          'which would mean running every historical position through a strong engine ' +
          'offline. But the lesson that stuck with me is architectural. Running the engine ' +
          'in a Web Worker, shipping pre-baked data instead of fetching at load, and ' +
          'choosing a small legible system over a big opaque one made the whole thing ' +
          'maintainable by exactly one person. That happens to be the team size this ' +
          'project has.',
      },
    ],
  },
  {
    slug: 'mac-in-browser',
    title: 'Building a 1984 Macintosh in the Browser',
    date: 'May 2026',
    readTime: '5 min read',
    blurb: 'Why my portfolio boots, beeps, and makes you double-click folders.',
    body: [
      {
        type: 'p',
        text:
          'Most portfolio sites are a hero section, three cards, and a contact form. Mine ' +
          'is a Macintosh 128K sitting in a dark room, waiting for you to press the power ' +
          'switch. This was not the efficient choice. It was the right one.',
      },
      { type: 'h', text: 'The metaphor does the work' },
      {
        type: 'p',
        text:
          'A desktop is a navigation system people already know how to use. They knew it ' +
          'in 1984, too. Projects live in folders. The résumé is a document. Games go in ' +
          'a Games folder. Instead of inventing an information architecture, I borrowed ' +
          'the most battle-tested one in computing history. The constraint of System 1 ' +
          '(one-bit graphics, pixel fonts, dithered grays) turned out to be a gift: every ' +
          'design decision has an obvious answer, which is "what would the original ' +
          'Finder do?"',
      },
      { type: 'h', text: 'What it is under the hood' },
      {
        type: 'p',
        text:
          'The whole machine is React, TypeScript, and Vite, deployed as a static site. ' +
          'Windows own their geometry through a small layout library that handles ' +
          'cascading, clamping to the viewport, and a compact phone mode where the desktop ' +
          'quietly becomes an iPhone home screen. The boot sequence is a single CSS ' +
          'transform that zooms the camera into the Mac\'s screen glass, computed so the ' +
          'glass lands exactly fitted to your viewport. Deep links still work. Hitting ' +
          '/projects opens the Projects window on top, because each window maps to a ' +
          'route and the build pre-renders a real HTML page for every one of them.',
      },
      { type: 'h', text: 'The details are the product' },
      {
        type: 'p',
        text:
          'The hourglass cursor flashes for a random beat before a window opens, because ' +
          'instant feels wrong on a 128K machine. The error dialog plays the classic ' +
          'Basso beep. There is an achievement system, because if you are going to make ' +
          'someone play Minesweeper on your résumé site, you should at least reward them ' +
          'for winning. None of these details matter individually. Collectively they are ' +
          'the difference between a theme and a place.',
      },
    ],
  },
  {
    slug: 'fde-notes',
    title: 'Notes from Forward Deployed Engineering',
    date: 'Apr 2026',
    readTime: '4 min read',
    blurb: 'What shipping AI into real factories taught me about software.',
    body: [
      {
        type: 'p',
        text:
          'I joined Endeavor AI as a Forward Deployed Engineer after graduating from ' +
          'Carnegie Mellon with a business degree and a CS minor. The job title confuses ' +
          'people, so here is my working definition: an FDE is an engineer whose code has ' +
          'to survive contact with a real customer\'s real data, this week.',
      },
      { type: 'h', text: 'The data is never clean' },
      {
        type: 'p',
        text:
          'In school, datasets arrive pre-washed. In production ERP automation, the ' +
          'product catalog has three names for the same item, the customer records were ' +
          'last deduplicated during a previous presidential administration, and the ' +
          'integration you depend on goes down on Tuesdays. A large part of the job is ' +
          'diagnosing data quality issues in customer environments and designing ' +
          'workarounds that are reliable enough to run unattended. That is a politer way ' +
          'of saying: assume everything lies, and verify.',
      },
      { type: 'h', text: 'Boring infrastructure wins' },
      {
        type: 'p',
        text:
          'The stack that actually ships is deliberately unexciting: FastAPI services, ' +
          'AWS Lambda, S3, Terraform. Scheduled syncs that ingest catalogs and push ' +
          'uploads downstream do not need novelty; they need to run every night and tell ' +
          'you loudly when they did not. The AI is the differentiator, but the plumbing ' +
          'around it is what customers experience as "it works."',
      },
      { type: 'h', text: 'Business school was not wasted' },
      {
        type: 'p',
        text:
          'The surprise of the role is how often the hard problem is not technical. ' +
          'Deciding what to automate first. Translating an operations manager\'s ' +
          'frustration into a schema. Knowing when a 90% solution shipped this week beats ' +
          'a 99% solution shipped next quarter. That is the business half of my degree ' +
          'earning its keep. Forward deployed engineering is the rare job where the ' +
          'spreadsheet people and the terminal people are the same person.',
      },
    ],
  },
  {
    slug: 'spoiler-block',
    title: 'Teaching a Browser What a Spoiler Is',
    date: 'Dec 2024',
    readTime: '3 min read',
    blurb: 'The surprisingly fuzzy NLP problem inside a small Chrome extension.',
    body: [
      {
        type: 'p',
        text:
          'Spoiler-block started with a simple grievance: I was two seasons behind on a ' +
          'show, and the internet did not care. The obvious fix is keyword blocklists. ' +
          'It is obviously bad. Block the show\'s title and you block the review you ' +
          'wanted to read; allow it and "character X dies in episode Y" sails right ' +
          'through.',
      },
      { type: 'h', text: 'Spoilers are about context, not keywords' },
      {
        type: 'p',
        text:
          'A spoiler is a claim about plot, attached to a work, that you have not reached ' +
          'yet. That is three conditions, and naive matching tests only one of them. The ' +
          'extension scores page text with lightweight NLP before deciding what to ' +
          'redact, looking at sentence-level context around a title mention rather than ' +
          'the mention itself. Moving from keywords to context scoring improved blocking ' +
          'efficiency by about 40% in my testing, mostly by cutting false positives that ' +
          'made people turn blockers off.',
      },
      { type: 'h', text: 'Redaction is UX, too' },
      {
        type: 'p',
        text:
          'The second lesson was about the redaction itself. Deleting content breaks page ' +
          'layouts and makes users suspicious about what they missed. Blacking text out ' +
          'keeps the page intact. Visibly, reversibly, the way a censored document looks. ' +
          'And it puts the user in control: click to reveal if you are willing to risk it. ' +
          'It is still an ongoing project, and the backlog (per-show progress tracking, ' +
          'image redaction) is mostly a list of ways context could get richer.',
      },
    ],
  },
];

export function getWriting(slug: string): Writing | undefined {
  return writings.find((w) => w.slug === slug);
}
