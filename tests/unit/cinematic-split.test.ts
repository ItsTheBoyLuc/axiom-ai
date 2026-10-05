// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { splitSentences, splitWords } from '@/components/cinematic/split';

const el = (html: string) => {
  const d = document.createElement('div');
  d.innerHTML = html;
  document.body.appendChild(d);
  return d;
};

describe('text splitting for the scroll scenes', () => {
  it('splits a heading into words, keeping real spaces between them (readable and selectable)', () => {
    const h = el('Understand the Models Defining Tomorrow.');
    const s = splitWords(h);
    expect(s.kind).toBe('words');
    expect(s.parts.map((p) => p.textContent)).toEqual([
      'Understand',
      'the',
      'Models',
      'Defining',
      'Tomorrow.',
    ]);
    expect(h.textContent).toBe('Understand the Models Defining Tomorrow.');
  });

  it('reverts to the original markup', () => {
    const h = el('One two three');
    const before = h.innerHTML;
    const s = splitWords(h);
    expect(h.innerHTML).not.toBe(before);
    s.revert();
    expect(h.innerHTML).toBe(before);
  });

  it('splits a paragraph into sentences', () => {
    const p = el('Every model carries its source. Benchmarks stay separate! Is that clear? Yes.');
    const s = splitSentences(p);
    expect(s.kind).toBe('sentences');
    expect(s.parts.map((x) => x.textContent)).toEqual([
      'Every model carries its source.',
      'Benchmarks stay separate!',
      'Is that clear?',
      'Yes.',
    ]);
    expect(p.textContent?.replace(/\s+/g, ' ')).toBe(
      'Every model carries its source. Benchmarks stay separate! Is that clear? Yes.',
    );
  });

  it('builds a one-sentence paragraph word by word instead of leaving it as one block', () => {
    const p = el('Explore the technology, performance, and capabilities behind modern AI.');
    const s = splitSentences(p);
    expect(s.kind).toBe('words');
    expect(s.parts.length).toBe(9);
  });

  it('never splits text that contains inline markup: it animates as one block and loses nothing', () => {
    const p = el('See the <a href="/x">methodology</a> for details.');
    const s = splitWords(p);
    expect(s.kind).toBe('block');
    expect(s.parts).toEqual([p]);
    expect(p.innerHTML).toContain('<a href="/x">methodology</a>');
  });

  it('leaves a single word alone', () => {
    const h = el('Sources');
    expect(splitWords(h).kind).toBe('block');
  });
});
