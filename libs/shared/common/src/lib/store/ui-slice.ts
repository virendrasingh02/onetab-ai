import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface UIState {
  activeWorkspaceId: string | null;
  activeChannelId: string | null;
  sidebarOpen: boolean;
  activeModal: string | null;
}

const initialState: UIState = {
  activeWorkspaceId: null,
  activeChannelId: null,
  sidebarOpen: true,
  activeModal: null,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setActiveWorkspace(state, action: PayloadAction<string | null>) {
      state.activeWorkspaceId = action.payload;
    },
    setActiveChannel(state, action: PayloadAction<string | null>) {
      state.activeChannelId = action.payload;
    },
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    setSidebarOpen(state, action: PayloadAction<boolean>) {
      state.sidebarOpen = action.payload;
    },
    openModal(state, action: PayloadAction<string>) {
      state.activeModal = action.payload;
    },
    closeModal(state) {
      state.activeModal = null;
    },
  },
});

export const {
  setActiveWorkspace,
  setActiveChannel,
  toggleSidebar,
  setSidebarOpen,
  openModal,
  closeModal,
} = uiSlice.actions;

export default uiSlice.reducer;
