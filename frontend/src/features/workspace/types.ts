import type { Edge, Node } from "@xyflow/react";

export type LogType = "info" | "action" | "error";
export type LogFilter = "all" | LogType;
export type NodeStatus = "idle" | "running" | "completed" | "error";

export interface CanvasNodeData extends Record<string, unknown> {
  title: string;
  entityType: string;
  description: string;
  status: NodeStatus;
}

export type CanvasNode = Node<CanvasNodeData, "entity">;
export type CanvasEdge = Edge;

export interface LogEntry {
  id: string;
  timestamp: string;
  source: string;
  type: LogType;
  message: string;
  relatedId?: string;
}

export type NewLogEntry = Omit<LogEntry, "id" | "timestamp">;

export interface WorkflowLogSyncEntry {
  id: number;
  timestamp: string;
  source: string;
  message: string;
  type: LogType;
}

export interface NodeTemplate {
  title: string;
  entityType: string;
  description: string;
}

export interface WorkflowAgentSyncState {
  name: "Author" | "Editor" | "FactChecker" | "CopyEditor";
  status: "idle" | "running" | "completed" | "failed";
}
