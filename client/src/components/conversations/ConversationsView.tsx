import { useEffect } from "react"
import { MessageSquare, Trash2, Play, XCircle, Clock, Hash } from "lucide-react"
import { useAppDispatch, useAppSelector } from "@/store/hooks"
import {
  setActiveConversation,
  cancelConversation,
  deleteConversation,
  syncConversationStatus,
  syncDeleteConversation,
} from "@/store/slices/conversationsSlice"
import { setActiveView } from "@/store/slices/uiSlice"
import { loadLogs } from "@/store/slices/logsSlice"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { statusColor, formatDate } from "@/helpers/conversationHelpers"

export function ConversationsView() {
  const dispatch = useAppDispatch()
  const conversations = useAppSelector((s) => s.conversations.items)
  const activeId = useAppSelector((s) => s.conversations.activeConversationId)

  // Refresh logs when this view mounts so the data stays current
  useEffect(() => {
    dispatch(loadLogs())
  }, [dispatch])

  const handleResume = (id: string) => {
    dispatch(setActiveConversation(id))
    dispatch(setActiveView("chat"))
  }

  const handleCancel = (id: string) => {
    dispatch(cancelConversation(id))
    dispatch(syncConversationStatus({ id, status: "cancelled" }))
  }

  const handleDelete = (id: string) => {
    dispatch(deleteConversation(id))
    dispatch(syncDeleteConversation(id))
  }

  if (conversations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
            <MessageSquare className="size-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No conversations yet. Start chatting!</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                "group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/30",
                activeId === conv.id && "border-primary/40 bg-primary/5"
              )}
            >
              {/* Top row */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="truncate text-sm font-medium">{conv.title}</span>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="size-3" />
                      {formatDate(conv.updatedAt)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Hash className="size-3" />
                      {conv.messages.length} msg{conv.messages.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      statusColor(conv.status)
                    )}
                  >
                    {conv.status}
                  </span>
                </div>
              </div>

              {/* Provider / model badges */}
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {conv.provider}
                </Badge>
                <Badge variant="outline" className="text-xs font-mono">
                  {conv.model}
                </Badge>
              </div>

              {/* Last message preview */}
              {conv.messages.length > 0 && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {conv.messages[conv.messages.length - 1].content || "…"}
                </p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => handleResume(conv.id)}
                >
                  <Play className="size-3" />
                  Resume
                </Button>

                {conv.status === "active" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground hover:text-destructive"
                    onClick={() => handleCancel(conv.id)}
                  >
                    <XCircle className="size-3" />
                    Cancel
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="ml-auto text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(conv.id)}
                  aria-label="Delete conversation"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}