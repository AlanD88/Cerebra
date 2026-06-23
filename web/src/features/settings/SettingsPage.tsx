import { ModeToggle } from '../../components/ModeToggle';
import type { Surface } from '../preferences/types';

// Settings is the consolidated home for the Phase 6 optional modes (also
// toggleable inline on each surface). Every row reads/writes the same
// `/preferences` row through useMode, so the states stay in lockstep.
const ROWS: { surface: Surface; title: string; desc: string }[] = [
  {
    surface: 'concept',
    title: 'Concept · Focus mode',
    desc: 'Make the visualization full-bleed; notes, recall and dependencies collapse into a side drawer.',
  },
  {
    surface: 'graph',
    title: 'Knowledge Graph · Immersive mode',
    desc: 'Hide the page chrome and let the atlas fill the screen, with the controls floating over it.',
  },
  {
    surface: 'review',
    title: 'Review · Tutor tone',
    desc: 'Warmer, encouraging phrasing during recall. The score stays AI-assigned and read-only.',
  },
];

export function SettingsPage() {
  return (
    <div className="max-w-2xl">
      <header className="mb-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-charcoal/50">Preferences</p>
        <h1 className="mt-1 font-display text-h1 font-medium text-charcoal">Settings</h1>
      </header>

      <section className="surface-paper p-6">
        <h2 className="font-display text-h2 text-charcoal">Display modes</h2>
        <p className="mt-1 text-caption text-charcoal/55">
          Optional alternate treatments — all default off and sync to your account.
        </p>
        <ul className="mt-5 divide-y divide-forest/10">
          {ROWS.map((r) => (
            <li key={r.surface} className="flex items-center justify-between gap-6 py-4">
              <div>
                <p className="text-body font-semibold text-charcoal">{r.title}</p>
                <p className="mt-0.5 text-caption text-charcoal/60">{r.desc}</p>
              </div>
              <ModeToggle surface={r.surface} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
