import {
  AiEntityAvatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Hint,
} from '@org/ui';
import {
  AtSign,
  BarChart3,
  Blocks,
  Bot,
  Loader2,
  Paperclip,
  Plug,
  Plus,
  Settings2,
  Sparkles,
} from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /mac|iphone|ipad/i.test(navigator.platform);
const UPLOAD_SHORTCUT_LABEL = IS_MAC ? '⌘U' : 'Ctrl+U';

export type ComposerConnectorKind = 'agent' | 'coworker' | 'app';

export interface ComposerConnectorItem {
  id: string;
  name: string;
  kind: ComposerConnectorKind;
  /** Agent/coworker avatar (incl. `icon:` identities) or an app's logo. */
  avatarUrl?: string;
}

export interface ComposerConnectorsConfig {
  /** Only what is connected to — and so usable in — this conversation. */
  items: ComposerConnectorItem[];
  /** True while the lists are still loading, so the menu doesn't flash empty. */
  loading?: boolean;
  onManage?: () => void;
}

const KIND_LABEL: Record<ComposerConnectorKind, string> = {
  agent: 'AI agents',
  coworker: 'AI coworkers',
  app: 'Apps',
};

const KIND_ORDER: ComposerConnectorKind[] = ['agent', 'coworker', 'app'];

const KIND_ICON: Record<ComposerConnectorKind, typeof Bot> = {
  agent: Bot,
  coworker: Sparkles,
  app: Blocks,
};

function KindIcon({ kind }: { kind: ComposerConnectorKind }) {
  const Icon = KIND_ICON[kind];
  return <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
}

interface ComposerAttachMenuProps {
  /** Opens the native file picker; omitted when the surface can't take uploads. */
  onUpload?: () => void;
  /** Opens the Create poll dialog; omitted where polls are not offered. */
  onCreatePoll?: () => void;
  connectors?: ComposerConnectorsConfig;
  /** Inserts the picked agent, coworker or app as an @mention. */
  onPickConnector?: (item: ComposerConnectorItem) => void;
  children?: ReactNode;
}

function ConnectorIcon({ item }: { item: ComposerConnectorItem }) {
  if (item.kind === 'app') {
    return (
      <span className="size-6 flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-accent-violet/20 bg-accent-violet-soft text-accent-violet">
        {item.avatarUrl ? (
          <img src={item.avatarUrl} alt="" className="size-4 object-contain" />
        ) : (
          <Blocks className="size-3.5" aria-hidden />
        )}
      </span>
    );
  }
  return (
    <AiEntityAvatar
      name={item.name}
      kind={item.kind}
      avatarUrl={item.avatarUrl}
      size="xs"
    />
  );
}

/**
 * The composer's "+" menu: Upload files and Create poll first, then one
 * submenu row per kind (AI agents, AI coworkers, Apps) listing what is
 * connected to this conversation (picking one @mentions it), and a
 * "Manage connectors" footer. Submenus keep the top level short however many
 * connectors a conversation has.
 */
export function ComposerAttachMenu({
  onUpload,
  onCreatePoll,
  connectors,
  onPickConnector,
}: ComposerAttachMenuProps) {
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

  return (
    <DropdownMenu modal={false}>
      <Hint label="Attach files or use connected tools">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Attach files or use connected tools"
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

        {connectors ? (
          <>
            {onUpload || onCreatePoll ? <DropdownMenuSeparator /> : null}
            {items.length > 0 ? (
              KIND_ORDER.map((kind) => {
                const group = items.filter((item) => item.kind === kind);
                if (group.length === 0) return null;
                return (
                  <DropdownMenuSub key={kind}>
                    <DropdownMenuSubTrigger className="gap-2.5">
                      <KindIcon kind={kind} />
                      <span className="min-w-0 flex-1 truncate">
                        {KIND_LABEL[kind]}
                      </span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {group.length}
                      </span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="w-64 p-1 max-h-72 overflow-y-auto">
                      <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
                        Mention in message
                      </DropdownMenuLabel>
                      {group.map((item) => (
                        <DropdownMenuItem
                          key={`${item.kind}:${item.id}`}
                          onSelect={() => onPickConnector?.(item)}
                          className="group gap-2.5"
                        >
                          <ConnectorIcon item={item} />
                          <span className="min-w-0 flex-1 truncate">
                            {item.name}
                          </span>
                          <AtSign
                            className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-data-[highlighted]:opacity-100"
                            aria-hidden
                          />
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                );
              })
            ) : (
              <div className="gap-2 px-2 py-2 flex items-center text-muted-foreground">
                {connectors.loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    <span className="text-sm">Loading connectors…</span>
                  </>
                ) : (
                  <>
                    <Plug className="size-4 shrink-0" aria-hidden />
                    <span className="text-sm">
                      No agents, coworkers or apps connected here yet
                    </span>
                  </>
                )}
              </div>
            )}
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
