import { useCurrentUser } from '@org/auth';
import type { PublicUser, RoomMember, SystemActivityEventContent, SystemEventEntity } from '@org/types';
import { getSystemEventCapabilities } from '@org/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  ScrollArea,
  toast,
  UserAvatar,
  usePromptDialog,
  useRightPanelStore,
} from '@org/ui';
import { useUserPresenceMap } from '@org/realtime';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  AtSign,
  MessageSquare,
  MoreHorizontal,
  Search,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatrix } from './matrix-provider.js';

export interface GroupMembersPanelProps {
  roomId: string;
  members: RoomMember[];
  workspaceSlug: string;
  onAddPeople: () => void;
  onClose: () => void;
  onMention?: (member: RoomMember) => void;
}

function toSystemEventEntity(user: PublicUser): SystemEventEntity {
  return {
    kind: 'user',
    id: user.id,
    name: user.displayName || user.name,
    avatarUrl: user.avatarUrl ?? undefined,
  };
}

function buildMemberRemovedEvent(
  roomId: string,
  workspaceId: string | undefined,
  actor: PublicUser,
  target: { id: string; name: string; avatarUrl?: string },
): SystemActivityEventContent {
  return {
    type: 'mie.system_event',
    eventType: 'member_removed',
    conversationType: 'group_dm',
    conversationId: roomId,
    workspaceId,
    actor: toSystemEventEntity(actor),
    target: {
      kind: 'user',
      id: target.id,
      name: target.name,
      avatarUrl: target.avatarUrl,
    },
    occurredAt: Date.now(),
    idempotencyKey: `group-dm-removed:${roomId}:${target.id}:${Date.now()}`,
    capabilities: getSystemEventCapabilities('member_removed'),
  };
}

export function GroupMembersPanel({
  roomId,
  members,
  workspaceSlug,
  onAddPeople,
  onClose,
  onMention,
}: GroupMembersPanelProps) {
  const { client } = useMatrix();
  const { workspaceId } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const presenceMap = useUserPresenceMap();
  const prompts = usePromptDialog();
  const openProfilePanel = useRightPanelStore((s) => s.openProfile);
  const navigate = useNavigate();
  const [search, setSearch] = useState('');

  const myUserId = client?.getSession()?.userId;
  const myMember = members.find((m) => m.userId === myUserId);
  const myPowerLevel = myMember?.powerLevel ?? 0;
  const canManage = myPowerLevel >= 50;

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.displayName.toLowerCase().includes(q) ||
        m.userId.toLowerCase().includes(q),
    );
  }, [members, search]);

  const handleRemoveMember = async (member: RoomMember) => {
    if (!client) return;
    const confirmed = await prompts.confirmAction({
      title: `Remove ${member.displayName} from this conversation?`,
      description: `${member.displayName} will no longer be able to send or receive messages in this group.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!confirmed) return;

    try {
      if (currentUser) {
        await client
          .sendStructuredMessage(
            roomId,
            buildMemberRemovedEvent(roomId, workspaceId, currentUser, {
              id: member.userId,
              name: member.displayName,
              avatarUrl: member.avatarUrl,
            }),
          )
          .catch(() => undefined);
      }
      await client.removeFromRoom(roomId, member.userId);
      toast.success(`Removed ${member.displayName} from the conversation`);
    } catch {
      toast.error(`Could not remove ${member.displayName}`);
    }
  };

  const handleOpenProfile = (member: RoomMember) => {
    openProfilePanel({
      userId: member.userId,
      name: member.displayName,
      avatarUrl: member.avatarUrl,
      powerLevel: member.powerLevel,
    });
  };

  const handleStartDM = (member: RoomMember) => {
    navigate(`/w/${workspaceSlug}/dms/${member.userId}`);
  };

  return (
    <div className="min-h-0 flex h-full flex-col bg-surface text-foreground border-l border-border">
      {/* Panel Header */}
      <div className="px-3 pt-3 pb-2 gap-2 flex shrink-0 items-center justify-between border-b border-border">
        <div className="gap-2 flex items-center min-w-0">
          <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold tracking-tight truncate">
            Members
          </h2>
          <Badge variant="neutral" className="px-1.5 py-0 h-4 text-[10px]">
            {members.length}
          </Badge>
        </div>
        <div className="gap-1 flex items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={onAddPeople}
            className="h-7 text-xs gap-1.5 px-2"
          >
            <UserPlus className="size-3.5" />
            <span>Add</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close members panel"
            className="size-7"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Search Input */}
      <div className="p-2 border-b border-border bg-surface-raised/40">
        <div className="relative">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members…"
            className="h-8 pl-8 text-xs bg-background"
          />
        </div>
      </div>

      {/* Member List */}
      <ScrollArea className="min-h-0 flex-1">
        {filteredMembers.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            No members found matching &ldquo;{search}&rdquo;.
          </div>
        ) : (
          <ul className="p-1 space-y-0.5">
            {filteredMembers.map((member) => {
              const livePresence = presenceMap[member.userId]?.status;
              const presence = livePresence ?? 'offline';
              const isSelf = member.userId === myUserId;
              const isOwner = member.powerLevel >= 100;
              const isAdmin = member.powerLevel >= 50 && !isOwner;
              const canRemoveThisMember =
                canManage && !isSelf && myPowerLevel > member.powerLevel;

              const roleLabel = isOwner ? 'Owner' : isAdmin ? 'Admin' : 'Member';

              return (
                <li
                  key={member.userId}
                  className="group flex items-center justify-between px-2.5 py-1.5 rounded-md hover:bg-accent/50 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => handleOpenProfile(member)}
                    className="min-w-0 gap-2.5 flex flex-1 items-center text-left focus-visible:outline-none"
                  >
                    <UserAvatar
                      name={member.displayName}
                      src={member.avatarUrl}
                      seed={member.userId}
                      presence={presence}
                      size="sm"
                      className="size-7"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="gap-1.5 flex items-center">
                        <span className="text-xs font-medium truncate text-foreground">
                          {member.displayName}
                        </span>
                        {isSelf ? (
                          <span className="text-[10px] text-muted-foreground">
                            (you)
                          </span>
                        ) : null}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {roleLabel}
                      </span>
                    </div>
                  </button>

                  <div className="gap-1 flex items-center shrink-0">
                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Actions for ${member.displayName}`}
                          className="size-6 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="bottom" className="w-48">
                        <DropdownMenuItem
                          onClick={() => handleOpenProfile(member)}
                          className="gap-2 text-xs"
                        >
                          <UserRound className="size-3.5" />
                          <span>View profile</span>
                        </DropdownMenuItem>
                        {!isSelf ? (
                          <DropdownMenuItem
                            onClick={() => handleStartDM(member)}
                            className="gap-2 text-xs"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Direct message</span>
                          </DropdownMenuItem>
                        ) : null}
                        {onMention ? (
                          <DropdownMenuItem
                            onClick={() => onMention(member)}
                            className="gap-2 text-xs"
                          >
                            <AtSign className="size-3.5" />
                            <span>Mention</span>
                          </DropdownMenuItem>
                        ) : null}
                        {canRemoveThisMember ? (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleRemoveMember(member)}
                              className="gap-2 text-xs text-destructive focus:text-destructive"
                            >
                              <UserMinus className="size-3.5" />
                              <span>Remove from group</span>
                            </DropdownMenuItem>
                          </>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
      {prompts.dialog}
    </div>
  );
}
