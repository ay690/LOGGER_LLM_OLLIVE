# Architecture — LLM Logger

## 1. System overview

LLM Logger is a full-stack application split into two independently runnable processes.

```
┌──────────────────────────────────────────────────────────────────┐
│                         Browser                                   │
│                                                                   │
│  React SPA (Vite :5173)                                          │
│  ├── Redux store     — in-memory, hydrated from MongoDB on boot  │
│  ├── llmSdk.ts       — Puter.js wrapper, PII redaction           │
│  └── api/client.ts   — typed fetch client → Express              │
│              │                          │                         │
└──────────────┼──────────────────────────┼─────────────────────────┘
               │                          │
               ▼                          ▼
      Puter.js AI Gateway         Express API (:3001)
      (external, browser-only)         │
                                   MongoDB Atlas
                                   db: logger_llm
```

The client is **optimistic**: every user action updates Redux immediately and syncs to the backend as a fire-and-forget side effect. The UI never blocks on a network call.

---

## 2. Repository layout

```
logger_llm/
├── client/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts             — all fetch calls, three namespaces
│   │   ├── components/
│   │   │   ├── chat/
│   │   │   │   ├── ChatView.tsx       — send/stream/cancel orchestration
│   │   │   │   ├── MessageBubble.tsx  — single message renderer
│   │   │   │   └── SettingsPanel.tsx  — model picker + toggles
│   │   │   ├── conversations/
│   │   │   │   └── ConversationsView.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── dashboardView.tsx
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.tsx
│   │   │   │   └── Header.tsx
│   │   │   ├── logs/
│   │   │   │   └── LogsView.tsx
│   │   │   └── ui/                   — shadcn/ui primitives
│   │   ├── helpers/
│   │   │   ├── chartHelpers.ts       — bucketByMinute()
│   │   │   ├── conversationHelpers.ts — statusColor(), formatDate()
│   │   │   ├── logHelpers.tsx        — statusBadge(), formatTs()
│   │   │   └── modelHelpers.ts       — stableColor(), shortLabel()
│   │   ├── sdk/
│   │   │   └── llmSdk.ts             — Puter.js, PII redaction, log dispatch
│   │   ├── store/
│   │   │   ├── index.ts              — configureStore (4 slices)
│   │   │   ├── hooks.ts              — useAppDispatch, useAppSelector
│   │   │   └── slices/
│   │   │       ├── conversationsSlice.ts
│   │   │       ├── logsSlice.ts
│   │   │       ├── settingsSlice.ts
│   │   │       └── uiSlice.ts
│   │   ├── types/
│   │   │   └── index.ts              — Provider, View, Message, Conversation, InferenceLog, DashboardMetrics
│   │   ├── App.tsx
│   │   └── main.tsx                  — bootstrap + root render
│   └── package.json
│
├── server/
│   ├── src/
│   │   ├── models/
│   │   │   ├── Conversation.ts
│   │   │   ├── InferenceLog.ts
│   │   │   └── UserSettings.ts
│   │   ├── routes/
│   │   │   ├── conversations.ts
│   │   │   ├── logs.ts
│   │   │   └── settings.ts
│   │   ├── middleware/
│   │   │   ├── validate.ts           — Zod middleware factory
│   │   │   ├── asyncHandler.ts       — promise rejection forwarder
│   │   │   └── errorHandler.ts       — global 4-param error handler
│   │   ├── validators/
│   │   │   └── schemas.ts            — all Zod schemas
│   │   ├── db.ts                     — singleton Mongoose connection
│   │   └── index.ts                  — Express app entry point
│   └── package.json
│
├── docker-compose.yml
├── README.md
└── ARCHITECTURE.md
```

---

## 3. Shared type system

All interfaces live in `client/src/types/index.ts`. The server has its own parallel interfaces in its Mongoose model files (`IConversation`, `IInferenceLog`, `IUserSettings`). The API client (`api/client.ts`) defines a third set of response shapes (`ApiConversation`, `ApiLog`, `ApiSettings`) that bridge the gap — mapping the server's `llmModel` field back to the frontend's `model` field.

```
client types/index.ts                 server models/
─────────────────────                 ──────────────
Message                               IMessage (sub-document, no _id)
  id: string                            id, role, content, timestamp: Date
  role: MessageRole
  content: string
  timestamp: string (ISO)
  isStreaming?: boolean               ← transient, never persisted

Conversation                          IConversation
  id: string                            _id: string (nanoid from client)
  title: string                         title, llmModel (≠ model), provider
  model: string           ←────────→    llmModel: string
  provider: Provider                    status, messages: IMessage[]
  status: "active"|...                  createdAt, updatedAt: Date
  messages: Message[]
  createdAt, updatedAt: string

InferenceLog                          IInferenceLog
  id: string                            _id: string
  model: string           ←────────→    llmModel: string
  status: "success"|...                 all other fields match
  ...                                   requestId: string (unique index)
```

The `llmModel` rename exists because Mongoose's `Document` base class has a `.model()` method — naming the schema field `model` causes a TypeScript conflict.

---

## 4. Client architecture

### 4.1 Bootstrap sequence

```
main.tsx
  │
  ├── store.dispatch(loadSettings())      GET /api/settings
  ├── store.dispatch(loadConversations()) GET /api/conversations
  │         both: .catch(() => {})  ← swallowed; app works offline
  │
  └── .finally(() =>
        createRoot(root).render(
          StrictMode
            Provider(store)
              ThemeProvider        ← reads localStorage, sets CSS class
                App
        )
      )
```

Settings and conversations are hydrated before the first render so `ChatView` never sees a flash of wrong defaults. If the backend is unreachable both calls fail silently and the store starts from hardcoded defaults.

### 4.2 Redux store shape

```
RootState
│
├── ui                               (uiSlice — no async thunks)
│   ├── activeView: View             default "chat"
│   ├── sidebarOpen: boolean         default true
│   └── selectedLogId: string|null
│
├── settings                         (settingsSlice)
│   ├── defaultProvider: "puter"
│   ├── defaultModel: string         default "gpt-4o-mini"
│   ├── streamingEnabled: boolean    default true
│   ├── piiRedactionEnabled: boolean default false
│   └── syncing: boolean
│
├── conversations                    (conversationsSlice)
│   ├── items: Conversation[]        newest-first (unshift on create)
│   ├── activeConversationId: string|null
│   ├── isLoading: boolean           true during llmCall
│   ├── streamingMessageId: string|null
│   └── syncing: boolean
│
└── logs                             (logsSlice)
    ├── items: InferenceLog[]        newest-first, capped at 500
    ├── filter: { model, status, search }
    └── syncing: boolean
```

Slices are deliberately isolated — no slice reads from another slice's state.

### 4.3 Async thunks per slice

**conversationsSlice**

| Thunk | API call | When dispatched |
|---|---|---|
| `loadConversations` | `GET /api/conversations` | `main.tsx` bootstrap |
| `syncCreateConversation(conv)` | `POST /api/conversations` | `ChatView` on new conversation |
| `syncAddMessage({ convId, msg })` | `POST /api/conversations/:id/messages` | `ChatView` per user message + completed assistant message |
| `syncConversationStatus({ id, status })` | `PATCH /api/conversations/:id/status` | `ChatView.handleCancel`, `ConversationsView.handleCancel` |
| `syncDeleteConversation(id)` | `DELETE /api/conversations/:id` | `ConversationsView.handleDelete` |

**logsSlice**

| Thunk | API call | When dispatched |
|---|---|---|
| `loadLogs(params?)` | `GET /api/logs` | `LogsView` mount, `ConversationsView` mount, `DashboardView` mount |
| `syncLog(log)` | `POST /api/logs` | `llmSdk.ts` `finally` block — always, regardless of outcome |

**settingsSlice**

| Thunk | API call | When dispatched |
|---|---|---|
| `loadSettings` | `GET /api/settings` | `main.tsx` bootstrap |
| `syncSettings(patch)` | `PATCH /api/settings` | `SettingsPanel` on every model/toggle change |

### 4.4 Data flow — sending a message

```
User types → presses Enter (or clicks Send)
        │
        ▼
ChatView.handleSend()
  │
  ├── guard: !text || isLoading → return
  │
  ├── [no active conv OR conv is cancelled]
  │     conv = buildConversation()          ← nanoid id, current model, now timestamps
  │     dispatch(createConversation)        → Redux: unshift to items, set activeId
  │     dispatch(syncCreateConversation)    → POST /api/conversations (fire-and-forget)
  │
  ├── dispatch(setLoading(true))
  │
  ├── userMsg = { id: nanoid(), role: "user", content, timestamp }
  │   dispatch(addMessage({ convId, userMsg }))   → Redux: push, auto-title if first msg
  │   dispatch(syncAddMessage({ convId, msg }))   → POST /api/conversations/:id/messages
  │
  ├── assistantMsg = { id: nanoid(), role: "assistant", content: "", isStreaming: true }
  │   dispatch(addMessage({ convId, assistantMsg })) → Redux: push streaming placeholder
  │   dispatch(setStreamingMessageId(assistantMsgId))
  │
  ├── abortRef.current = new AbortController()
  │   streamingContentRef.current = ""
  │
  └── llmCall(last10msgs + userMsg, convId, config, onChunk, signal)
            │
            ├── [streaming] puter.ai.chat(messages, { model, stream: true })
            │     for await (part of response)
            │       chunk = part.text ?? ""
            │       streamingContentRef.current += chunk
            │       dispatch(updateStreamingMessage({ convId, msgId, content }))
            │                 → Redux: mutates msg.content in-place → React re-renders
            │
            ├── [non-streaming] puter.ai.chat(messages, { model })
            │     content = extractText(response)
            │     dispatch(updateStreamingMessage) once
            │
            └── finally (always — success, error, or abort)
                  latencyMs = performance.now() - startTime
                  logEntry = { id: nanoid(), status, latencyMs, tokens, previews, ... }
                  dispatch(addLog(logEntry))    → Redux logs slice (sync, instant)
                  dispatch(syncLog(logEntry))   → POST /api/logs (async, fire-and-forget)

  ChatView finally block:
    dispatch(finalizeStreamingMessage)      → sets isStreaming: false, clears streamingId
    if (streamingContentRef.current)        ← only if assistant produced content
      dispatch(syncAddMessage(assistantMsg with finalContent))
    dispatch(setLoading(false))
```

### 4.5 Data flow — cancellation

```
User clicks Cancel (Square button)
        │
        ▼
ChatView.handleCancel()
  ├── abortRef.current.abort()
  │       └── AbortSignal fires inside llmCall
  │             └── DOMException "AbortError" caught
  │                   status = "cancelled"
  │                   errorMessage = "Request cancelled by user"
  │                   finally fires → dispatch(addLog) + dispatch(syncLog)
  │
  ├── dispatch(cancelConversation(convId))
  │       └── Redux: status → "cancelled", removes isStreaming messages,
  │                  streamingMessageId = null, isLoading = false
  │
  └── dispatch(syncConversationStatus({ id, status: "cancelled" }))
            → PATCH /api/conversations/:id/status
```

### 4.6 SDK layer in detail (`sdk/llmSdk.ts`)

The SDK has three responsibilities and no others:

**1. PII redaction** (`redactPII(text)`)
Applied to `inputPreview` and `outputPreview` only — never to content sent to the model.

| Pattern | Replacement |
|---|---|
| Email `[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}` | `[EMAIL]` |
| Phone `\d{3}[-.\s]?\d{3}[-.\s]?\d{4}` | `[PHONE]` |
| SSN `\d{3}-\d{2}-\d{4}` | `[SSN]` |
| Card `(?:\d[ -]?){13,16}` | `[CARD]` |

Previews are always truncated to 500 chars after redaction to match the server schema limit.

**2. Puter.js call**

```
puter.ai.chat(
  messages: [{ role, content }],   ← OpenAI-style array
  { model: string, stream?: true }
)
```

Streaming returns an async iterable. Each part has a `.text` property. The SDK accumulates chunks into `content` and calls `onChunk(chunk)` per part.

Non-streaming returns a response object. `extractText()` handles both `response.message.content` (string or array of `{ text }`) and a direct string fallback.

**3. Log construction and dispatch**

Token estimation: `Math.ceil(chars / 4)`. Prompt tokens are estimated before the request so error logs carry real values. Completion tokens are calculated after.

```
finally {
  logEntry: InferenceLog = {
    id:               nanoid()            ← log identity
    requestId:        nanoid()            ← idempotency key for dedup
    conversationId:   passed in
    sessionId:        same as conversationId (future-proofed)
    provider:         "puter"
    model:            config.model
    requestTimestamp: ISO before call
    responseTimestamp: ISO after finally
    latencyMs:        performance.now() delta
    promptTokens:     estimated pre-call
    completionTokens: estimated post-call
    totalTokens:      sum
    status:           "success" | "error" | "cancelled"
    errorMessage:     set in catch block
    inputPreview:     redacted + sliced to 500
    outputPreview:    redacted + sliced to 500
  }
  dispatch(addLog(logEntry))   // sync — UI sees it immediately
  dispatch(syncLog(logEntry))  // async — persists to MongoDB
}
```

### 4.7 API client (`api/client.ts`)

Single `req<T>(path, options?)` function wraps all `fetch` calls. Throws on non-2xx with the server's `error` field as the message. Three exported namespaces:

```
conversationsApi.list()                     GET  /conversations
conversationsApi.create(payload)            POST /conversations
conversationsApi.get(id)                    GET  /conversations/:id
conversationsApi.addMessage(id, message)    POST /conversations/:id/messages
conversationsApi.updateStatus(id, status)   PATCH /conversations/:id/status
conversationsApi.delete(id)                 DELETE /conversations/:id

logsApi.ingest(log)                         POST /logs
logsApi.list(params?)                       GET  /logs?model=&status=&search=&page=&limit=

settingsApi.get()                           GET  /settings
settingsApi.update(patch)                   PATCH /settings
```

### 4.8 loadLogs merge strategy

When `loadLogs.fulfilled` fires, it doesn't blindly replace `state.items`. Instead:

```
fetched = API response (mapped to InferenceLog shape)
fetchedIds = new Set(fetched.map(l => l.id))

localOnly = state.items.filter(l => !fetchedIds.has(l.id))
// ^ logs dispatched locally but not yet synced (e.g. just sent a message)

merged = [...localOnly, ...fetched]
merged.sort((a, b) => b.requestTimestamp - a.requestTimestamp)
state.items = merged.slice(0, 500)
```

This prevents log loss when the user sends a message and then navigates to the Logs or Dashboard view before `syncLog` completes.

### 4.9 Routing

No URL router. `App.tsx` renders a `ViewRouter` switch on `ui.activeView`:

```
"chat"           → ChatView
"logs"           → LogsView
"conversations"  → ConversationsView
"dashboard"      → DashboardView
```

`Sidebar` dispatches `setActiveView(view)`. The URL never changes.

### 4.10 Component responsibilities

| Component | Redux reads | Redux writes | On mount |
|---|---|---|---|
| `App` | — | — | — |
| `Sidebar` | `ui.activeView`, `ui.sidebarOpen` | `setActiveView`, `toggleSidebar` | — |
| `Header` | `ui.activeView`, `logs.items.length` | — | — |
| `ChatView` | `conversations.*`, `settings.*` | conversations + settings thunks | creates conv if none |
| `MessageBubble` | prop only | — | — |
| `SettingsPanel` | `settings.*` | `setDefault*`, `syncSettings` | — |
| `ConversationsView` | `conversations.items`, `activeId` | `setActiveConversation`, cancel/delete thunks | `loadLogs()` |
| `LogsView` | `logs.items`, `logs.filter`, `logs.syncing` | `setFilter`, `clearLogs`, `loadLogs` | `loadLogs()` |
| `DashboardView` | `logs.items`, `logs.syncing` | `loadLogs` | `loadLogs({ limit: 500 })` |

### 4.11 Dashboard metrics computation

`DashboardView` derives all metrics locally via a single `useMemo(logs => ...)`:

```
total     = logs.length
success   = logs.filter(l => l.status === "success").length
errors    = logs.filter(l => l.status === "error").length
avgLatency = sum(latencyMs) / total
totalTokens = sum(totalTokens)

modelBreakdown = reduce by l.model → { [model]: count }
modelPie = sorted entries → [{ model, label, value, color }]
  label = shortLabel(model)   ← looks up PUTER_MODELS display name
  color = stableColor(model)  ← deterministic hash of model string → palette[i]

timeSeries = bucketByMinute(logs)
  → sort oldest-first
  → group by "HH:MM" key
  → take last 15 buckets
  → [{ time, latency (avg), requests, errors, tokens }]
```

Charts rendered with Recharts: `AreaChart` (latency, errors, tokens), `BarChart` (throughput), `PieChart` with donut (model breakdown).

### 4.12 Client dependency rules

```
components   →  store/hooks, sdk/llmSdk, helpers/*, components/ui/*
sdk          →  @heyputer/puter.js
             →  store (AppDispatch injected as argument — never imported directly)
store slices →  api/client
api/client   →  fetch (browser native)
helpers      →  pure functions, zero external dependencies
```

The store never imports from components or the SDK. The SDK never imports from components. The graph is acyclic.

---

## 5. Server architecture

### 5.1 Entry point and middleware stack

```
server/src/index.ts
  │
  ├── connectDB()                     ← must succeed before app.listen
  │
  └── Express app
        ├── cors({ origin: ["localhost:5173", "localhost:4173"],
        │          methods: GET POST PATCH DELETE })
        ├── express.json({ limit: "1mb" })
        │
        ├── GET /health → { status: "ok", timestamp }
        ├── /api/conversations  → conversationsRouter
        ├── /api/logs           → logsRouter
        ├── /api/settings       → settingsRouter
        │
        ├── 404 catch-all       → { error: "Not found" }
        └── errorHandler        ← must be last, 4-param signature
```

Every async route handler is wrapped with `asyncHandler(fn)`:

```ts
// asyncHandler.ts
return (req, res, next) => fn(req, res, next).catch(next)
// Forwards any promise rejection to errorHandler instead of crashing
```

`errorHandler` logic:
- `err.code === 11000` (MongoDB duplicate key) → 409
- `err.statusCode ?? 500`; production 500s return generic message
- Always logs `[ERROR] message + stack` to console

### 5.2 Validation middleware

`validate(schema: ZodSchema)` is a middleware factory:

```ts
const result = schema.safeParse(req.body)
// failure → 400 { error: "Validation failed", details: [{ field, message }] }
// success → req.body = result.data  (Zod coerces + applies defaults)
//           next()
```

Zod defaults applied server-side: `provider = "puter"`, `status = "active"`, `messages = []`, `inputPreview = ""`, `outputPreview = ""`. This means clients don't need to send optional fields.

### 5.3 MongoDB connection (`db.ts`)

Singleton pattern via module-level `isConnected` flag. Connects to `process.env.MONGODB_URI` with `dbName: "logger_llm"` (explicit, ignores URI path). Registers `error` and `disconnected` listeners that reset the flag. The `main()` function in `index.ts` awaits `connectDB()` — if it throws, the process exits.

### 5.4 MongoDB collections and schemas

**`conversations`**

```
_id:        String  (nanoid from client, not ObjectId)
title:      String  (required, trim, maxlength 200)
llmModel:   String  (required, trim)
provider:   String  (default "puter")
status:     String  (enum: active | cancelled | completed, default "active")
messages: [{
  id:        String  (required, no sub-document _id)
  role:      String  (enum: system | user | assistant)
  content:   String  (required)
  timestamp: Date    (required)
}]
createdAt:  Date    (auto via timestamps: true)
updatedAt:  Date    (auto via timestamps: true)

virtual: messageCount = messages.length

indexes:
  { updatedAt: -1 }                  — list view, newest first
  { status: 1, updatedAt: -1 }       — filter by status + recency
```

Messages are embedded (not a separate collection) because they are always loaded together with the conversation. The 16 MB BSON limit is not a practical concern for chat history.

**`inferencelogs`**

```
_id:               String  (nanoid log.id)
conversationId:    String  (ref → conversations._id)
sessionId:         String  (currently = conversationId; reserved for future session concept)
provider:          String  (default "puter")
llmModel:          String  (required)
requestTimestamp:  Date    (required)
responseTimestamp: Date    (required)
latencyMs:         Number  (required, min 0)
promptTokens:      Number  (required, min 0)
completionTokens:  Number  (required, min 0)
totalTokens:       Number  (required, min 0)
status:            String  (enum: success | error | cancelled)
errorMessage:      String  (optional)
inputPreview:      String  (required, maxlength 500)
outputPreview:     String  (required, maxlength 500)
requestId:         String  (required)

timestamps: false — requestTimestamp/responseTimestamp carry all time data

indexes:
  { conversationId, requestTimestamp: -1 }  — per-conversation log queries
  { requestTimestamp: -1 }                  — dashboard time-series
  { llmModel, requestTimestamp: -1 }        — model filter in LogsView
  { status, requestTimestamp: -1 }          — status filter in LogsView
  { requestId }  UNIQUE                     — idempotency dedup
```

**`usersettings`**

```
userId:              String  (unique, default "default")
defaultProvider:     String  (default "puter")
defaultModel:        String  (default "gpt-4o-mini")
streamingEnabled:    Boolean (default true)
piiRedactionEnabled: Boolean (default false)
createdAt / updatedAt: Date  (auto via timestamps: true)
```

Single document per user. `userId = "default"` until auth is added.

### 5.5 Ingestion pipeline (POST /api/logs)

```
POST /api/logs
  │
  ▼
validate(IngestLogSchema)
  │  Zod checks: nanoid IDs, ISO dates, int tokens ≥ 0, status enum,
  │              errorMessage truncated to 2000 via .transform(),
  │              inputPreview/outputPreview default "" (empty ok — error logs)
  │  400 on failure with field-level errors
  ▼
findOne({ requestId: body.requestId })
  │  exists → 200 { data: existing, duplicate: true }  (idempotent)
  ▼
new InferenceLog({ _id: body.id, llmModel: body.model, ... })
  │
InferenceLog.save()
  │
201 { data: log }
```

Batch ingestion (`POST /api/logs/batch`) accepts up to 50 logs. It collects existing `requestId`s in a single `find`, filters new ones, then calls `insertMany({ ordered: false })` — partial failures don't abort the batch.

### 5.6 Conversation routes

| Method | Path | Key logic |
|---|---|---|
| `GET` | `/api/conversations` | Aggregation: `$project` all fields + `{ $size: "$messages" }` as `messageCount`, sorted `updatedAt: -1`. Message content excluded for performance. |
| `POST` | `/api/conversations` | Validated by `CreateConversationSchema`. `_id` set from client nanoid, `llmModel` from `body.model`. |
| `GET` | `/api/conversations/:id` | `findById` with full message array. |
| `POST` | `/api/conversations/:id/messages` | `findByIdAndUpdate` with `$push: { messages: msg }` + `$set: { updatedAt: new Date() }`. |
| `PATCH` | `/api/conversations/:id/status` | `findByIdAndUpdate $set { status, updatedAt }`. |
| `DELETE` | `/api/conversations/:id` | `findByIdAndDelete` — cascades to messages (embedded). |

### 5.7 Stats aggregation (GET /api/logs/stats)

Four aggregation pipelines run in `Promise.all`:

```
Pipeline 1 — Summary (default: last 24h via ?since= ISO param)
  $match requestTimestamp >= since
  $group _id:null
    totalRequests: $sum 1
    successCount:  $sum { $cond [status=="success", 1, 0] }
    errorCount:    $sum { $cond [status=="error",   1, 0] }
    cancelledCount:$sum { $cond [status=="cancelled",1,0] }
    avgLatencyMs:  $avg latencyMs
    totalTokens:   $sum totalTokens
    totalPromptTokens, totalCompletionTokens

Pipeline 2 — By model
  $match same window
  $group _id:llmModel → count, totalTokens, avgLatency
  $sort count:-1

Pipeline 3 — By status
  $match same window
  $group _id:status → count

Pipeline 4 — Time series (always last 60 minutes)
  $match requestTimestamp >= now-60min
  $group _id:{ year, month, day, hour, minute }
    requests, errors (conditional sum), avgLatency, tokens
  $sort chronological (year,month,day,hour,minute all asc)
```

Response shape:
```json
{
  "data": {
    "summary": { totalRequests, successRate, errorCount, cancelledCount,
                 avgLatencyMs, totalTokens, totalPromptTokens, totalCompletionTokens },
    "byModel":  [{ _id, count, totalTokens, avgLatency }],
    "byStatus": [{ _id, count }],
    "timeSeries": [{ time: "HH:MM", requests, errors, latency, tokens }]
  }
}
```

### 5.8 Zod schema reference

```
nanoidString  = string.min(1).max(64).regex(/^[\w-]+$/)
isoDate       = string.datetime()

MessageSchema
  id: nanoidString, role: enum, content: string(1–100k), timestamp: isoDate

CreateConversationSchema
  id, title(1–200,default "New Conversation"), model(1–100), provider(default "puter"),
  status(default "active"), messages([MessageSchema],default []), createdAt, updatedAt

AddMessageSchema
  message: MessageSchema

UpdateConversationStatusSchema
  status: enum("active"|"cancelled"|"completed")

IngestLogSchema
  id, conversationId, sessionId: nanoidString
  provider(default "puter"), model(1–100)
  requestTimestamp, responseTimestamp: isoDate
  latencyMs, promptTokens, completionTokens, totalTokens: int≥0
  status: enum
  errorMessage: string.max(2000).optional().transform(v => v?.slice(0,2000))
  inputPreview: string.max(500).default("")
  outputPreview: string.max(500).default("")
  requestId: nanoidString

IngestLogBatchSchema
  logs: array(IngestLogSchema).min(1).max(50)

UpdateSettingsSchema
  defaultProvider?, defaultModel?, streamingEnabled?, piiRedactionEnabled?
```

---

## 6. Helper functions

| File | Function | Signature | Purpose |
|---|---|---|---|
| `chartHelpers.ts` | `bucketByMinute` | `(logs: InferenceLog[]) → BucketPoint[]` | Sorts oldest-first, groups by `HH:MM`, returns last 15 buckets with avg latency, request count, error count, token sum |
| `conversationHelpers.ts` | `statusColor` | `(status) → string` | Tailwind class string for status badge (green/destructive/muted) |
| `conversationHelpers.ts` | `formatDate` | `(iso) → string` | `toLocaleString` with month/day/hour/minute options |
| `logHelpers.tsx` | `formatTs` | `(iso) → string` | `toLocaleTimeString` HH:MM:SS |
| `logHelpers.tsx` | `statusBadge` | `(status) → JSX.Element` | Colored shadcn Badge (success=green, error=destructive, cancelled=amber) |
| `modelHelpers.ts` | `stableColor` | `(str) → string` | Deterministic hash of string → `PALETTE[i]` (15-color array) |
| `modelHelpers.ts` | `shortLabel` | `(modelValue) → string` | Looks up `PUTER_MODELS` label, falls back to raw value |

---

## 7. Supported models

All models proxied through Puter's free AI gateway — no API key required.

| Provider | Model value | Display label |
|---|---|---|
| OpenAI | `gpt-4o-mini` | GPT-4o mini |
| OpenAI | `gpt-4o` | GPT-4o |
| OpenAI | `openai/gpt-4.1` | GPT-4.1 |
| OpenAI | `openai/o4-mini` | o4-mini |
| Anthropic | `claude-sonnet-4-5` | Claude Sonnet 4 |
| Anthropic | `claude-haiku-3-5` | Claude Haiku 3.5 |
| Google | `google/gemini-2.0-flash` | Gemini 2.0 Flash |
| Google | `google/gemini-1.5-pro` | Gemini 1.5 Pro |
| Meta | `meta-llama/llama-3.3-70b-instruct` | Llama 3.3 70B |
| xAI | `x-ai/grok-3-mini-beta` | Grok 3 Mini |
| xAI | `x-ai/grok-3-beta` | Grok 3 |
| Mistral | `mistralai/mistral-large` | Mistral Large |
| Mistral | `mistralai/mistral-small` | Mistral Small |
| DeepSeek | `deepseek/deepseek-r1` | DeepSeek R1 |
| DeepSeek | `deepseek/deepseek-chat-v3-0324` | DeepSeek V3 |

---

## 8. Key design decisions

| Decision | Detail |
|---|---|
| **Optimistic updates** | Every action updates Redux synchronously before the network call. UI never blocks. If sync fails, the app still works — failure is logged to console via `rejectWithValue` in `syncLog`. |
| **Two-phase log dispatch** | `addLog` (sync reducer) gives instant UI feedback. `syncLog` (async thunk) persists to MongoDB. Both run from the SDK's `finally` block so even errors and cancellations are captured. |
| **`requestId` unique index** | Separate from the log's `_id`. Provides natural idempotency — retrying a failed `POST /api/logs` never creates a duplicate. Returns 200 with `duplicate: true`. |
| **`llmModel` field name** | `model` clashes with Mongoose's built-in `Document.model()` method in TypeScript strict mode. Renamed to `llmModel` on both schema and route. The API client maps transparently. |
| **Messages embedded in Conversation** | Always loaded together with the conversation. No join needed. 16 MB BSON limit is not a practical concern for chat. |
| **loadLogs merge strategy** | On `loadLogs.fulfilled`, local-only logs (those not in the fetched set) are preserved to avoid losing unsaved items during navigation. |
| **Bootstrap before render** | `loadSettings` + `loadConversations` run before `ReactDOM.render`. Avoids flash of wrong model defaults in `ChatView` and empty sidebar in `ConversationsView`. |
| **Offline tolerance** | Both bootstrap thunks use `.catch(() => {})`. The app starts with hardcoded defaults if the backend is unreachable. |
| **No URL routing** | Four fixed views, single domain, no need for browser history. `ui.activeView` is the navigation layer. |
| **`syncing` flag per slice** | Each slice exposes a `syncing: boolean` derived from pending/fulfilled/rejected cases. Used by `LogsView` for a pulse indicator and `DashboardView` for its loading state. |

---

## 9. Known limitations

| Item | Detail |
|---|---|
| Token counts | Estimated at `Math.ceil(chars / 4)`. Puter.js does not expose actual usage data from its SDK. |
| Single user | `UserSettings` hardcodes `userId = "default"`. No authentication layer exists. |
| No message deletion | Individual messages cannot be deleted — only the whole conversation. |
| Streaming abort | Uses browser `AbortController`. Mid-stream cancellation behaviour depends on the underlying model via Puter. |
| `Provider` type | `type Provider = "puter"` — designed for expansion; only one value implemented. |
| `sessionId` | Currently identical to `conversationId`. Reserved field for a future multi-turn session concept. |
| Dashboard time window | `bucketByMinute` shows the last 15 minutes of activity from whatever logs are in Redux. For historical analysis beyond that window, `GET /api/logs/stats` supports a `?since=` parameter. |