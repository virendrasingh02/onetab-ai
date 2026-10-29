import { createContext, useContext } from 'react';

/**
 * How a chat card connects one of the viewer's apps — the host runs the same
 * flow the Integration Hub does (OAuth popup, credentials form…), so a card
 * asking "connect Gmail" never needs to know how Gmail signs in.
 */
export interface AppConnector {
  /** Starts connecting (or reconnecting) `provider` for the viewer. */
  connect: (provider: string, label: string) => void | Promise<void>;
  /** Whether the viewer can use `provider` right now; undefined when unknown. */
  isConnected: (provider: string) => boolean | undefined;
}

const AppConnectContext = createContext<AppConnector | null>(null);

export const AppConnectProvider = AppConnectContext.Provider;

export function useAppConnector(): AppConnector | null {
  return useContext(AppConnectContext);
}
