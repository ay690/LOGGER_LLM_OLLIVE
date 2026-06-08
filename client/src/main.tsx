import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import "./index.css";
import App from "./App.tsx"
import { store } from "@/store";
import { ThemeProvider } from "@/components/theme-provider.tsx";
import { loadSettings } from "@/store/slices/settingsSlice";
import { loadConversations } from "@/store/slices/conversationsSlice";

// Bootstrap: hydrate store from backend before first render.
// Failures are silenced — the app works offline with local defaults.
Promise.all([
  store.dispatch(loadSettings()).unwrap().catch(() => {}),
  store.dispatch(loadConversations()).unwrap().catch(() => {}),
]).finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Provider store={store}>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </Provider>
    </StrictMode>
  )
})
