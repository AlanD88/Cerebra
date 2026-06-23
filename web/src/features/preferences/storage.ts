import type { Preferences } from './types';
import { DEFAULT_MODES } from './types';

// localStorage mirror of the preferences row. It exists purely to paint the
// stored mode on first frame (before the GET resolves) without a layout-shift
// flash (polish-frontend.md §2). The server row remains the source of truth.
const LS_KEY = 'cerebra:preferences';

export function readLocalPreferences(): Preferences | undefined {
  if (typeof localStorage === 'undefined') return undefined;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Preferences;
    if (parsed && typeof parsed.modes === 'object') {
      return { modes: { ...DEFAULT_MODES, ...parsed.modes } };
    }
  } catch {
    // ignore malformed/blocked storage — fall back to defaults
  }
  return undefined;
}

export function writeLocalPreferences(prefs: Preferences): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    // ignore — storage is a cache, never the source of truth
  }
}
