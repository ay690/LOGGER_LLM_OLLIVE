// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { nanoid } from "@reduxjs/toolkit";
import puter from "@heyputer/puter.js";
import type { AppDispatch } from "@/store";
import { addLog, syncLog } from "@/store/slices/logsSlice";
import type { InferenceLog, Message } from "@/types";

// ─── PII Redaction ────────────────────────────────────────────────────────────
const PII_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[EMAIL]" },
  { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "[PHONE]" },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN]" },
  { pattern: /\b(?:\d[ -]?){13,16}\b/g, replacement: "[CARD]" },
]

export function redactPII(text: string): string {
  let result = text
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

// ─── Available models via Puter ───────────────────────────────────────────────
// Puter proxies 500+ models — these are the most popular ones grouped by origin.
export const PUTER_MODELS: { label: string; value: string }[] = [
  // OpenAI
  { label: "GPT-4o mini", value: "gpt-4o-mini" },
  { label: "GPT-4o", value: "gpt-4o" },
  { label: "GPT-4.1", value: "openai/gpt-4.1" },
  { label: "o4-mini", value: "openai/o4-mini" },
  // Anthropic
  { label: "Claude Sonnet 4", value: "claude-sonnet-4-5" },
  { label: "Claude Haiku 3.5", value: "claude-haiku-3-5" },
  // Google
  { label: "Gemini 2.0 Flash", value: "google/gemini-2.0-flash" },
  { label: "Gemini 1.5 Pro", value: "google/gemini-1.5-pro" },
  // Meta
  { label: "Llama 3.3 70B", value: "meta-llama/llama-3.3-70b-instruct" },
  // xAI
  { label: "Grok 3 Mini", value: "x-ai/grok-3-mini-beta" },
  { label: "Grok 3", value: "x-ai/grok-3-beta" },
  // Mistral
  { label: "Mistral Large", value: "mistralai/mistral-large" },
  { label: "Mistral Small", value: "mistralai/mistral-small" },
  // DeepSeek
  { label: "DeepSeek R1", value: "deepseek/deepseek-r1" },
  { label: "DeepSeek V3", value: "deepseek/deepseek-chat-v3-0324" },
]

// For the settings slice / model picker — flat list of values
export const PROVIDER_MODELS = {
  puter: PUTER_MODELS.map((m) => m.value),
}

// ─── SDK Config ───────────────────────────────────────────────────────────────
export interface SDKConfig {
  model: string
  streamingEnabled: boolean
  piiRedactionEnabled: boolean
  dispatch: AppDispatch
}

// ─── Extract text from Puter response ────────────────────────────────────────
// Puter normalises responses but the shape varies slightly per underlying model.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractText(response: any): string {
  // Standard: response.message.content (string or array)
  const content = response?.message?.content
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((c: { text?: string }) => c?.text ?? "")
      .join("")
  }
  // Fallback: direct string
  if (typeof response === "string") return response
  return ""
}

// ─── Main SDK call ────────────────────────────────────────────────────────────
export async function llmCall(
  messages: Message[],
  conversationId: string,
  config: SDKConfig,
  onChunk?: (chunk: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const requestId = nanoid()
  const requestTimestamp = new Date().toISOString()
  const startTime = performance.now()

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user")
  const inputPreview = config.piiRedactionEnabled
    ? redactPII(lastUserMsg?.content ?? "")
    : (lastUserMsg?.content ?? "").slice(0, 120)

  // Format messages for puter.ai.chat — it accepts OpenAI-style message arrays
  const formattedMessages = messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }))

  let status: InferenceLog["status"] = "success"
  let errorMessage: string | undefined
  let content = ""
  // Puter doesn't expose token counts in its JS SDK yet — estimate from chars
  let promptTokens = 0
  let completionTokens = 0

  try {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError")

    if (config.streamingEnabled && onChunk) {
      // Streaming: puter.ai.chat returns an async iterable when stream: true
      const response = await puter.ai.chat(formattedMessages, {
        model: config.model,
        stream: true,
      })

      for await (const part of response) {
        if (signal?.aborted) break
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const chunk: string = (part as any)?.text ?? ""
        if (chunk) {
          content += chunk
          onChunk(chunk)
        }
      }
    } else {
      // Non-streaming
      const response = await puter.ai.chat(formattedMessages, {
        model: config.model,
      })
      content = extractText(response)
    }

    // Rough token estimate (4 chars ≈ 1 token) since Puter SDK doesn't return usage yet
    const allInputText = messages.map((m) => m.content).join(" ")
    promptTokens = Math.ceil(allInputText.length / 4)
    completionTokens = Math.ceil(content.length / 4)

  } catch (err) {
    if (
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.message.toLowerCase().includes("abort"))
    ) {
      status = "cancelled"
      errorMessage = "Request cancelled by user"
    } else {
      status = "error"
      errorMessage = err instanceof Error ? err.message : String(err)
    }
    throw err
  } finally {
    const latencyMs = Math.round(performance.now() - startTime)
    const outputPreview = config.piiRedactionEnabled
      ? redactPII(content)
      : content.slice(0, 120)

    const logEntry: InferenceLog = {
        id: nanoid(),
        conversationId,
        sessionId: conversationId,
        provider: "puter",
        model: config.model,
        requestTimestamp,
        responseTimestamp: new Date().toISOString(),
        latencyMs,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        status,
        errorMessage,
        inputPreview,
        outputPreview,
        requestId,
      }

    config.dispatch(addLog(logEntry))
    // Fire-and-forget persist to backend — don't block or throw on failure
    config.dispatch(syncLog(logEntry))
  }

  return content;
}