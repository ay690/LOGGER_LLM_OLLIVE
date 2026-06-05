import { configureStore } from "@reduxjs/toolkit";
import uiReducer from "./slices/uiSlice";
import logsReducer from "./slices/logsSlice";

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    logs: logsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch