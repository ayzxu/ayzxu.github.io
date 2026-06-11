/* ==========================================================================
   Fun — the hobbies and interests rendered by the Fun folder window.
   ========================================================================== */

import gusfring from '../assets/art/gusfring.webp';
import stevejobs from '../assets/art/stevejobs.png';
import vagabondshoes from '../assets/art/vagabondshoes.webp';
import walterwhite from '../assets/art/walterwhite.webp';
import azukivagabond from '../assets/art/azukivagabond.webp';
import dragon from '../assets/art/dragon.webp';
import corgi from '../assets/art/corgi.webp';
import sunsetkicks from '../assets/art/sunsetkicks.webp';
import gymVideo1 from '../assets/gym/IMG_6232.mov';
import gymVideo2 from '../assets/gym/IMG_6418.MOV';
import volleyballVideo1 from '../assets/volleyball/VB1.mov';
import volleyballImage1 from '../assets/volleyball/HS2A3950_Original.webp';
// .webp variant used here — the .png original is ~7.6 MB
import volleyballImage2 from '../assets/volleyball/HS2A4018_Original.webp';

import type { ImageItem, LinkItem, MediaItem } from './types';

export type FunItem = {
  title: string;
  description: string[];
  images?: ImageItem[];
  media?: MediaItem[];
  links?: LinkItem[];
  // Chess is rendered specially in FunWindow (live Chess.com board)
  live?: boolean;
};

export const funItems: FunItem[] = [
  {
    title: 'Chess',
    description: ['Just trying to get better at chess!'],
    links: [{ name: 'Chess.com Profile', url: 'https://www.chess.com/member/mozandyque' }],
    live: true,
  },
  {
    title: 'Art',
    description: [
      'I like drawing bald or nearly bald guys and painting shoes. ' +
        'The occasional animal too.',
    ],
    images: [
      { src: vagabondshoes, alt: 'Custom Vagabond AF1 — June 2025' },
      { src: walterwhite, alt: 'Walter White, pencil — August 2024' },
      { src: gusfring, alt: 'Gus Fring, pencil — July 2024' },
      { src: stevejobs, alt: 'Steve Jobs, MS Paint with a mouse — July 2023' },
      { src: azukivagabond, alt: 'Azuki "Vagabond", pen and marker — December 2022' },
      { src: dragon, alt: 'Dragon, pencil — March 2021' },
      { src: sunsetkicks, alt: 'Custom shoes "Sunset Kicks" — June 2020' },
      { src: corgi, alt: 'Corgi, pencil — January 2020' },
    ],
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
