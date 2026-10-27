import { create } from 'zustand';

export interface StatusModalState {
  isStatusModalOpen: boolean;
  openStatusModal: () => void;
  closeStatusModal: () => void;
}

export const useStatusModalStore = create<StatusModalState>()((set) => ({
  isStatusModalOpen: false,
  openStatusModal: () => set({ isStatusModalOpen: true }),
  closeStatusModal: () => set({ isStatusModalOpen: false }),
}));
