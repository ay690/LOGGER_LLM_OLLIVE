import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useAppSelector } from "@/store/hooks";
import type { View } from "@/types";

const VIEW_TITLES: Record<View, string> = {
    chat: "Chat",
    conversations: "Conversations",
    dashboard: "Dashboard",
    logs: "Inference Logs",
}

export function Header() {
    const { theme, setTheme } = useTheme()
    const activeView = useAppSelector((s) => s.ui.activeView)
    const totalLogs = useAppSelector((s) => s.logs.items.length)

    return (
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
            <div className="flex items-center gap-3">
                <h1 className="text-sm font-semibold">{VIEW_TITLES[activeView]}</h1>
                {activeView === "logs" && totalLogs > 0 && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {totalLogs} events
                    </span>
                )}
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    aria-label="Toggle theme"
                >
                    {theme === "dark" ? (
                        <Sun className="size-4" />
                    ) : (
                        <Moon className="size-4" />
                    )}
                </Button>
            </div>
        </header>
    )
}