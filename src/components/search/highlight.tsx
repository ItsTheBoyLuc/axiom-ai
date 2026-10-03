import { highlightParts } from '@/lib/models/highlight';

/** Text with the parts matching the search words marked (case-insensitive). Safe: no HTML is injected. */
export function Highlight({ text, query }: { text: string; query: string }) {
  return (
    <>
      {highlightParts(text, query).map((p, i) =>
        p.match ? (
          <mark key={i} className="bg-accent/20 text-fg rounded-sm">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}
