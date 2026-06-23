import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Tex } from './Tex';

// Note: these query by selector rather than getByRole('math') — running
// getByRole forces jsdom's getComputedStyle over KaTeX's CSS, which crashes
// jsdom's style engine. The DOM assertions below are equivalent.
describe('Tex (KaTeX accessibility)', () => {
  it('exposes the source TeX as the accessible label, not the rendered span soup', () => {
    const tex = 'A\\mathbf{v} = \\lambda\\mathbf{v}';
    const { container } = render(<Tex tex={tex} />);
    const math = container.querySelector('[role="math"]');
    expect(math).not.toBeNull();
    expect(math).toHaveAttribute('aria-label', tex);
  });

  it('renders KaTeX markup (never an image) and hides it from assistive tech', () => {
    const { container } = render(<Tex tex="x^2" />);
    // visual output is real KaTeX…
    expect(container.querySelector('.katex')).not.toBeNull();
    // …wrapped so screen readers skip the decorative spans
    expect(container.querySelector('[aria-hidden="true"] .katex')).not.toBeNull();
  });

  it('uses a block element in display mode', () => {
    const { container } = render(<Tex tex="x" display />);
    expect(container.querySelector('[role="math"]')?.tagName).toBe('DIV');
  });
});
