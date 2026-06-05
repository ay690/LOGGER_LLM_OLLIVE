import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { Provider } from "@/types"

interface SettingsState {
    defaultProvider: Provider
    defaultModel: string
    streamingEnabled: boolean
    piiRedactionEnabled: boolean
}

const initialState: SettingsState = {
    defaultProvider: "puter",
    defaultModel: "gpt-4o-mini",
    streamingEnabled: true,
    piiRedactionEnabled: false,
}

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
        // kept for future multi-provider expansion
        setDefaultProvider(state, action: PayloadAction<Provider>) {
            state.defaultProvider = action.payload
        },
    },
})

export const {
    setDefaultModel,
    setStreamingEnabled,
    setPiiRedactionEnabled,
    setDefaultProvider,
} = settingsSlice.actions
export default settingsSlice.reducer;