// Local test without the Functions host:
//   node scripts/compare-cli.js <input.pdf> <master.pdf> [out-dir]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { comparePdfs, reportNameFor } from '../src/lib/compare.js';

const [inputPath, masterPath, outDir = 'out'] = process.argv.slice(2);
if (!inputPath || !masterPath) {
  console.log('Usage: node scripts/compare-cli.js <input.pdf> <master.pdf> [out-dir]');
  process.exit(1);
}

const inputName = basename(inputPath);
const { report, summary } = await comparePdfs({
  inputPdf: await readFile(inputPath),
  masterPdf: await readFile(masterPath),
  inputName,
  masterName: basename(masterPath),
});

await mkdir(outDir, { recursive: true });
const outPath = join(outDir, reportNameFor(inputName));
await writeFile(outPath, report);
console.log(summary);
console.log(`Report -> ${outPath}`);
