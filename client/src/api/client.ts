// ─── Typed API client for the logger_llm backend ─────────────────────────────
// All network calls live here. Components and thunks import from this module.

const BASE = "http://localhost:3001/api"

// Generic fetch wrapper — throws on non-2xx
async function req<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error((body as { error?: string }).error ?? `HTTP ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── Types mirroring the server response shapes ───────────────────────────────
export interface ApiMessage {
  id: string
  role: "system" | "user" | "assistant"
  content: string
  timestamp: string
}

export interface ApiConversation {
  _id: string
  title: string
  llmModel: string
  provider: string
  status: "active" | "cancelled" | "completed"
  messages: ApiMessage[]
  messageCount?: number
  createdAt: string
  updatedAt: string
}

export interface ApiLog {
  _id: string
  conversationId: string
  sessionId: string
  provider: string
  llmModel: string
  requestTimestamp: string
  responseTimestamp: string
  latencyMs: number
  promptTokens: number
  completionTokens: number
  totalTokens: number
  status: "success" | "error" | "cancelled"
  errorMessage?: string
  inputPreview: string
  outputPreview: string
  requestId: string
}

export interface ApiSettings {
  userId: string
  defaultProvider: string
  defaultModel: string
  streamingEnabled: boolean
  piiRedactionEnabled: boolean
}

// ─── Conversations ────────────────────────────────────────────────────────────
export const conversationsApi = {
  list: () =>
    req<{ data: ApiConversation[] }>("/conversations"),

  create: (payload: {
    id: string
    title: string
    model: string
    provider: string
    status: string
    messages: ApiMessage[]
    createdAt: string
    updatedAt: string
  }) =>
    req<{ data: ApiConversation }>("/conversations", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  get: (id: string) =>
    req<{ data: ApiConversation }>(`/conversations/${id}`),

  addMessage: (conversationId: string, message: ApiMessage) =>
    req<{ data: ApiConversation }>(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),

  updateStatus: (id: string, status: "active" | "cancelled" | "completed") =>
    req<{ data: ApiConversation }>(`/conversations/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),

  delete: (id: string) =>
    req<{ message: string }>(`/conversations/${id}`, { method: "DELETE" }),
}

// ─── Logs ─────────────────────────────────────────────────────────────────────
export const logsApi = {
  ingest: (log: {
    id: string
    conversationId: string
    sessionId: string
    provider: string
    model: string
    requestTimestamp: string
    responseTimestamp: string
    latencyMs: number
    promptTokens: number
    completionTokens: number
    totalTokens: number
    status: "success" | "error" | "cancelled"
    errorMessage?: string
    inputPreview: string
    outputPreview: string
    requestId: string
  }) =>
    req<{ data: ApiLog }>("/logs", {
      method: "POST",
      body: JSON.stringify(log),
    }),

  list: (params?: {
    model?: string
    status?: string
    conversationId?: string
    search?: string
    page?: number
    limit?: number
  }) => {
    const qs = new URLSearchParams()
    if (params?.model && params.model !== "all") qs.set("model", params.model)
    if (params?.status && params.status !== "all") qs.set("status", params.status)
    if (params?.conversationId) qs.set("conversationId", params.conversationId)
    if (params?.search) qs.set("search", params.search)
    if (params?.page) qs.set("page", String(params.page))
    if (params?.limit) qs.set("limit", String(params.limit))
    const query = qs.toString()
    return req<{ data: ApiLog[]; pagination: { page: number; limit: number; total: number; pages: number } }>(
      `/logs${query ? `?${query}` : ""}`
    )
  },
}

// ─── Settings ─────────────────────────────────────────────────────────────────
export const settingsApi = {
  get: () =>
    req<{ data: ApiSettings }>("/settings"),

  update: (patch: Partial<Omit<ApiSettings, "userId">>) =>
    req<{ data: ApiSettings }>("/settings", {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),
}
