import { appVersionsApi } from '@org/api-client';
import { Button, Hint } from '@org/ui';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useDesktop } from './desktop-provider.js';

// Local client build version (can be overridden via VITE_APP_VERSION)
const CLIENT_WEB_VERSION =
  (typeof import.meta !== 'undefined' &&
    (import.meta as any).env?.VITE_APP_VERSION) ||
  '2.8.4';

/**
 * Web Application Version Detection Indicator.
 * In browser mode, periodically checks whether a newer version of the web app has been released.
 * If a new release is detected, presents a compact "New version (Update)" action in the header.
 */
export function WebVersionIndicator() {
  const { isDesktop } = useDesktop();

  const { data: webMeta } = useQuery({
    queryKey: ['web-version-meta'],
    queryFn: () => appVersionsApi.webMetadata(),
    // Poll every 10 minutes in background
    refetchInterval: 10 * 60 * 1000,
    staleTime: 5 * 60 * 1000,
    enabled: !isDesktop,
  });

  if (isDesktop || !webMeta) return null;

  const serverVersion = webMeta.version;
  const isNewerAvailable =
    serverVersion &&
    serverVersion !== CLIENT_WEB_VERSION &&
    serverVersion !== '0.0.0';

  if (!isNewerAvailable) return null;

  return (
    <Hint label={`OneTab AI v${serverVersion} is now live. Click to refresh.`}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => window.location.reload()}
        aria-label={`Update to web version ${serverVersion}`}
        className="gap-1 px-2 text-xs font-medium h-7 cursor-pointer text-accent-blue border-accent-blue/40 hover:bg-accent-blue/10"
      >
        <Sparkles className="size-3.5 text-accent-blue" />
        <span className="sm:inline hidden">v{serverVersion} Live</span>
        <RefreshCw className="size-3 ml-0.5" />
      </Button>
    </Hint>
  );
}
