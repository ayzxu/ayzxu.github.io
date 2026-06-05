/* ==========================================================================
   Portfolio content — extracted from the original route components so the
   Macintosh "windows" can render it without carrying page-layout logic.
   ========================================================================== */

// Project assets
import squatformAnalyze from '../assets/projectpics/squatform/analyze.webp';
import squatformFeedback from '../assets/projectpics/squatform/feedback.png';
import spoilerblockExtension from '../assets/projectpics/spoilerblock/extension.png';
import spoilerblockRedacted from '../assets/projectpics/spoilerblock/redacted.png';
import spoilerblockFurtherRedaction from '../assets/projectpics/spoilerblock/furtherredaction.webp';
import threeglWorld from '../assets/projectpics/threegl/world.webp';
import chessaiGameplay from '../assets/projectpics/chessai/gameplay.png';

// Fun assets
import gusfring from '../assets/art/gusfring.webp';
import stevejobs from '../assets/art/stevejobs.png';
import vagabondshoes from '../assets/art/vagabondshoes.webp';
import walterwhite from '../assets/art/walterwhite.webp';
import gymVideo1 from '../assets/gym/IMG_6232.mov';
import gymVideo2 from '../assets/gym/IMG_6418.MOV';
import volleyballVideo1 from '../assets/volleyball/VB1.mov';
import volleyballImage1 from '../assets/volleyball/HS2A3950_Original.webp';
// .webp variant used here — the .png original is ~7.6 MB
import volleyballImage2 from '../assets/volleyball/HS2A4018_Original.webp';

// About assets
import portrait2 from '../assets/portraits/portrait2.webp';
import portrait3 from '../assets/portraits/portrait3.webp';
import portrait4 from '../assets/portraits/portrait4.webp';
import azuki1 from '../assets/experiencepics/azuki/azuki1.webp';
import azuki2 from '../assets/experiencepics/azuki/azuki2.webp';
import ibm12 from '../assets/experiencepics/ibm1/ibm12.webp';
import ibm13 from '../assets/experiencepics/ibm1/ibm13.webp';
import ibm14 from '../assets/experiencepics/ibm1/ibm14.webp';
import ibm21 from '../assets/experiencepics/ibm2/ibm21.webp';
import ibm22 from '../assets/experiencepics/ibm2/ibm22.webp';
import ibm23 from '../assets/experiencepics/ibm2/ibm23.webp';

/* --- Types ---------------------------------------------------------------- */

export type MediaItem = { src: string; alt: string; type: 'image' | 'video' };
export type LinkItem = { name: string; url: string };

export type Project = {
  title: string;
  date: string;
  description: string;
  link?: string;
  images?: { src: string; alt: string }[];
};

export type FunItem = {
  title: string;
  description: string[];
  images?: { src: string; alt: string }[];
  media?: MediaItem[];
  links?: LinkItem[];
  // Chess is rendered specially in FunWindow (live Chess.com board)
  live?: boolean;
};

export type ExperienceItem = {
  role: string;
  org: string;
  location: string;
  dates: string;
  url: string;
  bullets: string[];
  images?: { src: string; alt: string }[];
};

/* --- Intro (Read Me window) ---------------------------------------------- */

export const intro = {
  heading: "Hi, I'm Andy.",
  body:
    "I'm a recent Carnegie Mellon graduate studying Business and Computer Science. " +
    "I'm passionate about building AI products that solve real problems and create meaningful impact. " +
    "Previously, I've worked as a Forward Deployed Engineer at Endeavor AI and as an AI Engineer Intern at IBM.",
  portrait: portrait2,
};

export const socials: LinkItem[] = [
  { name: 'GitHub', url: 'https://github.com/ayzxu' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/in/ayzxu/' },
  { name: 'Email', url: 'mailto:andyxu.sanjose@gmail.com' },
];

/* --- Projects window ----------------------------------------------------- */

export const projects: Project[] = [
  {
    title: 'Squat Form Analyzer',
    date: 'Nov 2025',
    description:
      'Python + OpenCV web application that analyzes squat form from uploaded ' +
      'videos using MediaPipe pose estimation. Provides detailed ratings ' +
      '(0-100) and actionable feedback on knee tracking, back angle, depth, ' +
      'and alignment.',
    link: 'https://github.com/ayzxu/squatform',
    images: [
      { src: squatformAnalyze, alt: 'Squat Form Analysis Interface' },
      { src: squatformFeedback, alt: 'Detailed Feedback ' },
    ],
  },
  {
    title: 'Spoiler-block Chrome Extension',
    date: 'Nov 2024 - Ongoing',
    description:
      'NLP-based Chrome extension that blocks spoilers with 40% efficiency increase.',
    link: 'https://github.com/ayzxu/spoilerblock',
    images: [
      { src: spoilerblockExtension, alt: 'Extension Interface' },
      { src: spoilerblockRedacted, alt: 'Spoiler Redaction Example' },
      { src: spoilerblockFurtherRedaction, alt: 'Advanced Redaction Features' },
    ],
  },
  {
    title: 'Brawl Stars Agent - Supercell Game',
    date: 'Nov 2024 - Ongoing',
    description:
      'AI-powered bot using computer vision and reinforcement learning to play Brawl Stars.',
  },
  {
    title: 'ThreeGL Planet \u2013 WebGL Game World',
    date: 'Sep 2025',
    description:
      'Browser-based 3D game world built with React, Three.js, and WebGL. ' +
      'Features an asset pipeline with GLTF + Draco/KTX2 compression.',
    link: 'https://github.com/ayzxu/threegl-planet',
    images: [{ src: threeglWorld, alt: '3D Game World Screenshot' }],
  },
  {
    title: 'Chess AI',
    date: 'Dec 2022',
    description:
      'AI opponent using minimax algorithm with alpha-beta pruning. Supports ' +
      'human vs. human and human vs. AI game modes.',
    link: 'https://www.github.com/ayzxu/chess',
    images: [{ src: chessaiGameplay, alt: 'Chess AI Gameplay' }],
  },
];

/* --- Fun window ---------------------------------------------------------- */

export const funItems: FunItem[] = [
  {
    title: 'Chess',
    description: ['Just trying to get better at chess!'],
    links: [{ name: 'Chess.com Profile', url: 'https://www.chess.com/member/mozandyque' }],
    live: true,
  },
  {
    title: 'Art',
    description: ['I like drawing bald or nearly bald guys and painting shoes.'],
    images: [
      { src: gusfring, alt: 'Gus Fring' },
      { src: stevejobs, alt: 'Steve Jobs' },
      { src: vagabondshoes, alt: 'Vagabond Shoes' },
      { src: walterwhite, alt: 'Walter White' },
    ],
    links: [{ name: 'Portfolio', url: 'https://axuportfolio.weebly.com' }],
  },
  {
    title: 'Volleyball',
    description: [
      "Playing competitive volleyball as a captain as part of CMU Men's Club " +
        'Volleyball team. Led the team to top 15 in Division II of National ' +
        'Club Volleyball Foundation in 2023, 2024, 2025, as well as the 2026 Runner Ups.',
    ],
    media: [
      { src: volleyballImage1, alt: 'Phoenix Nationals 2025', type: 'image' },
      { src: volleyballImage2, alt: 'Phoenix Nationals 2025 as well', type: 'image' },
      { src: volleyballVideo1, alt: 'Clip from Phoenix Nationals 2025', type: 'video' },
    ],
  },
  {
    title: 'Gaming',
    description: [
      'Previously Immortal 2 in Valorant.',
      'Previously top 63 global in Clash Royale.',
    ],
    links: [
      {
        name: 'Valorant Tracker',
        url: 'https://tracker.gg/valorant/profile/riot/nuts%23deep/overview?platform=pc&playlist=competitive',
      },
      { name: 'Clash Royale Profile', url: 'https://royaleapi.com/player/8C9QQGVCR' },
    ],
  },
  {
    title: 'Gym',
    description: [
      'Current Lifting Stats:',
      '295lbs Bench',
      '385lbs Squat',
      '405lbs Deadlift',
      'Just trying to stay healthy and get stronger!',
    ],
    media: [
      { src: gymVideo1, alt: '365 Squat for 2!', type: 'video' },
      { src: gymVideo2, alt: '295 Bench!', type: 'video' },
    ],
  },
];

/* --- About window -------------------------------------------------------- */

export const about = {
  portraits: [
    { src: portrait4, alt: 'New York City, October 2025' },
    { src: portrait3, alt: 'Me and my scooter, September 2025' },
  ],
  background:
    'I grew up in the Bay Area, California, and attended Lynbrook High School. ' +
    "I graduated from Carnegie Mellon University with a degree in Business + " +
    'Computer Science, with a passion for building AI products and constant ' +
    'improvement. I also scooter around campus sometimes, so there\u2019s that.',
  closing:
    "I'm always looking for opportunities to combine my technical skills with " +
    'my business acumen to create impactful products! Contact me if you\u2019d ' +
    'like to chat or collaborate.',
};

export const experience: ExperienceItem[] = [
  {
    role: 'Forward Deployed Engineer',
    org: 'Endeavor AI',
    location: 'San Francisco, CA',
    dates: 'Mar 2026 - Present',
    url: 'https://www.endeavor.ai',
    bullets: [
      'Engineered consumer integrations and internal platform tooling for ' +
        'AI-assisted order entry and ERP automation workflows',
      'Built backend services using FastAPI and cloud-native data pipelines ' +
        'with AWS Lambda, S3, and Terraform',
      'Automated ingestion of product catalogs and customer records for ' +
        'scheduled syncs and downstream upload workflows',
      'Diagnosed data quality issues in customer environments, designing ' +
        'reliable workarounds for production systems',
    ],
  },
  {
    role: 'AI Engineer Intern',
    org: 'IBM',
    location: 'San Francisco, CA',
    dates: 'May 2025 - Aug 2025',
    url: 'https://www.ibm.com',
    bullets: [
      'Developed an intelligent document processing pipeline leveraging OCR, ' +
        'Tensorflow, and Granite-8B to decrease costs by 80% and speed up by ' +
        '150% when compared to GPT-4o',
      'Created a semantic search pipeline and chatbot utilizing watsonx.ai, ' +
        'Pytorch, and Puppeteer for Minnesota Government',
      'Engineered full-stack automated recording summarization platform ' +
        'integrating watsonx.ai with Flask and ThreadPoolExecutor parallel ' +
        'processing, achieving 80% faster transcription and 90% time savings',
      'Built internal AI OneDrive document chat system using LangChain and ' +
        'vectorized Lucene database',
    ],
    images: [
      { src: ibm21, alt: 'Avey and Satvik!' },
      { src: ibm22, alt: 'Boat Cruise Event in SF' },
      { src: ibm23, alt: 'Ping Pong Tournament Champion' },
    ],
  },
  {
    role: 'Data and AI Specialist Intern',
    org: 'IBM',
    location: 'San Francisco, CA',
    dates: 'May 2024 - Aug 2024',
    url: 'https://www.ibm.com',
    bullets: [
      'Ensured client readiness for Data and AI infrastructure with technical ' +
        'solutions, reducing deployment time by 20%',
      "Prospected 10+ use cases and demos for IBM's watsonx.ai, watsonx.data, " +
        'and watsonx.gov in Python and SQL',
      'Built fullstack application with Node.js, HTML, and CSS for ' +
        'manipulating sales CSV files using Pandas in Python',
      'Constructed custom Excel spreadsheet with macros to assist sales team ' +
        'with 40+ clients',
    ],
    images: [
      { src: ibm12, alt: 'First day of work at IBM!' },
      { src: ibm13, alt: 'SF Giants Game with interns!' },
      { src: ibm14, alt: 'Escape Room with interns!' },
    ],
  },
  {
    role: 'Software Engineering and Marketing Intern',
    org: 'Chiru Labs (Azuki)',
    location: 'Los Angeles, CA',
    dates: 'Jun 2023 - Aug 2023',
    url: 'https://www.azuki.com',
    bullets: [
      'Built a client-facing website using React.js and a Python backend, ' +
        'improved UX with responsive animated UI',
      'Conducted web3 market research that identified 10+ key customer ' +
        'segments, resulting in a 15% increase in revenue',
    ],
    images: [
      { src: azuki1, alt: 'First day of work at Azuki!' },
      { src: azuki2, alt: 'The old office in LA' },
    ],
  },
];
