import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  BarChart3,
  Bot,
  Check,
  Loader2,
  Paperclip,
  Plug,
  Plus,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /mac|iphone|ipad/i.test(navigator.platform);
const UPLOAD_SHORTCUT_LABEL = IS_MAC ? '⌘U' : 'Ctrl+U';

export type ComposerConnectorKind = 'agent' | 'coworker' | 'app';

export interface ComposerConnectorItem {
  id: string;
  name: string;
  kind: ComposerConnectorKind;
  /** Already usable in this conversation. Unconnected items offer "Connect". */
  connected: boolean;
}

export interface ComposerConnectorsConfig {
  /** Every agent, coworker and app the viewer could use — not just connected. */
  items: ComposerConnectorItem[];
  /** Hides the Connect / Connected affordance where connecting has no meaning. */
  showStatus: boolean;
  onConnect: (item: ComposerConnectorItem) => void | Promise<void>;
  onManage?: () => void;
}

const KIND_META: Record<
  ComposerConnectorKind,
  { label: string; Icon: typeof Bot }
> = {
  agent: { label: 'AI agents', Icon: Bot },
  coworker: { label: 'AI coworkers', Icon: Sparkles },
  app: { label: 'Apps', Icon: Plug },
};

const KIND_ORDER: ComposerConnectorKind[] = ['agent', 'coworker', 'app'];

interface ComposerAttachMenuProps {
  /** Opens the native file picker; omitted when the surface can't take uploads. */
  onUpload?: () => void;
  /** Opens the Create poll dialog; omitted where polls are not offered. */
  onCreatePoll?: () => void;
  connectors?: ComposerConnectorsConfig;
  children?: ReactNode;
}

/**
 * The composer's "+" menu: Upload files and Create poll first, then every agent, coworker and
 * app grouped by kind (each marked Connected or offering Connect), and a
 * "Manage connectors" footer.
 */
export function ComposerAttachMenu({
  onUpload,
  onCreatePoll,
  connectors,
}: ComposerAttachMenuProps) {
  const [pending, setPending] = useState<string | null>(null);
  const items = connectors?.items ?? [];

  // Ctrl/⌘+U opens the file picker, matching the shortcut shown in the menu.
  useEffect(() => {
    if (!onUpload) return;
    const handler = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === 'u'
      ) {
        event.preventDefault();
        onUpload();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onUpload]);

  const connect = async (item: ComposerConnectorItem) => {
    if (!connectors || pending) return;
    setPending(item.id);
    try {
      await connectors.onConnect(item);
    } finally {
      setPending(null);
    }
  };

  return (
    <DropdownMenu modal={false}>
      <Hint label="Attach files or connect tools">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Attach files or connect tools"
            className="size-8 flex touch-target shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary-text transition-colors hover:border-primary/40 hover:bg-primary/20 active:scale-95"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
      </Hint>
      <DropdownMenuContent
        side="top"
        align="start"
        className="w-72 p-1"
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        {onUpload ? (
          <DropdownMenuItem
            onSelect={onUpload}
            className="gap-2.5 justify-between"
          >
            <span className="gap-2.5 min-w-0 flex items-center">
              <Paperclip
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="truncate">Add files or photos</span>
            </span>
            <kbd className="text-xs shrink-0 font-sans text-muted-foreground">
              {UPLOAD_SHORTCUT_LABEL}
            </kbd>
          </DropdownMenuItem>
        ) : null}

        {onCreatePoll ? (
          <DropdownMenuItem onSelect={onCreatePoll} className="gap-2.5">
            <BarChart3
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="truncate">Create poll</span>
          </DropdownMenuItem>
        ) : null}

        {items.length > 0 ? (
          <>
            {onUpload || onCreatePoll ? <DropdownMenuSeparator /> : null}
            <div className="max-h-64 overflow-y-auto">
              {KIND_ORDER.map((kind) => {
                const group = items.filter((item) => item.kind === kind);
                if (group.length === 0) return null;
                const { label, Icon } = KIND_META[kind];
                return (
                  <div key={kind}>
                    <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                      {label}
                    </DropdownMenuLabel>
                    {group.map((item) => {
                      const busy = pending === item.id;
                      return (
                        <DropdownMenuItem
                          key={`${item.kind}:${item.id}`}
                          // Keep the menu open so several can be connected in a row.
                          onSelect={(event) => {
                            if (connectors?.showStatus && !item.connected) {
                              event.preventDefault();
                              void connect(item);
                            }
                          }}
                          className="gap-2.5 justify-between"
                        >
                          <span className="gap-2.5 min-w-0 flex items-center">
                            <Icon
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-hidden
                            />
                            <span className="truncate">{item.name}</span>
                          </span>
                          {connectors?.showStatus ? (
                            item.connected ? (
                              <span className="gap-1 text-xs flex shrink-0 items-center text-success-text">
                                <Check className="size-3.5" aria-hidden />
                                Connected
                              </span>
                            ) : (
                              <span
                                className={cn(
                                  'gap-1 text-xs flex shrink-0 items-center text-muted-foreground',
                                  busy && 'opacity-70',
                                )}
                              >
                                {busy ? (
                                  <Loader2
                                    className="size-3.5 animate-spin"
                                    aria-hidden
                                  />
                                ) : null}
                                Connect
                              </span>
                            )
                          ) : null}
                        </DropdownMenuItem>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </>
        ) : null}

        {connectors?.onManage ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={connectors.onManage}
              className="gap-2.5"
            >
              <Settings2 className="size-4 text-muted-foreground" aria-hidden />
              <span>Manage connectors</span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
