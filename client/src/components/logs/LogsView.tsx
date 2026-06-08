import { useState, useEffect } from "react";
import { Search, Filter, X, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setFilter, clearLogs, loadLogs } from "@/store/slices/logsSlice";
import { PUTER_MODELS } from "@/sdk/llmSdk";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { statusBadge, formatTs } from "@/helpers/logHelpers";
import type { InferenceLog } from "@/types";

function LogRow({ log }: { log: InferenceLog }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Summary row */}
      <button
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="shrink-0 text-muted-foreground">
          {expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </span>

        {/* Status dot */}
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            log.status === "success"
              ? "bg-green-500"
              : log.status === "error"
                ? "bg-destructive"
                : "bg-amber-500"
          )}
        />

        <span className="w-20 shrink-0 text-xs text-muted-foreground font-mono">
          {formatTs(log.requestTimestamp)}
        </span>

        <span className="w-16 shrink-0">
          <Badge variant="secondary" className="text-xs capitalize">
            {log.provider}
          </Badge>
        </span>

        <span className="w-36 shrink-0 truncate font-mono text-xs text-muted-foreground">
          {log.model}
        </span>

        <span className="flex-1 truncate text-xs text-muted-foreground">
          {log.inputPreview}
        </span>

        <span className="w-20 shrink-0 text-right text-xs font-medium">
          {log.latencyMs}ms
        </span>

        <span className="w-20 shrink-0 text-right text-xs text-muted-foreground">
          {log.totalTokens} tok
        </span>

        <span className="w-20 shrink-0 text-right">
          {statusBadge(log.status)}
        </span>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-border bg-muted/20 px-4 py-3">
          <div className="grid grid-cols-2 gap-4 text-xs lg:grid-cols-4">
            <div>
              <p className="mb-1 font-medium text-muted-foreground">Request ID</p>
              <p className="font-mono break-all">{log.requestId}</p>
            </div>
            <div>
              <p className="mb-1 font-medium text-muted-foreground">Session ID</p>
              <p className="font-mono break-all">{log.sessionId.slice(0, 16)}…</p>
            </div>
            <div>
              <p className="mb-1 font-medium text-muted-foreground">Request Time</p>
              <p className="font-mono">{new Date(log.requestTimestamp).toLocaleString()}</p>
            </div>
            <div>
              <p className="mb-1 font-medium text-muted-foreground">Response Time</p>
              <p className="font-mono">{new Date(log.responseTimestamp).toLocaleString()}</p>
            </div>
            <div>
              <p className="mb-1 font-medium text-muted-foreground">Prompt Tokens</p>
              <p className="font-mono">{log.promptTokens}</p>
            </div>
            <div>
              <p className="mb-1 font-medium text-muted-foreground">Completion Tokens</p>
              <p className="font-mono">{log.completionTokens}</p>
            </div>
            <div>
              <p className="mb-1 font-medium text-muted-foreground">Total Tokens</p>
              <p className="font-mono">{log.totalTokens}</p>
            </div>
            <div>
              <p className="mb-1 font-medium text-muted-foreground">Latency</p>
              <p className="font-mono">{log.latencyMs}ms</p>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Input Preview</p>
              <p className="rounded-md bg-background px-3 py-2 font-mono text-xs leading-relaxed">
                {log.inputPreview || "—"}
              </p>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Output Preview</p>
              <p className="rounded-md bg-background px-3 py-2 font-mono text-xs leading-relaxed">
                {log.outputPreview || "—"}
              </p>
            </div>
          </div>

          {log.errorMessage && (
            <div className="mt-3">
              <p className="mb-1 text-xs font-medium text-destructive">Error</p>
              <p className="rounded-md bg-destructive/5 px-3 py-2 font-mono text-xs text-destructive">
                {log.errorMessage}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function LogsView() {
  const dispatch = useAppDispatch()
  const { items: logs, filter, syncing } = useAppSelector((s) => s.logs)

  // Load from backend on mount so logs survive page refresh
  useEffect(() => {
    dispatch(loadLogs())
  }, [dispatch])

  const filtered = logs.filter((log) => {
    if (filter.model !== "all" && log.model !== filter.model) return false
    if (filter.status !== "all" && log.status !== filter.status) return false
    if (filter.search) {
      const q = filter.search.toLowerCase()
      if (
        !log.inputPreview.toLowerCase().includes(q) &&
        !log.outputPreview.toLowerCase().includes(q) &&
        !log.model.toLowerCase().includes(q) &&
        !log.requestId.toLowerCase().includes(q)
      )
        return false
    }
    return true
  })

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search logs…"
            value={filter.search}
            onChange={(e) => dispatch(setFilter({ search: e.target.value }))}
            className="h-8 pl-8 text-xs"
          />
          {filter.search && (
            <button
              onClick={() => dispatch(setFilter({ search: "" }))}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        <Select
          value={filter.model}
          onValueChange={(v) => dispatch(setFilter({ model: v }))}
        >
          <SelectTrigger className="h-8 w-48 text-xs">
            <Filter className="size-3 mr-1 shrink-0" />
            <SelectValue placeholder="All Models" />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all" className="text-xs">All Models</SelectItem>
            {PUTER_MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-xs">
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filter.status}
          onValueChange={(v) => dispatch(setFilter({ status: v }))}
        >
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="error">Error</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>

        {logs.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground hover:text-destructive"
            onClick={() => dispatch(clearLogs())}
          >
            <Trash2 className="size-3.5" />
            Clear
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {syncing && <span className="mr-2 animate-pulse">syncing…</span>}
          {filtered.length} / {logs.length} logs
        </span>
      </div>

      {/* Column headers */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-3 px-4 text-xs font-medium text-muted-foreground">
          <span className="w-3.5 shrink-0" />
          <span className="w-2 shrink-0" />
          <span className="w-20 shrink-0">Time</span>
          <span className="w-16 shrink-0">Provider</span>
          <span className="w-36 shrink-0">Model</span>
          <span className="flex-1">Input</span>
          <span className="w-20 text-right">Latency</span>
          <span className="w-20 text-right">Tokens</span>
          <span className="w-20 text-right">Status</span>
        </div>
      )}

      {/* Log rows */}
      <ScrollArea className="flex-1">
        {filtered.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-muted-foreground">
              {logs.length === 0
                ? "No inference logs yet. Start chatting to generate logs."
                : "No logs match the current filters."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {filtered.map((log) => (
              <LogRow key={log.id} log={log} />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}