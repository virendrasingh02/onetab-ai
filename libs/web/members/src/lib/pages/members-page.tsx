import { coworkersApi, queryKeys } from '@org/api-client';
import { useCurrentUser } from '@org/auth';
import { useUserPresenceMap } from '@org/realtime';
import {
  WorkspacePermission,
  WorkspaceRole,
  type AICoworkerDetail,
} from '@org/types';
import {
  ActionDropdownMenu,
  AiEntityAvatar,
  Badge,
  Button,
  EmptyState,
  EntityContextMenu,
  LocalTime,
  SearchInput,
  Skeleton,
  SkeletonAvatar,
  SkeletonText,
  UserAvatar,
  useRightPanelStore,
  type EntityAction,
  PageBar,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import {
  useCurrentWorkspace,
  useWorkspacePermission,
  useWorkspaceStore,
  type WorkspaceState,
} from '@org/web-workspace';
import { useQuery } from '@tanstack/react-query';
import {
  MessageSquare,
  MoreHorizontal,
  ShieldCheck,
  Sparkles,
  UserMinus,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useMemberMutations, useMembers } from '../use-members.js';

/** Coworker status pill, from the API's `status` + `isActive` — same shape as `PRESENCE_META`. */
function coworkerStatusMeta(coworker: AICoworkerDetail): {
  label: string;
  dot: string;
  text: string;
} {
  if (!coworker.isActive) {
    return {
      label: 'Paused',
      dot: 'bg-muted-foreground/40',
      text: 'text-muted-foreground',
    };
  }
  switch (coworker.status) {
    case 'WORKING':
    case 'RUNNING_TASK':
      return {
        label: 'Working',
        dot: 'bg-primary ring-2 ring-primary/20 animate-pulse',
        text: 'text-primary',
      };
    case 'IDLE':
      return {
        label: 'Idle',
        dot: 'bg-warning ring-2 ring-warning/20',
        text: 'text-warning-text',
      };
    case 'ERROR':
      return {
        label: 'Needs attention',
        dot: 'bg-destructive ring-2 ring-destructive/20',
        text: 'text-destructive-text',
      };
    default:
      return {
        label: 'Available',
        dot: 'bg-success ring-2 ring-success/20',
        text: 'text-success-text',
      };
  }
}

const ROLE_BADGE: Record<string, 'primary' | 'info' | 'neutral'> = {
  OWNER: 'primary',
  ADMIN: 'info',
  MEMBER: 'neutral',
  GUEST: 'neutral',
};

type PresenceKey = 'online' | 'away' | 'busy' | 'offline';

/** Right-hand status pill on a human row, mirroring the coworker "Available" pill. */
const PRESENCE_META: Record<
  PresenceKey,
  { label: string; dot: string; text: string }
> = {
  online: {
    label: 'Active',
    dot: 'bg-success ring-2 ring-success/20',
    text: 'text-success-text',
  },
  away: {
    label: 'Away',
    dot: 'bg-warning ring-2 ring-warning/20',
    text: 'text-warning-text',
  },
  busy: {
    label: 'Busy',
    dot: 'bg-destructive ring-2 ring-destructive/20',
    text: 'text-destructive-text',
  },
  offline: {
    label: 'Offline',
    dot: 'bg-muted-foreground/40',
    text: 'text-muted-foreground',
  },
};

export function MembersPage() {
  const { workspaceId, workspace } = useCurrentWorkspace();
  const navigate = useNavigate();
  const members = useMembers(workspaceId);
  const coworkers = useQuery({
    queryKey: workspaceId
      ? queryKeys.coworkers.all(workspaceId)
      : ['coworkers', 'all'],
    queryFn: () =>
      workspaceId ? coworkersApi.list(workspaceId) : Promise.resolve([]),
    enabled: Boolean(workspaceId),
  });

  const { updateRole, remove } = useMemberMutations(workspaceId);
  const currentUser = useCurrentUser();
  const presenceMap = useUserPresenceMap();
  const openProfilePanel = useRightPanelStore((s) => s.openProfile);
  const setInviteMembersOpen = useWorkspaceStore(
    (s: WorkspaceState) => s.setInviteMembersOpen,
  );
  const [query, setQuery] = useState('');

  // Asks for the capability rather than comparing role rungs, so this agrees
  // with what the API's guard will decide for the same request.
  const { can } = useWorkspacePermission();
  const canManage = can(WorkspacePermission.MANAGE_MEMBERS);

  const filteredHumans = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = members.data ?? [];
    if (!term) return list;
    return list.filter((member) =>
      [
        member.user.displayName ?? member.user.name,
        member.user.username,
        member.user.jobTitle,
        member.role,
      ].some((field) => field?.toLowerCase().includes(term)),
    );
  }, [members.data, query]);

  const filteredCoworkers = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = (coworkers.data as AICoworkerDetail[] | undefined) ?? [];
    if (!term) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        (c.role && c.role.toLowerCase().includes(term)) ||
        (c.description && c.description.toLowerCase().includes(term)),
    );
  }, [coworkers.data, query]);

  const isLoading =
    members.isLoading &&
    !members.data &&
    coworkers.isLoading &&
    !coworkers.data;
  const noMatches =
    filteredHumans.length === 0 && filteredCoworkers.length === 0;

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <PageBar
        icon={<Users />}
        title="People &amp; AI Coworkers"
        meta={
          isLoading ? (
            <Skeleton className="h-4.5 w-24 rounded-full" />
          ) : (
            <Badge
              variant="neutral"
              className="px-1.5 py-0 h-4.5 gap-1 text-[11px]"
            >
              <span>{members.data?.length ?? 0} humans</span>
              <span aria-hidden>·</span>
              <span>{(coworkers.data as any[])?.length ?? 0} AI coworkers</span>
            </Badge>
          )
        }
        actions={
          <>
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search people & AI coworkers…"
              className="h-7 text-xs"
              wrapperClassName="w-40 sm:w-56"
            />
            {canManage ? (
              <Button
                onClick={() => setInviteMembersOpen(true)}
                size="sm"
                className="h-7 text-xs gap-1"
                leadingIcon={<UserPlus className="size-3.5" />}
              >
                Invite people
              </Button>
            ) : null}
          </>
        }
      />

      <div className="min-h-0 p-4 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-4xl space-y-6 mx-auto">
          {isLoading ? (
            <div
              className="divide-y rounded-lg border bg-card"
              role="status"
              aria-busy="true"
              aria-label="Loading members..."
            >
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="gap-3 px-4 py-3 flex items-center justify-between"
                >
                  <div className="gap-3 min-w-0 flex flex-1 items-center">
                    <SkeletonAvatar size="md" shape="circle" />
                    <div className="min-w-0 space-y-1.5 flex-1">
                      <SkeletonText
                        width={idx % 2 === 0 ? 'w-36' : 'w-44'}
                        size="sm"
                      />
                      <SkeletonText width="w-24" size="xs" />
                    </div>
                  </div>
                  <div className="gap-2 flex items-center">
                    <Skeleton className="h-5 w-14 rounded-full" />
                    <Skeleton className="h-7 w-7 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
          ) : noMatches ? (
            <EmptyState
              icon={<Users />}
              title="No people or AI coworkers match"
              description={`Nothing matched "${query}".`}
            />
          ) : (
            <>
              {/* Humans Section */}
              {filteredHumans.length > 0 && (
                <div className="space-y-2">
                  <div className="px-1 flex items-center justify-between">
                    <div className="gap-1.5 flex items-center">
                      <Users className="size-3.5 text-primary" aria-hidden />
                      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        Humans
                      </h3>
                      <Badge
                        variant="neutral"
                        className="px-1.5 py-0 font-medium text-[10px]"
                      >
                        {filteredHumans.length}
                      </Badge>
                    </div>
                  </div>

                  <ul className="divide-y rounded-lg border bg-card">
                    {filteredHumans.map((member) => {
                      const isSelf = member.user.id === currentUser?.id;
                      const isOwner = member.role === WorkspaceRole.OWNER;
                      const livePresence = presenceMap[member.user.id];
                      const memberStatus: PresenceKey =
                        livePresence?.status ??
                        (member.user.presence === 'ONLINE'
                          ? 'online'
                          : member.user.presence === 'AWAY'
                            ? 'away'
                            : member.user.presence === 'BUSY'
                              ? 'busy'
                              : 'offline');
                      const presenceMeta = PRESENCE_META[memberStatus];
                      const statusEmoji =
                        livePresence?.statusEmoji ?? member.user.statusEmoji;
                      const statusText =
                        livePresence?.statusText ?? member.user.statusText;

                      const name = member.user.displayName ?? member.user.name;
                      const jobTitle =
                        member.user.jobTitle?.trim() ||
                        member.user.title?.trim() ||
                        null;
                      const openProfile = () =>
                        openProfilePanel({
                          userId: member.user.id,
                          name,
                          avatarUrl: member.user.avatarUrl ?? undefined,
                          title: jobTitle ?? undefined,
                          role: member.role,
                          email: member.email ?? undefined,
                          joinedAt: member.joinedAt,
                          bio: member.user.bio ?? undefined,
                          timezone: member.user.timezone,
                          statusEmoji,
                          statusText,
                          status:
                            memberStatus === 'away' || memberStatus === 'busy'
                              ? 'unavailable'
                              : memberStatus,
                        });
                      const openMessage = () => {
                        if (workspace?.slug) {
                          navigate(
                            `/w/${workspace.slug}/dms/${member.user.id}`,
                          );
                        }
                      };

                      const manageable = canManage && !isOwner && !isSelf;
                      const actions: EntityAction[] = [
                        {
                          id: 'profile',
                          group: 'open',
                          label: 'View profile',
                          icon: UserRound,
                          run: openProfile,
                        },
                        {
                          id: 'message',
                          group: 'open',
                          label: isSelf ? 'Open your notes' : `Message ${name}`,
                          icon: MessageSquare,
                          hidden: !workspace?.slug,
                          run: openMessage,
                        },
                        {
                          id: 'role',
                          group: 'manage',
                          label: 'Change role',
                          icon: ShieldCheck,
                          hidden: !manageable,
                          children: [
                            WorkspaceRole.ADMIN,
                            WorkspaceRole.MEMBER,
                            WorkspaceRole.GUEST,
                          ].map((role): EntityAction => ({
                            id: `role-${role}`,
                            label: role.charAt(0) + role.slice(1).toLowerCase(),
                            checked: member.role === role,
                            disabled: member.role === role,
                            successMessage: `${name} is now ${role.toLowerCase()}`,
                            run: () =>
                              updateRole.mutateAsync({
                                userId: member.user.id,
                                input: { role },
                              }),
                          })),
                        },
                        {
                          id: 'remove',
                          group: 'danger',
                          label: 'Remove from workspace…',
                          icon: UserMinus,
                          destructive: true,
                          hidden: !manageable,
                          confirm: {
                            title: `Remove ${name} from this workspace?`,
                            description:
                              'They lose access immediately. Their content stays, and you can re-invite them later.',
                            confirmLabel: 'Remove',
                            destructive: true,
                          },
                          run: () => remove.mutateAsync(member.user.id),
                        },
                      ];

                      return (
                        <EntityContextMenu
                          key={member.id}
                          actions={actions}
                          scope={`member:${member.user.id}`}
                          entityType="member"
                          entity={member}
                          label={name}
                        >
                          <li className="gap-3 px-4 py-3 flex items-center justify-between transition-colors hover:bg-muted/10">
                            <button
                              type="button"
                              onClick={openProfile}
                              className="gap-3 min-w-0 flex flex-1 cursor-pointer items-center text-left"
                            >
                              <UserAvatar
                                size="lg"
                                name={name}
                                src={member.user.avatarUrl}
                                seed={member.user.id}
                                avatarColor={member.avatarColor}
                                presence={memberStatus}
                                statusEmoji={statusEmoji}
                                statusText={statusText}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="gap-2 min-w-0 flex items-center">
                                  <p className="text-sm font-semibold truncate text-foreground hover:underline">
                                    {name}
                                    {isSelf ? (
                                      <span className="font-normal text-muted-foreground">
                                        {' '}
                                        (you)
                                      </span>
                                    ) : null}
                                  </p>
                                  {member.user.username ? (
                                    <span className="text-xs truncate text-muted-foreground">
                                      @{member.user.username}
                                    </span>
                                  ) : null}
                                  <Badge
                                    variant={
                                      ROLE_BADGE[member.role] ?? 'neutral'
                                    }
                                    className="font-bold px-1 py-0 h-4 shrink-0 text-[9px] uppercase"
                                  >
                                    {member.role.toLowerCase()}
                                  </Badge>
                                </div>
                                <p className="gap-1.5 text-xs mt-0.5 min-w-0 flex items-center text-muted-foreground">
                                  {jobTitle ? (
                                    <>
                                      <span className="font-medium truncate text-foreground/80">
                                        {jobTitle}
                                      </span>
                                      <span aria-hidden>·</span>
                                    </>
                                  ) : null}
                                  {statusText || statusEmoji ? (
                                    <>
                                      <span className="truncate">
                                        {statusEmoji ? `${statusEmoji} ` : ''}
                                        {statusText}
                                      </span>
                                      <span aria-hidden>·</span>
                                    </>
                                  ) : null}
                                  <span className="shrink-0">
                                    Joined {formatRelative(member.joinedAt)}
                                  </span>
                                  <span aria-hidden>·</span>
                                  <LocalTime
                                    timezone={member.user.timezone}
                                    icon
                                    withHint
                                    hintName={name}
                                  />
                                </p>
                              </div>
                            </button>

                            <div className="gap-2 flex shrink-0 items-center">
                              <div
                                className={`gap-1.5 text-xs font-medium flex items-center ${presenceMeta.text}`}
                              >
                                <span
                                  className={`size-2 rounded-full ${presenceMeta.dot}`}
                                />
                                <span className="sm:inline hidden">
                                  {presenceMeta.label}
                                </span>
                              </div>

                              {workspace?.slug ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 text-xs gap-1.5"
                                  onClick={openMessage}
                                >
                                  <MessageSquare className="size-3.5" />
                                  <span>{isSelf ? 'Notes' : 'Message'}</span>
                                </Button>
                              ) : null}

                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={openProfile}
                              >
                                View profile
                              </Button>

                              {manageable ? (
                                <ActionDropdownMenu
                                  actions={actions}
                                  scope={`member:${member.user.id}`}
                                  entityType="member"
                                  entity={member}
                                  trigger={
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={`Manage ${name}`}
                                    >
                                      <MoreHorizontal />
                                    </Button>
                                  }
                                />
                              ) : null}
                            </div>
                          </li>
                        </EntityContextMenu>
                      );
                    })}
                  </ul>
                </div>
              )}

              {/* AI Coworkers Section */}
              {filteredCoworkers.length > 0 && (
                <div className="space-y-2">
                  <div className="px-1 flex items-center justify-between">
                    <div className="gap-1.5 flex items-center">
                      <Sparkles className="size-3.5 text-primary" aria-hidden />
                      <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        AI Coworkers
                      </h3>
                      <Badge
                        variant="primary"
                        className="px-1.5 py-0 font-medium text-[10px]"
                      >
                        {filteredCoworkers.length}
                      </Badge>
                    </div>
                  </div>

                  <ul className="divide-y rounded-lg border bg-card">
                    {filteredCoworkers.map((coworker) => {
                      // Same right-rail profile the coworker's DM header opens.
                      const openCoworkerProfile = () =>
                        openProfilePanel({
                          entityKind: 'coworker',
                          entityId: coworker.id,
                          raw: coworker,
                          userId:
                            coworker.matrixUserId ?? `coworker-${coworker.id}`,
                          name: coworker.name,
                          avatarUrl: coworker.avatarUrl ?? undefined,
                          role: coworker.role,
                          bio: coworker.description ?? undefined,
                        });
                      const handleMessage = () => {
                        if (workspace?.slug) {
                          navigate(
                            `/w/${workspace.slug}/coworkers/${coworker.id}`,
                          );
                        }
                      };

                      const statusMeta = coworkerStatusMeta(coworker);

                      return (
                        <li
                          key={coworker.id}
                          className="gap-3 px-4 py-3 flex items-center justify-between transition-colors hover:bg-muted/10"
                        >
                          <button
                            type="button"
                            onClick={openCoworkerProfile}
                            className="gap-3 min-w-0 flex flex-1 cursor-pointer items-center text-left"
                          >
                            <span className="relative inline-flex shrink-0">
                              <AiEntityAvatar
                                name={coworker.name}
                                kind="coworker"
                                avatarUrl={coworker.avatarUrl}
                                size="md"
                              />
                              <span
                                className={`-bottom-0.5 -right-0.5 size-2.5 absolute rounded-full ring-2 ring-background ${statusMeta.dot}`}
                              />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="gap-2 flex items-center">
                                <p className="text-sm font-semibold truncate text-foreground hover:underline">
                                  {coworker.name}
                                </p>
                                <Badge
                                  variant="primary"
                                  className="font-bold px-1 py-0 h-4 border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[9px] uppercase"
                                >
                                  AI COWORKER
                                </Badge>
                              </div>
                              <p className="text-xs mt-0.5 truncate text-muted-foreground">
                                {coworker.role ? (
                                  <span className="font-medium mr-1.5 text-foreground/80">
                                    {coworker.role}
                                  </span>
                                ) : null}
                                {coworker.description ? (
                                  <span>{coworker.description}</span>
                                ) : null}
                              </p>
                            </div>
                          </button>

                          <div className="gap-2 flex shrink-0 items-center">
                            <div
                              className={`gap-1.5 text-xs font-medium flex items-center ${statusMeta.text}`}
                            >
                              <span
                                className={`size-2 rounded-full ${statusMeta.dot}`}
                              />
                              <span className="sm:inline hidden">
                                {statusMeta.label}
                              </span>
                            </div>

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1.5"
                              onClick={handleMessage}
                            >
                              <MessageSquare className="size-3.5" />
                              <span>Message</span>
                            </Button>

                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={openCoworkerProfile}
                            >
                              View profile
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
