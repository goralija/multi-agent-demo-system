import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { CanvasNode } from "../types";

function CanvasEntityNode({ data, selected }: NodeProps<CanvasNode>) {
  const statusClass =
    data.status === "running"
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : data.status === "completed"
        ? "border-sky-300 bg-sky-50 text-sky-700"
        : data.status === "error"
          ? "border-rose-300 bg-rose-50 text-rose-700"
          : "border-zinc-300 bg-zinc-100 text-zinc-600";

  return (
    <article
      className={`w-60 rounded-xl border bg-background/95 p-3 shadow-sm transition-all ${
        selected ? "border-primary/70 shadow-md shadow-primary/20" : "border-border/80"
      }`}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          pointerEvents: "none",
          border: "none",
          background: "transparent",
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 8,
          height: 8,
          opacity: 0,
          pointerEvents: "none",
          border: "none",
          background: "transparent",
        }}
      />

      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded-md border border-border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {data.entityType}
        </span>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusClass}`}
        >
          {data.status}
        </span>
      </div>

      <h3 className="mb-1 text-sm font-semibold text-foreground">{data.title}</h3>
      <p className="text-xs leading-relaxed text-muted-foreground">{data.description}</p>
    </article>
  );
}

const nodeTypes = {
  entity: CanvasEntityNode,
};

export { CanvasEntityNode, nodeTypes };
