import { UserProfileRightPanel } from '@org/chat-ui';
import type { CurrentUser } from '@org/types';
import { Button, Hint, useRightPanelStore } from '@org/ui';
import {
  MessagesSquare,
  User as UserIcon,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AssistantPanel } from './assistant-panel.js';

export interface RightPanelProps {
  currentUser: CurrentUser;
  workspaceSlug: string;
  onClose: () => void;
}

/**
 * The right rail.
 *
 * It used to be the AI assistant and only the assistant, which meant every new
 * thing that wanted a side view — a person, a channel's details, an open card,
 * a conversation's threads — had nowhere to go but a modal.
 *
 * The rail now hosts several of them, but they are *separate panels*, not tabs
 * of one: each fills the rail on its own and is opened from its own trigger —
 * "Ask AI" in the header, Profile in the account menu, the details button in
 * the channel header, the card's own view switcher, the threads button in the
 * conversation. There is deliberately no strip of tabs across the top: a strip
 * implies the other panels are part of whatever you are reading, and it costs
 * the width of four buttons in a column that is already the narrowest thing on
 * screen.
 *
 * Panels whose content owns editing state — a card, a thread's reply box, a
 * channel's details with its own tabs and dialogs — are *hosted*: the rail puts
 * out an empty element and their owner portals into it. Rebuilding them here
 * would mean rebuilding the state behind them too.
 */
export function RightPanel({
  currentUser,
  workspaceSlug,
  onClose,
}: RightPanelProps) {
  const navigate = useNavigate();

  const view = useRightPanelStore((s) => s.view);
  const profile = useRightPanelStore((s) => s.profile);
  const hosted = useRightPanelStore((s) => s.hosted);
  const setSlot = useRightPanelStore((s) => s.setSlot);

  const openDirectMessage = useCallback(
    (targetUserId?: string) => {
      if (targetUserId) {
        navigate(`/w/${workspaceSlug}/dms/${targetUserId}`);
      } else {
        navigate(`/w/${workspaceSlug}/dms`);
      }
    },
    [navigate, workspaceSlug],
  );

  /* Stable refs — an inline arrow would hand the store `null` and then the
     element again on every single render of the rail. */
  const setCardSlot = useCallback(
    (element: HTMLDivElement | null) => setSlot('card', element),
    [setSlot],
  );
  const setThreadsSlot = useCallback(
    (element: HTMLDivElement | null) => setSlot('threads', element),
    [setSlot],
  );
  const setDetailsSlot = useCallback(
    (element: HTMLDivElement | null) => setSlot('details', element),
    [setSlot],
  );

  /*
   * A registered owner is the proof the content is actually there; without one
   * the view is a leftover from something since closed, and the rail falls
   * through to the assistant rather than showing an empty column.
   *
   * An owner that passes no title draws its own header — the card has a full
   * toolbar, the channel details a name row plus tabs — so wrapping either in
   * our frame would stack two headers.
   */
  if (view === 'card' && hosted.card) {
    return <HostedSlot slotRef={setCardSlot} />;
  }

  if (view === 'details' && hosted.details) {
    return hosted.details.title ? (
      <PanelFrame
        icon={UserIcon}
        title={hosted.details.title}
        onClose={onClose}
      >
        <HostedSlot slotRef={setDetailsSlot} />
      </PanelFrame>
    ) : (
      <HostedSlot slotRef={setDetailsSlot} />
    );
  }

  if (view === 'threads' && hosted.threads) {
    return (
      <PanelFrame
        icon={MessagesSquare}
        title={hosted.threads.title}
        onClose={onClose}
      >
        <HostedSlot slotRef={setThreadsSlot} />
      </PanelFrame>
    );
  }

  if (view === 'profile') {
    const person = profile;
    return (
      <PanelFrame
        icon={UserIcon}
        title={person ? person.name : 'Your profile'}
        onClose={onClose}
      >
        <UserProfileRightPanel
          userId={person?.userId ?? currentUser.id}
          name={person?.name ?? currentUser.displayName ?? currentUser.name}
          avatarUrl={person?.avatarUrl ?? currentUser.avatarUrl ?? undefined}
          title={person?.title ?? currentUser.title ?? undefined}
          role={person?.role}
          powerLevel={person?.powerLevel}
          email={person?.email ?? currentUser.email}
          joinedAt={person?.joinedAt ?? currentUser.createdAt}
          bio={person?.bio ?? currentUser.bio ?? undefined}
          timezone={person?.timezone ?? currentUser.timezone}
          status={person?.status ?? 'online'}
          statusEmoji={person?.statusEmoji ?? currentUser.statusEmoji}
          statusText={person?.statusText ?? currentUser.statusText}
          onSendDirectMessage={openDirectMessage}
          onStartCall={(targetUserId) => {
            navigate(`/w/${workspaceSlug}/dms/${targetUserId}?call=true`);
          }}
        />
      </PanelFrame>
    );
  }

  /* The assistant draws its own header — it always has. */
  return <AssistantPanel onClose={onClose} />;
}

/** The element a hosted panel's owner portals into. */
function HostedSlot({
  slotRef,
}: {
  slotRef: (element: HTMLDivElement | null) => void;
}) {
  return (
    <div
      ref={slotRef}
      className="min-h-0 flex h-full flex-1 flex-col overflow-hidden"
    />
  );
}

/* ----------------------------------------------------------- panel frame --- */

/**
 * The header the rail draws for panels that do not bring one, so switching
 * between them does not move the close button or change the height of the
 * first row.
 *
 * Matches `AssistantPanel`'s own header rather than replacing it: the assistant
 * needs the standalone version on mobile, where the rail becomes a sheet.
 */
function PanelFrame({
  icon: Icon,
  title,
  onClose,
  children,
}: {
  icon: LucideIcon;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-0 flex h-full flex-col">
      <div className="h-12 px-3 flex shrink-0 items-center justify-between border-b border-border">
        <span className="min-w-0 gap-1.5 font-semibold text-sm flex items-center text-foreground">
          <Icon className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="truncate">{title}</span>
        </span>

        <Hint label="Close panel">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="size-4" />
          </Button>
        </Hint>
      </div>

      <div className="min-h-0 flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
