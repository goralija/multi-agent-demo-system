import { DEFAULT_LEFT_PERCENT, MAX_LEFT_PERCENT, MIN_LEFT_PERCENT, STORAGE_KEY } from "./constants";
import type { CanvasNode } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatTimestamp(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour12: false });
}

export function readSavedLeftPanelPercent(): number {
  if (typeof window === "undefined") {
    return DEFAULT_LEFT_PERCENT;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  const parsed = Number(rawValue);

  if (!Number.isFinite(parsed)) {
    return DEFAULT_LEFT_PERCENT;
  }

  return clamp(parsed, MIN_LEFT_PERCENT, MAX_LEFT_PERCENT);
}

export function withNodeSelection(nodes: CanvasNode[], selectedId: string | null): CanvasNode[] {
  return nodes.map((node) => ({
    ...node,
    selected: selectedId !== null && node.id === selectedId,
  }));
}
