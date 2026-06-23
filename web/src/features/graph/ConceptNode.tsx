import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { heatColor, heatLabel, type Heat } from '../../lib/heat';

export interface ConceptNodeData {
  label: string;
  heatState: Heat;
  importance: number;
  mastery: number;
  dimmed: boolean;
  selected: boolean;
}

function ConceptNodeImpl({ data }: { data: ConceptNodeData }) {
  const size = 26 + data.importance * 7; // importance 1–5 → 33–61px

  return (
    <div
      className="flex flex-col items-center transition-opacity duration-fast"
      style={{ opacity: data.dimmed ? 0.26 : 1 }}
      title={`${data.label} · ${heatLabel(data.heatState)}`}
      aria-label={`${data.label}, ${heatLabel(data.heatState)}`}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} isConnectable={false} />
      <div
        className="rounded-full ring-1 ring-forest/15"
        style={{
          width: size,
          height: size,
          backgroundColor: heatColor(data.heatState),
          boxShadow: data.selected ? '0 0 0 3px rgba(48,67,61,0.35)' : undefined,
        }}
      />
      <span className="mt-1 max-w-[96px] truncate text-[10px] text-charcoal/70">{data.label}</span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} isConnectable={false} />
    </div>
  );
}

export const ConceptNode = memo(ConceptNodeImpl);
