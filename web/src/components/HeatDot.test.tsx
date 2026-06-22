import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HeatDot } from './HeatDot';

describe('HeatDot', () => {
  it('renders the label so heat is never communicated by color alone', () => {
    render(<HeatDot state="mastered" />);
    expect(screen.getByText('Mastered')).toBeInTheDocument();
  });

  it('paints the dot with the canonical heat color', () => {
    const { container } = render(<HeatDot state="cold" />);
    const dot = container.querySelector('span[aria-hidden]');
    expect(dot).toHaveStyle({ backgroundColor: '#B17457' });
  });

  it('can hide the label when an adjacent label already names the heat', () => {
    render(<HeatDot state="hot" showLabel={false} />);
    expect(screen.queryByText('Hot')).not.toBeInTheDocument();
  });
});
