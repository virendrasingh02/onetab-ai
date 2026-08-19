import { useCurrentWorkspace } from '@org/web-workspace';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CreateChannelDialog } from '../components/create-channel-dialog.js';
import { BrowseChannelsPage } from './browse-channels-page.js';

/**
 * The /channels/new route, kept for links and the command palette.
 *
 * Creating a channel is a dialog now, so the route renders the channel list
 * underneath it: the modal needs something behind it, and closing it lands on
 * the page the user would have wanted anyway.
 */
export function CreateChannelPage() {
  const { slug } = useCurrentWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(true);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) return;

    // A deep link has no history to go back to — going back would leave the app.
    if (location.key === 'default') {
      navigate(`/w/${slug}/channels`, { replace: true });
    } else {
      navigate(-1);
    }
  };

  return (
    <>
      <BrowseChannelsPage />
      <CreateChannelDialog open={open} onOpenChange={handleOpenChange} />
    </>
  );
}
