/* ==========================================================================
   Projects — each entry is a "document" in the Projects folder that opens
   into its own case-study window. Richer metadata (tech stack, year, impact
   metrics) is rendered consistently by ProjectWindow.
   ========================================================================== */

import squatformAnalyze from '../assets/projectpics/squatform/analyze.webp';
import squatformFeedback from '../assets/projectpics/squatform/feedback.png';
import spoilerblockExtension from '../assets/projectpics/spoilerblock/extension.png';
import spoilerblockRedacted from '../assets/projectpics/spoilerblock/redacted.png';
import spoilerblockFurtherRedaction from '../assets/projectpics/spoilerblock/furtherredaction.webp';
import threeglWorld from '../assets/projectpics/threegl/world.webp';
import chessaiGameplay from '../assets/projectpics/chessai/gameplay.png';

import type { WindowId } from '../components/windowConfig';
import type { ImageItem } from './types';

export type Project = {
  /** Stable id — also forms the case-study window id (`project-<slug>`) */
  slug: string;
  title: string;
  date: string;
  year: number;
  /** Technologies, rendered as a consistent tag row in the case study */
  techStack: string[];
  /** Headline metrics / outcomes, rendered as a bulleted "Impact" block */
  impact?: string[];
  description: string;
  link?: string;
  /** Opens a window inside the desktop (e.g. the live Andy Chess app) instead
     of linking out. When set, this takes precedence over `link`. */
  openApp?: WindowId;
  openAppLabel?: string;
  images?: ImageItem[];
};

export const projects: Project[] = [
  {
    slug: 'chess-ai',
    title: "Andy's Chess AI",
    date: 'Jun 2026',
    year: 2026,
    techStack: ['TypeScript', 'Web Workers', 'chess.js', 'Node.js', 'Chess.com API'],
    impact: [
      'Plays at ~1500 Chess.com strength with a recognizably "Andy" style',
      'Runs entirely in the browser — no server, no Stockfish',
      'Retrains on my latest games via an offline data pipeline',
    ],
    description:
      'A chess engine that plays like me, built from my real Chess.com games. ' +
      'It opens with my actual repertoire, leans toward the moves I\'d pick, and ' +
      'even makes my mistakes (~1500 chess.com). Hand-written search engine that runs ' +
      'entirely in your browser — no server, no Stockfish. It gets stronger as I do: ' +
      'the bot retrains on my latest games.',
    openApp: 'chess',
    openAppLabel: 'Play Andy Chess',
    images: [{ src: chessaiGameplay, alt: 'Chess AI Gameplay' }],
  },
  {
    slug: 'squat-form',
    title: 'Squat Form Analyzer',
    date: 'Nov 2025',
    year: 2025,
    techStack: ['Python', 'OpenCV', 'MediaPipe', 'Flask'],
    impact: [
      'Scores squat form 0–100 from a single uploaded video',
      'Actionable feedback on knee tracking, back angle, depth, and alignment',
    ],
    description:
      'Python + OpenCV web application that analyzes squat form from uploaded ' +
      'videos using MediaPipe pose estimation. Provides detailed ratings ' +
      '(0-100) and actionable feedback on knee tracking, back angle, depth, ' +
      'and alignment.',
    link: 'https://github.com/ayzxu/squatform',
    images: [
      { src: squatformAnalyze, alt: 'Squat Form Analysis Interface' },
      { src: squatformFeedback, alt: 'Detailed Feedback' },
    ],
  },
  {
    slug: 'spoiler-block',
    title: 'Spoiler-block Chrome Extension',
    date: 'Nov 2024 - Ongoing',
    year: 2024,
    techStack: ['JavaScript', 'NLP', 'Chrome Extensions API'],
    impact: ['40% increase in spoiler-blocking efficiency'],
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
    slug: 'threegl-planet',
    title: 'ThreeGL Planet \u2013 WebGL Game World',
    date: 'Sep 2025',
    year: 2025,
    techStack: ['React', 'Three.js', 'WebGL', 'GLTF', 'Draco/KTX2'],
    impact: ['Asset pipeline with GLTF + Draco/KTX2 compression for fast loads'],
    description:
      'Browser-based 3D game world built with React, Three.js, and WebGL. ' +
      'Features an asset pipeline with GLTF + Draco/KTX2 compression.',
    link: 'https://github.com/ayzxu/threegl-planet',
    images: [{ src: threeglWorld, alt: '3D Game World Screenshot' }],
  },
];

export function getProject(slug: string): Project | undefined {
  return projects.find((p) => p.slug === slug);
}
