import { useRef, useState } from 'react';
import { Tex } from '../../components/Tex';
import type { VizEig, VizPreset, VizSpec } from './types';

// SVG/world mapping (mirrors the prototype): origin centered, 40px per unit.
const S = 40;
const CX = 230;
const CY = 180;
const px = (x: number) => CX + x * S;
const py = (y: number) => CY - y * S;
const fmt = (n: number) => String(Math.round(n * 100) / 100);

/**
 * The Concept Page visualization. NEVER tab-gated, always mounted, ~40vh
 * (agent-rules / concept-page-frontend.md §2). Interaction state is purely
 * local — exploration is never written back as an assessment.
 */
export function VisualizationPanel({ vizSpec }: { vizSpec: VizSpec | null }) {
  return (
    <section className="card-reveal surface-paper p-4" aria-label="Concept visualization">
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">Visualization</p>
        <div className="flex items-center gap-4 text-caption text-charcoal/55">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-[3px] w-3.5 rounded bg-moss" /> Av
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3.5 border-t-[1.5px] border-dashed border-forest" />
            eigen-guides
          </span>
        </div>
      </div>
      {vizSpec?.kind === 'eigen' && vizSpec.presets.length > 0 ? (
        <EigenViz spec={vizSpec} />
      ) : (
        <StaticFrame />
      )}
    </section>
  );
}

function StaticFrame() {
  return (
    <div className="flex h-[40vh] min-h-[300px] items-center justify-center rounded-lg bg-sage/10 text-body text-charcoal/50">
      Interactive visualization coming soon for this concept.
    </div>
  );
}

function EigenViz({ spec }: { spec: VizSpec }) {
  const [presetKey, setPresetKey] = useState(spec.presets[0].key);
  const [v, setV] = useState({ x: 1.5, y: 0.5 });
  const dragging = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const cur: VizPreset = spec.presets.find((p) => p.key === presetKey) ?? spec.presets[0];
  const m = cur.m;
  const avx = m[0][0] * v.x + m[0][1] * v.y;
  const avy = m[1][0] * v.x + m[1][1] * v.y;
  const r = Math.hypot(v.x, v.y) || 1e-6;
  const aligned = cur.eigs.find((e) => Math.abs(v.x * e.d[1] - v.y * e.d[0]) / r < 0.06) ?? null;
  const vColor = aligned ? '#30433D' : '#B17457';

  const setEig = (e: VizEig) => setV({ x: e.d[0] * 1.45, y: e.d[1] * 1.45 });
  const reset = () => setV({ x: 1.5, y: 0.5 });

  const pointFromEvent = (e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const vbX = ((e.clientX - rect.left) / rect.width) * 460;
    const vbY = ((e.clientY - rect.top) / rect.height) * 360;
    const clamp = (n: number) => Math.max(-5.4, Math.min(5.4, n));
    return { x: clamp((vbX - CX) / S), y: clamp((CY - vbY) / S) };
  };

  const onDown = (e: React.PointerEvent) => {
    dragging.current = true;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = pointFromEvent(e);
    if (p) setV(p);
  };
  const onMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const p = pointFromEvent(e);
    if (p) setV(p);
  };
  const onUp = () => {
    dragging.current = false;
  };

  const liveTex =
    `A\\mathbf{v}=${cur.label}\\!\\begin{bmatrix}${fmt(v.x)}\\\\${fmt(v.y)}\\end{bmatrix}` +
    `=\\begin{bmatrix}${fmt(avx)}\\\\${fmt(avy)}\\end{bmatrix}`;
  const status = aligned
    ? `v lies on an eigen-direction — Av = ${aligned.val} · v, parallel and ${aligned.val >= 1 ? 'stretched' : 'shrunk'}.`
    : 'Drag the tip onto a dashed guide so Av turns parallel to v.';

  return (
    <div className="flex flex-col gap-3 lg:flex-row">
      <div className="min-h-[300px] flex-1 rounded-lg bg-cream/40 lg:h-[40vh]">
        <svg
          ref={svgRef}
          viewBox="0 0 460 360"
          className="block h-full w-full touch-none"
          style={{ cursor: dragging.current ? 'grabbing' : 'grab' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerLeave={onUp}
          role="img"
          aria-label="Drag the vector v; Av snaps parallel when v lands on an eigen-direction."
        >
          <defs>
            <Arrow id="ah-clay" color="#B17457" />
            <Arrow id="ah-forest" color="#30433D" />
            <Arrow id="ah-moss" color="#61715A" />
          </defs>

          {/* grid */}
          {range(-5, 5).map((k) => {
            const X = px(k);
            return X >= 8 && X <= 452 ? (
              <line key={`gv${k}`} x1={X} y1={8} x2={X} y2={352} stroke="rgba(141,156,132,0.16)" />
            ) : null;
          })}
          {range(-4, 4).map((k) => {
            const Y = py(k);
            return Y >= 8 && Y <= 352 ? (
              <line key={`gh${k}`} x1={8} y1={Y} x2={452} y2={Y} stroke="rgba(141,156,132,0.16)" />
            ) : null;
          })}
          {/* axes */}
          <line x1={8} y1={CY} x2={452} y2={CY} stroke="rgba(141,156,132,0.5)" strokeWidth={1.3} />
          <line x1={CX} y1={8} x2={CX} y2={352} stroke="rgba(141,156,132,0.5)" strokeWidth={1.3} />

          {/* eigen guides */}
          {spec.showGuides &&
            cur.eigs.map((e, i) => {
              const L = 5.3;
              return (
                <g key={`guide${i}`}>
                  <line
                    x1={px(e.d[0] * L)}
                    y1={py(e.d[1] * L)}
                    x2={px(-e.d[0] * L)}
                    y2={py(-e.d[1] * L)}
                    stroke="#30433D"
                    strokeWidth={1.4}
                    strokeDasharray="5 6"
                    opacity={0.36}
                  />
                  <text
                    x={px(e.d[0] * 4.6)}
                    y={py(e.d[1] * 4.6)}
                    fill="#5b6b54"
                    fontSize={12}
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    λ={e.val}
                  </text>
                </g>
              );
            })}

          {/* Av */}
          <line x1={px(0)} y1={py(0)} x2={px(avx)} y2={py(avy)} stroke="#61715A" strokeWidth={3} opacity={0.9} markerEnd="url(#ah-moss)" />
          <text x={px(avx) + (avx >= 0 ? 12 : -12)} y={py(avy) - 8} fill="#4f5d49" fontSize={14} fontWeight={600} textAnchor={avx >= 0 ? 'start' : 'end'}>
            Av
          </text>

          {/* v */}
          {aligned && <circle cx={px(v.x)} cy={py(v.y)} r={18} fill="#30433D" opacity={0.13} />}
          <line x1={px(0)} y1={py(0)} x2={px(v.x)} y2={py(v.y)} stroke={vColor} strokeWidth={3.6} markerEnd={aligned ? 'url(#ah-forest)' : 'url(#ah-clay)'} />
          <text x={px(v.x) + (v.x >= 0 ? 12 : -12)} y={py(v.y) + (v.y >= 0 ? -10 : 18)} fill={vColor} fontSize={14} fontWeight={700} textAnchor={v.x >= 0 ? 'start' : 'end'}>
            v
          </text>
          <circle cx={px(v.x)} cy={py(v.y)} r={8} fill="#fff" stroke={vColor} strokeWidth={2.5} />
          <circle cx={px(v.x)} cy={py(v.y)} r={3.4} fill={vColor} />
          <circle cx={CX} cy={CY} r={3} fill="#30433D" />
        </svg>
      </div>

      {/* live readout (glass L2) */}
      <div className="surface-glass w-full p-4 lg:w-[300px]">
        <p className="font-display text-body italic text-moss">An eigenvector satisfies</p>
        <Tex display tex="A\mathbf{v} = \lambda\,\mathbf{v}" className="mt-1 text-forest" />

        <p className="mt-4 eyebrow">Live computation</p>
        <div className="mt-1 overflow-x-auto">
          <Tex display tex={liveTex} className="text-charcoal" />
        </div>

        <p
          className="mt-3 text-caption leading-relaxed"
          style={{ color: aligned ? '#30433D' : '#8a7c66' }}
          data-testid="viz-status"
        >
          {status}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {cur.eigs.map((e, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setEig(e)}
              className="rounded-md border border-forest/20 px-2.5 py-1 text-caption text-forest transition-colors duration-fast hover:bg-forest/5"
            >
              Align to λ = {e.val}
            </button>
          ))}
          <button
            type="button"
            onClick={reset}
            className="rounded-md px-2.5 py-1 text-caption text-charcoal/50 transition-colors duration-fast hover:text-charcoal"
          >
            Reset
          </button>
        </div>

        {spec.presets.length > 1 && (
          <div className="mt-3 flex gap-2">
            {spec.presets.map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => setPresetKey(p.key)}
                aria-pressed={p.key === presetKey}
                className={`rounded-md px-2.5 py-1 text-caption transition-colors duration-fast ${
                  p.key === presetKey
                    ? 'bg-forest text-cream'
                    : 'border border-forest/20 text-forest hover:bg-forest/5'
                }`}
              >
                {p.key}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Arrow({ id, color }: { id: string; color: string }) {
  return (
    <marker id={id} markerWidth={11} markerHeight={11} refX={7} refY={3.2} orient="auto" markerUnits="userSpaceOnUse">
      <path d="M0,0 L8,3.2 L0,6.4 Z" fill={color} />
    </marker>
  );
}

function range(a: number, b: number): number[] {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}
