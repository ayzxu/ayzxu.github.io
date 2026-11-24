/* Writings — essays shipped as "AndyWrite documents". Each post is a
   document icon in the Writings folder that opens in a read-only AndyWrite
   window (the word processor doubles as the reader).

   Body blocks: 'h' renders as a section heading, 'p' as a paragraph. */

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
    slug: 'chess-bot',
    title: 'How I Trained a Chess Bot on My Own Games',
    date: 'Nov 2026',
    readTime: '4 min read',
    blurb: 'Turning my Chess.com history into an engine that blunders like me.',
    body: [
      {
        type: 'p',
        text:
          'There are plenty of chess engines you can lose to. I wanted one ' +
          'where losing feels like losing to me: my openings, the moves I like, ' +
          'and my mistakes, made about as often as I make them. I\'m rated ' +
          'around 1900 in rapid on Chess.com, so that\'s the level it plays at.',
      },
      { type: 'h', text: 'Why not Stockfish?' },
      {
        type: 'p',
        text:
          'The obvious approach is Stockfish with the strength turned down. I ' +
          'didn\'t use it, for two reasons. First, hosting: this site is a ' +
          'static GitHub Pages deployment, which can\'t send the cross-origin ' +
          'isolation headers multi-threaded Stockfish needs, and the ' +
          'workarounds mean a multi-megabyte download. Second, a weakened ' +
          'Stockfish doesn\'t make human mistakes. It plays near-perfect moves ' +
          'and then, every so often, a random bad one. People go wrong in more ' +
          'specific ways. They miss a quiet reply, or don\'t calculate a line ' +
          'they should have. I wanted to model that directly. Stockfish does ' +
          'show up, but offline, as the grader.',
      },
      { type: 'h', text: 'The engine' },
      {
        type: 'p',
        text:
          'The bot runs its own engine in a Web Worker: a 0x88 board, ' +
          'alpha-beta search with a transposition table and the usual pruning, ' +
          'and PeSTO\'s tuned evaluation tables. With about half a second per ' +
          'move it searches 8 to 12 plies deep, which is much stronger than me. ' +
          'That\'s deliberate. The engine\'s job is to know what each move is ' +
          'actually worth. Deciding which move I\'d play is a separate step.',
      },
      { type: 'h', text: 'How it picks a move' },
      {
        type: 'p',
        text:
          'For every legal move, the engine reports three scores: what the move ' +
          'looks like at a glance (it plays out the obvious captures), what it ' +
          'looks like after checking the opponent\'s best reply, and what a deep ' +
          'search says. In any given position I\'m doing one of those three ' +
          'things. Sometimes I glance and move, sometimes I check the reply, ' +
          'sometimes I actually calculate. The model picks a level based on the ' +
          'position: whether it\'s an endgame, whether I\'m in check, whether ' +
          'there\'s only one good move, whether the game is already decided, and ' +
          'how late it is. Then it chooses among the moves by how good they ' +
          'look at that level, with some noise and a lean toward my habits. I ' +
          'like captures, checks, and developing pieces, and I don\'t like ' +
          'retreating. The mistakes come from the gap between levels. A move ' +
          'can look fine at a glance and lose to a quiet reply.',
      },
      { type: 'h', text: 'Fitting it to my games' },
      {
        type: 'p',
        text:
          'Every weight in that model is fitted to moves I actually played. A ' +
          'pipeline downloads all of my Chess.com games (about 8,500), has ' +
          'Stockfish grade every move I made after the opening in my recent ' +
          'rapid games and 400 recent blitz games, runs the bot\'s own engine on ' +
          'each of those positions, and fits the model by maximum likelihood to ' +
          'the moves I chose. Blitz helped more than I expected. My rapid ' +
          'rating only reached 1900 in July 2026, so there aren\'t many rapid ' +
          'games at that level, and blitz games have far more blunders to learn ' +
          'from. On games it never saw, the model predicts my exact move 44.6% ' +
          'of the time. Always playing the engine\'s top move would get 39.8%.',
      },
      { type: 'h', text: 'What surprised me' },
      {
        type: 'p',
        text:
          'The fitted model played much worse than I do. A model built to ' +
          'predict my moves spreads some probability over moves I\'d never ' +
          'actually play, and sampling from it adds up to a weaker player. ' +
          'Against rating-limited Stockfish it scored half a point out of 24. ' +
          'So the bot sharpens its choices and calculates more often, which ' +
          'keeps the style and only changes the level. I tuned that against my ' +
          'games from July and August 2026. In those positions it picks a ' +
          'Stockfish-approved move 66% of the time, against my 67%, and its ' +
          'average centipawn loss is 40 to my 38.',
      },
      {
        type: 'p',
        text:
          'The opening book comes from the same games, weighted toward recent ' +
          'rapid, and the pause before each move comes from the clock times in ' +
          'my blitz games, so it plays recaptures fast and takes longer in ' +
          'sharp positions. When I rerun the pipeline it refits on my newest ' +
          'games and plays at my current rating, so it should get better when I ' +
          'do.',
      },
    ],
  },
  {
    slug: 'asteroids',
    title: 'The Sky Is Closer Than You Think',
    date: 'Jun 2026',
    readTime: '3 min read',
    blurb: 'From a middle-school astronomy event to a live map of today’s near misses.',
    body: [
      {
        type: 'p',
        text:
          'In middle school I did Reach for the Stars, the astronomy event in ' +
          'Science Olympiad. You memorize constellations, deep-sky objects, and ' +
          'the names of stars that have been dead longer than there have been ' +
          'people to name them. I studied most of it off flashcards. What ' +
          'actually stuck was the first time I went outside afterward and ' +
          'recognized Orion. It wasn\'t a flashcard anymore. It was up there, ' +
          'and I knew which one it was.',
      },
      {
        type: 'p',
        text:
          'The thing I most want to see, I still haven\'t: the aurora in ' +
          'Iceland, in winter, far enough from town that it fills the whole ' +
          'sky. I\'ve watched a lot of shaky phone footage of it, and I\'m pretty ' +
          'sure the footage doesn\'t come close. I haven\'t gone yet. The ' +
          'Asteroids app on this site is partly what I built in the meantime.',
      },
      { type: 'h', text: 'The orbits are real' },
      {
        type: 'p',
        text:
          'It would have been easy to draw a pretty starfield and scatter some ' +
          'rocks around it. Instead, the app pulls NASA\'s NeoWs feed (the Near ' +
          'Earth Object Web Service) and asks what\'s making a close approach to ' +
          'Earth today, closest first. For each object it fetches the orbital ' +
          'elements from JPL\'s small-body database and propagates them by ' +
          'solving Kepler\'s equation, with Earth placed by a standard analytic ' +
          'ephemeris. Every trajectory on screen is that rock\'s actual path ' +
          'relative to Earth over the 48 hours either side of its closest ' +
          'approach. A time bar lets you scrub through the flyby or ' +
          'fast-forward it.',
      },
      { type: 'h', text: 'Two ways of seeing the same sky' },
      {
        type: 'p',
        text:
          'There\'s a scale toggle. The classic view is the original System 1 ' +
          'toy: each asteroid sweeps a decorative ring at its catalogued miss ' +
          'distance. It looks great and is completely unphysical. The real view ' +
          'propagates the actual orbits and draws everything to scale, with the ' +
          'Moon\'s orbit for reference. To scale, most of these rocks miss us by ' +
          'several times the distance to the Moon, which is reassuring or not ' +
          'depending on how you feel about the word "several."',
      },
      { type: 'h', text: 'Drawing 1984 in WebGL' },
      {
        type: 'p',
        text:
          'The scene is rendered in grayscale off-screen with WebGL2, then ' +
          'reduced to one-bit black and white by a Bayer ordered-dither shader. ' +
          'That one shader shades the day/night line across the globe and ' +
          'stipples the asteroid trails into the dotted texture a 1984 screen ' +
          'would have produced. Labels, hazard rings, and the rings you click ' +
          'to select an object are drawn on a separate 2D overlay, so the text ' +
          'stays sharp while everything else gets dithered. The one-bit limit ' +
          'actually helps: dithered, the scene reads like a diagram instead of ' +
          'a blurry photo.',
      },
      { type: 'h', text: 'Why bother' },
      {
        type: 'p',
        text:
          'None of this needs a server or a paid API. It runs on NASA\'s public ' +
          'feed and orbital mechanics that have been settled for three hundred ' +
          'years, so anyone with a browser can watch today\'s close approaches. ' +
          'I built it for the same reason that night with Orion stuck with me: ' +
          'the rocks are real, they keep real schedules, and you can check. ' +
          'Iceland is still on the list.',
      },
    ],
  },
  {
    slug: 'mac-in-browser',
    title: 'Building a 1984 Macintosh in the Browser',
    date: 'May 2026',
    readTime: '2 min read',
    blurb: 'Why my portfolio boots, beeps, and makes you double-click folders.',
    body: [
      {
        type: 'p',
        text:
          'Most portfolio sites are a hero section, three cards, and a contact ' +
          'form. Mine is a Macintosh 128K floating in a dark room, and you get ' +
          'to it by watching it boot.',
      },
      { type: 'h', text: 'Why a desktop' },
      {
        type: 'p',
        text:
          'People already know how to use a desktop, and they did in 1984 too. ' +
          'Projects go in folders, the résumé is a document, and games go in a ' +
          'Games folder. I didn\'t have to design a navigation system. I ' +
          'borrowed the Finder\'s. Working within System 1\'s limits (one-bit ' +
          'graphics, pixel fonts, dithered grays) also made design decisions ' +
          'easier. When I wasn\'t sure, I asked what the original Finder would ' +
          'do.',
      },
      { type: 'h', text: 'Under the hood' },
      {
        type: 'p',
        text:
          'It\'s React, TypeScript, and Vite, deployed as a static site. Windows ' +
          'manage their own geometry through a small layout library that ' +
          'cascades them, keeps them inside the viewport, and switches to a ' +
          'phone mode where the desktop becomes an iPhone home screen. The ' +
          'intro is one continuous camera move. The Mac floats up out of the ' +
          'dark, power runs up its keyboard cord, the screen turns on, and the ' +
          'camera dives in. The screen you\'re watching is the real desktop the ' +
          'whole time, scaled onto the Mac\'s glass, so when the camera lands ' +
          'it\'s already at full size and nothing has to switch over. Deep links ' +
          'still work. Going to /projects opens the Projects window on top, ' +
          'because each window maps to a route and the build pre-renders an ' +
          'HTML page for each one.',
      },
      { type: 'h', text: 'Small details' },
      {
        type: 'p',
        text:
          'The hourglass cursor shows for a random beat before a window opens, ' +
          'because instant would feel wrong on a 128K Mac. The error dialog ' +
          'plays the classic Basso beep. There\'s an achievement system, since ' +
          'if I\'m going to make people play Minesweeper on my résumé site, they ' +
          'should get something for winning. None of these matter much on their ' +
          'own. Together they\'re what make it feel like using an old computer.',
      },
    ],
  },
  {
    slug: 'fde-notes',
    title: 'Notes from Forward Deployed Engineering',
    date: 'Apr 2026',
    readTime: '2 min read',
    blurb: 'What shipping AI into real factories taught me about software.',
    body: [
      {
        type: 'p',
        text:
          'I joined Endeavor AI as a Forward Deployed Engineer after graduating ' +
          'from Carnegie Mellon with a business degree and a CS minor. Most ' +
          'people don\'t know what the title means, so here\'s my definition: an ' +
          'FDE is an engineer whose code has to work on a real customer\'s real ' +
          'data, this week.',
      },
      { type: 'h', text: 'The data is never clean' },
      {
        type: 'p',
        text:
          'In school, datasets come cleaned. In production ERP automation, the ' +
          'product catalog has three names for the same item, the customer ' +
          'records haven\'t been deduplicated in years, and an integration you ' +
          'depend on goes down on Tuesdays. A lot of the job is diagnosing data ' +
          'problems in customer environments and building workarounds reliable ' +
          'enough to run unattended. In practice that means assuming nothing is ' +
          'correct until I\'ve checked it.',
      },
      { type: 'h', text: 'Boring infrastructure' },
      {
        type: 'p',
        text:
          'The stack that ships is deliberately unexciting: FastAPI services, ' +
          'AWS Lambda, S3, and Terraform. A scheduled sync that ingests ' +
          'catalogs and pushes uploads downstream doesn\'t need to be novel. It ' +
          'needs to run every night and alert someone when it doesn\'t. The AI ' +
          'is what makes the product different, but customers mostly judge it ' +
          'by whether the plumbing around it works.',
      },
      { type: 'h', text: 'Where the business degree helps' },
      {
        type: 'p',
        text:
          'What surprised me is how often the hard problem isn\'t technical. ' +
          'It\'s deciding what to automate first, turning an operations ' +
          'manager\'s complaints into a schema, or knowing when a 90% solution ' +
          'this week beats a 99% solution next quarter. That\'s where the ' +
          'business half of my degree comes in. It\'s one of the few engineering ' +
          'jobs where I use both halves every day.',
      },
    ],
  },
  {
    slug: 'spoiler-block',
    title: 'Teaching a Browser What a Spoiler Is',
    date: 'Dec 2024',
    readTime: '2 min read',
    blurb: 'The surprisingly fuzzy NLP problem inside a small Chrome extension.',
    body: [
      {
        type: 'p',
        text:
          'Spoiler-block started because I was two seasons behind on a show and ' +
          'kept getting it spoiled. The obvious fix is a keyword blocklist, and ' +
          'it doesn\'t work well. Block the show\'s title and you also block the ' +
          'review you wanted to read. Allow it, and "character X dies in ' +
          'episode Y" gets through.',
      },
      { type: 'h', text: 'Context, not keywords' },
      {
        type: 'p',
        text:
          'A spoiler is a statement about the plot of a specific work, at a ' +
          'point you haven\'t reached yet. That\'s three conditions, and keyword ' +
          'matching only checks one of them. The extension scores page text ' +
          'with lightweight NLP before deciding what to redact, looking at the ' +
          'sentences around a title mention instead of the mention alone. In my ' +
          'testing, moving from keywords to context scoring improved blocking ' +
          'efficiency by about 40%, mostly by cutting the false positives that ' +
          'make people switch blockers off.',
      },
      { type: 'h', text: 'How to redact' },
      {
        type: 'p',
        text:
          'The other thing I learned was about the redaction itself. Deleting ' +
          'text breaks page layouts and makes people wonder what they missed. ' +
          'Blacking it out keeps the layout intact and looks like a censored ' +
          'document, and you can click to reveal it if you\'re willing to risk ' +
          'it. It\'s still a work in progress. Next on the list are per-show ' +
          'progress tracking and image redaction.',
      },
    ],
  },
];

export function getWriting(slug: string): Writing | undefined {
  return writings.find((w) => w.slug === slug);
}
