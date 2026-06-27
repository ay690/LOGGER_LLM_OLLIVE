import type { InferenceLog } from "@/types"

/** Buckets logs into per-minute time series data for chart display (last 15 buckets). */
export function bucketByMinute(logs: InferenceLog[]) {
  const map = new Map<string, { latency: number[]; count: number; errors: number; tokens: number }>()

  // Sort oldest-first so the map builds in chronological order
  const sorted = [...logs].sort(
    (a, b) => new Date(a.requestTimestamp).getTime() - new Date(b.requestTimestamp).getTime()
  )

  for (const log of sorted) {
    const d = new Date(log.requestTimestamp)
    const key = `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`
    const existing = map.get(key) ?? { latency: [], count: 0, errors: 0, tokens: 0 }
    existing.latency.push(log.latencyMs)
    existing.count += 1
    if (log.status === "error") existing.errors += 1
    existing.tokens += log.totalTokens
    map.set(key, existing)
  }

  // Map is now in chronological order — take the 15 most recent buckets
  return Array.from(map.entries()).slice(-15).map(([time, v]) => ({
    time,
    latency: Math.round(v.latency.reduce((a, b) => a + b, 0) / v.latency.length),
    requests: v.count,
    errors: v.errors,
    tokens: v.tokens,
  }))
}
