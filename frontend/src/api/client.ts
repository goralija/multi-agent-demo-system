const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface Article {
  id: number;
  title: string;
  bullet_points: string;
  content: string;
  status: string;
  comments: AgentComment[];
  created_at: string;
  updated_at: string;
}

export interface AgentComment {
  id: number;
  agent: string;
  body: string;
  created_at: string;
}

export type WorkflowAgentStatus = "idle" | "running" | "completed" | "failed";

export interface WorkflowAgentState {
  name: "Author" | "Editor" | "FactChecker" | "CopyEditor";
  status: WorkflowAgentStatus;
}

export interface WorkflowFlag {
  text: string;
  reason: string;
}

export interface WorkflowState {
  id: string;
  status: "running" | "completed" | "failed";
  current_step: "author" | "editor" | "fact_checker" | "copy_editor";
  data: {
    draft: string;
    flags: WorkflowFlag[];
    final_article: string;
  };
  agents: WorkflowAgentState[];
  created_at: string;
}

export interface WorkflowLog {
  id: number;
  timestamp: string;
  source: string;
  message: string;
  type: "info" | "action" | "error";
}

interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/api/health/"),
  listArticles: () => request<Paginated<Article>>("/api/articles/"),
  getArticle: (id: number) => request<Article>(`/api/articles/${id}/`),
  createArticle: (data: Pick<Article, "title" | "bullet_points">) =>
    request<Article>("/api/articles/", { method: "POST", body: JSON.stringify(data) }),
  startWorkflow: (data: { bullet_points: string[] }) =>
    request<WorkflowState>("/api/workflows/", { method: "POST", body: JSON.stringify(data) }),
  getWorkflow: (id: string) => request<WorkflowState>(`/api/workflows/${id}/`),
  getWorkflowLogs: (id: string) => request<WorkflowLog[]>(`/api/workflows/${id}/logs/`),
};
