/* ==========================================================================
   Experience & profile — the Read Me intro, socials, the About Me blurb and
   the full work-experience history.
   ========================================================================== */

import pfp from '../assets/portraits/pfp.webp';
import portrait3 from '../assets/portraits/portrait3.webp';
import portrait4 from '../assets/portraits/portrait4.webp';
import portrait5 from '../assets/portraits/portrait5.webp';
import portrait6 from '../assets/portraits/portrait6.webp';
import portrait7 from '../assets/portraits/portrait7.webp';
import portrait8 from '../assets/portraits/portrait8.webp';
import azuki1 from '../assets/experiencepics/azuki/azuki1.webp';
import azuki2 from '../assets/experiencepics/azuki/azuki2.webp';
import ibm12 from '../assets/experiencepics/ibm1/ibm12.webp';
import ibm13 from '../assets/experiencepics/ibm1/ibm13.webp';
import ibm14 from '../assets/experiencepics/ibm1/ibm14.webp';
import ibm21 from '../assets/experiencepics/ibm2/ibm21.webp';
import ibm22 from '../assets/experiencepics/ibm2/ibm22.webp';
import ibm23 from '../assets/experiencepics/ibm2/ibm23.webp';
import mercorLogo from '../assets/experiencepics/mercor/mercor.png';
import endeavorLogo from '../assets/experiencepics/endeavor/endeavor.png';
import ibmLogo from '../assets/experiencepics/ibm/ibm.svg';
import azukiLogo from '../assets/experiencepics/azuki/azuki-logo.png';

import type { ImageItem, LinkItem } from './types';

export type ExperienceItem = {
  role: string;
  org: string;
  location: string;
  dates: string;
  url: string;
  bullets: string[];
  /** Company logo shown inline beside the org name */
  logo?: string;
  images?: ImageItem[];
};

/* --- Intro (Read Me window) ---------------------------------------------- */

export const intro = {
  heading: "Hi, I'm Andy.",
  body:
    "I'm a Member of Technical Staff on the Applied AI, Forward Deployed " +
    "Engineering team at Mercor. I recently graduated from Carnegie " +
    "Mellon University with a degree in Business Administration and " +
    "a minor in Computer Science.",
  portrait: pfp,
};

export const socials: LinkItem[] = [
  { name: 'GitHub', url: 'https://github.com/ayzxu' },
  { name: 'LinkedIn', url: 'https://www.linkedin.com/in/ayzxu/' },
  { name: 'Email', url: 'mailto:andyxu.sanjose@gmail.com' },
];

/* --- About window -------------------------------------------------------- */

export const about = {
  portraits: [
    { src: portrait5, alt: 'Graduation day at Carnegie Mellon, May 2026' },
    { src: portrait6, alt: 'China, May 2026' },
    { src: portrait4, alt: 'New York City, October 2025' },
    { src: portrait3, alt: 'Me and my scooter, September 2025' },
    { src: portrait7, alt: 'Bamboo grove in Japan, March 2025' },
    { src: portrait8, alt: 'Yakitori night in Japan, March 2025' },
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
    role: 'Member of Technical Staff',
    org: 'Mercor',
    location: 'San Francisco, CA',
    dates: 'Aug 2026 - Present',
    url: 'https://mercor.com',
    logo: mercorLogo,
    bullets: [
      'Building and deploying custom AI solutions directly alongside ' +
        "customers on Mercor's Applied AI, Forward Deployed Engineering team",
      'Embedding with partner teams to translate ambiguous, real-world ' +
        'requirements into reliable production systems',
    ],
  },
  {
    role: 'Forward Deployed Engineer',
    org: 'Endeavor AI',
    location: 'San Francisco, CA',
    dates: 'Mar 2026 - Jul 2026',
    url: 'https://www.endeavor.ai',
    logo: endeavorLogo,
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
    logo: ibmLogo,
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
    logo: ibmLogo,
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
    logo: azukiLogo,
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
