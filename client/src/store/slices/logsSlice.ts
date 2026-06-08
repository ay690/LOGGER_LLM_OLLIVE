import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit"
import type { InferenceLog } from "@/types"
import { logsApi } from "@/api/client"

interface LogsState {
  items: InferenceLog[]
  filter: {
    model: string
    status: string
    search: string
  }
  syncing: boolean
}

const initialState: LogsState = {
  items: [],
  filter: {
    model: "all",
    status: "all",
    search: "",
  },
  syncing: false,
}

// ─── Async thunks ─────────────────────────────────────────────────────────────

/** Load logs from the backend on mount (LogsView). */
export const loadLogs = createAsyncThunk(
  "logs/loadLogs",
  async (params?: { model?: string; status?: string; search?: string; page?: number; limit?: number }) => {
    const { data } = await logsApi.list(params)
    return data
  }
)

/** Fire-and-forget: persist a single inference log to the backend.
 *  The local Redux store is already updated by addLog — this just syncs to DB. */
export const syncLog = createAsyncThunk(
  "logs/syncLog",
  async (log: InferenceLog) => {
    await logsApi.ingest({
      id: log.id,
      conversationId: log.conversationId,
      sessionId: log.sessionId,
      provider: log.provider,
      model: log.model,
      requestTimestamp: log.requestTimestamp,
      responseTimestamp: log.responseTimestamp,
      latencyMs: log.latencyMs,
      promptTokens: log.promptTokens,
      completionTokens: log.completionTokens,
      totalTokens: log.totalTokens,
      status: log.status,
      errorMessage: log.errorMessage,
      inputPreview: log.inputPreview,
      outputPreview: log.outputPreview,
      requestId: log.requestId,
    })
  }
)

// ─── Slice ────────────────────────────────────────────────────────────────────
const logsSlice = createSlice({
  name: "logs",
  initialState,
  reducers: {
    addLog(state, action: PayloadAction<InferenceLog>) {
      state.items.unshift(action.payload)
      if (state.items.length > 500) {
        state.items = state.items.slice(0, 500)
      }
    },

    setFilter(state, action: PayloadAction<Partial<LogsState["filter"]>>) {
      state.filter = { ...state.filter, ...action.payload }
    },

    clearLogs(state) {
      state.items = []
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(loadLogs.pending, (state) => { state.syncing = true })
      .addCase(loadLogs.fulfilled, (state, action) => {
        state.syncing = false
        // Map API shape (llmModel) back to frontend InferenceLog shape (model)
        const fetched: InferenceLog[] = action.payload.map((l) => ({
          id: l._id,
          conversationId: l.conversationId,
          sessionId: l.sessionId,
          provider: l.provider as InferenceLog["provider"],
          model: l.llmModel,
          requestTimestamp: l.requestTimestamp,
          responseTimestamp: l.responseTimestamp,
          latencyMs: l.latencyMs,
          promptTokens: l.promptTokens,
          completionTokens: l.completionTokens,
          totalTokens: l.totalTokens,
          status: l.status,
          errorMessage: l.errorMessage,
          inputPreview: l.inputPreview,
          outputPreview: l.outputPreview,
          requestId: l.requestId,
        }))

        // Merge: keep any local logs that aren't in the fetched set (not yet synced),
        // then append fetched results. Deduplicate by id.
        const fetchedIds = new Set(fetched.map((l) => l.id))
        const localOnly = state.items.filter((l) => !fetchedIds.has(l.id))
        const merged = [...localOnly, ...fetched]
        // Sort newest-first and cap at 500
        merged.sort(
          (a, b) => new Date(b.requestTimestamp).getTime() - new Date(a.requestTimestamp).getTime()
        )
        state.items = merged.slice(0, 500)
      })
      .addCase(loadLogs.rejected, (state) => { state.syncing = false })
      .addCase(syncLog.pending, (state) => { state.syncing = true })
      .addCase(syncLog.fulfilled, (state) => { state.syncing = false })
      .addCase(syncLog.rejected, (state) => { state.syncing = false })
  },
})

export const { addLog, setFilter, clearLogs } = logsSlice.actions
export default logsSlice.reducer
