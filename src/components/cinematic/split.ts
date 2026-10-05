/**
 * Splits text that is already in the server-rendered HTML into words or sentences so scroll can
 * build it piece by piece. The text stays readable and selectable (spaces are kept as real text
 * between the spans, so screen readers and find-in-page still see ordinary prose), and `revert()`
 * restores the original markup. Only elements whose children are plain text are split: anything
 * with inline markup (links, emphasis) is animated as one block instead, so nothing is lost.
 */

export type Split = {
  parts: HTMLElement[];
  /** What the parts are: words, sentences (or phrases), or the whole element as one block. */
  kind: 'words' | 'sentences' | 'block';
  revert: () => void;
};

const hasOnlyText = (el: Element) => [...el.childNodes].every((n) => n.nodeType === Node.TEXT_NODE);

function wrap(el: HTMLElement, pieces: string[], cls: string, kind: Split['kind']): Split {
  const original = el.innerHTML;
  const parts: HTMLElement[] = [];
  el.textContent = '';
  pieces.forEach((piece, i) => {
    const span = document.createElement('span');
    span.className = cls;
    span.textContent = piece;
    // inline-block so transform and filter apply; text wrapping still happens between the spans.
    span.style.display = 'inline-block';
    span.style.willChange = 'transform, opacity, filter';
    parts.push(span);
    el.appendChild(span);
    if (i < pieces.length - 1) el.appendChild(document.createTextNode(' '));
  });
  return {
    parts,
    kind,
    revert: () => {
      el.innerHTML = original;
    },
  };
}

/** Words, in reading order. Falls back to the element itself when it contains inline markup. */
export function splitWords(el: HTMLElement): Split {
  if (!hasOnlyText(el)) return { parts: [el], kind: 'block', revert: () => {} };
  const words = (el.textContent ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return { parts: [el], kind: 'block', revert: () => {} };
  return wrap(el, words, 'cine-w', 'words');
}

/**
 * Sentences (split after . ! ? followed by a space). Text of a single sentence is built word by
 * word instead, so a one-sentence lead still arrives piece by piece without awkward line breaks.
 */
export function splitSentences(el: HTMLElement): Split {
  if (!hasOnlyText(el)) return { parts: [el], kind: 'block', revert: () => {} };
  const text = (el.textContent ?? '').trim();
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)|[^.!?]+$/g)?.map((s) => s.trim()) ?? [text];
  if (sentences.length < 2) return splitWords(el);
  return wrap(el, sentences, 'cine-s', 'sentences');
}
