// ─── PII Redaction ────────────────────────────────────────────────────────────

const PII_PATTERNS: { pattern: RegExp; replacement: string }[] = [
  { pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[EMAIL]" },
  { pattern: /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, replacement: "[PHONE]" },
  { pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN]" },
  { pattern: /\b(?:\d[ -]?){13,16}\b/g, replacement: "[CARD]" },
]

/** Replaces common PII patterns (email, phone, SSN, credit card) with placeholder tokens. */
export function redactPII(text: string): string {
  let result = text
  for (const { pattern, replacement } of PII_PATTERNS) {
    result = result.replace(pattern, replacement)
  }
  return result
}
