import katex from 'katex';
import { useMemo } from 'react';

interface TexProps {
  tex: string;
  display?: boolean;
  className?: string;
}

/**
 * All mathematical notation renders via KaTeX, never an image (agent-rules).
 * `throwOnError: false` degrades a bad expression to source text rather than
 * throwing. The string memoizes on `tex`, so the live readout re-typesets only
 * when its value changes. (Named `Tex` to avoid shadowing the global `Math`.)
 */
export function Tex({ tex, display = false, className }: TexProps) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: display, throwOnError: false }),
    [tex, display],
  );
  const Tag = display ? 'div' : 'span';
  return <Tag className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
