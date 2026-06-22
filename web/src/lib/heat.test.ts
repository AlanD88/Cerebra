import { describe, expect, it } from 'vitest';
import {
  HEAT_COLOR,
  HEAT_LABEL,
  heatColor,
  heatLabel,
  heatState,
  heatStateFromFraction,
} from './heat';

describe('heatState', () => {
  it('maps each band to its state', () => {
    expect(heatState(90)).toBe('mastered');
    expect(heatState(75)).toBe('hot');
    expect(heatState(60)).toBe('warm');
    expect(heatState(40)).toBe('cold');
    expect(heatState(10)).toBe('frozen');
  });

  it('treats thresholds as inclusive lower bounds', () => {
    expect(heatState(85)).toBe('mastered');
    expect(heatState(70)).toBe('hot');
    expect(heatState(50)).toBe('warm');
    expect(heatState(25)).toBe('cold');
  });

  it('treats values just below a threshold as the colder band', () => {
    expect(heatState(84.999)).toBe('hot');
    expect(heatState(69.999)).toBe('warm');
    expect(heatState(49.999)).toBe('cold');
    expect(heatState(24.999)).toBe('frozen');
  });

  it('handles the full-scale extremes', () => {
    expect(heatState(100)).toBe('mastered');
    expect(heatState(0)).toBe('frozen');
  });
});

describe('heatStateFromFraction', () => {
  it('scales a 0–1 mastery into the 0–100 bands', () => {
    expect(heatStateFromFraction(0.9)).toBe('mastered');
    expect(heatStateFromFraction(0.5)).toBe('warm');
    expect(heatStateFromFraction(0)).toBe('frozen');
    expect(heatStateFromFraction(1)).toBe('mastered');
  });
});

describe('heat color + label mapping', () => {
  it('returns the canonical color for every state', () => {
    expect(heatColor('mastered')).toBe('#30433D');
    expect(heatColor('hot')).toBe('#61715A');
    expect(heatColor('warm')).toBe('#D9C8A9');
    expect(heatColor('cold')).toBe('#B17457');
    expect(heatColor('frozen')).toBe('#6b6f6c');
  });

  it('keeps the exported color table in sync with the resolver', () => {
    for (const state of Object.keys(HEAT_COLOR) as (keyof typeof HEAT_COLOR)[]) {
      expect(heatColor(state)).toBe(HEAT_COLOR[state]);
    }
  });

  it('returns a human label for every state', () => {
    expect(heatLabel('mastered')).toBe('Mastered');
    expect(heatLabel('frozen')).toBe('Frozen');
    for (const state of Object.keys(HEAT_LABEL) as (keyof typeof HEAT_LABEL)[]) {
      expect(heatLabel(state)).toBe(HEAT_LABEL[state]);
    }
  });
});
