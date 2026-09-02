import { configureStore } from '@reduxjs/toolkit';
import appDownloadReducer from './app-download-slice.js';
import preferencesReducer from './preferences-slice.js';
import uiReducer from './ui-slice.js';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    preferences: preferencesReducer,
    appDownload: appDownloadReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
