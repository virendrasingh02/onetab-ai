import {
  Badge,
  Button,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@org/ui';
import { ArrowUpRight, Bookmark, LogIn, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  APP_ORIGINS,
  sendToBackground,
  type CapturedPage,
} from '../lib/messaging.js';
import { AskAiTab } from './ask-ai-tab.js';
import { SaveTab } from './save-tab.js';
import { useSession } from './use-session.js';

/** Opens the web app, reusing an existing tab when one is already open. */
async function openApp(path = ''): Promise<void> {
  const existing = await chrome.tabs.query({
    url: APP_ORIGINS.map((origin) => `${origin}/*`),
  });

  if (existing[0]?.id !== undefined) {
    await chrome.tabs.update(existing[0].id, {
      active: true,
      ...(path ? { url: `${APP_ORIGINS[0]}${path}` } : {}),
    });
    await chrome.windows.update(existing[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: `${APP_ORIGINS[0]}${path}` });
  }
  window.close();
}

function Header({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="gap-2 px-3 py-2.5 flex items-center border-b border-[#27272A]">
      <span
        aria-hidden
        className="size-6 flex items-center justify-center rounded-[6px] bg-[#6E56CF]"
      >
        <Sparkles className="size-3.5 text-[#FAFAFA]" />
      </span>
      <div className="flex-1">
        <p className="text-xs font-semibold tracking-tight text-[#FAFAFA]">
          OneTab AI
        </p>
      </div>
      <Badge variant={signedIn ? 'success' : 'neutral'}>
        {signedIn ? 'Connected' : 'Signed out'}
      </Badge>
      <Button
        size="icon-sm"
        variant="ghost"
        aria-label="Open OneTab AI"
        onClick={() => void openApp()}
      >
        <ArrowUpRight className="size-3.5" />
      </Button>
    </header>
  );
}

/**
 * Shown when no OneTab AI tab has a session to lend.
 *
 * The extension deliberately has no login form: it borrows the web app's
 * session, so there is exactly one place credentials are ever entered and one
 * refresh flow to keep correct.
 */
function SignedOut({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="gap-3 px-4 py-8 flex flex-col items-center text-center">
      <span
        aria-hidden
        className="size-10 flex items-center justify-center rounded-[8px] border border-[#27272A] bg-[#16171A] text-[#A1A1AA]"
      >
        <LogIn className="size-4" />
      </span>
      <div>
        <p className="text-xs font-semibold tracking-tight text-[#FAFAFA]">
          Sign in to OneTab AI
        </p>
        <p className="mt-1 text-xs leading-relaxed max-w-[15rem] text-balance text-[#71717A]">
          The extension uses the session from your OneTab AI tab. Sign in there
          and it connects automatically.
        </p>
      </div>
      <div className="gap-2 flex items-center">
        <Button size="sm" onClick={() => void openApp('/login')}>
          Open OneTab AI
        </Button>
        <Button size="sm" variant="secondary" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}

export function PopupApp() {
  const { session, loading, refresh } = useSession();
  const [page, setPage] = useState<CapturedPage | null>(null);
  const [tab, setTab] = useState('ask');

  // Capture up front: both tabs want it, and it costs one message.
  useEffect(() => {
    void sendToBackground<CapturedPage>({ type: 'page:capture' }).then(
      (response) => setPage(response.ok ? response.data : null),
    );
  }, []);

  // "Save this page" from the context menu opens the popup on the save tab.
  useEffect(() => {
    void chrome.storage.session.get('onetab.pendingCapture').then((stored) => {
      if (stored['onetab.pendingCapture']) {
        setTab('save');
        return chrome.storage.session.remove('onetab.pendingCapture');
      }
      return undefined;
    });
  }, []);

  const signedIn = Boolean(session?.accessToken);

  return (
    <div className="flex w-[360px] flex-col bg-[#09090B] text-[#FAFAFA]">
      <Header signedIn={signedIn} />

      {loading ? (
        <div className="gap-2 py-10 text-xs flex items-center justify-center text-[#71717A]">
          <Spinner className="size-3.5" />
          Connecting…
        </div>
      ) : !signedIn ? (
        <SignedOut onRetry={refresh} />
      ) : (
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="mx-3 mt-2.5 grid w-auto grid-cols-2">
            <TabsTrigger value="ask" className="gap-1.5">
              <Sparkles className="size-3.5" aria-hidden />
              Ask AI
            </TabsTrigger>
            <TabsTrigger value="save" className="gap-1.5">
              <Bookmark className="size-3.5" aria-hidden />
              Save
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ask" className="p-3">
            <AskAiTab page={page} />
          </TabsContent>

          <TabsContent value="save" className="p-3">
            <SaveTab page={page} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
