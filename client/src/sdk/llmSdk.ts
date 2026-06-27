// ─── Re-exports ───────────────────────────────────────────────────────────────
// All logic lives in @/utils — re-exported here for backwards compatibility.
export { redactPII } from "@/utils/pii"
export { extractText, llmCall } from "@/helpers/sdk"
export type { SDKConfig } from "@/helpers/sdk"

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
