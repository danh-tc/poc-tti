import { extractWords } from './extract.js';
import { diffWords } from './diff.js';
import { buildReport } from './report.js';

export async function comparePdfs({ inputPdf, masterPdf, inputName = 'input.pdf', masterName = 'master.pdf' }) {
  const [inputWords, masterWords] = await Promise.all([extractWords(inputPdf), extractWords(masterPdf)]);

  if (!inputWords.length || !masterWords.length) {
    const which = !inputWords.length ? inputName : masterName;
    const err = new Error(`No text found in "${which}" (scanned PDF? OCR is not supported)`);
    err.status = 422;
    throw err;
  }

  const changes = diffWords(masterWords, inputWords);
  const count = (type) => changes.filter((c) => c.type === type).length;
  const summary = {
    identical: changes.length === 0,
    totalChanges: changes.length,
    changed: count('changed'),
    added: count('added'),
    removed: count('removed'),
    inputWords: inputWords.length,
    masterWords: masterWords.length,
  };

  const report = await buildReport({ inputPdf, masterPdf, inputName, masterName, changes, summary });
  return { report, summary };
}

export const reportNameFor = (inputName) => `${inputName.replace(/\.pdf$/i, '')}_report.pdf`;
