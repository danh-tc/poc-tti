// Extract words with their position on the page (PDF user-space units) using pdf.js.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Fallback width (1/1000 em) for glyphs whose width the PDF font does not expose
const DEFAULT_GLYPH_WIDTH = 550;

// unicode char -> advance width (1/1000 em) from the PDF's own font
function glyphWidths(font) {
  const widths = new Map();
  const toUnicode = font?.toUnicode?._map ?? font?.toUnicode ?? [];
  for (const [code, char] of Object.entries(toUnicode)) {
    const w = font.widths?.[code];
    if (char && w != null && !widths.has(char)) widths.set(char, w);
  }
  return widths;
}

export async function extractWords(pdfBytes) {
  // pdf.js transfers (detaches) the buffer it is given, so hand it a copy
  const task = getDocument({ data: new Uint8Array(pdfBytes), fontExtraProperties: true, verbosity: 0 });
  const doc = await task.promise;
  const words = [];

  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    await page.getOperatorList(); // loads fonts into commonObjs
    const { items } = await page.getTextContent();
    const fontCache = new Map();

    for (const item of items) {
      if (!item.str?.trim()) continue;
      const [a, b, , , x, y] = item.transform;
      const height = item.height || Math.hypot(a, b);

      if (!fontCache.has(item.fontName)) {
        let font;
        try {
          font = page.commonObjs.get(item.fontName);
        } catch {
          // font not resolved — every glyph uses the default width
        }
        fontCache.set(item.fontName, glyphWidths(font));
      }
      const widths = fontCache.get(item.fontName);
      const charWidth = (ch) => widths.get(ch) ?? DEFAULT_GLYPH_WIDTH;

      // pdf.js gives one box per text run; split it into words using glyph widths,
      // scaled so the run's total matches pdf.js' measured width (absorbs char/word spacing)
      const chars = [...item.str];
      const offsets = [0];
      for (const ch of chars) offsets.push(offsets.at(-1) + charWidth(ch));
      const scale = item.width / offsets.at(-1);

      // match indices are UTF-16 based; map them to code-point indices for `offsets`
      const cpIndex = (i) => [...item.str.slice(0, i)].length;
      for (const match of item.str.matchAll(/\S+/g)) {
        const start = cpIndex(match.index);
        const end = start + [...match[0]].length;
        words.push({
          text: match[0].normalize('NFC'),
          page: pageNo - 1,
          x: x + offsets[start] * scale,
          y,
          width: (offsets[end] - offsets[start]) * scale,
          height,
        });
      }
    }
  }

  await task.destroy();
  return words;
}
