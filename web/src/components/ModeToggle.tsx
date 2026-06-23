import { useMode } from '../features/preferences/useMode';
import { ALT_MODE, MODE_LABEL, type Surface } from '../features/preferences/types';

/**
 * A presentational on/off switch for a surface's optional mode (default off).
 * Implemented as an ARIA `switch` so it is keyboard-operable and announced
 * correctly; flipping it only changes layout/tone, never a data binding.
 */
export function ModeToggle({ surface }: { surface: Surface }) {
  const { mode, setMode } = useMode(surface);
  const alt = ALT_MODE[surface];
  const on = mode === alt;

  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-charcoal/55">
        {MODE_LABEL[alt]} mode
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={`${MODE_LABEL[alt]} mode`}
        onClick={() => setMode(on ? 'default' : alt)}
        className={`relative h-5 w-9 rounded-full transition-colors duration-fast ${
          on ? 'bg-forest' : 'bg-forest/20'
        }`}
      >
        <span
          className="absolute top-0.5 h-4 w-4 rounded-full bg-cream shadow-sm transition-transform duration-fast"
          style={{ transform: on ? 'translateX(18px)' : 'translateX(2px)' }}
        />
      </button>
    </label>
  );
}
