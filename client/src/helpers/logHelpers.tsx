import { Badge } from "@/components/ui/badge"
import type { InferenceLog } from "@/types"

/** Formats an ISO timestamp to a short HH:MM:SS string. */
export function formatTs(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

/** Returns a colored Badge for a log status. */
export function statusBadge(status: InferenceLog["status"]) {
  switch (status) {
    case "success":
      return (
        <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-0 text-xs">
          success
        </Badge>
      )
    case "error":
      return (
        <Badge className="bg-destructive/10 text-destructive border-0 text-xs">
          error
        </Badge>
      )
    case "cancelled":
      return (
        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0 text-xs">
          cancelled
        </Badge>
      )
  }
}
