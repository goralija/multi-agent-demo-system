import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MAX_LOG_ENTRIES, SCROLL_FOLLOW_THRESHOLD } from "../constants";
import type { LogEntry, LogFilter, NewLogEntry, WorkflowLogSyncEntry } from "../types";
import { createId, formatTimestamp } from "../utils";

export function useWorkspaceLogs() {
  const [logFilter, setLogFilter] = useState<LogFilter>("all");
  const [autoFollowLogs, setAutoFollowLogs] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>(() => [
    {
      id: createId("log"),
      timestamp: formatTimestamp(new Date()),
      source: "System",
      type: "info",
      message: "Interactive canvas initialized.",
    },
    {
      id: createId("log"),
      timestamp: formatTimestamp(new Date()),
      source: "System",
      type: "info",
      message: "Drag nodes, pan background, and zoom with wheel/trackpad.",
    },
  ]);

  const logsViewportRef = useRef<HTMLDivElement>(null);
  const autoFollowLogsRef = useRef(autoFollowLogs);

  useEffect(() => {
    autoFollowLogsRef.current = autoFollowLogs;
  }, [autoFollowLogs]);

  const appendLog = useCallback((entry: NewLogEntry) => {
    setLogs((current) => {
      const nextLogs = [
        ...current,
        {
          id: createId("log"),
          timestamp: formatTimestamp(new Date()),
          ...entry,
        },
      ];

      if (nextLogs.length > MAX_LOG_ENTRIES) {
        return nextLogs.slice(nextLogs.length - MAX_LOG_ENTRIES);
      }

      return nextLogs;
    });

    if (typeof window !== "undefined" && autoFollowLogsRef.current) {
      window.requestAnimationFrame(() => {
        const viewport = logsViewportRef.current;
        if (!viewport) {
          return;
        }

        viewport.scrollTop = viewport.scrollHeight;
      });
    }
  }, []);

  const filteredLogs = useMemo(() => {
    if (logFilter === "all") {
      return logs;
    }

    return logs.filter((log) => log.type === logFilter);
  }, [logFilter, logs]);

  useEffect(() => {
    const heartbeatInterval = window.setInterval(() => {
      appendLog({
        source: "System",
        type: "info",
        message: "Heartbeat: workspace responsive.",
      });
    }, 15000);

    return () => {
      window.clearInterval(heartbeatInterval);
    };
  }, [appendLog]);

  function handleLogsScroll() {
    const viewport = logsViewportRef.current;
    if (!viewport) {
      return;
    }

    const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    setAutoFollowLogs(distanceToBottom <= SCROLL_FOLLOW_THRESHOLD);
  }

  function jumpToLatestLogs() {
    const viewport = logsViewportRef.current;
    if (!viewport) {
      return;
    }

    viewport.scrollTop = viewport.scrollHeight;
    setAutoFollowLogs(true);
  }

  function clearLogs() {
    setLogs([
      {
        id: createId("log"),
        timestamp: formatTimestamp(new Date()),
        source: "System",
        type: "info",
        message: "Logs cleared by user.",
      },
    ]);
    setAutoFollowLogs(true);
  }

  function ingestWorkflowLogs(remoteLogs: WorkflowLogSyncEntry[]) {
    setLogs((current) => {
      const existing = new Set(current.map((entry) => entry.id));
      const additions: LogEntry[] = [];

      for (const remoteLog of remoteLogs) {
        const id = `workflow-log-${remoteLog.id}`;
        if (existing.has(id)) {
          continue;
        }

        const parsedTimestamp = new Date(remoteLog.timestamp);
        additions.push({
          id,
          timestamp: Number.isNaN(parsedTimestamp.getTime())
            ? remoteLog.timestamp
            : formatTimestamp(parsedTimestamp),
          source: remoteLog.source,
          type: remoteLog.type,
          message: remoteLog.message,
          relatedId:
            remoteLog.source === "Author"
              ? "author"
              : remoteLog.source === "Editor"
                ? "editor"
                : remoteLog.source === "FactChecker"
                  ? "fact-checker"
                  : remoteLog.source === "CopyEditor"
                    ? "copy-editor"
                    : undefined,
        });
      }

      if (additions.length === 0) {
        return current;
      }

      const merged = [...current, ...additions];
      if (merged.length > MAX_LOG_ENTRIES) {
        return merged.slice(merged.length - MAX_LOG_ENTRIES);
      }

      return merged;
    });

    if (typeof window !== "undefined" && autoFollowLogsRef.current) {
      window.requestAnimationFrame(() => {
        const viewport = logsViewportRef.current;
        if (!viewport) {
          return;
        }

        viewport.scrollTop = viewport.scrollHeight;
      });
    }
  }

  return {
    logFilter,
    setLogFilter,
    autoFollowLogs,
    filteredLogs,
    logsViewportRef,
    appendLog,
    handleLogsScroll,
    jumpToLatestLogs,
    clearLogs,
    ingestWorkflowLogs,
  };
}
