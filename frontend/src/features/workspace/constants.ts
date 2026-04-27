import type { CanvasEdge, CanvasNode, LogType, NodeTemplate } from "./types";

export const STORAGE_KEY = "multi-agent.workspace.left-panel";
export const DEFAULT_LEFT_PERCENT = 60;
export const MIN_LEFT_PERCENT = 40;
export const MAX_LEFT_PERCENT = 70;
export const WORKSPACE_MIN_SIZE = `${MIN_LEFT_PERCENT}%`;
export const WORKSPACE_MAX_SIZE = `${MAX_LEFT_PERCENT}%`;
export const LOGS_MIN_SIZE = "30%";

export const MAX_LOG_ENTRIES = 1000;
export const SCROLL_FOLLOW_THRESHOLD = 18;

export const nodeTemplates: NodeTemplate[] = [
  {
    title: "Author",
    entityType: "Agent",
    description: "Writes the first draft from the provided bullet points.",
  },
  {
    title: "Editor",
    entityType: "Agent",
    description: "Improves structure and decides whether another revision is needed.",
  },
  {
    title: "FactChecker",
    entityType: "Agent",
    description: "Flags potentially unverifiable claims in the current draft.",
  },
  {
    title: "CopyEditor",
    entityType: "Agent",
    description: "Performs final grammar, style, and formatting polish.",
  },
];

export const AGENT_NODE_ID_BY_NAME = {
  Author: "author",
  Editor: "editor",
  FactChecker: "fact-checker",
  CopyEditor: "copy-editor",
} as const;

export const initialNodes: CanvasNode[] = [
  {
    id: "author",
    type: "entity",
    position: { x: 60, y: 80 },
    data: {
      title: "Author",
      entityType: "Agent",
      description: "Writes the first draft from the provided bullet points.",
      status: "idle",
    },
  },
  {
    id: "editor",
    type: "entity",
    position: { x: 350, y: 120 },
    data: {
      title: "Editor",
      entityType: "Agent",
      description: "Improves structure and decides whether another revision is needed.",
      status: "idle",
    },
  },
  {
    id: "fact-checker",
    type: "entity",
    position: { x: 640, y: 260 },
    data: {
      title: "FactChecker",
      entityType: "Agent",
      description: "Flags potentially unverifiable claims in the current draft.",
      status: "idle",
    },
  },
  {
    id: "copy-editor",
    type: "entity",
    position: { x: 320, y: 380 },
    data: {
      title: "CopyEditor",
      entityType: "Agent",
      description: "Performs final grammar, style, and formatting polish.",
      status: "idle",
    },
  },
];

export const initialEdges: CanvasEdge[] = [
  {
    id: "flow-author-editor",
    source: "author",
    target: "editor",
    type: "smoothstep",
    animated: true,
  },
  {
    id: "flow-editor-author",
    source: "editor",
    target: "author",
    type: "smoothstep",
    style: { strokeDasharray: "6 4" },
  },
  {
    id: "flow-editor-fact-checker",
    source: "editor",
    target: "fact-checker",
    type: "smoothstep",
    animated: true,
  },
  {
    id: "flow-fact-checker-editor",
    source: "fact-checker",
    target: "editor",
    type: "smoothstep",
    style: { strokeDasharray: "6 4" },
  },
  {
    id: "flow-fact-checker-copy-editor",
    source: "fact-checker",
    target: "copy-editor",
    type: "smoothstep",
    animated: true,
  },
];

export const logTypeAccent: Record<LogType, string> = {
  info: "text-sky-700 bg-sky-100 border-sky-200",
  action: "text-emerald-700 bg-emerald-100 border-emerald-200",
  error: "text-rose-700 bg-rose-100 border-rose-200",
};
