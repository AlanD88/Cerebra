import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import ReactFlow, {
  Background,
  BackgroundVariant,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { api } from '../../lib/api';
import { HEAT_COLOR } from '../../lib/heat';
import { ErrorState } from '../../components/feedback';
import { usePrefersReducedMotion } from '../../lib/usePrefersReducedMotion';
import { ConceptNode, type ConceptNodeData } from './ConceptNode';
import { ConceptInspector } from './ConceptInspector';
import { computeActiveSet, isEdgeEmphasized, isNodeDimmed } from './graphModel';
import { graphQueries } from './queries';
import type { GraphFilter } from './types';

const nodeTypes = { concept: ConceptNode };

interface GraphCanvasProps {
  subjectId: string;
  subjectName?: string;
  // Immersive mode (polish-frontend §1): full-bleed frame, controls float over it.
  immersive?: boolean;
  // Slot rendered top-center over the canvas (used for immersive-mode chrome).
  overlay?: React.ReactNode;
}

export function GraphCanvas(props: GraphCanvasProps) {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function GraphCanvasInner({ subjectId, subjectName, immersive = false, overlay }: GraphCanvasProps) {
  const layoutQ = useQuery(graphQueries.layout(subjectId));
  const nodesQ = useQuery(graphQueries.nodes(subjectId));
  const edgesQ = useQuery(graphQueries.edges(subjectId));
  const reduced = usePrefersReducedMotion();
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  const [selected, setSelected] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<GraphFilter>(null);
  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const initialized = useRef(false);

  const nodes = useMemo(() => nodesQ.data ?? [], [nodesQ.data]);
  const edges = useMemo(() => edgesQ.data ?? [], [edgesQ.data]);

  useEffect(() => {
    if (layoutQ.data && !initialized.current) {
      const m = new Map<string, { x: number; y: number }>();
      layoutQ.data.forEach((p) => m.set(p.conceptId, { x: p.x, y: p.y }));
      setPositions(m);
      initialized.current = true;
    }
  }, [layoutQ.data]);

  const active = useMemo(
    () => computeActiveSet({ hoverId, selected, search, filter, nodes, edges }),
    [hoverId, selected, search, filter, nodes, edges],
  );

  const patchMut = useMutation({
    mutationFn: (positionsBody: { conceptId: string; x: number; y: number }[]) =>
      api.patch(`/graph/${subjectId}/layout`, { positions: positionsBody }),
  });

  // Debounced drag-to-layout persistence (presentation only — never relationships).
  const pending = useRef<Map<string, { x: number; y: number }>>(new Map());
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const scheduleSave = useCallback(
    (id: string, pos: { x: number; y: number }) => {
      pending.current.set(id, pos);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        const body = Array.from(pending.current.entries()).map(([conceptId, p]) => ({
          conceptId,
          x: p.x,
          y: p.y,
        }));
        pending.current.clear();
        if (body.length) patchMut.mutate(body);
      }, 400);
    },
    [patchMut],
  );

  const rfNodes: Node<ConceptNodeData>[] = useMemo(
    () =>
      nodes.map((n, i) => ({
        id: n.conceptId,
        type: 'concept',
        position: positions.get(n.conceptId) ?? { x: (i % 4) * 180, y: Math.floor(i / 4) * 150 },
        data: {
          label: n.name,
          heatState: n.heatState,
          importance: n.importance,
          mastery: n.mastery,
          dimmed: isNodeDimmed(active, n.conceptId),
          selected: selected === n.conceptId,
          onActivate: () => setSelected(n.conceptId),
        },
      })),
    [nodes, positions, active, selected],
  );

  const rfEdges: Edge[] = useMemo(
    () =>
      edges.map((e, i) => {
        const emphasized = isEdgeEmphasized(active, e);
        const dimmed = active !== null && !emphasized;
        return {
          id: `e${i}`,
          source: e.source,
          target: e.target,
          style: {
            stroke: emphasized ? '#30433D' : '#8D9C84',
            strokeWidth: emphasized ? 2 : 1,
            opacity: emphasized ? 0.9 : dimmed ? 0.12 : 0.4,
          },
        };
      }),
    [edges, active],
  );

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setPositions((prev) => {
      let touched = false;
      const next = new Map(prev);
      for (const ch of changes) {
        if (ch.type === 'position' && ch.position) {
          next.set(ch.id, ch.position);
          touched = true;
        }
      }
      return touched ? next : prev;
    });
  }, []);

  const isLoading = layoutQ.isLoading || nodesQ.isLoading || edgesQ.isLoading;
  const isError = layoutQ.isError || nodesQ.isError || edgesQ.isError;

  if (isError) {
    return (
      <CanvasFrame immersive={immersive}>
        <div className="m-auto max-w-sm text-center">
          <ErrorState
            onRetry={() => {
              layoutQ.refetch();
              nodesQ.refetch();
              edgesQ.refetch();
            }}
            message="Couldn't load the graph."
          />
        </div>
      </CanvasFrame>
    );
  }

  if (!isLoading && nodes.length === 0) {
    return (
      <CanvasFrame immersive={immersive}>
        <p className="m-auto text-body text-charcoal/55">
          No concepts yet — create some to grow your atlas.
        </p>
      </CanvasFrame>
    );
  }

  const noMatch = search.trim().length > 0 && active !== null && active.size === 0;

  return (
    <CanvasFrame immersive={immersive}>
      {/* Immersive-mode chrome floats top-center, clear of the corner controls. */}
      {overlay && <div className="absolute left-1/2 top-5 z-20 -translate-x-1/2">{overlay}</div>}

      {/* faint region watermark — the named region behind the constellation */}
      {subjectName && (
        <span className="pointer-events-none absolute left-1/2 top-10 z-0 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.3em] text-charcoal/15">
          {subjectName}
        </span>
      )}

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={(_, node) => scheduleSave(node.id, node.position)}
        onNodeClick={(_, node) => setSelected(node.id)}
        onNodeMouseEnter={(_, node) => setHoverId(node.id)}
        onNodeMouseLeave={() => setHoverId(null)}
        onPaneClick={() => setSelected(null)}
        minZoom={0.55}
        maxZoom={2.6}
        fitView
        fitViewOptions={{ duration: reduced ? 0 : 250, padding: 0.3 }}
        onlyRenderVisibleElements
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        nodesFocusable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={28} size={1} color="rgba(141,156,132,0.25)" />
      </ReactFlow>

      {/* Search (L2, top-left) */}
      <div className="absolute left-5 top-5 z-10 w-[260px]">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search concepts…"
          aria-label="Search concepts"
          className="surface-glass w-full px-4 py-2.5 text-body text-charcoal outline-none placeholder:text-charcoal/40"
        />
        {noMatch && <p className="mt-1.5 px-2 text-caption text-clay">No concepts match.</p>}
      </div>

      {/* Filters (top-right) */}
      <div className="absolute right-5 top-5 z-10 flex gap-2" style={{ marginRight: selected ? 320 : 0 }}>
        <FilterChip active={filter === 'weak'} onClick={() => setFilter((f) => (f === 'weak' ? null : 'weak'))}>
          Highlight weak
        </FilterChip>
        <FilterChip
          active={filter === 'deps'}
          disabled={!selected}
          onClick={() => setFilter((f) => (f === 'deps' ? null : 'deps'))}
        >
          Dependency path
        </FilterChip>
      </div>

      {/* Zoom (L2, bottom-left) */}
      <div className="surface-glass absolute bottom-5 left-5 z-10 flex flex-col overflow-hidden">
        <ZoomBtn onClick={() => zoomIn()} label="Zoom in">
          +
        </ZoomBtn>
        <ZoomBtn onClick={() => zoomOut()} label="Zoom out">
          −
        </ZoomBtn>
        <ZoomBtn onClick={() => fitView({ duration: reduced ? 0 : 250, padding: 0.3 })} label="Fit view">
          <span className="text-[10px]">fit</span>
        </ZoomBtn>
      </div>

      {/* Heat legend (L2, bottom-center) */}
      <div className="surface-glass absolute bottom-5 left-1/2 z-10 -translate-x-1/2 px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-charcoal/45">Heat</span>
          {(['mastered', 'hot', 'warm', 'cold', 'frozen'] as const).map((h) => (
            <span key={h} className="flex items-center gap-1.5 text-caption text-charcoal/70">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: HEAT_COLOR[h] }} />
              {h[0].toUpperCase() + h.slice(1)}
            </span>
          ))}
        </div>
      </div>

      {selected && (
        <ConceptInspector
          conceptId={selected}
          subjectName={subjectName}
          onClose={() => setSelected(null)}
          onShowPath={() => setFilter('deps')}
        />
      )}
    </CanvasFrame>
  );
}

function CanvasFrame({
  children,
  immersive = false,
}: {
  children: React.ReactNode;
  immersive?: boolean;
}) {
  return (
    <div
      className={`relative flex min-h-[480px] w-full overflow-hidden bg-cream ${
        immersive
          ? 'h-[calc(100vh-1.5rem)] rounded-none'
          : 'h-[calc(100vh-9rem)] rounded-xl border border-forest/10'
      }`}
    >
      {children}
    </div>
  );
}

function FilterChip({
  active,
  disabled,
  onClick,
  children,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`surface-glass px-3 py-2 text-caption transition-colors duration-fast disabled:opacity-40 ${
        active ? 'font-semibold text-forest ring-1 ring-forest/30' : 'text-charcoal/70'
      }`}
    >
      {children}
    </button>
  );
}

function ZoomBtn({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center text-body text-charcoal/70 transition-colors duration-fast hover:bg-forest/5 hover:text-charcoal"
    >
      {children}
    </button>
  );
}
