import { TooltipProvider } from '@org/ui';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

/** Several components here use `<Hint>` (a `@org/ui` Tooltip wrapper), which
 * throws outside a `TooltipProvider` — the same pattern `@org/chat-ui`'s specs
 * already use. */
export function renderWithProviders(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}
