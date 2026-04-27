import { api } from "@/api/client";
import { Button } from "@/components/ui/button";
import { LogsPanel } from "@/features/workspace/components/LogsPanel";
import { WorkspaceCanvasPanel } from "@/features/workspace/components/WorkspaceCanvasPanel";
import {
  LOGS_MIN_SIZE,
  WORKSPACE_MAX_SIZE,
  WORKSPACE_MIN_SIZE,
} from "@/features/workspace/constants";
import { usePanelLayout } from "@/features/workspace/hooks/usePanelLayout";
import { useWorkflowPolling } from "@/features/workspace/hooks/useWorkflowPolling";
import { useWorkspaceCanvas } from "@/features/workspace/hooks/useWorkspaceCanvas";
import { useWorkspaceLogs } from "@/features/workspace/hooks/useWorkspaceLogs";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";

export function App() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["health"],
    queryFn: api.health,
  });

  const { initialLayoutRef, handleLayoutChange, handleLayoutPersist } = usePanelLayout();
  const {
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
  } = useWorkspaceLogs();
  const {
    nodes,
    edges,
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
  } = useWorkspaceCanvas(appendLog);

  const [workflowInput, setWorkflowInput] = useState(
    "City council approved a new public transit plan\nThe proposal includes two new tram lines\nAnalysts say commute times may drop by 15%",
  );
  const [activeWorkflowId, setActiveWorkflowId] = useState<string | null>(null);
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const handleWorkflowState = useCallback(
    (state: Awaited<ReturnType<typeof api.getWorkflow>>) => {
      syncAgentStates(state.agents);
    },
    [syncAgentStates],
  );

  const handleWorkflowLogs = useCallback(
    (logs: Awaited<ReturnType<typeof api.getWorkflowLogs>>) => {
      ingestWorkflowLogs(logs);
    },
    [ingestWorkflowLogs],
  );

  const {
    workflowState,
    isPolling,
    error: pollingError,
  } = useWorkflowPolling({
    workflowId: activeWorkflowId,
    onState: handleWorkflowState,
    onLogs: handleWorkflowLogs,
  });

  async function handleStartWorkflow() {
    const bulletPoints = workflowInput
      .split("\n")
      .map((line) => line.replace(/^\s*[-*]\s?/, "").trim())
      .filter(Boolean);

    if (bulletPoints.length === 0) {
      setStartError("Provide at least one bullet point.");
      return;
    }

    try {
      setIsStartingWorkflow(true);
      setStartError(null);
      const workflow = await api.startWorkflow({ bullet_points: bulletPoints });
      setActiveWorkflowId(workflow.id);
      syncAgentStates(workflow.agents);
      appendLog({
        source: "System",
        type: "action",
        message: `Workflow ${workflow.id} started.`,
      });
    } catch (caughtError) {
      setStartError(
        caughtError instanceof Error ? caughtError.message : "Failed to start workflow.",
      );
    } finally {
      setIsStartingWorkflow(false);
    }
  }

  return (
    <main className="h-dvh bg-[linear-gradient(160deg,hsl(204_30%_98%),hsl(190_16%_96%))] p-4">
      <section className="mx-auto flex h-full max-w-[1600px] flex-col gap-3">
        <header className="rounded-xl border border-border/80 bg-background/90 px-4 py-3 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
            <div className="space-y-2">
              <h1 className="text-lg font-semibold text-foreground">
                Multi-Agent Newsroom Workflow
              </h1>
              <p className="text-sm text-muted-foreground">
                Start a run from bullet points, then watch canvas statuses and logs update via
                polling.
              </p>
              <textarea
                value={workflowInput}
                onChange={(event) => setWorkflowInput(event.target.value)}
                className="h-28 w-full rounded-md border border-input bg-background p-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="One bullet point per line"
              />
            </div>

            <div className="flex min-w-[240px] flex-col items-stretch gap-2">
              <Button onClick={handleStartWorkflow} disabled={isStartingWorkflow}>
                {isStartingWorkflow ? "Starting..." : "Start Workflow"}
              </Button>
              <span className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                API: {isLoading ? "Checking" : error ? "Offline" : (data?.status ?? "Unknown")}
              </span>
              <span className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                Workflow: {workflowState?.status ?? "idle"}
              </span>
              <span className="rounded-md border border-border bg-background px-2 py-1 text-xs text-muted-foreground">
                Polling: {isPolling ? "active" : "stopped"}
              </span>
              {activeWorkflowId && (
                <span className="rounded-md border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
                  Run ID: {activeWorkflowId}
                </span>
              )}
            </div>
          </div>

          {(startError || pollingError) && (
            <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs text-rose-700">
              {startError ?? pollingError}
            </p>
          )}
        </header>

        <Group
          orientation="horizontal"
          defaultLayout={initialLayoutRef.current}
          onLayoutChange={handleLayoutChange}
          onLayoutChanged={handleLayoutPersist}
          className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/80 bg-background/90 shadow-sm"
        >
          <Panel
            id="workspace"
            minSize={WORKSPACE_MIN_SIZE}
            maxSize={WORKSPACE_MAX_SIZE}
            className="min-w-0"
          >
            <WorkspaceCanvasPanel
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onNodeClick={handleNodeClick}
              onNodeDragStop={handleNodeDragStop}
              onPaneClick={handlePaneClick}
              onSelectionChange={handleSelectionChange}
              onInit={handleFlowInit}
              onAddEntity={addEntityNode}
              onResetView={resetCanvasView}
              onSimulateError={emitErrorLog}
            />
          </Panel>

          <Separator className="group relative w-2 shrink-0 cursor-col-resize bg-border/70 transition-colors hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60">
            <div className="absolute left-1/2 top-1/2 h-14 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-foreground/30 group-hover:bg-primary/60" />
          </Separator>

          <Panel id="logs" minSize={LOGS_MIN_SIZE} className="min-w-0">
            <LogsPanel
              logFilter={logFilter}
              onFilterChange={setLogFilter}
              autoFollowLogs={autoFollowLogs}
              filteredLogs={filteredLogs}
              logsViewportRef={logsViewportRef}
              onLogsScroll={handleLogsScroll}
              onJumpToLatest={jumpToLatestLogs}
              onClearLogs={clearLogs}
              onLogClick={handleLogClick}
            />
          </Panel>
        </Group>
      </section>
    </main>
  );
}
