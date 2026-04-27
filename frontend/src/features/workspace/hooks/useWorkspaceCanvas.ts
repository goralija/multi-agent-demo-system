import {
  type NodeMouseHandler,
  type OnSelectionChangeFunc,
  type ReactFlowInstance,
  useNodesState,
} from "@xyflow/react";
import { useCallback, useMemo, useRef, useState } from "react";

import { AGENT_NODE_ID_BY_NAME, initialEdges, initialNodes, nodeTemplates } from "../constants";
import type {
  CanvasEdge,
  CanvasNode,
  LogEntry,
  NewLogEntry,
  NodeStatus,
  WorkflowAgentSyncState,
} from "../types";
import { createId, withNodeSelection } from "../utils";

type AppendLog = (entry: NewLogEntry) => void;

export function useWorkspaceCanvas(appendLog: AppendLog) {
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(initialNodes);
  const edges: CanvasEdge[] = initialEdges;
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(initialNodes[0]?.id ?? null);
  const flowInstanceRef = useRef<ReactFlowInstance<CanvasNode> | null>(null);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const selectNode = useCallback(
    (id: string | null) => {
      setSelectedNodeId(id);
      setNodes((current) => withNodeSelection(current, id));
    },
    [setNodes],
  );

  const handleNodeClick: NodeMouseHandler<CanvasNode> = useCallback(
    (_event, node) => {
      selectNode(node.id);
      appendLog({
        source: node.data.title,
        type: "action",
        message: `${node.data.title} focused in canvas.`,
        relatedId: node.id,
      });
    },
    [appendLog, selectNode],
  );

  const handleNodeDragStop: NodeMouseHandler<CanvasNode> = useCallback(
    (_event, node) => {
      appendLog({
        source: node.data.title,
        type: "action",
        message: `Moved to x:${Math.round(node.position.x)}, y:${Math.round(node.position.y)}.`,
        relatedId: node.id,
      });
    },
    [appendLog],
  );

  const handlePaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const handleSelectionChange: OnSelectionChangeFunc<CanvasNode> = useCallback(
    ({ nodes: selectedNodes }) => {
      const first = selectedNodes[0];
      setSelectedNodeId(first?.id ?? null);
    },
    [],
  );

  const handleFlowInit = useCallback((instance: ReactFlowInstance<CanvasNode>) => {
    flowInstanceRef.current = instance;
  }, []);

  function addEntityNode() {
    const id = createId("node");
    const nextIndex = nodes.length;
    const template = nodeTemplates[nextIndex % nodeTemplates.length];

    const newNode: CanvasNode = {
      id,
      type: "entity",
      position: {
        x: 90 + (nextIndex % 4) * 260 + (nextIndex % 2) * 28,
        y: 90 + Math.floor(nextIndex / 4) * 170,
      },
      data: {
        title: template.title,
        entityType: template.entityType,
        description: template.description,
        status: "idle",
      },
      selected: true,
    };

    setNodes((current) => [...withNodeSelection(current, null), newNode]);
    setSelectedNodeId(id);

    appendLog({
      source: "Workspace",
      type: "action",
      message: `Added ${template.title} node.`,
      relatedId: id,
    });
  }

  function resetCanvasView() {
    flowInstanceRef.current?.fitView({ padding: 0.16, duration: 240 });
    appendLog({
      source: "Workspace",
      type: "info",
      message: "Canvas viewport reset.",
    });
  }

  function emitErrorLog() {
    appendLog({
      source: "System",
      type: "error",
      message: "External service timeout while validating content.",
      relatedId: "fact-checker",
    });
  }

  function handleLogClick(log: LogEntry) {
    if (!log.relatedId) {
      return;
    }

    const relatedNode = nodes.find((node) => node.id === log.relatedId);
    if (!relatedNode) {
      return;
    }

    const instance = flowInstanceRef.current;
    if (!instance) {
      return;
    }

    selectNode(relatedNode.id);
    instance.setCenter(relatedNode.position.x + 120, relatedNode.position.y + 64, {
      zoom: Math.max(instance.getZoom(), 0.9),
      duration: 220,
    });
  }

  function syncAgentStates(states: WorkflowAgentSyncState[]) {
    const statusMap = new Map<string, NodeStatus>();
    for (const state of states) {
      const nodeId = AGENT_NODE_ID_BY_NAME[state.name];
      if (!nodeId) {
        continue;
      }

      const mappedStatus: NodeStatus =
        state.status === "failed"
          ? "error"
          : state.status === "completed"
            ? "completed"
            : state.status;
      statusMap.set(nodeId, mappedStatus);
    }

    if (statusMap.size === 0) {
      return;
    }

    setNodes((current) =>
      current.map((node) => {
        const nextStatus = statusMap.get(node.id);
        if (!nextStatus || node.data.status === nextStatus) {
          return node;
        }

        return {
          ...node,
          data: {
            ...node.data,
            status: nextStatus,
          },
        };
      }),
    );
  }

  return {
    nodes,
    edges,
    selectedNode,
    onNodesChange,
    handleNodeClick,
    handleNodeDragStop,
    handlePaneClick,
    handleSelectionChange,
    handleFlowInit,
    addEntityNode,
    resetCanvasView,
    emitErrorLog,
    handleLogClick,
    syncAgentStates,
  };
}
