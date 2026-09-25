import { useSearchParams } from 'react-router-dom';
import { DesktopHandoffPanel } from '../components/desktop-handoff-panel.js';
import { desktopCallbackUrl } from '../desktop-handoff.js';

/**
 * `/auth/callback?code=…&state=…` in a *browser* tab — for an identity
 * provider that redirects here rather than to the login page. It relays the
 * code to the desktop app through the same panel the login page uses.
 */
export function DesktopAuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  return (
    <DesktopHandoffPanel
      callbackUrl={code && state ? desktopCallbackUrl(code, state) : null}
      error={
        code && state
          ? null
          : 'This sign-in link is incomplete. Start again from the desktop app.'
      }
    />
  );
}
