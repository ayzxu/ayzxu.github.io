/* ==========================================================================
   writeExport — turns AndyWrite's contentEditable DOM into a small document
   model (paragraphs of styled runs), then renders that model out as plain
   text, standalone HTML, a real .docx (via the docx package) or a laid-out
   PDF (via jsPDF, with a tiny word-wrap engine that honours per-run fonts).
   ========================================================================== */

/* docx and jspdf are imported dynamically inside their export functions so
   the desktop's main bundle doesn't pay for them — they load on first save. */

export type WriteAlign = 'left' | 'center' | 'right';

export type WriteRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  /** First family from the computed font stack, e.g. "Geneva" */
  font: string;
  sizePx: number;
};

export type WriteParagraph = { align: WriteAlign; runs: WriteRun[] };

/* --- DOM → model ---------------------------------------------------------- */

function firstFamily(stack: string | undefined): string {
  if (!stack) return 'Geneva';
  const first = stack.split(',')[0] ?? '';
  return first.replace(/["']/g, '').trim() || 'Geneva';
}

/** text-decoration doesn't inherit as a computed value, but it paints through
    descendants — so check the whole ancestor chain up to the editor root. */
function isUnderlined(start: HTMLElement | null, root: HTMLElement): boolean {
  for (let el = start; el; el = el.parentElement) {
    if (el.tagName === 'U') return true;
    if (
      window
        .getComputedStyle(el)
        .textDecorationLine.includes('underline')
    ) {
      return true;
    }
    if (el === root) break;
  }
  return false;
}

function collectRuns(node: Node, out: WriteRun[], root: HTMLElement) {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (!text) return;
    const el = node.parentElement;
    const cs = el ? window.getComputedStyle(el) : null;
    out.push({
      text,
      bold: cs ? (parseInt(cs.fontWeight, 10) || 400) >= 600 : false,
      italic: cs ? cs.fontStyle.includes('italic') : false,
      underline: isUnderlined(el, root),
      font: firstFamily(cs?.fontFamily),
      sizePx: cs ? parseFloat(cs.fontSize) || 16 : 16,
    });
    return;
  }
  node.childNodes.forEach((child) => collectRuns(child, out, root));
}

function alignOf(el: HTMLElement): WriteAlign {
  const ta = window.getComputedStyle(el).textAlign;
  if (ta === 'center') return 'center';
  if (ta === 'right' || ta === 'end') return 'right';
  return 'left';
}

/** Walk the editor root: block-level children become paragraphs; loose
    inline nodes at the top level are grouped into one. */
export function extractDocument(root: HTMLElement): WriteParagraph[] {
  const paras: WriteParagraph[] = [];
  let loose: WriteRun[] = [];

  const flushLoose = () => {
    if (loose.length > 0) {
      paras.push({ align: 'left', runs: loose });
      loose = [];
    }
  };

  root.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      if (el.tagName === 'BR') {
        flushLoose();
        return;
      }
      const display = window.getComputedStyle(el).display;
      if (display === 'block' || display === 'list-item') {
        flushLoose();
        const runs: WriteRun[] = [];
        collectRuns(el, runs, root);
        paras.push({ align: alignOf(el), runs });
        return;
      }
    }
    collectRuns(node, loose, root);
  });
  flushLoose();

  if (paras.length === 0) paras.push({ align: 'left', runs: [] });
  return paras;
}

/* --- shared download helper ------------------------------------------------ */

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* --- plain text ------------------------------------------------------------ */

export function exportTxt(paras: WriteParagraph[], name: string) {
  const text = paras
    .map((p) => p.runs.map((r) => r.text).join(''))
    .join('\n');
  download(`${name}.txt`, new Blob([text], { type: 'text/plain' }));
}

/* --- standalone HTML -------------------------------------------------------- */

export function exportHtml(editorHtml: string, name: string) {
  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>${name}</title>
<style>
  body { max-width: 680px; margin: 40px auto; padding: 0 16px;
         font-family: Geneva, Helvetica, Arial, sans-serif; font-size: 16px;
         line-height: 1.45; color: #000; }
</style>
</head>
<body>
${editorHtml}
</body>
</html>
`;
  download(`${name}.html`, new Blob([doc], { type: 'text/html' }));
}

/* --- .docx ------------------------------------------------------------------ */

export async function exportDocx(paras: WriteParagraph[], name: string) {
  const { AlignmentType, Document, Packer, Paragraph, TextRun } =
    await import('docx');
  const DOCX_ALIGN: Record<
    WriteAlign,
    (typeof AlignmentType)[keyof typeof AlignmentType]
  > = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    right: AlignmentType.RIGHT,
  };
  const doc = new Document({
    sections: [
      {
        children: paras.map(
          (p) =>
            new Paragraph({
              alignment: DOCX_ALIGN[p.align],
              children: p.runs.map(
                (r) =>
                  new TextRun({
                    text: r.text,
                    bold: r.bold,
                    italics: r.italic,
                    underline: r.underline ? {} : undefined,
                    font: r.font,
                    // half-points: px → pt is ×0.75, then ×2
                    size: Math.round(r.sizePx * 1.5),
                  }),
              ),
            }),
        ),
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  download(`${name}.docx`, blob);
}

/* --- PDF --------------------------------------------------------------------
   jsPDF only bundles Helvetica / Times / Courier, so the classic Mac font
   names map onto their closest standard family. A greedy word-wrapper lays
   runs onto lines, honouring per-word font metrics and alignment. */

function pdfFamily(font: string): string {
  const f = font.toLowerCase();
  if (
    f.includes('york') ||
    f.includes('georgia') ||
    f.includes('times') ||
    f.includes('serif')
  ) {
    return 'times';
  }
  if (
    f.includes('monaco') ||
    f.includes('courier') ||
    f.includes('mono') ||
    f.includes('press start')
  ) {
    return 'courier';
  }
  return 'helvetica';
}

function pdfStyle(r: WriteRun): string {
  if (r.bold && r.italic) return 'bolditalic';
  if (r.bold) return 'bold';
  if (r.italic) return 'italic';
  return 'normal';
}

type PdfSeg = {
  text: string;
  family: string;
  style: string;
  sizePt: number;
  underline: boolean;
  width: number;
};

const PAGE_W = 612; // US Letter, points
const PAGE_H = 792;
const MARGIN = 72;
const AVAIL = PAGE_W - MARGIN * 2;

export async function exportPdf(paras: WriteParagraph[], name: string) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'letter' });

  const measure = (seg: Omit<PdfSeg, 'width'>): number => {
    doc.setFont(seg.family, seg.style);
    doc.setFontSize(seg.sizePt);
    return doc.getTextWidth(seg.text);
  };

  let y = MARGIN; // top of the current line

  const drawLine = (segs: PdfSeg[], align: WriteAlign, lineH: number, maxPt: number) => {
    if (y + lineH > PAGE_H - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
    const total = segs.reduce((s, seg) => s + seg.width, 0);
    let x = MARGIN;
    if (align === 'center') x = MARGIN + (AVAIL - total) / 2;
    if (align === 'right') x = MARGIN + AVAIL - total;
    const baseline = y + maxPt; // ascent ≈ font size
    for (const seg of segs) {
      doc.setFont(seg.family, seg.style);
      doc.setFontSize(seg.sizePt);
      doc.text(seg.text, x, baseline);
      if (seg.underline) {
        doc.setLineWidth(Math.max(0.5, seg.sizePt / 24));
        doc.line(x, baseline + 1.5, x + seg.width, baseline + 1.5);
      }
      x += seg.width;
    }
    y += lineH;
  };

  for (const p of paras) {
    if (p.runs.length === 0 || p.runs.every((r) => r.text.trim() === '')) {
      // blank line — advance by the paragraph's nominal height
      const sizePt = (p.runs[0]?.sizePx ?? 16) * 0.75;
      y += sizePt * 1.35;
      if (y > PAGE_H - MARGIN) {
        doc.addPage();
        y = MARGIN;
      }
      continue;
    }

    // split runs into word/space tokens, each carrying its style
    const tokens: Omit<PdfSeg, 'width'>[] = [];
    for (const r of p.runs) {
      const sizePt = r.sizePx * 0.75;
      for (const piece of r.text.split(/(\s+)/)) {
        if (piece === '') continue;
        tokens.push({
          text: piece,
          family: pdfFamily(r.font),
          style: pdfStyle(r),
          sizePt,
          underline: r.underline,
        });
      }
    }

    let line: PdfSeg[] = [];
    let lineW = 0;
    const flush = () => {
      // drop trailing whitespace so right/center alignment is true
      while (line.length > 0 && line[line.length - 1].text.trim() === '') {
        lineW -= line[line.length - 1].width;
        line.pop();
      }
      if (line.length === 0) return;
      const maxPt = Math.max(...line.map((s) => s.sizePt));
      drawLine(line, p.align, maxPt * 1.35, maxPt);
      line = [];
      lineW = 0;
    };

    for (const tok of tokens) {
      const isSpace = tok.text.trim() === '';
      const width = measure(tok);
      if (!isSpace && lineW + width > AVAIL && line.length > 0) flush();
      if (isSpace && line.length === 0) continue; // no leading spaces
      // very long single word: hard-break by characters
      if (!isSpace && width > AVAIL) {
        let chunk = '';
        for (const ch of tok.text) {
          const w = measure({ ...tok, text: chunk + ch });
          if (w > AVAIL && chunk !== '') {
            line.push({ ...tok, text: chunk, width: measure({ ...tok, text: chunk }) });
            flush();
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        if (chunk !== '') {
          const w = measure({ ...tok, text: chunk });
          line.push({ ...tok, text: chunk, width: w });
          lineW += w;
        }
        continue;
      }
      line.push({ ...tok, width });
      lineW += width;
    }
    flush();
  }

  download(`${name}.pdf`, doc.output('blob'));
}
