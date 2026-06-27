import { useMemo, useEffect } from "react"
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts"
import {
  Activity, Clock, Coins, AlertTriangle,
  CheckCircle2, Zap, TrendingUp,
} from "lucide-react"
import { useAppSelector } from "@/store/hooks"
import { useAppDispatch } from "@/store/hooks"
import { loadLogs } from "@/store/slices/logsSlice"
import { ScrollArea } from "@/components/ui/scroll-area"
import { stableColor, shortLabel } from "@/utils/model"
import { bucketByMinute } from "@/utils/chart"

// ─── Sub-components ───────────────────────────────────────────────────────────
function StatCard({ label, value, sub, icon, accent }: {
  label: string; value: string | number; sub?: string
  icon: React.ReactNode; accent?: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={`flex size-7 items-center justify-center rounded-lg ${accent ?? "bg-muted"}`}>
          {icon}
        </span>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <span className="text-sm font-semibold">{title}</span>
      {children}
    </div>
  )
}

const tooltipStyle = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 12,
  },
}

// ─── Custom pie label ─────────────────────────────────────────────────────────
function PieLabel({ cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, percent = 0 }: {
  cx?: number; cy?: number; midAngle?: number
  innerRadius?: number; outerRadius?: number; percent?: number
}) {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const r = innerRadius + (outerRadius - innerRadius) * 0.5
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  )
}

// ─── Dashboard ────────────────────────────────────────────────────────────────
export function DashboardView() {
  const dispatch = useAppDispatch()
  const logs = useAppSelector((s) => s.logs.items)
  const syncing = useAppSelector((s) => s.logs.syncing)

  // Load logs from backend whenever dashboard is opened
  useEffect(() => {
    dispatch(loadLogs({ limit: 500 }))
  }, [dispatch])

  const metrics = useMemo(() => {
    if (logs.length === 0) return null

    const total = logs.length
    const success = logs.filter((l) => l.status === "success").length
    const errors = logs.filter((l) => l.status === "error").length
    const avgLatency = logs.reduce((acc, l) => acc + l.latencyMs, 0) / total
    const totalTokens = logs.reduce((acc, l) => acc + l.totalTokens, 0)

    // Group by model (not provider — all are "puter" now)
    const modelBreakdown = logs.reduce((acc, l) => {
      acc[l.model] = (acc[l.model] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

    const modelPie = Object.entries(modelBreakdown)
      .sort((a, b) => b[1] - a[1]) // most used first
      .map(([model, value]) => ({
        model,
        label: shortLabel(model),
        value,
        color: stableColor(model),
      }))

    return {
      total, success, errors,
      successRate: Math.round((success / total) * 100),
      avgLatency: Math.round(avgLatency),
      totalTokens,
      modelPie,
      timeSeries: bucketByMinute(logs),
    }
  }, [logs])

  if (!metrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted">
            <Activity className={`size-6 text-muted-foreground ${syncing ? "animate-pulse" : ""}`} />
          </div>
          <p className="text-sm text-muted-foreground">
            {syncing ? "Loading metrics…" : "No inference data yet. Start chatting to see metrics."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-4 p-4">

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Total Requests" value={metrics.total} sub="all time"
            icon={<Activity className="size-3.5 text-blue-500" />} accent="bg-blue-500/10" />
          <StatCard label="Success Rate" value={`${metrics.successRate}%`} sub={`${metrics.success} succeeded`}
            icon={<CheckCircle2 className="size-3.5 text-green-500" />} accent="bg-green-500/10" />
          <StatCard label="Avg Latency" value={`${metrics.avgLatency}ms`} sub="per request"
            icon={<Clock className="size-3.5 text-amber-500" />} accent="bg-amber-500/10" />
          <StatCard label="Total Tokens" value={metrics.totalTokens.toLocaleString()} sub="prompt + completion"
            icon={<Coins className="size-3.5 text-purple-500" />} accent="bg-purple-500/10" />
        </div>

        {/* Top row charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

          {/* Latency */}
          <ChartCard title="Latency (ms)">
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={metrics.timeSeries}>
                <defs>
                  <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4285F4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#4285F4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="latency" stroke="#4285F4" fill="url(#latGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Throughput */}
          <ChartCard title="Throughput (requests)">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={metrics.timeSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="requests" fill="#34A853" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Model breakdown pie */}
          <ChartCard title="Model Breakdown">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={metrics.modelPie}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={2}
                  dataKey="value"
                  nameKey="label"
                  labelLine={false}
                  label={PieLabel}
                >
                  {metrics.modelPie.map((entry) => (
                    <Cell key={entry.model} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  {...tooltipStyle}
                  formatter={(value, _name, props: { payload?: { label?: string } }) => {
                    const count = typeof value === "number" ? value : 0
                    return [`${count} request${count !== 1 ? "s" : ""}`, props.payload?.label ?? ""]
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Legend — scrollable if many models */}
            <div className="flex max-h-28 flex-col gap-1.5 overflow-y-auto">
              {metrics.modelPie.map((entry) => (
                <div key={entry.model} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: entry.color }} />
                    <span className="truncate font-medium">{entry.label}</span>
                  </div>
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {entry.value} ({Math.round((entry.value / metrics.total) * 100)}%)
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard title="Errors Over Time">
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={metrics.timeSeries}>
                <defs>
                  <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EA4335" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#EA4335" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="errors" stroke="#EA4335" fill="url(#errGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertTriangle className="size-3.5 text-destructive" />
              {metrics.errors} total error{metrics.errors !== 1 ? "s" : ""}
            </div>
          </ChartCard>

          <ChartCard title="Token Usage Over Time">
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={metrics.timeSeries}>
                <defs>
                  <linearGradient id="tokGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#9333EA" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#9333EA" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <Tooltip {...tooltipStyle} />
                <Area type="monotone" dataKey="tokens" stroke="#9333EA" fill="url(#tokGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="size-3.5 text-purple-500" />
              {metrics.totalTokens.toLocaleString()} total tokens consumed
            </div>
          </ChartCard>
        </div>

        {/* Recent activity */}
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Zap className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Recent Activity</span>
          </div>
          <div className="flex flex-col gap-1">
            {logs.slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-xs hover:bg-muted/50">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${
                    log.status === "success" ? "bg-green-500"
                      : log.status === "error" ? "bg-destructive"
                      : "bg-amber-500"
                  }`}
                />
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: stableColor(log.model) }}
                />
                <span className="w-36 shrink-0 truncate font-medium">
                  {shortLabel(log.model)}
                </span>
                <span className="flex-1 truncate font-mono text-muted-foreground">
                  {log.inputPreview}
                </span>
                <span className="shrink-0 text-muted-foreground">{log.latencyMs}ms</span>
                <span className="shrink-0 text-muted-foreground">{log.totalTokens} tok</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </ScrollArea>
  )
}