// Build the report PDF: summary page(s), then the highlighted input and master pages.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, BlendMode } from 'pdf-lib';

const require = createRequire(import.meta.url);
// Unicode font so Vietnamese text renders on the summary page
const FONT_PATH = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf');
const FONT_BOLD_PATH = require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf');

export const COLORS = {
  added: rgb(0.55, 0.9, 0.55),
  changed: rgb(1, 0.85, 0.25),
  removed: rgb(1, 0.55, 0.55),
};

const A4 = [595.28, 841.89];
const MARGIN = 50;

function highlight(pdf, words, color) {
  const pages = pdf.getPages();
  for (const w of words) {
    pages[w.page]?.drawRectangle({
      x: w.x - 1,
      y: w.y - w.height * 0.25,
      width: w.width + 2,
      height: w.height * 1.25,
      color,
      opacity: 0.45,
      blendMode: BlendMode.Multiply,
    });
  }
}

function label(pdf, text, font) {
  for (const [i, page] of pdf.getPages().entries()) {
    const { width, height } = page.getSize();
    const caption = `${text} — page ${i + 1}`;
    const size = 9;
    const w = font.widthOfTextAtSize(caption, size);
    page.drawRectangle({ x: width - w - 16, y: height - 20, width: w + 12, height: 16, color: rgb(0.15, 0.15, 0.15) });
    page.drawText(caption, { x: width - w - 10, y: height - 15, size, font, color: rgb(1, 1, 1) });
  }
}

class TextWriter {
  constructor(pdf, font, bold) {
    Object.assign(this, { pdf, font, bold });
    this.newPage();
  }

  newPage() {
    this.page = this.pdf.addPage(A4);
    this.y = A4[1] - MARGIN;
  }

  line(text, { size = 10, bold = false, color = rgb(0, 0, 0), indent = 0, gap = 4 } = {}) {
    const font = bold ? this.bold : this.font;
    const maxWidth = A4[0] - MARGIN * 2 - indent;
    for (const row of wrap(text, font, size, maxWidth)) {
      if (this.y < MARGIN + size) this.newPage();
      this.y -= size;
      this.page.drawText(row, { x: MARGIN + indent, y: this.y, size, font, color });
      this.y -= gap;
    }
  }

  swatch(color, text) {
    if (this.y < MARGIN + 12) this.newPage();
    this.page.drawRectangle({ x: MARGIN, y: this.y - 11, width: 18, height: 11, color });
    this.page.drawText(text, { x: MARGIN + 26, y: this.y - 10, size: 10, font: this.font });
    this.y -= 16;
  }

  space(h = 8) {
    this.y -= h;
  }
}

function wrap(text, font, size, maxWidth) {
  const rows = [];
  let row = '';
  for (const word of text.split(' ')) {
    const candidate = row ? `${row} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !row) {
      row = candidate;
    } else {
      rows.push(row);
      row = word;
    }
  }
  rows.push(row);
  return rows;
}

const joinWords = (words) => words.map((w) => w.text).join(' ');
const pagesOf = (words) => [...new Set(words.map((w) => w.page + 1))].join(', ');
const truncate = (s, n = 300) => (s.length > n ? `${s.slice(0, n)}…` : s);

export async function buildReport({ inputPdf, masterPdf, inputName, masterName, changes, summary }) {
  const report = await PDFDocument.create();
  report.registerFontkit(fontkit);
  const font = await report.embedFont(await readFile(FONT_PATH), { subset: true });
  const bold = await report.embedFont(await readFile(FONT_BOLD_PATH), { subset: true });

  // --- summary ---
  const out = new TextWriter(report, font, bold);
  out.line('PDF Comparison Report', { size: 18, bold: true, gap: 10 });
  out.line(`Input:  ${inputName}`);
  out.line(`Master: ${masterName}`);
  out.line(`Generated: ${new Date().toISOString()}`, { color: rgb(0.4, 0.4, 0.4) });
  out.space();

  if (summary.identical) {
    out.line('No text differences found.', { size: 13, bold: true, color: rgb(0.1, 0.5, 0.1) });
  } else {
    out.line(
      `${summary.totalChanges} difference(s): ${summary.changed} changed, ${summary.added} added, ${summary.removed} removed`,
      { size: 12, bold: true },
    );
    out.line(`Words: ${summary.inputWords} in input, ${summary.masterWords} in master`, { color: rgb(0.4, 0.4, 0.4) });
    out.space();
    out.swatch(COLORS.changed, 'Changed text (highlighted on both input and master pages)');
    out.swatch(COLORS.added, 'Added — only in input');
    out.swatch(COLORS.removed, 'Removed — only in master');
    out.space();
    out.line('Details', { size: 13, bold: true, gap: 6 });

    for (const [i, c] of changes.entries()) {
      const where =
        c.type === 'removed' ? `master p.${pagesOf(c.master)}` : `input p.${pagesOf(c.input)}`;
      out.line(`${i + 1}. ${c.type.toUpperCase()} (${where})`, { bold: true, color: rgb(0.25, 0.25, 0.25) });
      if (c.master.length) out.line(`− ${truncate(joinWords(c.master))}`, { indent: 14, color: rgb(0.7, 0.1, 0.1) });
      if (c.input.length) out.line(`+ ${truncate(joinWords(c.input))}`, { indent: 14, color: rgb(0.1, 0.5, 0.1) });
      out.space(4);
    }
  }

  // --- highlighted source pages ---
  const input = await PDFDocument.load(inputPdf);
  const master = await PDFDocument.load(masterPdf);
  for (const c of changes) {
    const color = COLORS[c.type];
    highlight(input, c.input, color);
    highlight(master, c.master, c.type === 'changed' ? COLORS.changed : COLORS.removed);
  }

  input.registerFontkit(fontkit);
  master.registerFontkit(fontkit);
  label(input, `INPUT: ${inputName}`, await input.embedFont(await readFile(FONT_PATH), { subset: true }));
  label(master, `MASTER: ${masterName}`, await master.embedFont(await readFile(FONT_PATH), { subset: true }));

  for (const src of [input, master]) {
    const pages = await report.copyPages(src, src.getPageIndices());
    pages.forEach((p) => report.addPage(p));
  }

  return report.save();
}
