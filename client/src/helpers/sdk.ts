// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { nanoid } from "@reduxjs/toolkit"
import puter from "@heyputer/puter.js"
import type { AppDispatch } from "@/store"
import { addLog, syncLog } from "@/store/slices/logsSlice"
import type { InferenceLog, Message } from "@/types"
import { redactPII } from "@/utils/pii"

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
export function extractText(response: any): string {
  if (!response) return ""
  // Shape 1: response.message.content (string)
  const content = response?.message?.content
  if (typeof content === "string" && content) return content
  // Shape 2: response.message.content (array of {text} blocks)
  if (Array.isArray(content)) {
    const joined = content.map((c: { text?: string }) => c?.text ?? "").join("")
    if (joined) return joined
  }
  // Shape 3: response.text (some models)
  if (typeof response?.text === "string" && response.text) return response.text
  // Shape 4: response.choices[0].message.content (OpenAI passthrough)
  const choice = response?.choices?.[0]?.message?.content
  if (typeof choice === "string" && choice) return choice
  // Shape 5: direct string response
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
      // Streaming: puter.ai.chat returns a Promise of an async iterable when stream: true
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

      // If streaming yielded nothing, fall back to non-streaming
      if (!content) {
        const fallback = await puter.ai.chat(formattedMessages, { model: config.model })
        content = extractText(fallback)
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
    const rawOutput = content || (status === "cancelled" ? "[cancelled]" : status === "error" ? "[error]" : "")
    const outputPreview = config.piiRedactionEnabled
      ? redactPII(rawOutput)
      : rawOutput.slice(0, 120)

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

  return content
}
