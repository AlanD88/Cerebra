# Cerebra Foundations — Phase 0 · Scaffold & Tokens v1.0

Companion to `roadmap.md` (Phase 0 — Foundations), `design-system.md`, and
`agent-rules.md`. The groundwork every later phase assumes: project scaffold,
dependencies, design tokens (color, surface, heat, motion, type), the shared heat
utility, and the global shell. No product pages yet — this phase makes the tokens
resolve and the shell render.

Visual companion: `Cerebra Foundations.dc.html`.

---

## 1. Project scaffold

Monorepo-lite: a Vite frontend and a FastAPI backend in one repo.

```
cerebra/
├─ web/                 React + TypeScript + Vite + Tailwind
│  ├─ src/
│  │  ├─ app/           shell, routing, providers
│  │  ├─ lib/           heat utility, query client, api client
│  │  ├─ tokens/        tailwind token source of truth
│  │  └─ pages/         (filled from Phase 2 on)
│  └─ tailwind.config.ts
└─ api/                 FastAPI + SQLAlchemy (entities land in Phase 1)
```

**Frontend deps:** `react`, `react-dom`, `typescript`, `vite`, `@vitejs/plugin-react`,
`tailwindcss` + `postcss` + `autoprefixer`, `@tanstack/react-query`, `reactflow`,
`katex` (+ a thin KaTeX render helper). **Tooling:** `eslint`, `prettier`, `vitest`.
**Backend (repo only this phase):** `fastapi`, `uvicorn`, `sqlalchemy`, `psycopg`,
`alembic`, `pydantic`.

---

## 2. Color tokens

The seven brand colors from `design-system.md`, wired into Tailwind `theme.extend.colors`.

| Token | Hex | Role |
|---|---|---|
| `forest` | `#30433D` | primary dark surface, mastered |
| `moss` | `#61715A` | secondary, hot |
| `sage` | `#8D9C84` | muted accent, labels |
| `clay` | `#B17457` | warning / cold heat |
| `sand` | `#D9C8A9` | warm highlight, warm heat |
| `cream` | `#F5F1E8` | L0 canvas / paper |
| `charcoal` | `#1F2522` | body text |

No color outside this set. Tints/shades come from opacity, not new hexes.

---

## 3. Surface system (four levels)

Elevation is expressed by the surface, not arbitrary shadow values.

| Level | Token | Treatment |
|---|---|---|
| **L0** | `canvas` | Cream `#F5F1E8`, flat — the page |
| **L1** | `paper` | `#FBF9F3`, 1px `forest/14`, radius 10–11px, shadow `0 1px 3px rgba(31,37,34,.05)` |
| **L2** | `glass` | `linear-gradient(155deg, white/72, cream/60)`, `backdrop-blur(20px)`, 1px `white/80` |
| **L3** | `floating` | white, radius 13px, shadow `0 6px 22px rgba(31,37,34,.10)` — inspectors, popovers |
| **L4** | `modal` | white card on `charcoal/40` scrim, shadow `0 24px 60px rgba(31,37,34,.28)` |

Don't invent new elevation tiers; map every raised element to one of these.

---

## 4. Heat scale — single source of truth

One utility maps a 0–100 mastery (or 0–1, scaled) to a heat state + color. Every heat dot,
cell, and bar in the product calls it — never an inline threshold.

```ts
export type Heat = 'mastered' | 'hot' | 'warm' | 'cold' | 'frozen';

export function heatState(m: number): Heat {       // m in 0..100
  if (m >= 85) return 'mastered';
  if (m >= 70) return 'hot';
  if (m >= 50) return 'warm';
  if (m >= 25) return 'cold';
  return 'frozen';
}

export const HEAT_COLOR: Record<Heat, string> = {
  mastered: '#30433D',   // forest
  hot:      '#61715A',   // moss
  warm:     '#D9C8A9',   // sand
  cold:     '#B17457',   // clay
  frozen:   '#6b6f6c',   // muted charcoal
};
```

Note: the backend already stores `heat_state` on `concept_metrics` (see
`data-architecture.md` §5). The client utility is for any UI-only mastery value and for
mapping the stored enum → color.

---

## 5. Motion tokens

| Token | Duration | Use |
|---|---|---|
| `fast` | 150ms | reveal, hover, fades |
| `normal` | 250ms | node reposition, panel transitions |

Easing: a standard ease (`cubic-bezier(.4,0,.2,1)`). **No bounce, no elastic.** Honor
`prefers-reduced-motion`: durations collapse to 0, transforms are removed, the graph settles
instantly.

---

## 6. Type tokens

The product surfaces use three families (as in the hi-fi designs).

| Token | Family | Use |
|---|---|---|
| `display` | Newsreader (serif, 500) | hero numbers, page titles, card stats |
| `body` | Hanken Grotesk (400/600) | running text, labels, list rows |
| `mono` | JetBrains Mono (400/500) | eyebrow labels, metrics, code, data |

Scale: `display-xl` 48 · `display` 34 · `h2` 24 · `body-lg` 16 · `body` 14 · `caption` 12 ·
`mono-label` 10–11 (uppercase, `.16em` tracking). Math renders via KaTeX, never type.

---

## 7. Global shell

Present on all pages except Review.

- **Sidebar:** 52px wide, Forest `#30433D`, icon-only, expands on hover to reveal text
  labels. Nav order: Dashboard · Subjects · Knowledge Graph · Reviews · Settings.
- **Canvas:** L0 Cream. Max content width **1400px**, centered.
- **Routing:** TanStack Query provider + router at the `AppShell` root; Review renders
  outside the shell (full-screen).

---

## 8. Tailwind config (shape)

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: { forest:'#30433D', moss:'#61715A', sage:'#8D9C84',
                clay:'#B17457', sand:'#D9C8A9', cream:'#F5F1E8', charcoal:'#1F2522',
                heat: { mastered:'#30433D', hot:'#61715A', warm:'#D9C8A9',
                        cold:'#B17457', frozen:'#6b6f6c' } },
      fontFamily: { display:['Newsreader','serif'],
                    body:['Hanken Grotesk','sans-serif'],
                    mono:['JetBrains Mono','monospace'] },
      transitionDuration: { fast:'150ms', normal:'250ms' },
      maxWidth: { content:'1400px' },
    }
  }
}
```

---

## 9. Phase 0 exit criteria

The shell renders (sidebar + cream canvas, 1400px centered); all tokens resolve in Tailwind;
the heat utility is the single source of heat color; KaTeX, React Flow, and TanStack Query
are installed and smoke-tested; and a throwaway page proves a read from a projection table.
Only then does Phase 1 begin.
