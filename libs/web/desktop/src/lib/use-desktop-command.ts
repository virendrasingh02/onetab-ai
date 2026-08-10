import { useEffect, useRef } from 'react';
import type { DesktopCommand } from './desktop-api.js';
import { useDesktop } from './desktop-provider.js';

/**
 * Runs `handler` when the native menu, tray or global shortcut fires `command`.
 *
 * The handler is kept in a ref so callers can pass an inline closure without
 * re-subscribing on every render — a fresh function identity each render would
 * otherwise tear down and rebuild the subscription constantly.
 */
export function useDesktopCommand(command: DesktopCommand, handler: () => void): void {
  const { onCommand } = useDesktop();
  const latest = useRef(handler);
  latest.current = handler;

  useEffect(() => onCommand(command, () => latest.current()), [command, onCommand]);
}
