import { ErrorBoundary } from '@org/ui';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PopupApp } from './app/popup-app.js';
import './styles.css';

const container = document.getElementById('root');
if (!container) throw new Error('popup.html is missing #root.');

createRoot(container).render(
  <StrictMode>
    {/*
      A popup that throws renders as a blank white rectangle with no way to
      recover short of reopening it, so the boundary is not optional here.
    */}
    <ErrorBoundary>
      <PopupApp />
    </ErrorBoundary>
  </StrictMode>,
);
