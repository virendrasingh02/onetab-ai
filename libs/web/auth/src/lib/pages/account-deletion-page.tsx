import { Button } from '@org/ui';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../auth-layout.js';
import { AccountDeletionPanel } from '../components/account-deletion-panel.js';
import { LEGAL_LINKS } from '../legal-links.js';
import { useCurrentUser } from '../use-auth.js';

/**
 * The public deletion resource Google Play's Data safety form links to: it has
 * to work for someone who no longer has the app installed.
 */
export function AccountDeletionPage() {
  const user = useCurrentUser();

  return (
    <AuthLayout
      title="Delete your Onetab AI account"
      subtitle="Delete your account and the personal data tied to it."
    >
      {user ? (
        <AccountDeletionPanel />
      ) : (
        <div className="space-y-4 text-sm">
          <p className="text-muted-foreground">
            Deleting your account removes your profile, sign-in methods,
            sessions, notifications, preferences, private AI chats and connected
            app tokens, and removes you from every workspace. Content you added
            to a shared workspace stays there, shown as “Deleted user”. People
            who already received your messages keep their copies. Our payment
            provider keeps billing records as the law requires, audit logs keep
            an anonymous ID, and backups expire on their normal schedule.
          </p>
          <p className="text-muted-foreground">
            Sign in to confirm it is you. You can then delete your account right
            here, or from Settings → Account Security.
          </p>
          <Button asChild className="w-full">
            <Link to="/login">Sign in to continue</Link>
          </Button>
          {LEGAL_LINKS.support ? (
            <p className="text-muted-foreground">
              Cannot sign in?{' '}
              <a className="underline" href={LEGAL_LINKS.support}>
                Contact support
              </a>{' '}
              and we will delete your account for you.
            </p>
          ) : null}
        </div>
      )}
    </AuthLayout>
  );
}
