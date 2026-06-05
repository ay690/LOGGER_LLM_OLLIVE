import { Bot, LayoutDashboard, List, MessageSquare, Settings, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { setActiveView, toggleSidebar } from "@/store/slices/uiSlice";
import type { View } from "@/types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const NAV_ITEMS: { view: View; label: string; icon: React.ReactNode }[] = [
  { view: "chat", label: "Chat", icon: <MessageSquare className="size-4" /> },
  { view: "conversations", label: "Conversations", icon: <List className="size-4" /> },
  { view: "dashboard", label: "Dashboard", icon: <LayoutDashboard className="size-4" /> },
  { view: "logs", label: "Inference Logs", icon: <Zap className="size-4" /> },
]

export function Sidebar() {
  const dispatch = useAppDispatch()
  const activeView = useAppSelector((s) => s.ui.activeView)
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen)

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border bg-sidebar transition-all duration-200",
        sidebarOpen ? "w-52" : "w-14"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-3">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Bot className="size-4 text-primary-foreground" />
        </div>
        {sidebarOpen && (
          <span className="truncate text-sm font-semibold tracking-tight">
            LLM Observe
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {NAV_ITEMS.map(({ view, label, icon }) => {
          const active = activeView === view
          const btn = (
            <button
              key={view}
              onClick={() => dispatch(setActiveView(view))}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <span className="shrink-0">{icon}</span>
              {sidebarOpen && <span className="truncate">{label}</span>}
            </button>
          )

          if (!sidebarOpen) {
            return (
              <Tooltip key={view}>
                <TooltipTrigger asChild>{btn}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            )
          }
          return btn
        })}
      </nav>

      {/* Settings + Collapse */}
      <div className="flex flex-col gap-1 border-t border-border p-2">
        {!sidebarOpen ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => dispatch(setActiveView("chat" as View))}
                className="flex w-full items-center justify-center rounded-md p-2 text-sidebar-foreground hover:bg-sidebar-accent"
              >
                <Settings className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">Settings</TooltipContent>
          </Tooltip>
        ) : (
          <button
            onClick={() => dispatch(setActiveView("chat" as View))}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Settings className="size-4 shrink-0" />
            <span className="truncate">Settings</span>
          </button>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          className="self-end"
          onClick={() => dispatch(toggleSidebar())}
          aria-label="Toggle sidebar"
        >
          {sidebarOpen ? (
            <ChevronLeft className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </Button>
      </div>
    </aside>
  )
}