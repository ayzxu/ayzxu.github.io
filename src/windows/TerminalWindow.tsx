/* ==========================================================================
   TerminalWindow — a fake "MacTerminal". Type `help` to see the safe
   commands (`ls projects`, `open resume`, `whoami`, …). A couple of hidden
   commands exist for the curious; one of them unlocks an achievement.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import { projects } from '../data/projects';
import { writings } from '../data/writings';
import { intro, socials } from '../data/experience';
import { unlockAchievement } from '../lib/achievements';
import {
  projectWindowId,
  writingWindowId,
  WINDOW_META,
  type StaticWindowId,
  type WindowId,
} from '../components/windowConfig';

type TerminalWindowProps = {
  onOpenWindow: (id: WindowId) => void;
  onClose: () => void;
};

type Line = { text: string; kind?: 'cmd' | 'err' };

const BANNER: Line[] = [
  { text: 'MacTerminal 1.0 — System Software 1.0' },
  { text: 'Type "help" for a list of commands.' },
  { text: '' },
];

/* Apps the `open` command knows about, plus project / writing slugs. */
const OPENABLE: Partial<Record<string, StaticWindowId>> = {
  readme: 'readme',
  projects: 'projects',
  fun: 'fun',
  about: 'about',
  resume: 'resume',
  chess: 'chess',
  news: 'news',
  paint: 'paint',
  andywrite: 'andywrite',
  writings: 'writings',
  music: 'music',
  achievements: 'achievements',
  calc: 'calc',
  calculator: 'calc',
  games: 'games',
  minesweeper: 'minesweeper',
  snake: 'snake',
  puzzle: 'puzzle',
  trash: 'trash',
};

const HELP: string[] = [
  'Available commands:',
  '  help              this list',
  '  ls [dir]          list desktop items (try: ls projects, ls writings)',
  '  open <name>       open a window (try: open resume, open chess-ai)',
  '  cat readme        print the Read Me',
  '  whoami            who is at the keyboard',
  '  pwd               print working directory',
  '  date              current date and time',
  '  echo <text>       repeat after you',
  '  clear             clear the screen',
  '  exit              close the terminal',
];

const DESKTOP_LISTING = [
  'Read Me        Projects/      Fun/           Writings/',
  'About Me/      Resume         Andy Chess     News',
  'Paint          AndyWrite      AndyMusic      Achievements',
  'Games/         Calculator     MacTerminal    Trash',
];

export default function TerminalWindow({
  onOpenWindow,
  onClose,
}: TerminalWindowProps) {
  const [lines, setLines] = useState<Line[]>(BANNER);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* keep the latest output in view */
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  const print = (out: Line[]) => setLines((prev) => [...prev, ...out]);

  const run = (raw: string) => {
    const echo: Line = { text: `guest@macintosh % ${raw}`, kind: 'cmd' };
    const trimmed = raw.trim();
    if (!trimmed) {
      print([echo]);
      return;
    }

    const [cmd, ...args] = trimmed.split(/\s+/);
    const arg = args.join(' ').toLowerCase();
    const out: Line[] = [echo];

    switch (cmd.toLowerCase()) {
      case 'help':
        out.push(...HELP.map((text) => ({ text })));
        break;

      case 'ls': {
        if (arg === 'projects' || arg === 'projects/') {
          out.push(
            ...projects.map((p) => ({
              text: `${p.slug.padEnd(18)} ${p.title} (${p.date})`,
            })),
          );
        } else if (arg === 'writings' || arg === 'writings/') {
          out.push(
            ...writings.map((w) => ({
              text: `${w.slug.padEnd(18)} ${w.title} (${w.readTime})`,
            })),
          );
        } else if (!arg) {
          out.push(...DESKTOP_LISTING.map((text) => ({ text })));
        } else {
          out.push({ text: `ls: ${arg}: No such directory`, kind: 'err' });
        }
        break;
      }

      case 'open': {
        if (!arg) {
          out.push({ text: 'usage: open <name>  (see: ls)', kind: 'err' });
          break;
        }
        const app = OPENABLE[arg];
        const project = projects.find((p) => p.slug === arg);
        const writing = writings.find((w) => w.slug === arg);
        if (app) {
          out.push({ text: `Opening ${WINDOW_META[app].title}…` });
          onOpenWindow(app);
        } else if (project) {
          out.push({ text: `Opening ${project.title}…` });
          onOpenWindow(projectWindowId(project.slug));
        } else if (writing) {
          out.push({ text: `Opening ${writing.title}…` });
          onOpenWindow(writingWindowId(writing.slug));
        } else {
          out.push({
            text: `open: ${arg}: No such app or document`,
            kind: 'err',
          });
        }
        break;
      }

      case 'cat': {
        if (arg === 'readme' || arg === 'read me' || arg === 'readme.txt') {
          out.push({ text: intro.heading }, { text: intro.body });
        } else if (arg) {
          out.push({ text: `cat: ${arg}: No such file`, kind: 'err' });
        } else {
          out.push({ text: 'usage: cat readme', kind: 'err' });
        }
        break;
      }

      case 'whoami':
        out.push(
          { text: 'guest' },
          {
            text:
              'The admin is andy. Find him: ' +
              socials.map((s) => s.url.replace('mailto:', '')).join('  '),
          },
        );
        break;

      case 'pwd':
        out.push({ text: '/Users/guest/Desktop' });
        break;

      case 'date':
        out.push({ text: new Date().toString() });
        break;

      case 'echo':
        out.push({ text: args.join(' ') });
        break;

      case 'clear':
        setLines([]);
        return;

      case 'exit':
      case 'logout':
        out.push({ text: 'logout' });
        print(out);
        window.setTimeout(onClose, 300);
        return;

      /* ---- hidden commands ------------------------------------------- */

      case 'sudo': {
        if (arg.replace(/\s+/g, ' ') === 'rm -rf /') {
          out.push(
            { text: 'Deleting / …' },
            { text: 'Deleting /System … just kidding.' },
            { text: 'This Macintosh has survived since 1984; you are not' },
            { text: 'taking it down today. Achievement unlocked.' },
          );
          unlockAchievement('terminal-hack');
        } else {
          out.push({
            text: 'guest is not in the sudoers file. This incident will be reported.',
            kind: 'err',
          });
        }
        break;
      }

      case 'andy':
        out.push(
          { text: '   ___    _  _ ___  __   __' },
          { text: '  / _ \\  | \\| |   \\ \\ \\ / /' },
          { text: ' / /_\\ \\ | .` | |) | \\ V / ' },
          { text: '/_/   \\_\\|_|\\_|___/   |_|  ' },
          { text: 'You found me. Try "open chess" — best of three?' },
        );
        break;

      default:
        out.push({
          text: `mac-sh: command not found: ${cmd}`,
          kind: 'err',
        });
    }

    print(out);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const value = input;
      setInput('');
      if (value.trim()) {
        setHistory((h) => [...h, value]);
      }
      setHistIdx(-1);
      run(value);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const idx = histIdx === -1 ? history.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setInput(history[idx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx === -1) return;
      const idx = histIdx + 1;
      if (idx >= history.length) {
        setHistIdx(-1);
        setInput('');
      } else {
        setHistIdx(idx);
        setInput(history[idx]);
      }
    }
  };

  return (
    <div
      className="terminal-content"
      onClick={() => inputRef.current?.focus()}
    >
      <div className="terminal-scroll" ref={scrollRef}>
        {lines.map((l, i) => (
          <div
            key={i}
            className={`terminal-line${l.kind ? ` terminal-${l.kind}` : ''}`}
          >
            {l.text || '\u00a0'}
          </div>
        ))}
        <div className="terminal-input-row">
          <span className="terminal-prompt">guest@macintosh %</span>
          <input
            ref={inputRef}
            className="terminal-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            aria-label="Terminal command input"
            autoFocus
          />
        </div>
      </div>
    </div>
  );
}
