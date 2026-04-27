import { useRef, useState } from "react";

import {
  DEFAULT_LEFT_PERCENT,
  MAX_LEFT_PERCENT,
  MIN_LEFT_PERCENT,
  STORAGE_KEY,
} from "../constants";
import { clamp, readSavedLeftPanelPercent } from "../utils";

function readWorkspaceSize(layout: Record<string, number>): number {
  return clamp(layout.workspace ?? DEFAULT_LEFT_PERCENT, MIN_LEFT_PERCENT, MAX_LEFT_PERCENT);
}

export function usePanelLayout() {
  const [leftPanelPercent, setLeftPanelPercent] = useState<number>(() =>
    readSavedLeftPanelPercent(),
  );

  const initialLayoutRef = useRef({
    workspace: leftPanelPercent,
    logs: 100 - leftPanelPercent,
  });

  function handleLayoutChange(layout: Record<string, number>) {
    const leftPercent = readWorkspaceSize(layout);
    setLeftPanelPercent(leftPercent);
  }

  function handleLayoutPersist(layout: Record<string, number>) {
    if (typeof window === "undefined") {
      return;
    }

    const leftPercent = readWorkspaceSize(layout);
    window.localStorage.setItem(STORAGE_KEY, leftPercent.toFixed(2));
  }

  return {
    leftPanelPercent,
    initialLayoutRef,
    handleLayoutChange,
    handleLayoutPersist,
  };
}
