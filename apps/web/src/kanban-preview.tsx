import { KanbanBoard } from '@org/web-work-tools';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

// Throwaway harness for eyeballing the board outside the authenticated shell.
createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <div className="h-screen bg-background text-foreground">
      <KanbanBoard />
    </div>
  </StrictMode>,
);
