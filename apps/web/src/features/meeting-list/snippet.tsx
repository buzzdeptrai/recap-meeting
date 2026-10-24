import type { ReactNode } from "react";

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

const decode = (text: string) => text.replace(/&(?:amp|lt|gt|quot|#39);/g, (e) => ENTITIES[e] ?? e);

export type SnippetPart = { text: string; match: boolean };

/** Splits the API's escaped `<mark>` excerpt into plain-text parts (never injects HTML). */
export function parseSnippet(snippet: string): SnippetPart[] {
  return snippet
    .split(/(<mark>.*?<\/mark>)/s)
    .filter(Boolean)
    .map((chunk) =>
      chunk.startsWith("<mark>")
        ? { text: decode(chunk.slice("<mark>".length, -"</mark>".length)), match: true }
        : { text: decode(chunk), match: false },
    );
}

export function Snippet({ snippet }: { snippet: string }): ReactNode {
  return (
    <>
      {parseSnippet(snippet).map((part, index) =>
        part.match ? (
          <mark
            key={index}
            className="rounded-[3px] bg-[#f3e8fd] px-0.5 font-semibold text-soft-ink"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
