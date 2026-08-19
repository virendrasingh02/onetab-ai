import { zodResolver } from '@hookform/resolvers/zod';
import { formErrorMessage } from '@org/auth';
import { WorkspaceRole } from '@org/types';
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
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SkeletonList,
  Textarea,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { inviteMembersSchema, type InviteMembersInput } from '@org/validation';
import { MailPlus, X } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useInvitationMutations, useInvitations } from '../use-invitations.js';

/** Splits a pasted block of addresses on commas, semicolons and newlines. */
function parseEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export interface InviteMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Composes invitations and lists the ones still outstanding.
 *
 * Both live in the same dialog on purpose: the question "did I already invite
 * them?" comes up while typing the addresses, and answering it should not cost
 * a trip to another screen.
 */
export function InviteMembersDialog({
  open,
  onOpenChange,
}: InviteMembersDialogProps) {
  const { workspace, workspaceId } = useCurrentWorkspace();
  const invitations = useInvitations(workspaceId);
  const { invite, revoke } = useInvitationMutations(workspaceId);

  const form = useForm<InviteMembersInput>({
    resolver: zodResolver(inviteMembersSchema),
    defaultValues: { emails: [], role: WorkspaceRole.MEMBER },
  });

  // A closed dialog keeps neither the draft nor the last send's result banner.
  useEffect(() => {
    if (!open) {
      form.reset({ emails: [], role: WorkspaceRole.MEMBER });
      invite.reset();
    }
    // `form` and the mutation are stable for the life of the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await invite.mutateAsync(values);
      form.reset({ emails: [], role: values.role });
    } catch {
      // Rendered by <FormError>.
    }
  });

  const pending = invitations.data ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
                <MailPlus className="size-4" />
              </div>
              <div>
                <DialogTitle>Invite people</DialogTitle>
                <DialogDescription>
                  Invite people to {workspace?.name ?? 'this workspace'} by
                  email.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Form {...form}>
            <div className="space-y-4 px-6 py-4">
              <FormError error={formErrorMessage(invite.error)} />

              <FormField
                control={form.control}
                name="emails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email addresses</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        autoFocus
                        placeholder="ada@example.com, grace@example.com"
                        // The field holds an array; the textarea edits text.
                        value={(field.value ?? []).join(', ')}
                        onChange={(event) =>
                          field.onChange(parseEmails(event.target.value))
                        }
                        onBlur={field.onBlur}
                      />
                    </FormControl>
                    <FormDescription>
                      Separate addresses with commas or new lines ·{' '}
                      {(field.value ?? []).length} recipient
                      {(field.value ?? []).length === 1 ? '' : 's'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Member" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={WorkspaceRole.ADMIN}>
                          Admin — can manage members and settings
                        </SelectItem>
                        <SelectItem value={WorkspaceRole.MEMBER}>
                          Member — full access to channels
                        </SelectItem>
                        <SelectItem value={WorkspaceRole.GUEST}>
                          Guest — only the channels they are added to
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {invite.data?.alreadyMembers.length ? (
                <p className="text-[11px] text-muted-foreground">
                  Already a member: {invite.data.alreadyMembers.join(', ')}
                </p>
              ) : null}

              {invite.data?.tokens ? (
                <div className="rounded-lg border border-border bg-surface-raised p-3">
                  <p className="mb-2 text-[11px] font-medium text-muted-foreground">
                    Development only — no mail transport is configured yet:
                  </p>
                  <ul className="space-y-1">
                    {Object.entries(invite.data.tokens).map(
                      ([email, token]) => (
                        <li
                          key={email}
                          className="font-mono text-[11px] break-all"
                        >
                          {email} → /invite/{token}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-medium text-foreground">
                  Pending invitations
                </p>

                {invitations.isLoading ? (
                  <SkeletonList rows={2} />
                ) : pending.length === 0 ? (
                  <EmptyState
                    size="sm"
                    icon={<MailPlus />}
                    title="No pending invitations"
                    description="Invitations you send appear here until they are accepted."
                  />
                ) : (
                  <ScrollArea className="max-h-48" contentClassName="pr-1">
                    <ul className="divide-y divide-border">
                      {pending.map((invitation) => (
                        <li
                          key={invitation.id}
                          className="flex items-center gap-2.5 py-2"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-foreground">
                              {invitation.email}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Invited {formatRelative(invitation.createdAt)} ·
                              expires {formatRelative(invitation.expiresAt)}
                            </p>
                          </div>
                          <Badge variant="neutral">
                            {invitation.role.toLowerCase()}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Revoke invitation for ${invitation.email}`}
                            onClick={() => revoke.mutate(invitation.id)}
                          >
                            <X />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </div>
            </div>
          </Form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Done
            </Button>
            <Button
              type="submit"
              loading={form.formState.isSubmitting || invite.isPending}
              leadingIcon={<MailPlus />}
            >
              Send invitations
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
