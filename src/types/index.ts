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

