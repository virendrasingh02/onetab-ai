import type { AICoworkerDetail, ComposerContext } from '@org/types';
import {
  Badge,
  Button,
  confirm,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Hint,
  ChatConversationSkeleton,
  toast,
  useRightPanelStore,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentUser } from '@org/auth';
import {
  ChatPanel,
  ConversationTabsShell,
  useDirectRoom,
  useMatrix,
} from '@org/web-chat';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  ArrowLeft,
  Brain,
  Check,
  Copy,
  MessageSquareOff,
  MoreHorizontal,
  Star,
  Trash2,
  UserRound,
} from 'lucide-react';
import { type FC, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CoworkerAvatar } from './CoworkerAvatar.js';
import { CoworkerCreateDialog } from './CoworkerCreateDialog.js';
import {
  useCoworker,
  useCoworkerFavorites,
  useCoworkerMutations,
} from './use-coworkers.js';

export interface CoworkerChatViewProps {
  coworkerId?: string;
}

/**
 * Coworker sticky title header — Counterpart to AgentMessageHeader & AppMessageHeader.
 */
function CoworkerMessageHeader({
  coworker,
  onEdit,
}: {
  coworker: AICoworkerDetail;
  onEdit: () => void;
}) {
  const { workspaceId, slug: workspaceSlug } = useCurrentWorkspace();
  const { isFavorite: checkFavorite, toggleFavorite } = useCoworkerFavorites(workspaceId);
  const mutations = useCoworkerMutations(workspaceId);
  const openProfilePanel = useRightPanelStore((s) => s.openProfile);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const name = coworker.name;
  const slug = workspaceSlug || 'default';
  const isFavorite = checkFavorite(coworker.id);

  const handleOpenProfile = () => {
    openProfilePanel({
      entityKind: 'coworker',
      entityId: coworker.id,
      raw: coworker,
      userId: coworker.matrixUserId ?? `coworker-${coworker.id}`,
      name: coworker.name,
      avatarUrl: coworker.avatarUrl ?? undefined,
      title: `${coworker.role} · ${coworker.model || 'gpt-4o'}`,
      role: coworker.role,
      bio:
        coworker.description ||
        coworker.systemPrompt ||
        'Autonomous workspace AI coworker configured for team collaboration.',
      status: coworker.status === 'AVAILABLE' ? 'online' : 'unavailable',
      statusEmoji: '🤝',
      statusText: `AI Coworker · ${coworker.status === 'AVAILABLE' ? 'Available' : 'Busy'}`,
    });
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/w/${slug}/coworkers?coworkerId=${coworker.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied', {
      description: 'Coworker conversation link copied to clipboard.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleFavorite = () => {
    toggleFavorite(coworker.id);
    toast.success(
      isFavorite ? 'Removed from favorites' : 'Added to favorites',
      { description: `${name} · AI Coworker` },
    );
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: `Delete ${coworker.name}?`,
      description:
        'Are you sure you want to delete this AI coworker? This action cannot be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;

    try {
      await mutations.remove.mutateAsync(coworker.id);
      toast.success(`Deleted coworker ${coworker.name}`);
      navigate(`/w/${slug}/coworkers`);
    } catch {
      toast.error('Failed to delete coworker');
    }
  };

  return (
    <div className="top-0 backdrop-blur-md sticky z-20 shrink-0 border-b border-border bg-background/95">
      <div className="gap-2.5 px-3 sm:px-6 py-1.5 min-h-12 flex flex-wrap items-center justify-between">
        <div className="min-w-0 gap-2 flex items-center">
          <div className="min-w-0 gap-2 flex items-center">
            <button
              type="button"
              onClick={handleOpenProfile}
              className="gap-2 p-1 -m-1 flex cursor-pointer items-center rounded-md text-left transition-colors hover:bg-accent/60 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`View ${name}'s details`}
            >
              <CoworkerAvatar
                name={coworker.name}
                avatarUrl={coworker.avatarUrl}
                status={coworker.status}
                size="sm"
                className="size-7"
              />
              <h2 className="text-base font-semibold tracking-tight truncate text-foreground">
                {name}
              </h2>
            </button>

            <Badge
              variant="primary"
              className="gap-0.5 py-0 h-5 font-bold tracking-wider text-[10px] uppercase"
            >
              <span>AI COWORKER</span>
            </Badge>
          </div>

          <div className="gap-0.5 flex items-center">
            {/* 1. Fav icon */}
            <Hint
              label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-pressed={isFavorite}
                aria-label={
                  isFavorite ? 'Remove from favorites' : 'Add to favorites'
                }
                onClick={handleToggleFavorite}
                className={isFavorite ? 'text-warning' : undefined}
              >
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-accent-amber',
                  )}
                />
              </Button>
            </Hint>

            {/* 2. 3-dot dropdown menu */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Conversation options"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-64">
                <DropdownMenuItem
                  onClick={handleCopyLink}
                  className="justify-between"
                >
                  <div className="gap-2.5 flex items-center">
                    {copied ? (
                      <Check className="size-4 text-success-text" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    <span>{copied ? 'Link copied!' : 'Copy link'}</span>
                  </div>
                  <DropdownMenuShortcut>C</DropdownMenuShortcut>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleOpenProfile}
                  className="gap-2.5 cursor-pointer"
                >
                  <UserRound className="size-4" />
                  <span>Open coworker details</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={onEdit}
                  className="gap-2.5 cursor-pointer"
                >
                  <Brain className="size-4 text-primary" />
                  <span>Edit Settings &amp; Prompt</span>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleDelete}
                  className="gap-2.5 text-destructive focus:text-destructive cursor-pointer"
                >
                  <Trash2 className="size-4" />
                  <span>Delete coworker</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Real Matrix Chat Panel for Coworkers — Identical to AI Agents & Apps */
function CoworkerConversationPanel({
  coworker,
  workspaceId,
}: {
  coworker: AICoworkerDetail;
  workspaceId: string;
}) {
  const { enabled } = useMatrix();
  const currentUser = useCurrentUser();
  const peerId = coworker.matrixUserId || `coworker-${coworker.id}`;
  const { roomId, error } = useDirectRoom(peerId);

  const composerContext = useMemo<ComposerContext>(
    () => ({
      surfaceKind: 'coworker',
      workspaceId,
      roomId,
      peerId,
      canManage: false,
    }),
    [workspaceId, roomId, peerId],
  );

  if (!enabled) {
    return (
      <EmptyState
        size="lg"
        icon={<MessageSquareOff />}
        title="Chat is not configured"
        description="This deployment has no Matrix homeserver. Set MATRIX_ENABLED and the homeserver settings to talk to coworkers."
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title={`Could not open the conversation with ${coworker.name}`}
        description={error}
      />
    );
  }

  return (
    <ConversationTabsShell
      filesContext={{ type: 'AGENT', id: coworker.id }}
      roomId={roomId}
      workspaceId={workspaceId}
      enabled={enabled}
      currentUserId={currentUser?.id}
    >
      <ChatPanel
        roomId={roomId}
        title={coworker.name}
        subtitle={`${coworker.role} · ${coworker.model || 'gpt-4o'}`}
        showHeader={false}
        workspaceId={workspaceId}
        showMembers={false}
        showEncryptedBadge={false}
        composerContext={composerContext}
        welcome={{
          kind: 'direct',
          welcomeMessage: coworker.welcomeMessage,
          peer: {
            name: coworker.name,
            userId: peerId,
            kind: 'coworker',
            role: `${coworker.role} · ${coworker.model || 'gpt-4o'}`,
            avatarNode: (
              <CoworkerAvatar
                name={coworker.name}
                avatarUrl={coworker.avatarUrl}
                status={coworker.status}
                size="lg"
              />
            ),
          },
        }}
      />
    </ConversationTabsShell>
  );
}

export const CoworkerChatView: FC<CoworkerChatViewProps> = ({
  coworkerId: propCoworkerId,
}) => {
  const navigate = useNavigate();
  const params = useParams<{ slug: string; coworkerId?: string; id?: string }>();
  const coworkerId = propCoworkerId || params.coworkerId || params.id || '';

  const { workspaceId = '', slug: workspaceSlug = '' } = useCurrentWorkspace();

  const { data: coworker, isLoading, error } = useCoworker(workspaceId, coworkerId);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  /*
   * Keep the previously-resolved coworker on screen while the next one loads,
   * so switching coworkers swaps the panel contents in place instead of
   * blanking the header and chat surface to a full spinner for the round
   * trip — same pattern as `ChannelPage`'s `lastChannel` ref.
   */
  const lastCoworker = useRef<AICoworkerDetail | undefined>(undefined);
  if (coworker) lastCoworker.current = coworker;
  const displayCoworker = error ? undefined : (coworker ?? lastCoworker.current);

  // Only the very first coworker opened this session — nothing to keep on
  // screen — gets the skeleton loader; every later switch renders in place.
  if (!displayCoworker && isLoading) {
    return <ChatConversationSkeleton avatarShape="rounded" avatarSize="sm" hasTabs />;
  }

  if (error || !displayCoworker) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center p-6 bg-background">
        <ErrorState
          title="Coworker Not Found"
          description="The AI Coworker you requested does not exist or has been removed from this workspace."
        />
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-2"
          onClick={() => navigate(`/w/${workspaceSlug}/coworkers`)}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to AI Coworkers Directory
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex flex-1 flex-col overflow-hidden bg-background text-foreground">
      <CoworkerMessageHeader
        coworker={displayCoworker}
        onEdit={() => setEditDialogOpen(true)}
      />

      <CoworkerConversationPanel
        coworker={displayCoworker}
        workspaceId={workspaceId}
      />

      {/* Edit Dialog */}
      <CoworkerCreateDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        workspaceId={workspaceId}
        coworker={displayCoworker}
      />
    </div>
  );
};
