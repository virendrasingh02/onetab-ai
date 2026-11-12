import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Textarea,
  toast,
} from '@org/ui';
import { Send } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatrix } from './matrix-provider.js';
import { NewMessageRecipients } from './new-message-recipients.js';
import {
  summariseDestinations,
  useShareDestinations,
} from './use-share-destinations.js';

/** Something with a link — a task, a project — to post into conversations. */
export interface ShareToChatTarget {
  /** What it is, for the wording: "task", "project". */
  noun: string;
  title: string;
  /** In-app path or absolute URL; tasks unfurl as a card where it lands. */
  url: string;
}

export interface ShareToChatDialogProps {
  target: ShareToChatTarget | null;
  onOpenChange: (open: boolean) => void;
}

/**
 * "Share in chat": posts a link to a task or project into any mix of
 * channels, groups and people, with an optional note above it. Each
 * destination gets its own message.
 */
export function ShareToChatDialog({
  target,
  onOpenChange,
}: ShareToChatDialogProps) {
  return (
    <Dialog open={target !== null} onOpenChange={onOpenChange}>
      <DialogContent mobile="full" className="sm:max-w-lg">
        {/* Remounted per target so recipients and the note never carry over. */}
        {target ? (
          <ShareToChatForm
            key={target.url}
            target={target}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ShareToChatForm({
  target,
  onDone,
}: {
  target: ShareToChatTarget;
  onDone: () => void;
}) {
  const { peopleOptions, channelOptions, resolveDestinations, isLoading } =
    useShareDestinations();
  const { client } = useMatrix();
  const navigate = useNavigate();

  const [peopleIds, setPeopleIds] = useState<string[]>([]);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const [isSending, setIsSending] = useState(false);

  const count = peopleIds.length + channelIds.length;
  const canSend = count > 0 && !isSending && !!client;
  const link = /^https?:\/\//.test(target.url)
    ? target.url
    : `${window.location.origin}${target.url}`;

  const send = async () => {
    if (!client || !canSend) return;
    setIsSending(true);
    try {
      const destinations = await resolveDestinations({ channelIds, peopleIds });
      const body = [note.trim() || target.title, link].join('\n');
      const results = await Promise.allSettled(
        destinations.map((destination) =>
          client.sendMessage(destination.roomId, body),
        ),
      );
      const delivered = destinations.filter(
        (_, index) => results[index]?.status === 'fulfilled',
      );
      const failed = destinations.length - delivered.length;
      if (delivered.length === 0) {
        toast.error(`Could not share the ${target.noun}. Try again.`);
        return;
      }
      const first = delivered[0];
      toast.success(
        `Shared in ${summariseDestinations(delivered.map((d) => d.label))}`,
        {
          description:
            failed > 0
              ? `${failed} destination${failed === 1 ? '' : 's'} could not be reached.`
              : undefined,
          action:
            delivered.length === 1 && first
              ? { label: 'View', onClick: () => navigate(first.href) }
              : undefined,
        },
      );
      onDone();
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : `Could not share the ${target.noun}.`,
      );
    } finally {
      setIsSending(false);
    }
  };

  return (
    <>
      <DialogHeader className="pr-12">
        <DialogTitle>Share {target.noun} in chat</DialogTitle>
        <DialogDescription className="truncate">
          {target.title}
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="space-y-3">
        <NewMessageRecipients
          multiple
          people={peopleOptions}
          channels={channelOptions}
          selectedPeopleIds={peopleIds}
          onChangePeople={setPeopleIds}
          selectedChannelIds={channelIds}
          onChangeChannels={setChannelIds}
          label=""
          placeholder={
            isLoading ? 'Loading people…' : 'Add a channel, group or person'
          }
          autoFocus
        />
        <Textarea
          rows={3}
          value={note}
          disabled={isSending}
          placeholder="Add a message, if you'd like."
          aria-label="Message"
          onChange={(event) => setNote(event.target.value)}
        />
        {client ? null : (
          <p className="text-xs text-muted-foreground">
            Chat is not connected right now, so this cannot be sent yet.
          </p>
        )}
      </DialogBody>

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
        <Button
          size="sm"
          leadingIcon={<Send />}
          loading={isSending}
          disabled={!canSend}
          onClick={() => void send()}
        >
          Share
        </Button>
      </DialogFooter>
    </>
  );
}
