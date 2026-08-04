import { zodResolver } from '@hookform/resolvers/zod';
import { formErrorMessage } from '@org/auth';
import { WorkspaceRole } from '@org/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Form,
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  SkeletonList,
  Textarea,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { inviteMembersSchema, type InviteMembersInput } from '@org/validation';
import { MailPlus, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useInvitationMutations, useInvitations } from '../use-invitations.js';

/** Splits a pasted block of addresses on commas, semicolons and newlines. */
function parseEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

export function InvitationsPage() {
  const { workspace, workspaceId } = useCurrentWorkspace();
  const invitations = useInvitations(workspaceId);
  const { invite, revoke } = useInvitationMutations(workspaceId);

  const form = useForm<InviteMembersInput>({
    resolver: zodResolver(inviteMembersSchema),
    defaultValues: { emails: [], role: WorkspaceRole.MEMBER },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await invite.mutateAsync(values);
      form.reset({ emails: [], role: WorkspaceRole.MEMBER });
    } catch {
      // Rendered by <FormError>.
    }
  });

  return (
    <div className="max-w-2xl space-y-6 p-6 mx-auto">
      <div>
        <h2 className="text-lg font-semibold">Invitations</h2>
        <p className="text-sm text-muted-foreground">
          Invite people to {workspace?.name} by email.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invite people</CardTitle>
          <CardDescription>
            Paste one or more addresses, separated by commas or new lines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
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
                      {(field.value ?? []).length} recipient
                      {(field.value ?? []).length === 1 ? '' : 's'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                loading={invite.isPending}
                leadingIcon={<MailPlus />}
              >
                Send invitations
              </Button>

              {invite.data?.alreadyMembers.length ? (
                <p className="text-xs text-muted-foreground">
                  Already a member: {invite.data.alreadyMembers.join(', ')}
                </p>
              ) : null}

              {invite.data?.tokens ? (
                <div className="p-3 rounded-md bg-muted">
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    Development only — no mail transport is configured yet:
                  </p>
                  <ul className="space-y-1">
                    {Object.entries(invite.data.tokens).map(
                      ([email, token]) => (
                        <li key={email} className="text-xs font-mono break-all">
                          {email} → /invite/{token}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              ) : null}
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {invitations.isLoading ? (
            <SkeletonList rows={3} />
          ) : (invitations.data?.length ?? 0) === 0 ? (
            <EmptyState
              size="sm"
              icon={<MailPlus />}
              title="No pending invitations"
              description="Invitations you send will appear here until they are accepted."
            />
          ) : (
            <ul className="divide-y">
              {invitations.data?.map((invitation) => (
                <li
                  key={invitation.id}
                  className="gap-3 py-2.5 flex items-center"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {invitation.email}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Invited {formatRelative(invitation.createdAt)} · expires{' '}
                      {formatRelative(invitation.expiresAt)}
                    </p>
                  </div>
                  <Badge variant="neutral">
                    {invitation.role.toLowerCase()}
                  </Badge>
                  <Button
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
