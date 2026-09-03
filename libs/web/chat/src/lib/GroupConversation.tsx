import type { WorkspaceMember } from '@org/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Hint,
  toast,
  UserAvatarGroup,
  usePromptDialog,
} from '@org/ui';
import { cn } from '@org/utils';
import { useMembers } from '@org/web-members';
import { useCurrentWorkspace } from '@org/web-workspace';
import { matrixApi } from '@org/api-client';
import {
  Bell,
  BellOff,
  Copy,
  LogOut,
  MessagesSquare,
  MoreHorizontal,
  Pencil,
  Star,
  UserPlus,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatPanel } from './chat-panel.js';
import { useMatrix } from './matrix-provider.js';
import { useRoomSummary } from './use-chat.js';
import { useDirectMessagePreferences } from './use-dm-preferences.js';
import { PeoplePicker } from './people-picker.js';

/** Comma-joined member names, minus the reader — the fallback title for an unnamed group. */
function membersTitle(names: string[]): string {
  if (names.length === 0) return 'Group message';
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} +${names.length - 3}`;
}

export interface GroupConversationProps {
  roomId: string;
  extraPeers?: WorkspaceMember[];
}

/**
 * A group direct message — many people, one private room, kept distinct from a
 * channel. Reuses the same `ChatPanel` a channel and a 1:1 use; what it adds is
 * a header with the roster, a name, and membership controls.
 */
export function GroupConversation({
  roomId,
  extraPeers,
}: GroupConversationProps) {
  const { enabled, client } = useMatrix();
  const { workspaceId } = useCurrentWorkspace();
  const membersQuery = useMembers(workspaceId);
  const { room, members } = useRoomSummary(roomId);

  const [chatActionsSlot, setChatActionsSlot] = useState<HTMLDivElement | null>(
    null,
  );
  // Owned here rather than in `GroupHeader` so the welcome block at the top of
  // the timeline can open the same "Add people" dialog the header menu does.
  const [addPeopleOpen, setAddPeopleOpen] = useState(false);

  const myUserId = client?.getSession()?.userId;
  const otherNames = useMemo(
    () =>
      members
        .filter((member) => member.userId !== myUserId)
        .map((member) => member.displayName || member.userId),
    [members, myUserId],
  );

  const title = room?.name?.trim() || membersTitle(otherNames);

  const allWorkspacePeople = useMemo(
    () => [...(membersQuery.data ?? []), ...(extraPeers ?? [])],
    [membersQuery.data, extraPeers],
  );

  if (!enabled) {
    return (
      <div className="min-h-0 flex flex-1 flex-col">
        <GroupHeader
          title="Group message"
          members={members}
          roomId={roomId}
          workspacePeople={allWorkspacePeople}
          chatActionsRef={setChatActionsSlot}
          addPeopleOpen={addPeopleOpen}
          onAddPeopleOpenChange={setAddPeopleOpen}
        />
        <EmptyState
          size="lg"
          icon={<MessagesSquare />}
          title="Chat is not configured"
          description="This deployment has no Matrix homeserver. Set MATRIX_ENABLED and the homeserver settings to turn on group messages."
        />
      </div>
    );
  }

  if (client && room === null && members.length === 0) {
    // The client is connected but this room is not in its store — a stale link,
    // or the reader has left the group.
    return (
      <div className="min-h-0 flex flex-1 flex-col">
        <GroupHeader
          title="Group message"
          members={members}
          roomId={roomId}
          workspacePeople={allWorkspacePeople}
          chatActionsRef={setChatActionsSlot}
          addPeopleOpen={addPeopleOpen}
          onAddPeopleOpenChange={setAddPeopleOpen}
        />
        <ErrorState
          title="This conversation is unavailable"
          description="You may have left this group, or the link is out of date."
        />
      </div>
    );
  }

  // The picked people may already share a channel — reused, not duplicated
  // (see `getOrCreateGroupDirectMessage`). It renders here as a conversation,
  // just without the group-DM-only membership controls.
  const isChannel = room?.kind === 'channel';

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <GroupHeader
        title={title}
        members={members}
        roomId={roomId}
        isChannel={isChannel}
        workspacePeople={allWorkspacePeople}
        chatActionsRef={setChatActionsSlot}
        addPeopleOpen={addPeopleOpen}
        onAddPeopleOpenChange={setAddPeopleOpen}
      />
      <ChatPanel
        roomId={roomId}
        title={title}
        subtitle={
          isChannel
            ? 'Shared channel'
            : `${members.length} ${members.length === 1 ? 'member' : 'members'}`
        }
        workspaceId={workspaceId}
        headerActionsSlot={chatActionsSlot}
        showMembers
        showEncryptedBadge={false}
        welcome={
          isChannel
            ? undefined
            : {
                kind: 'group',
                description: room?.topic,
                onAddPeople: () => setAddPeopleOpen(true),
              }
        }
      />
    </div>
  );
}

/** Adapts the group's member rows to the shared {@link UserAvatarGroup}. */
function AvatarStack({
  members,
}: {
  members: { userId: string; displayName: string; avatarUrl?: string }[];
}) {
  return (
    <UserAvatarGroup
      size="sm"
      users={members.map((m) => ({
        id: m.userId,
        name: m.displayName || m.userId,
        avatarUrl: m.avatarUrl,
      }))}
    />
  );
}

function GroupHeader({
  title,
  members,
  roomId,
  isChannel = false,
  workspacePeople,
  chatActionsRef,
  addPeopleOpen,
  onAddPeopleOpenChange,
}: {
  title: string;
  members: { userId: string; displayName: string; avatarUrl?: string }[];
  roomId: string;
  /** True when this "group" resolved to a channel these people already share. */
  isChannel?: boolean;
  workspacePeople: WorkspaceMember[];
  chatActionsRef: (element: HTMLDivElement | null) => void;
  /** The "Add people" dialog is owned by {@link GroupConversation}. */
  addPeopleOpen: boolean;
  onAddPeopleOpenChange: (open: boolean) => void;
}) {
  const { client } = useMatrix();
  const { workspaceId, slug } = useCurrentWorkspace();
  const preferences = useDirectMessagePreferences(workspaceId);
  const prompts = usePromptDialog();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const isFavorite = preferences.isFavorite(roomId);
  const isMuted = preferences.isMuted(roomId);
  const workspaceSlug = slug || 'default';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/w/${workspaceSlug}/dms?room=${roomId}`,
    );
    setCopied(true);
    toast.success('Link copied', {
      description: 'Group conversation link copied to clipboard.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRename = useCallback(async () => {
    if (!client) return;
    const name = await prompts.promptText({
      title: 'Rename group',
      label: 'Group name',
      defaultValue: client.getRoom(roomId)?.name ?? '',
      confirmLabel: 'Rename',
    });
    if (name == null) return;
    try {
      await client.setRoomName(roomId, name);
      toast.success(name.trim() ? 'Group renamed' : 'Group name cleared');
    } catch {
      toast.error('Could not rename the group');
    }
  }, [client, prompts, roomId]);

  const handleLeave = useCallback(async () => {
    if (!client) return;
    const confirmed = await prompts.confirmAction({
      title: `Leave "${title}"?`,
      description:
        'You will stop receiving messages from this group. Someone still in it can add you back.',
      confirmLabel: 'Leave group',
      destructive: true,
    });
    if (!confirmed) return;
    try {
      await client.leaveRoom(roomId);
      toast.success('You left the group');
      navigate(`/w/${workspaceSlug}/dms`);
    } catch {
      toast.error('Could not leave the group');
    }
  }, [client, prompts, roomId, title, navigate, workspaceSlug]);

  return (
    <div className="top-0 backdrop-blur-md sticky z-20 shrink-0 border-b border-border bg-background/95">
      <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
        <div className="min-w-0 gap-2.5 flex items-center">
          <AvatarStack members={members} />
          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight truncate text-foreground">
              {title}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {members.length} {members.length === 1 ? 'member' : 'members'}
              {isMuted ? ' · muted' : ''}
            </p>
          </div>

          <div className="gap-0.5 flex items-center">
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
                onClick={() => preferences.toggleFavorite(roomId)}
              >
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-accent-amber',
                  )}
                />
              </Button>
            </Hint>

            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Group options"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-60">
                {!isChannel ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => onAddPeopleOpenChange(true)}
                      className="gap-2.5"
                    >
                      <UserPlus className="size-4" />
                      <span>Add people</span>
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      onClick={handleRename}
                      className="gap-2.5"
                    >
                      <Pencil className="size-4" />
                      <span>Rename group</span>
                    </DropdownMenuItem>
                  </>
                ) : null}

                <DropdownMenuItem
                  onClick={handleCopyLink}
                  className="justify-between"
                >
                  <div className="gap-2.5 flex items-center">
                    <Copy className="size-4" />
                    <span>{copied ? 'Link copied!' : 'Copy link'}</span>
                  </div>
                  <DropdownMenuShortcut>C</DropdownMenuShortcut>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => preferences.toggleMuted(roomId)}
                  className="gap-2.5"
                >
                  {isMuted ? (
                    <Bell className="size-4" />
                  ) : (
                    <BellOff className="size-4" />
                  )}
                  <span>
                    {isChannel
                      ? isMuted
                        ? 'Unmute'
                        : 'Mute'
                      : isMuted
                        ? 'Unmute group'
                        : 'Mute group'}
                  </span>
                </DropdownMenuItem>

                {!isChannel ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleLeave}
                      className="gap-2.5 text-destructive focus:text-destructive"
                    >
                      <LogOut className="size-4" />
                      <span>Leave group</span>
                    </DropdownMenuItem>
                  </>
                ) : null}

                <DropdownMenuItem
                  onClick={() => navigate(`/w/${workspaceSlug}/dms`)}
                  className="gap-2.5"
                >
                  <X className="size-4" />
                  <span>Close conversation</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div
          ref={chatActionsRef}
          className="gap-0.5 flex items-center empty:hidden"
        />
      </div>

      <AddPeopleDialog
        open={addPeopleOpen}
        onOpenChange={onAddPeopleOpenChange}
        roomId={roomId}
        currentMemberIds={members.map((member) => member.userId)}
        workspacePeople={workspacePeople}
      />
      {prompts.dialog}
    </div>
  );
}

function AddPeopleDialog({
  open,
  onOpenChange,
  roomId,
  currentMemberIds,
  workspacePeople,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  currentMemberIds: string[];
  workspacePeople: WorkspaceMember[];
}) {
  const { client } = useMatrix();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );

  const currentSet = useMemo(
    () => new Set(currentMemberIds),
    [currentMemberIds],
  );

  const handleAdd = async () => {
    if (!client || selected.length === 0) return;
    setBusy(true);
    try {
      const identities = await Promise.all(
        selected.map((id) => matrixApi.peerIdentity(id)),
      );
      const toInvite = identities
        .map((identity) => identity.matrixUserId)
        .filter((matrixId) => !currentSet.has(matrixId));

      if (toInvite.length === 0) {
        toast.info('Everyone selected is already in this group.');
      } else {
        await client.addToGroupDirectMessage(roomId, toInvite);
        toast.success(
          toInvite.length === 1
            ? 'Added 1 person to the group'
            : `Added ${toInvite.length} people to the group`,
        );
      }
      setSelected([]);
      onOpenChange(false);
    } catch {
      toast.error('Could not add people to the group');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-4 pb-3">
          <DialogTitle>Add people</DialogTitle>
          <DialogDescription>
            They will see the full history of this group conversation.
          </DialogDescription>
        </DialogHeader>

        <div className="h-80 border-t border-border flex flex-col">
          <PeoplePicker
            members={workspacePeople}
            selectedIds={selected}
            onToggle={toggle}
            emptyHint="Invite someone to this workspace first."
          />
        </div>

        <DialogFooter className="p-3 border-t border-border">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={selected.length === 0 || busy}
            leadingIcon={busy ? undefined : <UserPlus className="size-4" />}
          >
            {busy
              ? 'Adding…'
              : selected.length > 0
                ? `Add ${selected.length}`
                : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

