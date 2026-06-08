# Architecture — LLM Logger

## System overview

LLM Logger is a full-stack application split into two independently runnable processes: a **React SPA** (client) and an **Express + MongoDB API** (server). The client handles the UI and all LLM communication; the server is a pure ingestion and storage layer.

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│                                                  │
│   React SPA (Vite)                               │
│   ├── Redux store  (in-memory, hydrated on boot) │
│   ├── llmSdk.ts   (Puter.js wrapper)             │
│   └── api/client.ts  (fetch → Express API)      │
│                    │              │               │
└────────────────────┼──────────────┼───────────────┘
                     │              │
                     ▼              ▼
             Puter.js AI      Express API
             Gateway          :3001
             (external)          │
                              MongoDB Atlas
```

The client is **optimistic** — every action (create conversation, add message, log an inference) updates the Redux store immediately and then syncs to the backend as a fire-and-forget side effect. The UI never waits for the network.

---

## Repository layout

```
logger_llm/
├── client/                  # React + Vite SPA
│   ├── src/
│   │   ├── api/             # Typed fetch client (all HTTP calls)
│   │   ├── components/      # React components by feature
│   │   ├── helpers/         # Pure utility functions
│   │   ├── sdk/             # Puter.js wrapper + PII redaction
│   │   ├── store/           # Redux slices + typed hooks
│   │   └── types/           # Shared TypeScript interfaces
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
│
├── server/                  # Express + Mongoose API
│   ├── src/
│   │   ├── models/          # Mongoose schemas
│   │   ├── routes/          # Route handlers
│   │   ├── middleware/       # Validation, error handling, async wrapper
│   │   ├── validators/      # Zod schemas
│   │   ├── db.ts            # MongoDB connection
│   │   └── index.ts         # Express app entry point
│   └── package.json
│
├── README.md
└── ARCHITECTURE.md
```

---

## Client architecture

### State design

Four Redux slices compose the entire client state. Slices are deliberately isolated — no slice reads from another.

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
│   ├── piiRedactionEnabled: boolean
│   └── syncing: boolean
│
├── conversations
│   ├── items: Conversation[]         — full message history
│   ├── activeConversationId: string | null
│   ├── isLoading: boolean
│   ├── streamingMessageId: string | null
│   └── syncing: boolean
│
└── logs
    ├── items: InferenceLog[]         — newest-first, capped at 500
    ├── filter: { model, status, search }
    └── syncing: boolean
```

Each slice exports both synchronous reducers (for immediate UI updates) and async thunks (for backend sync). Thunk rejections are logged to the console but never surface as UI errors — the app keeps working offline.

### Bootstrap sequence

```
main.tsx
  └── Promise.all([
        store.dispatch(loadSettings()),      // GET /api/settings
        store.dispatch(loadConversations()), // GET /api/conversations
      ])
        └── .finally(() => ReactDOM.render(...))
```

The app renders only after both fetches resolve or fail. On failure the store starts with hardcoded defaults — fully offline-tolerant.

### Data flow — sending a message

```
User presses Enter
        │
        ▼
ChatView.handleSend()
  ├── [if new conv] dispatch(createConversation)     → store (sync)
  ├──              dispatch(syncCreateConversation)  → POST /api/conversations
  ├── dispatch(addMessage) [user msg]                → store (sync)
  ├── dispatch(syncAddMessage)                       → POST /api/conversations/:id/messages
  ├── dispatch(addMessage) [streaming placeholder]  → store (sync)
  ├── dispatch(setLoading(true))
  │
  └── llmCall(messages, convId, config, onChunk, signal)
          │
          ├── [streaming]  puter.ai.chat(..., { stream: true })
          │       └── for await chunk → dispatch(updateStreamingMessage) → live re-render
          │
          ├── [non-stream] puter.ai.chat(...)
          │       └── response → dispatch(updateStreamingMessage)
          │
          └── finally (always — success, error, or cancel)
                  ├── dispatch(addLog)     → logs slice (sync)
                  └── dispatch(syncLog)   → POST /api/logs (async, fire-and-forget)

  finally (ChatView)
    ├── dispatch(finalizeStreamingMessage)
    ├── [if content] dispatch(syncAddMessage) [assistant msg]  → POST /api/conversations/:id/messages
    └── dispatch(setLoading(false))
```

### Data flow — cancellation

```
User clicks Cancel
        │
        ▼
ChatView.handleCancel()
  ├── abortRef.current.abort()
  │       └── throws AbortError inside llmCall
  │               └── catch → status = "cancelled"
  │               └── finally → dispatch(addLog) + dispatch(syncLog)
  ├── dispatch(cancelConversation)        → removes streaming msg, sets status
  └── dispatch(syncConversationStatus)   → PATCH /api/conversations/:id/status
```

### SDK layer (`sdk/llmSdk.ts`)

The SDK has three responsibilities and no others:

1. **PII redaction** — regex scrub of emails, phones, SSNs, card numbers applied to previews before storage (never to content sent to the model)
2. **Puter.js call** — translates `Message[]` to OpenAI-style format; handles streaming (async iterable) and non-streaming paths
3. **Log dispatch** — always creates an `InferenceLog` in `finally` regardless of outcome, then dispatches `addLog` (sync) and `syncLog` (async)

Token counts are estimated at `Math.ceil(chars / 4)` since Puter.js does not yet expose usage data. Prompt tokens are estimated before the request so error logs still carry meaningful values.

### API client (`api/client.ts`)

All `fetch` calls are centralised here in three namespaces — `conversationsApi`, `logsApi`, `settingsApi`. Components and thunks import from this module and never call `fetch` directly. The client maps between the server's `llmModel` field name and the frontend's `model` field transparently.

### Routing

There is no URL-based router. Navigation is pure state:

```
ui.activeView  →  ViewRouter (App.tsx)  →  renders one of:
    "chat"           →  ChatView
    "logs"           →  LogsView
    "conversations"  →  ConversationsView
    "dashboard"      →  DashboardView
```

The URL never changes.

### Component tree

```
App
├── Sidebar            reads ui.activeView, ui.sidebarOpen
├── Header             reads ui.activeView, logs.items.length
└── ViewRouter
    ├── ChatView        reads conversations.*, settings.*
    │   ├── MessageBubble (per message)
    │   └── SettingsPanel
    ├── LogsView        reads logs.items, logs.filter — loads on mount
    ├── ConversationsView  reads conversations.items — refreshes logs on mount
    └── DashboardView   reads logs.items — loads on mount, derives all metrics via useMemo
```

`DashboardView` is the only component that performs non-trivial derived computation. All chart series, stat cards, and the model breakdown are computed inside a single `useMemo` over `logs.items` with no external memoisation.

### Client dependency rules

```
components  →  store/hooks, sdk/llmSdk, helpers/*, components/ui/*
sdk         →  @heyputer/puter.js, store (dispatch injected — never imported)
store       →  @reduxjs/toolkit, api/client
api/client  →  fetch (browser native)
helpers     →  pure functions, no external dependencies
```

The store never imports from components or the SDK. The SDK never imports from components. The dependency graph is acyclic.

---

## Server architecture

### MongoDB collections

**`conversations`**
```
{
  _id:        String   // nanoid — kept as-is from client
  title:      String
  llmModel:   String   // renamed from 'model' to avoid Mongoose Document.model() clash
  provider:   String
  status:     "active" | "cancelled" | "completed"
  messages: [{
    id:        String
    role:      "system" | "user" | "assistant"
    content:   String
    timestamp: Date
  }]
  createdAt:  Date     // managed by Mongoose timestamps option
  updatedAt:  Date
}
```

Messages are embedded — they are always read together with the conversation and typical conversation length will not approach the 16 MB BSON limit.

**`inferencelogs`**
```
{
  _id:               String   // nanoid log.id
  conversationId:    String   // ref → conversations._id
  sessionId:         String
  provider:          String
  llmModel:          String
  requestTimestamp:  Date
  responseTimestamp: Date
  latencyMs:         Number
  promptTokens:      Number
  completionTokens:  Number
  totalTokens:       Number
  status:            "success" | "error" | "cancelled"
  errorMessage:      String?
  inputPreview:      String   // max 500 chars, PII-redacted on client
  outputPreview:     String   // max 500 chars, PII-redacted on client
  requestId:         String   // unique — used for idempotency
}
```

Indexes:
- `{ conversationId, requestTimestamp: -1 }` — per-conversation log queries
- `{ requestTimestamp: -1 }` — dashboard time-series aggregation
- `{ llmModel, requestTimestamp: -1 }` — model filter
- `{ status, requestTimestamp: -1 }` — status filter
- `{ requestId }` unique — idempotency (duplicate POST returns 200, not 201)

**`usersettings`**
```
{
  userId:             String   // "default" until auth is added
  defaultProvider:    String
  defaultModel:       String
  streamingEnabled:   Boolean
  piiRedactionEnabled: Boolean
}
```

### Ingestion pipeline

```
POST /api/logs
        │
        ▼
validate(IngestLogSchema)          ← Zod: type coercion, length caps, defaults
        │  400 on failure (field-level errors)
        ▼
idempotency check                  ← findOne({ requestId })
        │  200 + { duplicate: true } if exists
        ▼
InferenceLog.save()                ← Mongoose + MongoDB Atlas
        │
        ▼
201 { data: log }
```

`errorMessage` is truncated server-side to 2000 chars by a Zod transform. `inputPreview` and `outputPreview` default to `""` so error logs (where there may be no output) always pass validation.

### Middleware stack

```
Request
  → CORS (whitelist: localhost:5173, localhost:4173)
  → express.json (1 MB limit)
  → route handler
      → validate(ZodSchema)     ← 400 on invalid body
      → asyncHandler(fn)        ← catches promise rejections → next(err)
      → route logic
  → errorHandler                ← 409 on duplicate key, 500 on unhandled errors
```

### Stats aggregation

`GET /api/logs/stats` runs four MongoDB aggregation pipelines in parallel:

1. **Summary** — `$group` total requests, success/error/cancelled counts, avg latency, total tokens
2. **By model** — `$group` on `llmModel`, sorted by count descending
3. **By status** — `$group` on `status`
4. **Time series** — `$group` by `{ year, month, day, hour, minute }` for the last 60 minutes

The frontend's `DashboardView` uses the Redux `logs.items` array (loaded via `GET /api/logs`) and derives the same metrics locally via `bucketByMinute()` — this means the dashboard works offline with locally-cached data and can also be wired to the stats endpoint in future.

---

## Key design decisions

| Decision | Rationale |
|---|---|
| Optimistic updates | UI never blocks on network; log/conversation state is immediately visible even if the backend is down |
| Messages embedded in Conversation | Always fetched together; avoids a join; won't hit the 16 MB BSON limit for typical usage |
| `requestId` unique index | Natural idempotency — retrying a failed POST never creates duplicate logs |
| `llmModel` field name | `model` clashes with Mongoose's built-in `Document.model()` method in TypeScript |
| No URL routing | Single-page tool with four fixed views — a URL router adds no value |
| `loadSettings` before first render | Settings (model, streaming, PII toggle) must be hydrated before `ChatView` initialises to avoid a flash of wrong defaults |
| Bootstrap errors are swallowed | App starts with local defaults if the backend is unreachable — offline-first by design |

---

## Known limitations

| Item | Detail |
|---|---|
| Token counts | Estimated (chars / 4); Puter.js does not expose actual usage data |
| Single user | `UserSettings` uses `userId = "default"`; no auth layer exists yet |
| No message deletion | Messages can only be deleted by deleting the whole conversation |
| Streaming abort | Uses `AbortController`; mid-stream cancellation depends on the underlying model |
| `Provider` type | Exists for future multi-provider support; only `"puter"` is implemented |
