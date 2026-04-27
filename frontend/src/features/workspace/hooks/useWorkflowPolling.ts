import { type WorkflowLog, type WorkflowState, api } from "@/api/client";
import { useEffect, useRef, useState } from "react";

interface UseWorkflowPollingOptions {
  workflowId: string | null;
  intervalMs?: number;
  onState?: (state: WorkflowState) => void;
  onLogs?: (logs: WorkflowLog[]) => void;
}

export function useWorkflowPolling({
  workflowId,
  intervalMs = 1500,
  onState,
  onLogs,
}: UseWorkflowPollingOptions) {
  const [workflowState, setWorkflowState] = useState<WorkflowState | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onStateRef = useRef(onState);
  const onLogsRef = useRef(onLogs);

  useEffect(() => {
    onStateRef.current = onState;
  }, [onState]);

  useEffect(() => {
    onLogsRef.current = onLogs;
  }, [onLogs]);

  useEffect(() => {
    if (!workflowId) {
      setWorkflowState(null);
      setIsPolling(false);
      setError(null);
      return;
    }

    const activeWorkflowId = workflowId;

    let cancelled = false;
    let timerId: number | null = null;

    async function pollOnce() {
      try {
        const [state, logs] = await Promise.all([
          api.getWorkflow(activeWorkflowId),
          api.getWorkflowLogs(activeWorkflowId),
        ]);
        if (cancelled) {
          return;
        }

        setWorkflowState(state);
        setError(null);
        onStateRef.current?.(state);
        onLogsRef.current?.(logs);

        if (state.status !== "running") {
          setIsPolling(false);
          if (timerId !== null) {
            window.clearInterval(timerId);
            timerId = null;
          }
        }
      } catch (caughtError) {
        if (cancelled) {
          return;
        }

        setError(caughtError instanceof Error ? caughtError.message : "Polling failed");
      }
    }

    setIsPolling(true);
    void pollOnce();
    timerId = window.setInterval(() => {
      void pollOnce();
    }, intervalMs);

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearInterval(timerId);
      }
      setIsPolling(false);
    };
  }, [workflowId, intervalMs]);

  return {
    workflowState,
    isPolling,
    error,
  };
}
