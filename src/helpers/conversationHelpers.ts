import type { Conversation } from "@/types"

/** Returns Tailwind classes for a conversation status badge. */
export function statusColor(status: Conversation["status"]): string {
  switch (status) {
    case "active":
      return "bg-green-500/15 text-green-600 dark:text-green-400"
    case "cancelled":
      return "bg-destructive/10 text-destructive"
    case "completed":
      return "bg-muted text-muted-foreground"
  }
}

/** Formats an ISO date string to a short "Mon DD, HH:MM" display string. */
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
