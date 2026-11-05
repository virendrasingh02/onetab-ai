import { queryKeys, userApi } from '@org/api-client';
import {
  Button,
  Field,
  Input,
  LoadingState,
  ErrorState,
  confirm,
  toast,
} from '@org/ui';
import { ACCOUNT_DELETION_CONFIRMATION } from '@org/validation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useLogout } from '../use-auth.js';

/**
 * Self-service account deletion, shared by Settings and the public
 * `/account/delete` page. The copy states what `AccountDeletionService` does,
 * including what it keeps; change them together.
 */
export function AccountDeletionPanel() {
  const logout = useLogout();
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const preview = useQuery({
    queryKey: queryKeys.account.deletionPreview(),
    queryFn: () => userApi.deletionPreview(),
  });

  const remove = useMutation({
    mutationFn: () =>
      userApi.deleteAccount({
        confirmation: ACCOUNT_DELETION_CONFIRMATION,
        password: password || undefined,
        twoFactorCode: twoFactorCode || undefined,
      }),
    onSuccess: () => {
      toast.success('Your account has been deleted.');
      logout.mutate();
    },
  });

  if (preview.isPending) return <LoadingState />;
  if (preview.isError) {
    return <ErrorState onRetry={() => void preview.refetch()} />;
  }

  const plan = preview.data;
  const ready =
    confirmation === ACCOUNT_DELETION_CONFIRMATION &&
    (!plan.requiresPassword || Boolean(password)) &&
    (!plan.requiresTwoFactor || Boolean(twoFactorCode));

  const submit = async () => {
    const accepted = await confirm({
      title: 'Delete your account?',
      description: 'This happens immediately and cannot be undone.',
      confirmLabel: 'Delete account',
      destructive: true,
    });
    if (accepted) remove.mutate();
  };

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">
        Your profile, sign-in methods, sessions, notifications, preferences,
        private AI chats and connected app tokens are deleted, and you leave
        every workspace. Tasks, documents and comments you added to a shared
        workspace stay there, shown as “Deleted user”. People who already
        received your messages keep their copies. Our payment provider keeps
        billing records as the law requires, audit logs keep an anonymous ID,
        and backups expire on their normal schedule.
      </p>

      {plan.workspacesToDelete.length > 0 ? (
        <p>
          These workspaces have no other members and are deleted too:{' '}
          <strong>
            {plan.workspacesToDelete.map((w) => w.name).join(', ')}
          </strong>
          .
        </p>
      ) : null}

      {plan.workspacesToTransfer.length > 0 ? (
        <p role="alert" className="text-destructive">
          You own workspaces other people use:{' '}
          <strong>
            {plan.workspacesToTransfer.map((w) => w.name).join(', ')}
          </strong>
          . Transfer ownership to another member first.
        </p>
      ) : (
        <div className="max-w-sm space-y-3">
          {plan.requiresPassword ? (
            <Field label="Password">
              <Input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          ) : null}
          {plan.requiresTwoFactor ? (
            <Field label="Authenticator or recovery code">
              <Input
                autoComplete="one-time-code"
                value={twoFactorCode}
                onChange={(event) => setTwoFactorCode(event.target.value)}
              />
            </Field>
          ) : null}
          <Field label={`Type ${ACCOUNT_DELETION_CONFIRMATION} to confirm`}>
            <Input
              autoComplete="off"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
            />
          </Field>
          {remove.error ? (
            <p role="alert" className="text-destructive">
              {remove.error.message}
            </p>
          ) : null}
          <Button
            variant="destructive"
            disabled={!ready || remove.isPending}
            onClick={() => void submit()}
          >
            Delete my account
          </Button>
        </div>
      )}
    </div>
  );
}
