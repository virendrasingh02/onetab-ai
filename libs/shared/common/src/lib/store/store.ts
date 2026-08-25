import { configureStore } from '@reduxjs/toolkit';
import preferencesReducer from './preferences-slice.js';
import uiReducer from './ui-slice.js';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    preferences: preferencesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
