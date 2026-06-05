import { TooltipProvider } from "@/components/ui/tooltip";
import { Sidebar } from "@/components/layout/Sidebar";
import ChatView  from "@/components/chat/ChatView";
import { useAppSelector } from "@/store/hooks";

function ViewRouter() {
  const activeView = useAppSelector((s) => s.ui.activeView)

  switch (activeView) {
    case "chat":
      return <ChatView />;
    default:
      return <ChatView />;
  }
}

export function App() {
  return (
    <TooltipProvider>
      <div className="flex h-svh overflow-hidden bg-background">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-hidden">
            <ViewRouter />
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}

export default App;