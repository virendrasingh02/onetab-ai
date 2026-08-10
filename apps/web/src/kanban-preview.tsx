import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

/*
 * `@org/web-work-tools` is lazy-loaded at the app's route boundary, so it has
 * to be reached the same way here — a static import would pull the library
 * back into the eagerly-loaded graph.
 */
const AsanaProjectManager = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.AsanaProjectManager })),
);

// Throwaway harness for eyeballing the board outside the authenticated shell.
createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <div className="h-screen bg-background text-foreground">
      <Suspense fallback={null}>
        <AsanaProjectManager />
      </Suspense>
    </div>
  </StrictMode>,
);
