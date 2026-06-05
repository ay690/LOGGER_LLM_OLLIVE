import { createSlice, type PayloadAction } from "@reduxjs/toolkit"
import type { InferenceLog } from "@/types"

interface LogsState {
  items: InferenceLog[]
  filter: {
    model: string
    status: string
    search: string
  }
}

const initialState: LogsState = {
  items: [],
  filter: {
    model: "all",
    status: "all",
    search: "",
  },
}

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
})

export const { addLog, setFilter, clearLogs } = logsSlice.actions;
export default logsSlice.reducer;