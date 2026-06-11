/* ==========================================================================
   AndyWriteWindow — a MacWrite-style word processor. A contentEditable page
   with a ruler-era toolbar: classic Mac font menu, point sizes, bold /
   italic / underline, alignment, and Save As… to TXT, HTML, DOCX or PDF.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import {
  exportDocx,
  exportHtml,
  exportPdf,
  exportTxt,
  extractDocument,
} from '../lib/writeExport';
import { unlockAchievement } from '../lib/achievements';

/* Classic Mac font names → web stacks that actually render */
const FONTS: { name: string; stack: string }[] = [
  { name: 'Geneva', stack: 'Geneva, Helvetica, Arial, sans-serif' },
  { name: 'New York', stack: '"New York", Georgia, "Times New Roman", serif' },
  { name: 'Monaco', stack: 'Monaco, "Courier New", monospace' },
  { name: 'Chicago', stack: '"Press Start 2P", monospace' },
];

const SIZES = [9, 10, 12, 14, 18, 24, 36, 48];

type SaveFormat = 'txt' | 'html' | 'docx' | 'pdf';

const SAVE_FORMATS: { id: SaveFormat; label: string }[] = [
  { id: 'pdf', label: 'PDF' },
  { id: 'docx', label: 'Word (.docx)' },
  { id: 'html', label: 'HTML' },
  { id: 'txt', label: 'Plain Text' },
];

export default function AndyWriteWindow() {
  const editorRef = useRef<HTMLDivElement>(null);
  const [docName, setDocName] = useState('Untitled');
  const [font, setFont] = useState(FONTS[0].name);
  const [size, setSize] = useState(12);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  /* close the Save As menu on any outside click */
  useEffect(() => {
    if (!saveOpen) return;
    const close = () => setSaveOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [saveOpen]);

  const focusEditor = () => editorRef.current?.focus();

  /** execCommand is deprecated but still the simplest cross-browser way to
      style a contentEditable selection — perfectly period-appropriate. */
  const exec = (command: string, value?: string) => {
    focusEditor();
    document.execCommand(command, false, value);
  };

  const applyFont = (name: string) => {
    setFont(name);
    const def = FONTS.find((f) => f.name === name) ?? FONTS[0];
    exec('fontName', def.stack);
  };

  /** execCommand only knows sizes 1–7, so set a sentinel size then rewrite
      the <font> tags it makes into spans with a real pixel size. */
  const applySize = (px: number) => {
    setSize(px);
    focusEditor();
    document.execCommand('fontSize', false, '7');
    const root = editorRef.current;
    if (!root) return;
    root.querySelectorAll('font[size="7"]').forEach((el) => {
      el.removeAttribute('size');
      (el as HTMLElement).style.fontSize = `${px}px`;
    });
  };

  const saveAs = async (format: SaveFormat) => {
    const root = editorRef.current;
    if (!root || saving) return;
    setSaveOpen(false);
    setSaving(true);
    const name = docName.trim() || 'Untitled';
    try {
      const paras = extractDocument(root);
      if (format === 'txt') exportTxt(paras, name);
      else if (format === 'html') exportHtml(root.innerHTML, name);
      else if (format === 'docx') await exportDocx(paras, name);
      else await exportPdf(paras, name);
      unlockAchievement('write-export');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="write-content">
      {/* toolbar */}
      <div className="write-toolbar">
        <input
          className="write-name"
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
          aria-label="Document name"
          spellCheck={false}
        />

        <select
          className="write-select"
          value={font}
          onChange={(e) => applyFont(e.target.value)}
          aria-label="Font"
        >
          {FONTS.map((f) => (
            <option key={f.name} value={f.name} style={{ fontFamily: f.stack }}>
              {f.name}
            </option>
          ))}
        </select>

        <select
          className="write-select write-select-size"
          value={size}
          onChange={(e) => applySize(Number(e.target.value))}
          aria-label="Font size"
        >
          {SIZES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <div className="write-group">
          <button
            type="button"
            className="write-btn write-btn-b"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('bold')}
            title="Bold (⌘B)"
          >
            B
          </button>
          <button
            type="button"
            className="write-btn write-btn-i"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('italic')}
            title="Italic (⌘I)"
          >
            I
          </button>
          <button
            type="button"
            className="write-btn write-btn-u"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('underline')}
            title="Underline (⌘U)"
          >
            U
          </button>
        </div>

        <div className="write-group">
          <button
            type="button"
            className="write-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('justifyLeft')}
            title="Align left"
            aria-label="Align left"
          >
            ⌜
          </button>
          <button
            type="button"
            className="write-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('justifyCenter')}
            title="Align center"
            aria-label="Align center"
          >
            ↔
          </button>
          <button
            type="button"
            className="write-btn"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => exec('justifyRight')}
            title="Align right"
            aria-label="Align right"
          >
            ⌝
          </button>
        </div>

        <div
          className="write-save-wrap"
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="mac-button"
            onClick={() => setSaveOpen((o) => !o)}
            disabled={saving}
          >
            {saving ? 'Saving…' : 'Save As…'}
          </button>
          {saveOpen && (
            <div className="write-save-menu" role="menu">
              {SAVE_FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className="write-save-item"
                  role="menuitem"
                  onClick={() => void saveAs(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* the page */}
      <div className="write-desk">
        <div
          ref={editorRef}
          className="write-page"
          contentEditable
          suppressContentEditableWarning
          spellCheck={false}
          role="textbox"
          aria-multiline="true"
          aria-label="Document text"
          data-placeholder="Type something brilliant…"
        />
      </div>

      <div className="write-statusbar">
        <span className="paint-bar-label">
          {font} · {size}px
        </span>
        <span className="paint-bar-label">AndyWrite 1.0</span>
      </div>
    </div>
  );
}
