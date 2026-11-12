import {
  ForwardedMessageCard,
  LexicalComposerInput,
  type LexicalEditorRef,
  type MentionCandidate,
} from '@org/chat-ui';
import type { ForwardedMessage, Message, RoomKind } from '@org/matrix-client';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  SegmentedControl,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { ChevronDown, Forward, Link2, ShieldAlert } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMatrix } from './matrix-provider.js';
import { NewMessageRecipients } from './new-message-recipients.js';
import {
  summariseDestinations,
  useShareDestinations,
} from './use-share-destinations.js';

export interface ForwardMessageSource {
  message: Message;
  /** Where it lives — decides the dialog's wording and the card's source line. */
  roomKind?: RoomKind;
  /** The channel's display name; unset for DMs. */
  roomName?: string;
  /** A private channel, DM or group. */
  isPrivate?: boolean;
  /** Workspace-relative path that reopens the original. */
  link?: string;
}

export interface ForwardMessageDialogProps {
  source: ForwardMessageSource | null;
  onOpenChange: (open: boolean) => void;
  /** Copies the original's link — the dialog's secondary way to share it. */
  onCopyLink?: (message: Message) => void;
}

/** The `Message` being forwarded, shaped as the card the recipients will see. */
function toPreview(source: ForwardMessageSource): ForwardedMessage {
  const { message } = source;
  // Forwarding a forward with no note of its own passes the original along —
  // preview exactly what `forwardMessage` will send.
  if (message.forwarded && !message.body.trim()) return message.forwarded;
  return {
    eventId: message.id,
    roomId: message.roomId,
    roomKind: source.roomKind,
    roomName: source.roomName,
    senderId: message.senderId,
    senderName: message.senderName,
    senderAvatarUrl: message.senderAvatarUrl,
    kind: message.kind,
    body: message.attachment ? '' : message.body,
    timestamp: message.timestamp,
    attachment: message.attachment,
    threadRootId: message.threadRootId,
  };
}

/**
 * "Forward message": send a copy of a message to any mix of channels, groups
 * and people, with an optional note on top.
 *
 * Each destination gets its own copy — so a DM forwarded to two teammates
 * lands in each of their DMs — unless the sender chooses to bundle the people
 * into one group conversation instead. The original travels as a snapshot
 * (see `OneTabMatrixClient.forwardMessage`), so recipients outside the source
 * conversation still see what was said.
 */
export function ForwardMessageDialog({
  source,
  onOpenChange,
  onCopyLink,
}: ForwardMessageDialogProps) {
  return (
    <Dialog open={source !== null} onOpenChange={onOpenChange}>
      <DialogContent mobile="full" className="sm:max-w-xl">
        {/* Remounted per message so a fresh dialog never inherits the last
            one's recipients or half-written note. */}
        {source ? (
          <ForwardMessageForm
            key={source.message.id}
            source={source}
            onDone={() => onOpenChange(false)}
            onCopyLink={onCopyLink}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ForwardMessageForm({
  source,
  onDone,
  onCopyLink,
}: {
  source: ForwardMessageSource;
  onDone: () => void;
  onCopyLink?: (message: Message) => void;
}) {
  const { message } = source;
  const {
    peopleOptions,
    channelOptions,
    resolveDestinations,
    currentUserId,
    isLoading: recipientsLoading,
  } = useShareDestinations();
  const { client } = useMatrix();
  const navigate = useNavigate();

  const [peopleIds, setPeopleIds] = useState<string[]>([]);
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [delivery, setDelivery] = useState<'separate' | 'group'>('separate');
  const [isSending, setIsSending] = useState(false);
  const editorRef = useRef<LexicalEditorRef | null>(null);

  const isPrivateSource =
    source.isPrivate ||
    source.roomKind === 'direct' ||
    source.roomKind === 'group';
  const preview = useMemo(() => toPreview(source), [source]);

  const mentionCandidates = useMemo<MentionCandidate[]>(
    () =>
      peopleOptions
        .filter((person) => person.kind === 'person')
        .map((person) => ({
          id: person.id,
          name: person.name,
          avatarUrl: person.avatarUrl ?? undefined,
          kind: 'user' as const,
          isSelf: person.isSelf,
        })),
    [peopleOptions],
  );

  const peerCount = peopleIds.filter((id) => id !== currentUserId).length;
  const canBundle = peerCount >= 2;
  const bundle = canBundle && delivery === 'group';
  const destinationCount = channelIds.length + (bundle ? 1 : peopleIds.length);
  const canSend = destinationCount > 0 && !isSending && !!client;

  const submit = useCallback(
    async (options: { openAfter?: boolean; note?: string } = {}) => {
      if (!client || !canSend) return;
      const comment = options.note ?? editorRef.current?.getMarkdown() ?? '';
      setIsSending(true);
      try {
        const destinations = await resolveDestinations({
          channelIds,
          peopleIds,
          bundle,
        });
        const results = await Promise.allSettled(
          destinations.map((destination) =>
            client.forwardMessage(destination.roomId, message, {
              comment,
              roomKind: source.roomKind,
              roomName: source.roomName,
              link: source.link,
            }),
          ),
        );

        const delivered = destinations.filter(
          (_, index) => results[index]?.status === 'fulfilled',
        );
        const failed = destinations.length - delivered.length;

        if (delivered.length === 0) {
          toast.error('Could not forward the message. Try again.');
          return;
        }
        const first = delivered[0];
        toast.success(
          `Forwarded to ${summariseDestinations(delivered.map((d) => d.label))}`,
          {
            description:
              failed > 0
                ? `${failed} destination${failed === 1 ? '' : 's'} could not be reached.`
                : undefined,
            action:
              !options.openAfter && delivered.length === 1 && first
                ? { label: 'View', onClick: () => navigate(first.href) }
                : undefined,
          },
        );
        onDone();
        if (options.openAfter && first) navigate(first.href);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not forward the message.',
        );
      } finally {
        setIsSending(false);
      }
    },
    [
      client,
      canSend,
      resolveDestinations,
      channelIds,
      peopleIds,
      bundle,
      message,
      source,
      navigate,
      onDone,
    ],
  );

  const recipientsReady = !recipientsLoading;

  return (
    <>
      <DialogHeader className="pr-12">
        <DialogTitle className="gap-2 text-base flex items-center">
          <Forward className="size-4 text-muted-foreground" aria-hidden />
          {isPrivateSource ? 'Forward this private message' : 'Forward message'}
        </DialogTitle>
        <DialogDescription>
          Send a copy to channels, groups or people — each gets their own.
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
            recipientsReady
              ? 'Add a channel, group or person'
              : 'Loading people…'
          }
          autoFocus
        />

        {canBundle ? (
          <div className="gap-3 flex flex-wrap items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {delivery === 'group'
                ? `One group conversation with ${peerCount} people.`
                : `A separate direct message to each of the ${peerCount} people.`}
            </p>
            <SegmentedControl
              aria-label="How to send to the people you picked"
              size="sm"
              value={delivery}
              onChange={setDelivery}
              options={[
                { value: 'separate', label: 'Individually' },
                { value: 'group', label: 'As a group' },
              ]}
            />
          </div>
        ) : null}

        {/* The note, in the same editor as the composer: formatting, @
            mentions and markdown shortcuts all behave as they do in chat. */}
        <div
          className={cn(
            'relative flex flex-col overflow-hidden rounded-xl border border-field-border theme-fixed bg-field',
            'transition-[border-color,box-shadow] duration-200 focus-within:border-brand/70 focus-within:ring-4 focus-within:ring-brand/15',
            '[&_[contenteditable]]:min-h-14 [&_[contenteditable]]:max-h-48',
            isSending && 'pointer-events-none opacity-60',
          )}
        >
          <LexicalComposerInput
            placeholder="Add a message, if you'd like."
            onSend={(text) => {
              void submit({ note: text });
            }}
            onRegisterRef={(ref) => {
              editorRef.current = ref;
            }}
            members={mentionCandidates}
            disabled={isSending}
            showToolbar
          />
        </div>

        <ForwardedMessageCard
          forwarded={preview}
          variant="preview"
          isPrivate={isPrivateSource}
          className="mt-0 max-w-none bg-surface-inset"
        />

        {isPrivateSource ? (
          <p className="gap-1.5 flex items-start text-[11px] text-muted-foreground">
            <ShieldAlert className="size-3.5 mt-px shrink-0" aria-hidden />
            This comes from a private conversation. Everyone in the destination
            will see this copy.
          </p>
        ) : null}
      </DialogBody>

      <DialogFooter className="sm:justify-between flex-row items-center">
        {onCopyLink ? (
          <Button
            variant="outline"
            leadingIcon={<Link2 />}
            onClick={() => onCopyLink(message)}
          >
            Copy link
          </Button>
        ) : (
          <span />
        )}

        <div className="flex items-stretch">
          <Button
            onClick={() => void submit()}
            disabled={!canSend}
            loading={isSending}
            className="rounded-r-none"
          >
            {destinationCount > 1
              ? `Forward to ${destinationCount}`
              : 'Forward'}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                disabled={!canSend}
                aria-label="More forward options"
                className="rounded-l-none border-l border-primary-foreground/20"
              >
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-56">
              <DropdownMenuItem
                onSelect={() => void submit({ openAfter: true })}
                description="Jump to where it was sent"
              >
                Forward and open conversation
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </DialogFooter>
    </>
  );
}
