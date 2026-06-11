/* ==========================================================================
   WritingReaderWindow — an essay rendered as a read-only AndyWrite document.
   The word processor becomes the reader: same page chrome and status bar,
   but the toolbar collapses to the document name and a working Save As… menu
   (the rendered page is real DOM, so writeExport works unchanged).
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';
import type { Writing } from '../data/writings';
import {
  exportDocx,
  exportHtml,
  exportPdf,
  exportTxt,
  extractDocument,
} from '../lib/writeExport';

type SaveFormat = 'txt' | 'html' | 'docx' | 'pdf';

const SAVE_FORMATS: { id: SaveFormat; label: string }[] = [
  { id: 'pdf', label: 'PDF' },
  { id: 'docx', label: 'Word (.docx)' },
  { id: 'html', label: 'HTML' },
  { id: 'txt', label: 'Plain Text' },
];

type WritingReaderWindowProps = {
  writing: Writing;
};

export default function WritingReaderWindow({
  writing,
}: WritingReaderWindowProps) {
  const pageRef = useRef<HTMLDivElement>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  /* close the Save As menu on any outside click */
  useEffect(() => {
    if (!saveOpen) return;
    const close = () => setSaveOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [saveOpen]);

  const saveAs = async (format: SaveFormat) => {
    const root = pageRef.current;
    if (!root || saving) return;
    setSaveOpen(false);
    setSaving(true);
    try {
      const paras = extractDocument(root);
      if (format === 'txt') exportTxt(paras, writing.title);
      else if (format === 'html') exportHtml(root.innerHTML, writing.title);
      else if (format === 'docx') await exportDocx(paras, writing.title);
      else await exportPdf(paras, writing.title);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="write-content">
      {/* toolbar — read-only: just the document name and Save As… */}
      <div className="write-toolbar">
        <span className="write-name write-name-readonly" title={writing.title}>
          {writing.title}
        </span>

        <span className="write-readonly-badge">Read Only</span>

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
        <div ref={pageRef} className="write-page write-page-reader">
          <h1 className="reader-title">{writing.title}</h1>
          <p className="reader-byline">
            Andy Xu · {writing.date} · {writing.readTime}
          </p>
          {writing.body.map((block, i) =>
            block.type === 'h' ? (
              <h2 key={i} className="reader-heading">
                {block.text}
              </h2>
            ) : (
              <p key={i} className="reader-para">
                {block.text}
              </p>
            ),
          )}
        </div>
      </div>

      <div className="write-statusbar">
        <span className="paint-bar-label">{writing.readTime}</span>
        <span className="paint-bar-label">AndyWrite 1.0 — Read Only</span>
      </div>
    </div>
  );
}
