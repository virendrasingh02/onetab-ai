import { MembersPage } from '@org/web-members';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { InviteMembersDialog } from '../components/invite-members-dialog.js';

/**
 * The /invitations route, kept for links, the dashboard and the members page.
 *
 * Inviting is a dialog now, so the route renders the member list underneath
 * it — the people already in the workspace are the context for inviting more,
 * and closing the dialog leaves the user somewhere useful.
 */
export function InvitationsPage() {
  const { slug } = useCurrentWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(true);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) return;

    // A deep link has no history to go back to — going back would leave the app.
    if (location.key === 'default') {
      navigate(`/w/${slug}/members`, { replace: true });
    } else {
      navigate(-1);
    }
  };

  return (
    <>
      <MembersPage />
      <InviteMembersDialog open={open} onOpenChange={handleOpenChange} />
    </>
  );
}
