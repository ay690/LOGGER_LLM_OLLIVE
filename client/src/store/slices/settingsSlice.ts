import { createSlice, createAsyncThunk, type PayloadAction } from "@reduxjs/toolkit"
import type { Provider } from "@/types"
import { settingsApi } from "@/api/client"

interface SettingsState {
  defaultProvider: Provider
  defaultModel: string
  streamingEnabled: boolean
  piiRedactionEnabled: boolean
  syncing: boolean
}

const initialState: SettingsState = {
  defaultProvider: "puter",
  defaultModel: "gpt-4o-mini",
  streamingEnabled: true,
  piiRedactionEnabled: false,
  syncing: false,
}

// ─── Async thunks ─────────────────────────────────────────────────────────────

/** Load user settings from the backend on app start. */
export const loadSettings = createAsyncThunk(
  "settings/loadSettings",
  async () => {
    const { data } = await settingsApi.get()
    return data
  }
)

/** Persist a settings change to the backend. */
export const syncSettings = createAsyncThunk(
  "settings/syncSettings",
  async (patch: Partial<Omit<SettingsState, "syncing">>) => {
    const { data } = await settingsApi.update(patch)
    return data
  }
)

// ─── Slice ────────────────────────────────────────────────────────────────────
const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setDefaultModel(state, action: PayloadAction<string>) {
      state.defaultModel = action.payload
    },
    setStreamingEnabled(state, action: PayloadAction<boolean>) {
      state.streamingEnabled = action.payload
    },
    setPiiRedactionEnabled(state, action: PayloadAction<boolean>) {
      state.piiRedactionEnabled = action.payload
    },
    setDefaultProvider(state, action: PayloadAction<Provider>) {
      state.defaultProvider = action.payload
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(loadSettings.pending, (state) => { state.syncing = true })
      .addCase(loadSettings.fulfilled, (state, action) => {
        state.syncing = false
        state.defaultProvider = action.payload.defaultProvider as Provider
        state.defaultModel = action.payload.defaultModel
        state.streamingEnabled = action.payload.streamingEnabled
        state.piiRedactionEnabled = action.payload.piiRedactionEnabled
      })
      .addCase(loadSettings.rejected, (state) => { state.syncing = false })
      .addCase(syncSettings.pending, (state) => { state.syncing = true })
      .addCase(syncSettings.fulfilled, (state) => { state.syncing = false })
      .addCase(syncSettings.rejected, (state) => { state.syncing = false })
  },
})

export const {
  setDefaultModel,
  setStreamingEnabled,
  setPiiRedactionEnabled,
  setDefaultProvider,
} = settingsSlice.actions

export default settingsSlice.reducer
