import { useCurrentUser } from '@org/auth';
import type {
  ComposerContext,
  PublicUser,
  RoomMember,
  SystemActivityEventContent,
  SystemEventEntity,
  SystemEventType,
  WorkspaceMember,
} from '@org/types';
import { getSystemEventCapabilities } from '@org/types';
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
  GroupAvatar,
  Hint,
  toast,
  usePromptDialog,
} from '@org/ui';
import { useUserPresenceMap } from '@org/realtime';
import { cn } from '@org/utils';
import { useMembers } from '@org/web-members';
import { useCurrentWorkspace } from '@org/web-workspace';
import { matrixApi } from '@org/api-client';
import {
  Bell,
  BellOff,
  Camera,
  Copy,
  LogOut,
  MessagesSquare,
  MoreHorizontal,
  Pencil,
  Headphones,
  Star,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChatPanel } from './chat-panel.js';
import { ConversationTabsShell } from './conversation-files-panel.js';
import { GroupMembersPanel } from './group-members-panel.js';
import { useMatrix } from './matrix-provider.js';
import { useRoomSummary } from './use-chat.js';
import { useDirectMessagePreferences } from './use-dm-preferences.js';
import { PeoplePicker } from './people-picker.js';

function toSystemEventEntity(user: PublicUser): SystemEventEntity {
  return {
    kind: 'user',
    id: user.id,
    name: user.displayName || user.name,
    avatarUrl: user.avatarUrl ?? undefined,
  };
}

/**
 * Group DMs are managed entirely client-side (no backend row to hang an
 * `AppEvent` off), so a membership-change system event is posted here,
 * directly by the current user's own Matrix session.
 */
function buildGroupDmMemberEvent(
  eventType: Extract<SystemEventType, 'member_added' | 'member_left'>,
  roomId: string,
  workspaceId: string | undefined,
  actor: PublicUser,
  target: PublicUser,
): SystemActivityEventContent {
  return {
    type: 'mie.system_event',
    eventType,
    conversationType: 'group_dm',
    conversationId: roomId,
    workspaceId,
    actor: toSystemEventEntity(actor),
    target: toSystemEventEntity(target),
    occurredAt: Date.now(),
    idempotencyKey: `group-dm-member:${roomId}:${target.id}:${eventType}:${Date.now()}`,
    capabilities: getSystemEventCapabilities(eventType),
  };
}

function buildGroupDmRenamedEvent(
  roomId: string,
  workspaceId: string | undefined,
  actor: PublicUser,
  newName: string,
): SystemActivityEventContent {
  return {
    type: 'mie.system_event',
    eventType: 'channel_renamed',
    conversationType: 'group_dm',
    conversationId: roomId,
    workspaceId,
    actor: toSystemEventEntity(actor),
    target: {
      kind: 'channel',
      id: roomId,
      name: newName,
    },
    occurredAt: Date.now(),
    idempotencyKey: `group-dm-rename:${roomId}:${Date.now()}`,
    capabilities: getSystemEventCapabilities('channel_renamed'),
  };
}

/** Comma-joined member names, minus the reader — the fallback title for an unnamed group. */
function membersTitle(names: string[]): string {
  if (names.length === 0) return 'Group message';
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} + ${names.length - 2} others`;
}

export interface GroupConversationProps {
  roomId: string;
  extraPeers?: WorkspaceMember[];
}

/**
 * A group direct message — many people, one private room, kept distinct from a
 * channel. Reuses the same `ChatPanel` a channel and a 1:1 use; what it adds is
 * a header with the roster, avatar management, a name, and membership controls.
 */
export function GroupConversation({
  roomId,
  extraPeers,
}: GroupConversationProps) {
  const { enabled, configStatus, client } = useMatrix();
  const { workspaceId, slug } = useCurrentWorkspace();
  const membersQuery = useMembers(workspaceId);
  const { room, members } = useRoomSummary(roomId);

  const [chatActionsSlot, setChatActionsSlot] = useState<HTMLDivElement | null>(
    null,
  );
  const [addPeopleOpen, setAddPeopleOpen] = useState(false);
  const [membersPanelOpen, setMembersPanelOpen] = useState(false);
  /* Bumped by the header menu; the chat surface owns the huddle and starts it. */
  const [huddleRequest, setHuddleRequest] = useState(0);

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

  const isChannel = room?.kind === 'channel';

  const composerContext = useMemo<ComposerContext>(
    () => ({
      surfaceKind: isChannel ? 'channel' : 'group-dm',
      workspaceId,
      roomId,
    }),
    [isChannel, workspaceId, roomId],
  );

  if (configStatus === 'disabled') {
    return (
      <div className="min-h-0 flex flex-1 flex-col">
        <GroupHeader
          title="Group message"
          members={members}
          roomAvatarUrl={room?.avatarUrl}
          roomId={roomId}
          workspacePeople={allWorkspacePeople}
          chatActionsRef={setChatActionsSlot}
          addPeopleOpen={addPeopleOpen}
          onAddPeopleOpenChange={setAddPeopleOpen}
          membersPanelOpen={membersPanelOpen}
          onToggleMembersPanel={() => setMembersPanelOpen((open) => !open)}
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

  if (client && !room && members.length === 0) {
    return (
      <div className="min-h-0 flex flex-1 flex-col">
        <GroupHeader
          title="Group message"
          members={members}
          roomAvatarUrl={undefined}
          roomId={roomId}
          workspacePeople={allWorkspacePeople}
          chatActionsRef={setChatActionsSlot}
          addPeopleOpen={addPeopleOpen}
          onAddPeopleOpenChange={setAddPeopleOpen}
          membersPanelOpen={membersPanelOpen}
          onToggleMembersPanel={() => setMembersPanelOpen((open) => !open)}
        />
        <ErrorState
          title="This conversation is unavailable"
          description="You may have left this group, or the link is out of date."
        />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <GroupHeader
        title={title}
        members={members}
        roomAvatarUrl={room?.avatarUrl}
        roomId={roomId}
        isChannel={isChannel}
        workspacePeople={allWorkspacePeople}
        chatActionsRef={setChatActionsSlot}
        addPeopleOpen={addPeopleOpen}
        onAddPeopleOpenChange={setAddPeopleOpen}
        membersPanelOpen={membersPanelOpen}
        onToggleMembersPanel={() => setMembersPanelOpen((open) => !open)}
        onStartHuddle={() => setHuddleRequest((count) => count + 1)}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0">
          <ConversationTabsShell
            filesContext={{ type: 'DIRECT', id: roomId }}
            roomId={roomId}
            workspaceId={workspaceId}
            enabled={enabled}
            currentUserId={myUserId ?? undefined}
          >
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
              huddleRequest={huddleRequest}
              showMembers={false}
              showEncryptedBadge={false}
              composerContext={composerContext}
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
          </ConversationTabsShell>
        </div>

        {membersPanelOpen ? (
          <div className="w-80 shrink-0 h-full">
            <GroupMembersPanel
              roomId={roomId}
              members={members}
              workspaceSlug={slug || 'default'}
              onAddPeople={() => setAddPeopleOpen(true)}
              onClose={() => setMembersPanelOpen(false)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GroupHeader({
  title,
  members,
  roomAvatarUrl,
  roomId,
  isChannel = false,
  workspacePeople,
  chatActionsRef,
  addPeopleOpen,
  onAddPeopleOpenChange,
  membersPanelOpen,
  onToggleMembersPanel,
  onStartHuddle,
}: {
  title: string;
  members: RoomMember[];
  roomAvatarUrl?: string | null;
  roomId: string;
  isChannel?: boolean;
  workspacePeople: WorkspaceMember[];
  chatActionsRef: (element: HTMLDivElement | null) => void;
  addPeopleOpen: boolean;
  onAddPeopleOpenChange: (open: boolean) => void;
  membersPanelOpen: boolean;
  onToggleMembersPanel: () => void;
  /**
   * A group call is a huddle — the 1:1 WebRTC call would ring every member and
   * connect only whoever answers first, privately. Absent while chat is not
   * available, where there is no huddle to start.
   */
  onStartHuddle?: () => void;
}) {
  const { client } = useMatrix();
  const { workspaceId, slug } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const preferences = useDirectMessagePreferences(workspaceId);
  const prompts = usePromptDialog();
  const presenceMap = useUserPresenceMap();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isFavorite = preferences.isFavorite(roomId);
  const isMuted = preferences.isMuted(roomId);
  const workspaceSlug = slug || 'default';

  const myUserId = client?.getSession()?.userId;
  const myMember = members.find((m) => m.userId === myUserId);
  const canManage = (myMember?.powerLevel ?? 0) >= 50;

  const onlineCount = useMemo(
    () =>
      members.filter((m) => presenceMap[m.userId]?.status === 'online').length,
    [members, presenceMap],
  );

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
      if (currentUser && name.trim()) {
        await client
          .sendStructuredMessage(
            roomId,
            buildGroupDmRenamedEvent(
              roomId,
              workspaceId,
              currentUser,
              name.trim(),
            ),
          )
          .catch(() => undefined);
      }
      toast.success(name.trim() ? 'Group renamed' : 'Group name cleared');
    } catch {
      toast.error('Could not rename the group');
    }
  }, [client, prompts, roomId, currentUser, workspaceId]);

  const handleAvatarFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !client) return;
    try {
      await client.setRoomAvatar(roomId, file);
      toast.success('Group avatar updated');
    } catch {
      toast.error('Could not update group avatar');
    } finally {
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleClearAvatar = async () => {
    if (!client) return;
    try {
      await client.clearRoomAvatar(roomId);
      toast.success('Group avatar removed');
    } catch {
      toast.error('Could not remove group avatar');
    }
  };

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
      if (currentUser) {
        await client
          .sendStructuredMessage(
            roomId,
            buildGroupDmMemberEvent(
              'member_left',
              roomId,
              workspaceId,
              currentUser,
              currentUser,
            ),
          )
          .catch(() => undefined);
      }
      await client.leaveRoom(roomId);
      toast.success('You left the group');
      navigate(`/w/${workspaceSlug}/dms`);
    } catch {
      toast.error('Could not leave the group');
    }
  }, [
    client,
    prompts,
    roomId,
    title,
    navigate,
    workspaceSlug,
    currentUser,
    workspaceId,
  ]);

  return (
    <div className="top-0 backdrop-blur-md sticky z-20 shrink-0 border-b border-border bg-background/95">
      <div className="gap-2.5 px-3 sm:px-6 py-1.5 min-h-12 flex flex-wrap items-center justify-between">
        <div className="min-w-0 gap-2.5 flex items-center">
          {/* Group Avatar with optional upload trigger */}
          <div className="relative group/avatar shrink-0">
            <GroupAvatar
              name={title}
              avatarUrl={roomAvatarUrl}
              members={members}
              size="sm"
              className="size-8"
            />
            {canManage && !isChannel ? (
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                title="Change group avatar"
                aria-label="Change group avatar"
                className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg text-white opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera className="size-3.5" />
              </button>
            ) : null}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileChange}
            />
          </div>

          <div className="min-w-0">
            <h2 className="text-base font-semibold tracking-tight truncate text-foreground">
              {title}
            </h2>
            <button
              type="button"
              onClick={onToggleMembersPanel}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 cursor-pointer"
            >
              {onlineCount > 0 ? (
                <span className="inline-flex items-center gap-1 text-success font-medium">
                  <span className="size-1.5 rounded-full bg-success inline-block" />
                  {onlineCount} online
                </span>
              ) : null}
              {onlineCount > 0 ? <span>·</span> : null}
              <span>
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </span>
              {isMuted ? ' · muted' : ''}
            </button>
          </div>

          <div className="gap-0.5 flex items-center">
            <Hint label={membersPanelOpen ? 'Hide members' : 'View members'}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-pressed={membersPanelOpen}
                aria-label="View members"
                onClick={onToggleMembersPanel}
                className={cn(membersPanelOpen && 'bg-accent text-accent-foreground')}
              >
                <Users className="size-4" />
              </Button>
            </Hint>

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
                <DropdownMenuItem
                  onClick={onToggleMembersPanel}
                  className="gap-2.5"
                >
                  <Users className="size-4" />
                  <span>{membersPanelOpen ? 'Hide members' : 'View members'}</span>
                </DropdownMenuItem>

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

                    {canManage ? (
                      <DropdownMenuItem
                        onClick={() => avatarInputRef.current?.click()}
                        className="gap-2.5"
                      >
                        <Camera className="size-4" />
                        <span>Change group avatar</span>
                      </DropdownMenuItem>
                    ) : null}

                    {canManage && roomAvatarUrl ? (
                      <DropdownMenuItem
                        onClick={handleClearAvatar}
                        className="gap-2.5 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-4" />
                        <span>Remove group avatar</span>
                      </DropdownMenuItem>
                    ) : null}
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

                {onStartHuddle ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={onStartHuddle} className="gap-2.5">
                      <Headphones className="size-4" />
                      <span>Start a huddle</span>
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

        {/* The chat surface portals its actions here — incl. "Start a huddle". */}
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
  const { workspaceId } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
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
        selected.map(async (id) => ({
          id,
          matrixUserId: (await matrixApi.peerIdentity(id)).matrixUserId,
        })),
      );
      const toInvite = identities.filter(
        (identity) => !currentSet.has(identity.matrixUserId),
      );

      if (toInvite.length === 0) {
        toast.info('Everyone selected is already in this group.');
      } else {
        await client.addToGroupDirectMessage(
          roomId,
          toInvite.map((identity) => identity.matrixUserId),
        );
        toast.success(
          toInvite.length === 1
            ? 'Added 1 person to the group'
            : `Added ${toInvite.length} people to the group`,
        );

        if (currentUser) {
          const membersById = new Map(
            workspacePeople.map((member) => [member.user.id, member.user]),
          );
          await Promise.all(
            toInvite.map((identity) => {
              const target = membersById.get(identity.id);
              if (!target) return Promise.resolve();
              return client
                .sendStructuredMessage(
                  roomId,
                  buildGroupDmMemberEvent(
                    'member_added',
                    roomId,
                    workspaceId,
                    currentUser,
                    target,
                  ),
                )
                .catch(() => undefined);
            }),
          );
        }
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
