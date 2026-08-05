import { useEffect, useState } from "react";
import { highlightPython } from "./shiki";
import type { HighlightedLine } from "./shiki";
import { isHostDark, watchHostTheme } from "./theme";

export function ShikiCodeView({
  source,
  wordWrap,
  onClick,
  onDoubleClick,
}: {
  source: string;
  wordWrap: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
}) {
  const [dark, setDark] = useState(isHostDark);
  const [lines, setLines] = useState<HighlightedLine[] | null>(null);

  useEffect(() => watchHostTheme(() => setDark(isHostDark())), []);
  useEffect(() => {
    let current = true;
    void highlightPython(source, dark)
      .then((next) => {
        if (current) setLines(next);
      })
      .catch(() => {
        if (current) setLines(null);
      });
    return () => {
      current = false;
    };
  }, [source, dark]);

  return (
    <div
      className="molvis-shiki-code"
      data-cell-selectable="true"
      tabIndex={0}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onKeyDown={(event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
          event.preventDefault();
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(event.currentTarget);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }}
      aria-label="Python code cell; double-click to edit"
    >
      {lines ? (
        <div className={wordWrap ? "is-wrapped" : undefined}>
          {lines.map((tokens, lineIndex) => (
            <div
              className="molvis-shiki-line"
              data-line-number={lineIndex + 1}
              key={`line-${lineIndex}`}
            >
              <span className="molvis-shiki-line-code">
                {tokens.map((token, tokenIndex) => (
                  <span
                    key={`token-${tokenIndex}`}
                    style={{
                      color: token.color,
                      fontStyle: token.fontStyle && token.fontStyle & 1 ? "italic" : undefined,
                      fontWeight: token.fontStyle && token.fontStyle & 2 ? 700 : undefined,
                      textDecoration: token.fontStyle && token.fontStyle & 4 ? "underline" : undefined,
                    }}
                  >
                    {token.content}
                  </span>
                ))}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <pre>{source || " "}</pre>
      )}
    </div>
  );
}
