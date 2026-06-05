import { PUTER_MODELS } from "@/sdk/llmSdk"

// ─── Color palette for model visualization ────────────────────────────────────
export const PALETTE = [
  "#4285F4", "#EA4335", "#FBBC05", "#34A853",
  "#8B5CF6", "#F97316", "#06B6D4", "#EC4899",
  "#10B981", "#6366F1", "#F59E0B", "#84CC16",
  "#3B82F6", "#A855F7", "#EF4444",
]

/** Deterministically maps a string (model value) to a palette color. */
export function stableColor(str: string): string {
  let h = 0
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h)
  return PALETTE[Math.abs(h) % PALETTE.length]
}

/** Returns the human-readable label for a model value, falling back to the raw value. */
export function shortLabel(modelValue: string): string {
  return PUTER_MODELS.find((m) => m.value === modelValue)?.label ?? modelValue
}
