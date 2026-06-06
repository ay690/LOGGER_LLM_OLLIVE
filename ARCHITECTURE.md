# Architecture — LLM Logger

## Overview

LLM Logger is a **single-page, client-only application** built with React and Vite. There is no backend, no database, and no server process. All state lives in memory (Redux store) and is cleared on page refresh. The app communicates with LLMs exclusively through the Puter.js browser SDK, which proxies requests to 15+ model providers without requiring any API keys.

```
Browser
└── React App (Vite SPA)
    ├── UI Layer       → React components (shadcn/ui + Tailwind CSS v4)
    ├── State Layer    → Redux Toolkit (in-memory, no persistence)
    ├── SDK Layer      → llmSdk.ts wrapping @heyputer/puter.js
    └── Puter Gateway  → External free AI proxy (network call)
```

---

## Architectural Style

The project follows a **reactive state machine** pattern, not an event-driven architecture.

| Term | Reality in this project |
|---|---|
| "Events" | Redux actions — plain objects dispatched synchronously |
| "Subscribers" | React components re-rendering on state diffs via `useAppSelector` |
| "Side effects" | Inline async handlers in `ChatView`, not middleware |
| "Event bus" | Does not exist — callers always know what they dispatch |

The closest thing to pub/sub is `llmSdk.ts` receiving `dispatch` as a dependency-injected argument and calling `addLog` as a fire-and-forget side effect inside `finally`. This is still a direct function call, not a decoupled event.

---

## Directory Structure

```
src/
├── components/
│   ├── chat/               # Chat interface
│   │   ├── ChatView.tsx        — main send/receive/stream logic
│   │   ├── MessageBubble.tsx   — renders a single message
│   │   └── SettingsPanel.tsx   — model, streaming, PII toggles
│   ├── conversations/
│   │   └── ConversationsView.tsx — history list, resume/delete
│   ├── dashboard/
│   │   └── dashboardView.tsx   — metrics, charts, recent activity
│   ├── layout/
│   │   ├── Sidebar.tsx         — nav + collapse toggle
│   │   └── Header.tsx          — title, log count badge, theme toggle
│   ├── logs/
│   │   └── LogsView.tsx        — filterable inference log table
│   ├── ui/                     — shadcn/ui primitives (button, card, etc.)
│   └── theme-provider.tsx      — dark/light theme via CSS variables
├── helpers/
│   ├── chartHelpers.ts         — per-minute time-series bucketing
│   ├── conversationHelpers.ts  — status colors, date formatting
│   ├── logHelpers.tsx          — log status badges, timestamp display
│   └── modelHelpers.ts         — deterministic color palette, label lookup
├── sdk/
│   └── llmSdk.ts               — Puter.js wrapper, PII redaction, log dispatch
├── store/
│   ├── index.ts                — configureStore (4 slices)
│   ├── hooks.ts                — typed useAppDispatch / useAppSelector
│   └── slices/
│       ├── conversationsSlice.ts  — conversation CRUD + streaming state
│       ├── logsSlice.ts           — inference log list + filters (max 500)
│       ├── settingsSlice.ts       — model, streaming, PII settings
│       └── uiSlice.ts             — active view, sidebar open, selected log
└── types/
    └── index.ts                — shared TypeScript interfaces
```

---

## State Design

Four independent Redux slices compose the entire app state.

```
RootState
├── ui
│   ├── activeView: "chat" | "logs" | "conversations" | "dashboard"
│   ├── sidebarOpen: boolean
│   └── selectedLogId: string | null
│
├── settings
│   ├── defaultProvider: "puter"
│   ├── defaultModel: string
│   ├── streamingEnabled: boolean
│   └── piiRedactionEnabled: boolean
│
├── conversations
│   ├── items: Conversation[]      — full message history
│   ├── activeConversationId: string | null
│   ├── isLoading: boolean
│   └── streamingMessageId: string | null
│
└── logs
    ├── items: InferenceLog[]      — capped at 500 entries, newest first
    └── filter: { model, status, search }
```

Slices have no cross-slice dependencies. They are deliberately isolated — the `logs` slice never reads from `conversations`, and vice versa.

---

## Data Flow — Sending a Message

```
User types → presses Enter
        │
        ▼
ChatView.handleSend()
  ├── dispatch(createConversation)    → conversations slice
  ├── dispatch(addMessage) [user]     → conversations slice
  ├── dispatch(addMessage) [streaming placeholder] → conversations slice
  ├── dispatch(setStreamingMessageId)
  ├── dispatch(setLoading(true))
  │
  └── llmCall(messages, convId, { dispatch, model, ... }, onChunk, signal)
          │
          ├── [streaming] puter.ai.chat(..., { stream: true })
          │       └── for await (chunk) → dispatch(updateStreamingMessage)
          │                               → re-renders MessageBubble live
          │
          ├── [non-streaming] puter.ai.chat(...)
          │       └── single response → dispatch(updateStreamingMessage)
          │
          └── finally (always runs)
                  ├── dispatch(addLog)               → logs slice
                  └── (returns to ChatView)
                          ├── dispatch(finalizeStreamingMessage)
                          └── dispatch(setLoading(false))
```

---

## Data Flow — Cancelling a Request

```
User clicks Cancel button
        │
        ▼
ChatView.handleCancel()
  ├── abortRef.current.abort()           → throws AbortError in llmCall
  ├── dispatch(cancelConversation)
  │       └── removes streaming message, sets status = "cancelled"
  └── dispatch(setLoading(false))

llmCall catch block
  └── detects AbortError → status = "cancelled" → dispatch(addLog) in finally
```

---

## SDK Layer (`llmSdk.ts`)

The SDK is a thin wrapper, not an abstraction. It handles three responsibilities:

1. **PII Redaction** — regex scrub of emails, phones, SSNs, card numbers before storing previews
2. **Puter.js call** — translates internal `Message[]` to OpenAI-style format, handles both streaming and non-streaming paths
3. **Log dispatch** — always fires `addLog` in `finally` with latency, token estimates, status, and previews

Token counts are **estimated** (chars / 4) since Puter.js does not expose usage data from its SDK yet.

---

## Routing

There is no URL-based router (no React Router). Navigation is purely state-driven:

```
ui.activeView  →  ViewRouter (App.tsx)  →  renders one of:
    "chat"           →  ChatView
    "logs"           →  LogsView
    "conversations"  →  ConversationsView
    "dashboard"      →  DashboardView
```

Sidebar dispatches `setActiveView`. The URL never changes.

---

## Rendering Architecture

```
App
├── Sidebar          — reads ui.activeView, ui.sidebarOpen
├── Header           — reads ui.activeView, logs.items.length
└── ViewRouter
    ├── ChatView     — reads conversations.*, settings.*
    │   ├── MessageBubble (per message)
    │   └── SettingsPanel
    ├── LogsView     — reads logs.items, logs.filter
    ├── ConversationsView — reads conversations.items
    └── DashboardView     — reads logs.items (derives all metrics via useMemo)
```

DashboardView is the only component that performs **derived computation** — all chart data and metrics are computed inside a single `useMemo` over `logs.items`. No selectors are memoized outside components.

---

## Theme

Theme is handled by `ThemeProvider` (wraps the app in `main.tsx`) using CSS custom properties. It reads from `localStorage` and applies a `dark` class to the root element. Redux is not involved — theme is the only piece of state that persists across page refreshes.

---

## Key Constraints and Known Limitations

| Constraint | Detail |
|---|---|
| No persistence | All state resets on page refresh (Redux is in-memory only) |
| No backend | Puter.js handles all AI calls from the browser |
| Token estimates | 4 chars ≈ 1 token; actual usage not available from Puter SDK |
| Log cap | `logsSlice` keeps a maximum of 500 entries |
| Single provider | `Provider` type exists for future expansion; only `"puter"` is implemented |
| No URL routing | Navigation is `ui.activeView` state only |
| Streaming abort | Uses browser `AbortController`; Puter may or may not honour mid-stream cancellation depending on the underlying model |

---

## Dependency Map

```
Component layer
    └── uses → store/hooks (useAppSelector, useAppDispatch)
    └── uses → sdk/llmSdk (llmCall, PUTER_MODELS)
    └── uses → helpers/* (pure utility functions)
    └── uses → components/ui/* (shadcn primitives)

SDK layer
    └── uses → @heyputer/puter.js (external, browser-only)
    └── uses → store (dispatch injected, never imported directly)

Store layer
    └── uses → @reduxjs/toolkit
    └── no imports from components or SDK

Helpers
    └── pure functions, no imports from store or SDK
```

The store never imports from components or the SDK. The SDK never imports from components. This keeps the dependency graph acyclic and layers cleanly separated.
