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
 *
 * Accessibility (polish-frontend §3): the rendered KaTeX spans are decorative
 * markup, so the wrapper carries `role="math"` + an `aria-label` of the source
 * TeX and hides its visual children from assistive tech — screen readers read
 * the expression's source, never raw span soup.
 */
export function Tex({ tex, display = false, className }: TexProps) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: display, throwOnError: false }),
    [tex, display],
  );
  const Tag = display ? 'div' : 'span';
  return (
    <Tag className={className} role="math" aria-label={tex}>
      <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />
    </Tag>
  );
}
