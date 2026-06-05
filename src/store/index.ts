import { configureStore } from "@reduxjs/toolkit";
import uiReducer from "./slices/uiSlice";
import logsReducer from "./slices/logsSlice";
import settingsReducer from "./slices/settingsSlice";
import conversationsReducer from "./slices/conversationsSlice";

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    logs: logsReducer,
    settings: settingsReducer,
    conversations: conversationsReducer,
  },
})

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;