import { z } from "zod";

// ─── Shared ───────────────────────────────────────────────────────────────────
const isoDate = z.string().datetime({ message: "Must be an ISO 8601 datetime string" });

const nanoidString = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[\w-]+$/, "Invalid ID format");

// ─── Message ─────────────────────────────────────────────────────────────────
export const MessageSchema = z.object({
  id: nanoidString,
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(100_000),
  timestamp: isoDate,
});

// ─── Conversation ─────────────────────────────────────────────────────────────
export const CreateConversationSchema = z.object({
  id: nanoidString,
  title: z.string().min(1).max(200).default("New Conversation"),
  model: z.string().min(1).max(100),
  provider: z.string().min(1).max(50).default("puter"),
  status: z.enum(["active", "cancelled", "completed"]).default("active"),
  messages: z.array(MessageSchema).default([]),
  createdAt: isoDate,
  updatedAt: isoDate,
});

export const AddMessageSchema = z.object({
  message: MessageSchema,
});

export const UpdateConversationStatusSchema = z.object({
  status: z.enum(["active", "cancelled", "completed"]),
});

// ─── Inference Log ────────────────────────────────────────────────────────────
export const IngestLogSchema = z.object({
  id: nanoidString,
  conversationId: nanoidString,
  sessionId: nanoidString,
  provider: z.string().min(1).max(50).default("puter"),
  model: z.string().min(1).max(100),
  requestTimestamp: isoDate,
  responseTimestamp: isoDate,
  latencyMs: z.number().int().min(0),
  promptTokens: z.number().int().min(0),
  completionTokens: z.number().int().min(0),
  totalTokens: z.number().int().min(0),
  status: z.enum(["success", "error", "cancelled"]),
  errorMessage: z.string().max(2000).optional(),
  inputPreview: z.string().max(500),
  outputPreview: z.string().max(500),
  requestId: nanoidString,
});

// Batch ingestion: up to 50 logs at once
export const IngestLogBatchSchema = z.object({
  logs: z.array(IngestLogSchema).min(1).max(50),
});

// ─── User Settings ────────────────────────────────────────────────────────────
export const UpdateSettingsSchema = z.object({
  defaultProvider: z.string().min(1).max(50).optional(),
  defaultModel: z.string().min(1).max(100).optional(),
  streamingEnabled: z.boolean().optional(),
  piiRedactionEnabled: z.boolean().optional(),
});
