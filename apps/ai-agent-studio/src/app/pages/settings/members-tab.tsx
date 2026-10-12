import { ApiError, invitationApi, memberApi } from '@org/api-client';
import { WorkspaceRole, type Invitation, type WorkspaceMember } from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  confirm,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  Textarea,
  toast,
  UserIdentity,
} from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MailPlus, Trash2, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useStudioSession } from '../../session-guard.js';

const QUIET = { disableToast: true } as const;

const errorText = (err: unknown): string =>
  err instanceof ApiError || err instanceof Error ? err.message : 'Something went wrong.';

const ASSIGNABLE_ROLES = [
  { value: WorkspaceRole.ADMIN, label: 'Admin', description: 'Manage members, billing and every agent' },
  { value: WorkspaceRole.MEMBER, label: 'Member', description: 'Build and run agents' },
  { value: WorkspaceRole.GUEST, label: 'Guest', description: 'Limited access to what they are added to' },
];

const ROLE_BLURB: Record<string, string> = {
  OWNER: 'Full control, including billing and deleting the workspace',
  ADMIN: 'Manages members and every agent',
  MEMBER: 'Builds and runs agents',
  GUEST: 'Limited access',
};

const parseEmails = (text: string): string[] =>
  [...new Set(text.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

/**
 * The workspace's real members and pending invitations. Changing roles,
 * removing people and inviting need an admin; for anyone else the controls
 * are off rather than failing after a click.
 */
export function MembersTab() {
  const { activeWorkspace, user } = useStudioSession();
  const workspaceId = activeWorkspace.id;
  const queryClient = useQueryClient();

  const membersKey = ['workspace-members', workspaceId] as const;
  const invitesKey = ['workspace-invitations', workspaceId] as const;

  const membersQuery = useQuery({ queryKey: membersKey, queryFn: () => memberApi.list(workspaceId) });
  const members = membersQuery.data ?? [];
  const me = members.find((m) => m.user.id === user.id);
  const canManage = me?.role === WorkspaceRole.OWNER || me?.role === WorkspaceRole.ADMIN;

  const invitesQuery = useQuery({
    queryKey: invitesKey,
    queryFn: () => invitationApi.list(workspaceId, { status: 'PENDING' }),
    enabled: canManage,
  });
  const invitations = invitesQuery.data ?? [];

  const [inviteOpen, setInviteOpen] = useState(false);
  const [emailsText, setEmailsText] = useState('');
  const [inviteRole, setInviteRole] = useState<string>(WorkspaceRole.MEMBER);
  const emails = useMemo(() => parseEmails(emailsText), [emailsText]);
  const invalid = emails.filter((e) => !isEmail(e));

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: membersKey });
    void queryClient.invalidateQueries({ queryKey: invitesKey });
  };

  const invite = useMutation({
    meta: QUIET,
    mutationFn: () => invitationApi.create(workspaceId, { emails, role: inviteRole as WorkspaceRole }),
    onSuccess: () => {
      refresh();
      setInviteOpen(false);
      setEmailsText('');
      toast.success(`Invited ${emails.length} ${emails.length === 1 ? 'person' : 'people'}`);
    },
    onError: (e) => toast.error('Could not send the invitations', { description: errorText(e) }),
  });

  const changeRole = useMutation({
    meta: QUIET,
    mutationFn: (input: { userId: string; role: Exclude<WorkspaceRole, 'OWNER'> }) => memberApi.updateRole(workspaceId, input.userId, { role: input.role }),
    onSuccess: refresh,
    onError: (e) => toast.error('Could not change the role', { description: errorText(e) }),
  });

  const remove = useMutation({
    meta: QUIET,
    mutationFn: (userId: string) => memberApi.remove(workspaceId, userId),
    onSuccess: () => {
      refresh();
      toast.success('Member removed');
    },
    onError: (e) => toast.error('Could not remove the member', { description: errorText(e) }),
  });

  const revoke = useMutation({
    meta: QUIET,
    mutationFn: (id: string) => invitationApi.revoke(workspaceId, id),
    onSuccess: () => {
      refresh();
      toast.success('Invitation revoked');
    },
    onError: (e) => toast.error('Could not revoke the invitation', { description: errorText(e) }),
  });

  const resend = useMutation({
    meta: QUIET,
    mutationFn: (id: string) => invitationApi.resend(workspaceId, id),
    onSuccess: () => toast.success('Invitation sent again'),
    onError: (e) => toast.error('Could not resend the invitation', { description: errorText(e) }),
  });

  const confirmRemove = async (m: WorkspaceMember) => {
    const ok = await confirm({
      title: `Remove ${m.user.displayName || m.user.name}?`,
      description: 'They lose access to this workspace and its agents straight away. Their past work stays.',
      confirmLabel: 'Remove member',
      destructive: true,
    });
    if (ok) remove.mutate(m.user.id);
  };

  if (membersQuery.isLoading) return <LoadingState label="Loading members…" />;
  if (membersQuery.isError) {
    return <ErrorState title="Couldn’t load members" description={errorText(membersQuery.error)} onRetry={() => void membersQuery.refetch()} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Workspace members</h3>
          <p className="text-xs text-muted-foreground">
            {members.length} {members.length === 1 ? 'person' : 'people'} in {activeWorkspace.name}. Roles are shared with the main platform.
          </p>
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)} disabled={!canManage} className="gap-1.5 text-xs" title={canManage ? undefined : 'Only admins can invite'}>
          <UserPlus className="size-3.5" /> Invite
        </Button>
      </div>

      {!canManage ? (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          You’re a {me?.role.toLowerCase() ?? 'member'} here, so you can see the team but not change it.
        </p>
      ) : null}

      {members.length === 0 ? (
        <EmptyState icon={<Users />} title="No members yet" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-surface">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-raised text-[11px] font-semibold uppercase text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3">Member</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Joined</th>
                <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {members.map((m) => {
                const isOwner = m.role === WorkspaceRole.OWNER;
                const isMe = m.user.id === user.id;
                const editable = canManage && !isOwner && !isMe;
                return (
                  <tr key={m.id} className="transition-colors hover:bg-surface-raised">
                    <td className="px-4 py-3">
                      <UserIdentity
                        name={m.user.name}
                        displayName={m.user.displayName}
                        src={m.user.avatarUrl}
                        seed={m.user.id}
                        email={m.email}
                        size="sm"
                        indicator={false}
                        badge={isMe ? <span className="text-[11px] text-muted-foreground">(you)</span> : undefined}
                      />
                    </td>
                    <td className="px-4 py-3">
                      {editable ? (
                        <AppSelect
                          size="sm"
                          aria-label={`Role for ${m.user.displayName || m.user.name}`}
                          value={m.role}
                          className="w-36"
                          onValueChange={(role) => changeRole.mutate({ userId: m.user.id, role: role as Exclude<WorkspaceRole, 'OWNER'> })}
                          options={ASSIGNABLE_ROLES}
                        />
                      ) : (
                        <div>
                          <Badge variant="outline" className="text-[11px] capitalize">
                            {m.role.toLowerCase()}
                          </Badge>
                          <div className="mt-0.5 text-[10px] text-muted-foreground">{ROLE_BLURB[m.role]}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={m.status === 'ACTIVE' ? 'success' : 'outline'} className="text-[10px] capitalize">
                        {m.status.toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      {editable ? (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Remove ${m.user.displayName || m.user.name}`}
                          onClick={() => void confirmRemove(m)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {canManage && invitations.length > 0 ? (
        <section aria-labelledby="pending-invites" className="space-y-2">
          <h4 id="pending-invites" className="text-xs font-semibold text-foreground">
            Pending invitations ({invitations.length})
          </h4>
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {invitations.map((inv: Invitation) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-xs">
                <span className="flex min-w-0 items-center gap-2">
                  <MailPlus className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate text-foreground">{inv.email ?? 'Invite link'}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {inv.role.toLowerCase()}
                  </Badge>
                </span>
                <span className="flex items-center gap-1">
                  <span className="mr-2 text-[11px] text-muted-foreground">expires {new Date(inv.expiresAt).toLocaleDateString()}</span>
                  {inv.email ? (
                    <Button variant="ghost" size="xs" onClick={() => resend.mutate(inv.id)} loading={resend.isPending && resend.variables === inv.id}>
                      Resend
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="xs" className="text-destructive hover:text-destructive" onClick={() => revoke.mutate(inv.id)}>
                    Revoke
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (emails.length > 0 && invalid.length === 0) invite.mutate();
            }}
          >
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="size-5 text-primary" /> Invite people
              </DialogTitle>
              <DialogDescription className="text-xs">They get an email with a link to join {activeWorkspace.name}.</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4 text-xs">
              <Field
                label="Email addresses"
                required
                hint="Separate several with commas, spaces or new lines."
                error={invalid.length > 0 ? `Not an email address: ${invalid.slice(0, 3).join(', ')}` : undefined}
              >
                <Textarea autoFocus rows={3} value={emailsText} onChange={(e) => setEmailsText(e.target.value)} placeholder="colleague@example.com" />
              </Field>
              <Field label="Role">
                <AppSelect value={inviteRole} onValueChange={setInviteRole} options={ASSIGNABLE_ROLES} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="ghost" size="sm" onClick={() => setInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={invite.isPending} disabled={emails.length === 0 || invalid.length > 0} className="font-semibold">
                Send {emails.length > 1 ? `${emails.length} invitations` : 'invitation'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
