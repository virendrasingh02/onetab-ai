import { coworkersApi, queryKeys } from '@org/api-client';
import { useCurrentUser } from '@org/auth';
import { useUserPresenceMap } from '@org/realtime';
import {
  WorkspacePermission,
  WorkspaceRole,
  coworkerTemplateKey,
  getCoworkerTemplate,
  type AICoworkerDetail,
} from '@org/types';
import {
  ActionDropdownMenu,
  Badge,
  Button,
  EmptyState,
  EntityContextMenu,
  LocalTime,
  SearchInput,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
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
  Bot,
  Check,
  Clock,
  Cpu,
  MessageSquare,
  MoreHorizontal,
  Play,
  Shield,
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

const ROLE_BADGE: Record<string, 'primary' | 'info' | 'neutral'> = {
  OWNER: 'primary',
  ADMIN: 'info',
  MEMBER: 'neutral',
  GUEST: 'neutral',
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
  const [selectedCoworker, setSelectedCoworker] =
    useState<AICoworkerDetail | null>(null);

  // Asks for the capability rather than comparing role rungs, so this agrees
  // with what the API's guard will decide for the same request.
  const { can } = useWorkspacePermission();
  const canManage = can(WorkspacePermission.MANAGE_MEMBERS);

  const filteredHumans = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = members.data ?? [];
    if (!term) return list;
    return list.filter((member) =>
      (member.user.displayName ?? member.user.name)
        .toLowerCase()
        .includes(term),
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
                      const openDrawer = () => setSelectedCoworker(coworker);
                      const handleMessage = () => {
                        if (workspace?.slug) {
                          navigate(
                            `/w/${workspace.slug}/coworkers/${coworker.id}`,
                          );
                        }
                      };

                      return (
                        <li
                          key={coworker.id}
                          className="gap-3 px-4 py-3 flex items-center justify-between transition-colors hover:bg-muted/10"
                        >
                          <button
                            type="button"
                            onClick={openDrawer}
                            className="gap-3 min-w-0 flex flex-1 cursor-pointer items-center text-left"
                          >
                            <div className="size-10 bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400 relative flex shrink-0 items-center justify-center rounded-xl border">
                              <Bot className="size-5" />
                              <span className="-bottom-0.5 -right-0.5 size-2.5 bg-success absolute rounded-full shadow-[0_0_6px_color-mix(in_oklab,var(--color-success)_50%,transparent)] ring-2 ring-background" />
                            </div>
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
                            <div className="gap-1.5 text-xs text-success-text font-medium flex items-center">
                              <span className="size-2 bg-success ring-success/20 rounded-full shadow-[0_0_8px_color-mix(in_oklab,var(--color-success)_40%,transparent)] ring-2" />
                              <span className="sm:inline hidden">
                                Available
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
                              onClick={openDrawer}
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

              {/* Humans Section */}
              {filteredHumans.length > 0 && (
                <div className="space-y-2">
                  <div className="px-1 flex items-center justify-between">
                    <div className="gap-1.5 flex items-center">
                      <Users
                        className="size-3.5 text-muted-foreground"
                        aria-hidden
                      />
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
                      const memberStatus =
                        livePresence?.status ??
                        (member.user.presence === 'ONLINE'
                          ? 'online'
                          : member.user.presence === 'AWAY'
                            ? 'away'
                            : member.user.presence === 'BUSY'
                              ? 'busy'
                              : 'offline');

                      const name = member.user.displayName ?? member.user.name;
                      const openProfile = () =>
                        openProfilePanel({
                          userId: member.user.id,
                          name: member.user.displayName ?? member.user.name,
                          avatarUrl: member.user.avatarUrl ?? undefined,
                          role: member.role,
                          timezone: member.user.timezone,
                          statusEmoji: member.user.statusEmoji,
                          statusText: member.user.statusText,
                          status:
                            memberStatus === 'away' || memberStatus === 'busy'
                              ? 'unavailable'
                              : memberStatus,
                        });

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
                          run: () =>
                            navigate(
                              `/w/${workspace?.slug}/dms/${member.user.id}`,
                            ),
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
                              className="gap-3 min-w-0 flex flex-1 cursor-pointer items-center text-left transition-opacity hover:opacity-80"
                            >
                              <UserAvatar
                                name={
                                  member.user.displayName ?? member.user.name
                                }
                                src={member.user.avatarUrl}
                                seed={member.user.id}
                                presence={memberStatus}
                                statusEmoji={member.user.statusEmoji}
                                statusText={member.user.statusText}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate text-foreground hover:underline">
                                  {member.user.displayName ?? member.user.name}
                                  {isSelf ? (
                                    <span className="font-normal text-muted-foreground">
                                      {' '}
                                      (you)
                                    </span>
                                  ) : null}
                                </p>
                                <p className="gap-1.5 text-xs flex items-center text-muted-foreground">
                                  <span>
                                    Joined {formatRelative(member.joinedAt)}
                                  </span>
                                  <span aria-hidden>·</span>
                                  <LocalTime
                                    timezone={member.user.timezone}
                                    icon
                                    withHint
                                    hintName={
                                      member.user.displayName ??
                                      member.user.name
                                    }
                                  />
                                </p>
                              </div>
                            </button>

                            <div className="gap-2 flex items-center">
                              <Badge
                                variant={ROLE_BADGE[member.role] ?? 'neutral'}
                              >
                                {member.role.toLowerCase()}
                              </Badge>

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
                                      aria-label={`Manage ${member.user.name}`}
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
            </>
          )}
        </div>
      </div>

      {/* Coworker Profile Sheet Drawer */}
      <Sheet
        open={Boolean(selectedCoworker)}
        onOpenChange={(open) => !open && setSelectedCoworker(null)}
      >
        <SheetContent
          side="right"
          className="p-0 sm:max-w-md w-full overflow-y-auto"
        >
          <SheetTitle className="sr-only">
            {selectedCoworker?.name ?? 'Coworker Profile'}
          </SheetTitle>
          <SheetDescription className="sr-only">
            View coworker details, capabilities, and telemetry.
          </SheetDescription>
          {selectedCoworker && (
            <div className="p-6 space-y-6 flex h-full w-full flex-col bg-surface text-foreground">
              <div className="flex items-start justify-between">
                <div className="gap-3 flex items-center">
                  <div className="size-14 bg-purple-500/10 border-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center rounded-2xl border">
                    <Bot className="size-8" />
                  </div>
                  <div>
                    <div className="gap-2 flex items-center">
                      <h3 className="text-lg font-bold text-foreground">
                        {selectedCoworker.name}
                      </h3>
                      <Badge
                        variant="primary"
                        className="font-bold px-1.5 py-0 h-4 border-purple-500/30 bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[9px] uppercase"
                      >
                        AI COWORKER
                      </Badge>
                    </div>
                    <p className="text-xs font-medium mt-0.5 text-primary">
                      {selectedCoworker.role}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                className="gap-2 font-medium w-full shadow-xs"
                onClick={() => {
                  setSelectedCoworker(null);
                  if (workspace?.slug) {
                    navigate(
                      `/w/${workspace.slug}/coworkers/${selectedCoworker.id}`,
                    );
                  }
                }}
              >
                <Play className="size-3.5 fill-current" />
                <span>Direct Message</span>
              </Button>

              <div className="space-y-3 pt-3 text-xs border-t border-border/60">
                <div className="py-0.5 flex items-center justify-between">
                  <span className="gap-1.5 flex items-center text-muted-foreground">
                    <Clock className="size-3.5" />
                    Status
                  </span>
                  <div className="gap-1.5 text-success-text font-semibold flex items-center">
                    <span className="size-2 bg-success rounded-full shadow-[0_0_8px_color-mix(in_oklab,var(--color-success)_50%,transparent)]" />
                    <span>Available</span>
                  </div>
                </div>

                <div className="py-0.5 flex items-center justify-between">
                  <span className="gap-1.5 flex items-center text-muted-foreground">
                    <Cpu className="size-3.5" />
                    Model &amp; Provider
                  </span>
                  <span className="font-semibold font-mono text-foreground">
                    {selectedCoworker.model || 'gpt-4o'} (
                    {selectedCoworker.provider || 'openai'})
                  </span>
                </div>

                <div className="py-0.5 flex items-center justify-between">
                  <span className="gap-1.5 flex items-center text-muted-foreground">
                    <Shield className="size-3.5" />
                    Knowledge Access
                  </span>
                  <Badge variant="primary" className="text-[10px]">
                    Workspace RAG Active
                  </Badge>
                </div>
              </div>

              {selectedCoworker.description && (
                <div className="pt-3 space-y-1.5 border-t border-border/60">
                  <h4 className="font-bold tracking-wider text-[11px] text-muted-foreground uppercase">
                    Scope &amp; Purpose
                  </h4>
                  <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {selectedCoworker.description}
                  </p>
                </div>
              )}

              {/* Capabilities */}
              <div className="pt-3 space-y-2 border-t border-border/60">
                <h4 className="font-bold tracking-wider gap-1.5 flex items-center text-[11px] text-muted-foreground uppercase">
                  <Check className="size-3 text-primary" />
                  <span>Capabilities</span>
                </h4>
                <ul className="space-y-1.5">
                  {(
                    (
                      selectedCoworker.configuration as {
                        capabilities?: string[];
                      } | null
                    )?.capabilities ??
                    getCoworkerTemplate(
                      coworkerTemplateKey(selectedCoworker.configuration),
                    )?.capabilities ??
                    []
                  ).map((cap: string, i: number) => (
                    <li
                      key={i}
                      className="gap-2 text-xs flex items-start text-foreground/90"
                    >
                      <span className="size-1.5 mt-1.5 shrink-0 rounded-full bg-primary/70" />
                      <span>{cap}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
