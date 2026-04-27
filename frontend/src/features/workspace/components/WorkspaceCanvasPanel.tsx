import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  type NodeMouseHandler,
  type OnNodesChange,
  type OnSelectionChangeFunc,
  ReactFlow,
  type ReactFlowInstance,
} from "@xyflow/react";

import { Button } from "@/components/ui/button";

import type { CanvasEdge, CanvasNode } from "../types";
import { nodeTypes } from "./CanvasEntityNode";

import "@xyflow/react/dist/style.css";

interface WorkspaceCanvasPanelProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onNodesChange: OnNodesChange<CanvasNode>;
  onNodeClick: NodeMouseHandler<CanvasNode>;
  onNodeDragStop: NodeMouseHandler<CanvasNode>;
  onPaneClick: () => void;
  onSelectionChange: OnSelectionChangeFunc<CanvasNode>;
  onInit: (instance: ReactFlowInstance<CanvasNode>) => void;
  onAddEntity: () => void;
  onResetView: () => void;
  onSimulateError: () => void;
}

export function WorkspaceCanvasPanel({
  nodes,
  edges,
  onNodesChange,
  onNodeClick,
  onNodeDragStop,
  onPaneClick,
  onSelectionChange,
  onInit,
  onAddEntity,
  onResetView,
  onSimulateError,
}: WorkspaceCanvasPanelProps) {
  return (
    <section className="flex h-full min-w-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Interactive Canvas Workspace</h2>
          <p className="text-xs text-muted-foreground">
            Drag nodes freely. Pan the background. Zoom with wheel or trackpad.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={onAddEntity}>
            Add Entity
          </Button>
          <Button size="sm" variant="outline" onClick={onResetView}>
            Reset View
          </Button>
          <Button size="sm" variant="outline" onClick={onSimulateError}>
            Simulate Error
          </Button>
        </div>
      </header>

      <div className="min-h-0 flex-1">
        <ReactFlow<CanvasNode, CanvasEdge>
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          onPaneClick={onPaneClick}
          onSelectionChange={onSelectionChange}
          onInit={onInit}
          fitView
          fitViewOptions={{ padding: 0.14 }}
          panOnDrag
          panOnScroll
          zoomOnScroll
          zoomOnPinch
          zoomOnDoubleClick={false}
          minZoom={0.35}
          maxZoom={2.1}
          selectionOnDrag={false}
          defaultEdgeOptions={{
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 18,
              height: 18,
              color: "hsl(210 22% 43%)",
            },
            style: {
              stroke: "hsl(210 22% 43%)",
              strokeWidth: 1.7,
            },
          }}
          className="bg-[linear-gradient(180deg,hsl(210_25%_99%),hsl(210_20%_97%))]"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1}
            color="hsl(215 16% 70% / 0.55)"
          />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </section>
  );
}
