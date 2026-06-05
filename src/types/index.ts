export type Provider = "puter"

export type MessageRole = "system" | "user" | "assistant";

export interface Message {
    id: string;
    role: MessageRole;
    content: string;
    timestamp: string;
    isStreaming?: boolean;
}

export interface Conversation {
    id: string;
    title: string;
    messages: Message[];
    model: string;
    provider: Provider;
    createdAt: string;
    updatedAt: string;
    status: "active" | "cancelled" | "completed";
}

export interface InferenceLog {
  id: string
  conversationId: string
  sessionId: string
  provider: Provider
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
}