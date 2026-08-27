import { zodResolver } from '@hookform/resolvers/zod';
import { channelApi } from '@org/api-client';
import { formErrorMessage } from '@org/auth';
import { WorkspaceRole, type ChannelSummary } from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Form,
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SkeletonList,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@org/ui';
import { formatRelative, parseEmails } from '@org/utils';
import { inviteMembersSchema, type InviteMembersInput } from '@org/validation';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useQuery } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  Copy,
  Hash,
  Link2,
  Mail,
  MailPlus,
  MessageSquare,
  Plus,
  RefreshCw,
  RotateCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  useInvitationLinks,
  useInvitationMutations,
  useInvitations,
} from '../use-invitations.js';

export interface InviteMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultScope?: {
    type: 'WORKSPACE' | 'CHANNEL' | 'TEAM' | 'PROJECT';
    id?: string;
    name?: string;
  };
  defaultRole?: WorkspaceRole;
}

export function InviteMembersDialog({
  open,
  onOpenChange,
  defaultScope,
  defaultRole = WorkspaceRole.MEMBER,
}: InviteMembersDialogProps) {
  const { workspace, workspaceId, slug } = useCurrentWorkspace();
  const [activeTab, setActiveTab] = useState<'email' | 'link' | 'pending'>('email');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedDevToken, setCopiedDevToken] = useState<string | null>(null);

  // Link configuration state
  const [linkRole, setLinkRole] = useState<WorkspaceRole>(WorkspaceRole.MEMBER);
  const [linkExpiresInDays, setLinkExpiresInDays] = useState<number>(30);
  const [linkMaxUses, setLinkMaxUses] = useState<string>('');

  // Queries
  const invitations = useInvitations(workspaceId);
  const linksQuery = useInvitationLinks(workspaceId);
  const channelsQuery = useQuery({
    queryKey: ['channels', workspaceId, 'list'],
    queryFn: () => channelApi.list(workspaceId as string),
    enabled: !!workspaceId && open,
  });

  // Mutations
  const {
    invite,
    resend,
    revoke,
    createLink,
    revokeLink,
    regenerateLink,
  } = useInvitationMutations(workspaceId);

  const form = useForm<InviteMembersInput>({
    resolver: zodResolver(inviteMembersSchema),
    defaultValues: {
      emails: [],
      role: defaultRole,
      channelId: defaultScope?.type === 'CHANNEL' ? defaultScope.id : undefined,
      message: '',
    },
  });

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (!open) {
      form.reset({
        emails: [],
        role: defaultRole,
        channelId: defaultScope?.type === 'CHANNEL' ? defaultScope.id : undefined,
        message: '',
      });
      invite.reset();
      setActiveTab('email');
    } else {
      if (defaultScope?.type === 'CHANNEL' && defaultScope.id) {
        form.setValue('channelId', defaultScope.id);
      }
      form.setValue('role', defaultRole);
    }
  }, [open, defaultRole, defaultScope, form, invite]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await invite.mutateAsync(values);
      form.reset({
        emails: [],
        role: values.role,
        channelId: values.channelId,
        message: '',
      });
    } catch {
      // Error is caught and displayed by FormError
    }
  });

  const handleCopyLink = (urlOrToken: string, isFullUrl = false) => {
    const fullUrl = isFullUrl
      ? urlOrToken
      : `${window.location.origin}${urlOrToken.startsWith('/') ? '' : '/'}${urlOrToken}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCreateNewLink = async () => {
    const maxUses = linkMaxUses.trim() ? parseInt(linkMaxUses.trim(), 10) : null;
    await createLink.mutateAsync({
      role: linkRole,
      channelId: defaultScope?.type === 'CHANNEL' ? defaultScope.id : undefined,
      expiresInDays: linkExpiresInDays,
      maxUses: maxUses && !isNaN(maxUses) ? maxUses : undefined,
    });
  };

  const pending = useMemo(
    () => (invitations.data ?? []).filter((inv) => inv.status === 'PENDING'),
    [invitations.data],
  );

  const activeLinks = useMemo(
    () => (linksQuery.data ?? []).filter((link) => link.status === 'PENDING'),
    [linksQuery.data],
  );

  const channelsList: ChannelSummary[] = channelsQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <MailPlus className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Invite to {defaultScope?.name ? `${defaultScope.name} (${workspace?.name})` : workspace?.name ?? 'Workspace'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Grant teammates access via email invitations or shareable links.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(val) => setActiveTab(val as 'email' | 'link' | 'pending')}
          className="w-full"
        >
          <div className="px-6 border-b border-border/70 pb-2">
            <TabsList className="grid w-full grid-cols-3 h-8 text-xs bg-muted/60 p-0.5">
              <TabsTrigger value="email" className="text-xs py-1 flex items-center gap-1.5">
                <Mail className="size-3.5" />
                <span>Invite by Email</span>
              </TabsTrigger>
              <TabsTrigger value="link" className="text-xs py-1 flex items-center gap-1.5">
                <Link2 className="size-3.5" />
                <span>Shareable Link</span>
                {activeLinks.length > 0 && (
                  <Badge variant="neutral" className="px-1 py-0 text-[10px] h-3.5">
                    {activeLinks.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="pending" className="text-xs py-1 flex items-center gap-1.5">
                <Users className="size-3.5" />
                <span>Pending</span>
                {pending.length > 0 && (
                  <Badge variant="info" className="px-1 py-0 text-[10px] h-3.5">
                    {pending.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* --- TAB 1: EMAIL INVITATION --- */}
          <TabsContent value="email" className="mt-0 focus-visible:outline-none">
            <form onSubmit={onSubmit} noValidate>
              <Form {...form}>
                <div className="space-y-4 px-6 py-4 max-h-[60vh] overflow-y-auto">
                  <FormError error={formErrorMessage(invite.error)} />

                  {/* Recipient Emails */}
                  <FormField
                    control={form.control}
                    name="emails"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold">
                          Email addresses
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            rows={3}
                            autoFocus
                            placeholder="ada@example.com, grace@example.com"
                            value={(field.value ?? []).join(', ')}
                            onChange={(event) =>
                              field.onChange(parseEmails(event.target.value))
                            }
                            onBlur={field.onBlur}
                            className="text-xs font-sans leading-relaxed resize-none bg-surface"
                          />
                        </FormControl>
                        <FormDescription className="text-[11px]">
                          Enter multiple addresses separated by commas, spaces, or newlines ·{' '}
                          <span className="font-semibold text-foreground">
                            {(field.value ?? []).length} recipient
                            {(field.value ?? []).length === 1 ? '' : 's'}
                          </span>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Scope Selection (if not locked to default scope) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">Role</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger className="h-8.5 text-xs bg-surface">
                                <SelectValue placeholder="Select role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="text-xs">
                              <SelectItem value={WorkspaceRole.ADMIN}>
                                <div className="flex flex-col text-left py-0.5">
                                  <span className="font-medium text-xs">Admin</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    Can manage members and workspace settings
                                  </span>
                                </div>
                              </SelectItem>
                              <SelectItem value={WorkspaceRole.MEMBER}>
                                <div className="flex flex-col text-left py-0.5">
                                  <span className="font-medium text-xs">Member</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    Full collaboration access to channels & tools
                                  </span>
                                </div>
                              </SelectItem>
                              <SelectItem value={WorkspaceRole.GUEST}>
                                <div className="flex flex-col text-left py-0.5">
                                  <span className="font-medium text-xs">Guest</span>
                                  <span className="text-[10px] text-muted-foreground">
                                    Access only to assigned channels
                                  </span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="channelId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold">
                            Channel Scope <span className="text-muted-foreground font-normal">(optional)</span>
                          </FormLabel>
                          <Select
                            value={field.value ?? 'none'}
                            onValueChange={(val) =>
                              field.onChange(val === 'none' ? null : val)
                            }
                          >
                            <FormControl>
                              <SelectTrigger className="h-8.5 text-xs bg-surface">
                                <SelectValue placeholder="All workspace channels" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="text-xs">
                              <SelectItem value="none">
                                <span className="text-xs text-muted-foreground">
                                  Entire Workspace
                                </span>
                              </SelectItem>
                              {channelsList.map((ch) => (
                                <SelectItem key={ch.id} value={ch.id}>
                                  <span className="flex items-center gap-1.5 text-xs">
                                    <Hash className="size-3 text-muted-foreground" />
                                    {ch.name}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Personal Message */}
                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-semibold flex items-center justify-between">
                          <span>Personal Note <span className="text-muted-foreground font-normal">(optional)</span></span>
                          <MessageSquare className="size-3 text-muted-foreground" />
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="e.g. Welcome aboard! Join our design critique channel."
                            value={field.value ?? ''}
                            onChange={field.onChange}
                            className="h-8.5 text-xs bg-surface"
                            maxLength={500}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Delivery / Batch Result Feedback */}
                  {invite.isSuccess && invite.data && (
                    <div className="rounded-xl border border-success/30 bg-success/10 p-3 space-y-2 text-xs">
                      <div className="flex items-center gap-2 text-success-text font-semibold">
                        <CheckCircle2 className="size-4 shrink-0" />
                        <span>
                          {invite.data.invited.length} invitation
                          {invite.data.invited.length === 1 ? '' : 's'} successfully sent!
                        </span>
                      </div>

                      {invite.data.alreadyMembers.length > 0 && (
                        <p className="text-[11px] text-muted-foreground">
                          Already workspace members: {invite.data.alreadyMembers.join(', ')}
                        </p>
                      )}

                      {invite.data.tokens && Object.keys(invite.data.tokens).length > 0 && (
                        <div className="rounded-lg border border-border/80 bg-background/90 p-2.5 space-y-1.5">
                          <p className="text-[10px] font-semibold tracking-wide uppercase text-muted-foreground">
                            Development links (no mail transport configured):
                          </p>
                          <ul className="space-y-1">
                            {Object.entries(invite.data.tokens).map(([email, token]) => (
                              <li
                                key={email}
                                className="flex items-center justify-between gap-2 font-mono text-[11px] bg-muted/50 px-2 py-1 rounded"
                              >
                                <span className="truncate">{email}</span>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-xs"
                                  onClick={() => handleCopyLink(`/invite/${token}`)}
                                  title="Copy invite URL"
                                >
                                  {copiedDevToken === token ? (
                                    <Check className="size-3 text-success-text" />
                                  ) : (
                                    <Copy className="size-3" />
                                  )}
                                </Button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <DialogFooter className="px-6 py-3 border-t border-border/70">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                  >
                    Done
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    loading={form.formState.isSubmitting || invite.isPending}
                    leadingIcon={<MailPlus className="size-3.5" />}
                    className="font-semibold"
                  >
                    Send Invitations
                  </Button>
                </DialogFooter>
              </Form>
            </form>
          </TabsContent>

          {/* --- TAB 2: SHAREABLE INVITE LINK --- */}
          <TabsContent value="link" className="mt-0 focus-visible:outline-none">
            <div className="space-y-4 px-6 py-4 max-h-[60vh] overflow-y-auto">
              <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Link2 className="size-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">
                      Shareable Link Access
                    </span>
                  </div>
                  <Badge variant="info" className="text-[10px] px-1.5 py-0">
                    Instant Join
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Anyone with this link can join {workspace?.name ?? 'the workspace'} directly.
                </p>

                {activeLinks.length > 0 ? (
                  <div className="space-y-3 pt-1">
                    {activeLinks.map((link) => {
                      const linkUrl = link.token
                        ? `/invite/${link.token}`
                        : `${window.location.origin}/w/${slug}/join`;

                      return (
                        <div
                          key={link.id}
                          className="rounded-lg border border-border/80 bg-background p-3 space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <Badge variant="neutral" className="text-[10px] uppercase font-semibold">
                                {link.role.toLowerCase()}
                              </Badge>
                              {link.channel && (
                                <span className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                                  <Hash className="size-3" />
                                  {link.channel.name}
                                </span>
                              )}
                              <span className="text-[11px] text-muted-foreground">
                                {link.maxUses ? `${link.useCount}/${link.maxUses} uses` : `${link.useCount} joined`}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              Expires {formatRelative(link.expiresAt)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <Input
                              readOnly
                              value={`${window.location.origin}${linkUrl.startsWith('/') ? '' : '/'}${linkUrl}`}
                              className="h-8 text-xs font-mono bg-surface"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => handleCopyLink(linkUrl)}
                              className="shrink-0 text-xs h-8"
                            >
                              {copiedLink ? (
                                <>
                                  <Check className="size-3.5 mr-1 text-success-text" />
                                  Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="size-3.5 mr-1" />
                                  Copy
                                </>
                              )}
                            </Button>
                          </div>

                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/50">
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => regenerateLink.mutate(link.id)}
                              loading={regenerateLink.isPending}
                              className="text-[11px] text-muted-foreground hover:text-foreground h-6"
                            >
                              <RotateCw className="size-3 mr-1" />
                              Regenerate
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => revokeLink.mutate(link.id)}
                              loading={revokeLink.isPending}
                              className="text-[11px] text-destructive hover:bg-destructive/10 h-6"
                            >
                              <Trash2 className="size-3 mr-1" />
                              Deactivate
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="space-y-3 pt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">
                          Default Role
                        </label>
                        <Select
                          value={linkRole}
                          onValueChange={(v) => setLinkRole(v as WorkspaceRole)}
                        >
                          <SelectTrigger className="h-8 text-xs bg-surface">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="text-xs">
                            <SelectItem value={WorkspaceRole.MEMBER}>Member</SelectItem>
                            <SelectItem value={WorkspaceRole.GUEST}>Guest</SelectItem>
                            <SelectItem value={WorkspaceRole.ADMIN}>Admin</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[11px] font-semibold text-muted-foreground">
                          Expires After
                        </label>
                        <Select
                          value={linkExpiresInDays.toString()}
                          onValueChange={(v) => setLinkExpiresInDays(parseInt(v, 10))}
                        >
                          <SelectTrigger className="h-8 text-xs bg-surface">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="text-xs">
                            <SelectItem value="7">7 Days</SelectItem>
                            <SelectItem value="30">30 Days</SelectItem>
                            <SelectItem value="90">90 Days</SelectItem>
                            <SelectItem value="365">1 Year</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-muted-foreground">
                        Max Uses (Optional)
                      </label>
                      <Input
                        type="number"
                        placeholder="Unlimited uses"
                        value={linkMaxUses}
                        onChange={(e) => setLinkMaxUses(e.target.value)}
                        className="h-8 text-xs bg-surface"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={handleCreateNewLink}
                      loading={createLink.isPending}
                      leadingIcon={<Plus className="size-3.5" />}
                      className="w-full text-xs font-semibold"
                    >
                      Generate Shareable Link
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="px-6 py-3 border-t border-border/70">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </TabsContent>

          {/* --- TAB 3: PENDING INVITATIONS --- */}
          <TabsContent value="pending" className="mt-0 focus-visible:outline-none">
            <div className="space-y-3 px-6 py-4 max-h-[60vh] overflow-y-auto">
              {invitations.isLoading ? (
                <SkeletonList rows={3} withAvatar={false} />
              ) : pending.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={<MailPlus className="size-6 text-muted-foreground" />}
                  title="No pending invitations"
                  description="Invitations you dispatch appear here until they are accepted or revoked."
                />
              ) : (
                <ScrollArea className="max-h-56 pr-1">
                  <ul className="divide-y divide-border/60 rounded-lg border bg-surface">
                    {pending.map((invitation) => (
                      <li
                        key={invitation.id}
                        className="flex items-center justify-between gap-3 p-3 hover:bg-accent/25 transition-colors"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-xs font-semibold text-foreground">
                              {invitation.email}
                            </span>
                            <Badge variant="neutral" className="text-[10px] px-1.5 py-0 capitalize">
                              {invitation.role.toLowerCase()}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Sent {formatRelative(invitation.createdAt)} · Expires{' '}
                            {formatRelative(invitation.expiresAt)}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => resend.mutate(invitation.id)}
                            loading={resend.isPending}
                            title="Resend invitation email"
                            className="text-[11px] h-7 px-2"
                          >
                            <RefreshCw className="size-3 mr-1" />
                            Resend
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => revoke.mutate(invitation.id)}
                            loading={revoke.isPending}
                            title="Revoke invitation"
                            className="text-destructive hover:bg-destructive/10 size-7"
                          >
                            <X className="size-3.5" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              )}
            </div>

            <DialogFooter className="px-6 py-3 border-t border-border/70">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
