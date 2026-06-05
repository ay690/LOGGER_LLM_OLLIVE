import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { View } from "@/types";

interface UIState {
    activeView: View;
    sidebarOpen: boolean;
    selectedLogId: string | null;
}

const initialState: UIState = {
    activeView: 'chat',
    sidebarOpen: true,
    selectedLogId: null,
};

const uiSlice = createSlice({
    name: 'ui',
    initialState,  
    reducers: {
        setActiveView(state, action: PayloadAction<View>) {
            state.activeView = action.payload;
        },
        toggleSidebar(state) {
            state.sidebarOpen = !state.sidebarOpen;
        },
        setSelectedLogId(state, action: PayloadAction<string | null>) {
            state.selectedLogId = action.payload;
        },
    },
})

export const { setActiveView, toggleSidebar, setSelectedLogId } = uiSlice.actions;
export default uiSlice.reducer;

