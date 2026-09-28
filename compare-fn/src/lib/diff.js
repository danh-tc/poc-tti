// Word-level diff between master (old) and input (new).
import { diffArrays } from 'diff';

/**
 * @returns {{ type: 'added'|'removed'|'changed', input: object[], master: object[] }[]}
 *   input  = words present only in the input file (new text)
 *   master = words present only in the master file (old text)
 */
export function diffWords(masterWords, inputWords) {
  const parts = diffArrays(masterWords, inputWords, {
    comparator: (left, right) => left.text === right.text,
  });

  // Walk the parts keeping index ranges, so pure inserts/deletes can be slid afterwards
  const hunks = [];
  let m = 0;
  let n = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const next = parts[i + 1];
    const len = part.value.length;

    if (part.removed && next?.added) {
      hunks.push({ type: 'changed', m: [m, m + len], n: [n, n + next.value.length] });
      m += len;
      n += next.value.length;
      i++;
    } else if (part.removed) {
      hunks.push({ type: 'removed', m: [m, m + len], n: [n, n] });
      m += len;
    } else if (part.added) {
      hunks.push({ type: 'added', m: [m, m], n: [n, n + len] });
      n += len;
    } else {
      m += len;
      n += len;
    }
  }

  slideToStart(hunks, 'added', 'n', inputWords);
  slideToStart(hunks, 'removed', 'm', masterWords);

  return hunks.map((h) => ({
    type: h.type,
    master: masterWords.slice(...h.m),
    input: inputWords.slice(...h.n),
  }));
}

// A pure insert "5a. ... phạm. Điều" preceded by "Điều" is the same diff as "Điều 5a. ... phạm.";
// slide such blocks left (like git's diff slider) so they start at the natural word.
function slideToStart(hunks, type, key, words) {
  for (const [i, h] of hunks.entries()) {
    if (h.type !== type) continue;
    const other = key === 'n' ? 'm' : 'n';
    const floor = i > 0 ? hunks[i - 1][key][1] : 0;
    while (h[key][0] > floor && words[h[key][0] - 1].text === words[h[key][1] - 1].text) {
      h[key][0]--;
      h[key][1]--;
      h[other][0]--;
      h[other][1]--;
    }
  }
}
