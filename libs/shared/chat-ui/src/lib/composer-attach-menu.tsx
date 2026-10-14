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
  Bot,
  Check,
  Loader2,
  Paperclip,
  Plug,
  Plus,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';

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
  connectors?: ComposerConnectorsConfig;
  children?: ReactNode;
}

/**
 * The composer's "+" menu: Upload files first, then every agent, coworker and
 * app grouped by kind (each marked Connected or offering Connect), and a
 * "Manage connectors" footer.
 */
export function ComposerAttachMenu({
  onUpload,
  connectors,
}: ComposerAttachMenuProps) {
  const [pending, setPending] = useState<string | null>(null);
  const items = connectors?.items ?? [];

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
          <DropdownMenuItem onSelect={onUpload} className="gap-2.5">
            <Paperclip className="size-4 text-muted-foreground" aria-hidden />
            <span>Upload files</span>
          </DropdownMenuItem>
        ) : null}

        {items.length > 0 ? (
          <>
            {onUpload ? <DropdownMenuSeparator /> : null}
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
                          className="justify-between gap-2.5"
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
              <Settings2
                className="size-4 text-muted-foreground"
                aria-hidden
              />
              <span>Manage connectors</span>
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
