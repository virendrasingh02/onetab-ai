import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ChatEntityType = 'card' | 'doc' | 'task' | 'thread' | 'project';
export type ChatEntityDrawerMode = 'preview' | 'edit' | 'details';
export type ChatDataFilter = 'all' | 'tasks' | 'cards' | 'docs' | 'threads' | 'projects';

export interface ActiveEntityReference {
  type: ChatEntityType;
  id: string;
  channelId?: string;
  title?: string;
}

export interface UIState {
  activeWorkspaceId: string | null;
  activeChannelId: string | null;
  sidebarOpen: boolean;
  activeModal: string | null;
  activeEntity: ActiveEntityReference | null;
  activeEntityDrawer: ChatEntityDrawerMode | null;
  chatDataFilter: ChatDataFilter;
  selectedChannelGroup: string | null;
}

const initialState: UIState = {
  activeWorkspaceId: null,
  activeChannelId: null,
  sidebarOpen: true,
  activeModal: null,
  activeEntity: null,
  activeEntityDrawer: null,
  chatDataFilter: 'all',
  selectedChannelGroup: null,
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
    setActiveEntity(state, action: PayloadAction<ActiveEntityReference | null>) {
      state.activeEntity = action.payload;
    },
    openEntityDrawer(
      state,
      action: PayloadAction<{ entity: ActiveEntityReference; mode?: ChatEntityDrawerMode }>,
    ) {
      state.activeEntity = action.payload.entity;
      state.activeEntityDrawer = action.payload.mode ?? 'preview';
    },
    closeEntityDrawer(state) {
      state.activeEntityDrawer = null;
    },
    setChatDataFilter(state, action: PayloadAction<ChatDataFilter>) {
      state.chatDataFilter = action.payload;
    },
    setSelectedChannelGroup(state, action: PayloadAction<string | null>) {
      state.selectedChannelGroup = action.payload;
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
  setActiveEntity,
  openEntityDrawer,
  closeEntityDrawer,
  setChatDataFilter,
  setSelectedChannelGroup,
} = uiSlice.actions;

// Selectors
export const selectActiveWorkspaceId = (state: { ui: UIState }) => state.ui.activeWorkspaceId;
export const selectActiveChannelId = (state: { ui: UIState }) => state.ui.activeChannelId;
export const selectSidebarOpen = (state: { ui: UIState }) => state.ui.sidebarOpen;
export const selectActiveModal = (state: { ui: UIState }) => state.ui.activeModal;
export const selectActiveEntity = (state: { ui: UIState }) => state.ui.activeEntity;
export const selectActiveEntityDrawer = (state: { ui: UIState }) => state.ui.activeEntityDrawer;
export const selectChatDataFilter = (state: { ui: UIState }) => state.ui.chatDataFilter;
export const selectSelectedChannelGroup = (state: { ui: UIState }) => state.ui.selectedChannelGroup;

export default uiSlice.reducer;

