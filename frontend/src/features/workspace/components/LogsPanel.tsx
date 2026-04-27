import type { RefObject } from "react";

import { Button } from "@/components/ui/button";

import { logTypeAccent } from "../constants";
import type { LogEntry, LogFilter } from "../types";

interface LogsPanelProps {
  logFilter: LogFilter;
  onFilterChange: (value: LogFilter) => void;
  autoFollowLogs: boolean;
  filteredLogs: LogEntry[];
  logsViewportRef: RefObject<HTMLDivElement>;
  onLogsScroll: () => void;
  onJumpToLatest: () => void;
  onClearLogs: () => void;
  onLogClick: (log: LogEntry) => void;
}

export function LogsPanel({
  logFilter,
  onFilterChange,
  autoFollowLogs,
  filteredLogs,
  logsViewportRef,
  onLogsScroll,
  onJumpToLatest,
  onClearLogs,
  onLogClick,
}: LogsPanelProps) {
  return (
    <section className="flex h-full min-w-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Logs / System Output</h2>
          <p className="text-xs text-muted-foreground">
            Real-time visibility into agent and workspace behavior.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="log-filter">
            Filter
          </label>
          <select
            id="log-filter"
            value={logFilter}
            onChange={(event) => onFilterChange(event.target.value as LogFilter)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All</option>
            <option value="info">Info</option>
            <option value="action">Action</option>
            <option value="error">Error</option>
          </select>

          <Button size="sm" variant="outline" onClick={onClearLogs}>
            Clear Logs
          </Button>
        </div>
      </header>

      {!autoFollowLogs && (
        <div className="border-b border-border/60 bg-amber-50 px-4 py-2 text-xs text-amber-700">
          Auto-scroll paused while browsing older logs.
          <Button className="ml-2 h-7 px-2" size="sm" onClick={onJumpToLatest}>
            Jump to latest
          </Button>
        </div>
      )}

      <div
        ref={logsViewportRef}
        onScroll={onLogsScroll}
        className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[linear-gradient(180deg,hsl(210_25%_99%),hsl(210_20%_97%))] p-3"
      >
        {filteredLogs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-background/80 px-4 py-6 text-center text-sm text-muted-foreground">
            No logs for this filter yet.
          </div>
        ) : (
          filteredLogs.map((log) => (
            <button
              key={log.id}
              type="button"
              onClick={() => onLogClick(log)}
              className="w-full rounded-md border border-border/70 bg-background/90 px-3 py-2 text-left hover:border-primary/45"
            >
              <p className="font-mono text-xs leading-relaxed text-foreground/90">
                <span className="text-muted-foreground">[{log.timestamp}]</span>{" "}
                <span className="font-semibold">{log.source}</span>{" "}
                <span
                  className={`rounded border px-1 py-0.5 text-[10px] ${logTypeAccent[log.type]}`}
                >
                  {log.type}
                </span>
                <span>: {log.message}</span>
              </p>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
