import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  CopyPlus,
  Expand,
  FileText,
  Hash,
  Link2,
  ListChecks,
  ListTree,
  Maximize2,
  MessageSquareText,
  Send,
  MoreHorizontal,
  PanelRight,
  PenLine,
  Sparkles,
  Star,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  useKanbanCardViewStore,
  type KanbanCardViewMode,
} from '../kanban-card-view-store.js';
import { CubeProjectIcon, StatusIcon } from '../kanban-icons.js';
import type { CardAiTask } from './card-ai.js';

const VIEW_OPTIONS: Array<{
  mode: KanbanCardViewMode;
  label: string;
  icon: LucideIcon;
}> = [
  { mode: 'panel', label: 'Open in side panel', icon: PanelRight },
  { mode: 'modal', label: 'Normal window', icon: Maximize2 },
  { mode: 'full', label: 'Full width', icon: Expand },
];

function CardViewSwitcher() {
  const mode = useKanbanCardViewStore((s) => s.mode);
  const setMode = useKanbanCardViewStore((s) => s.setMode);

  return (
    <div
      role="group"
      aria-label="Card view"
      className="gap-0.5 p-0.5 flex items-center rounded-btn border border-border/60 bg-muted/50"
    >
      {VIEW_OPTIONS.map((option) => {
        const isActive = option.mode === mode;
        return (
          <button
            key={option.mode}
            type="button"
            aria-pressed={isActive}
            aria-label={option.label}
            title={option.label}
            onClick={() => setMode(option.mode)}
            className={cn(
              'size-6 grid place-items-center rounded-[calc(var(--radius-btn)-2px)]',
              'transition-colors duration-(--duration-fast) ease-standard',
              'outline-none focus-visible:ring-1 focus-visible:ring-ring',
              isActive
                ? 'shadow-2xs bg-card text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <option.icon className="size-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

/** The same choice as `CardViewSwitcher`, for a toolbar with no room for it. */
function CardViewMenuItems() {
  const mode = useKanbanCardViewStore((s) => s.mode);
  const setMode = useKanbanCardViewStore((s) => s.setMode);

  return (
    <>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>View</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={mode}
        onValueChange={(value) => setMode(value as KanbanCardViewMode)}
      >
        {VIEW_OPTIONS.map((option) => (
          <DropdownMenuRadioItem
            key={option.mode}
            value={option.mode}
            indicator="check"
          >
            <option.icon className="mr-2 size-3.5" aria-hidden />
            {option.label}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </>
  );
}

async function copyToClipboard(text: string, confirmation: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(confirmation);
  } catch {
    toast.error('Could not reach the clipboard');
  }
}

/**
 * The ticket id, quiet and selectable. It trails the status as the last
 * breadcrumb step; copying it lives in the ⋯ menu ("Copy ticket ID").
 */
function TicketId({ identifier }: { identifier: string }) {
  return (
    <span
      className="font-medium tracking-tight shrink-0 font-mono text-xs text-muted-foreground select-all"
      title={`Ticket ${identifier}`}
    >
      {identifier}
    </span>
  );
}

export interface CardSiblings {
  /** 1-based place of this card in its column. */
  position: number;
  total: number;
  onPrevious?: () => void;
  onNext?: () => void;
  /** Titles of the neighbouring cards, named in the arrows' tooltips. */
  previousTitle?: string;
  nextTitle?: string;
}

/**
 * Steps through the cards of the same column without leaving the card. Just
 * the two arrows; each tooltip names the card it leads to.
 */
function CardStepper({ siblings }: { siblings: CardSiblings }) {
  const stepClass =
    'size-7 grid place-items-center rounded-md text-muted-foreground transition-colors outline-none hover:bg-accent/60 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-35';
  const label = (direction: 'Previous' | 'Next', title?: string) =>
    title ? `${direction}: ${title}` : `${direction} card`;
  return (
    <div
      role="group"
      aria-label={`Card ${siblings.position} of ${siblings.total} in this column`}
      className="gap-0.5 flex shrink-0 items-center"
    >
      <Hint label={label('Previous', siblings.previousTitle)}>
        <button
          type="button"
          disabled={!siblings.onPrevious}
          onClick={siblings.onPrevious}
          aria-label={label('Previous', siblings.previousTitle)}
          className={stepClass}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </button>
      </Hint>
      <Hint label={label('Next', siblings.nextTitle)}>
        <button
          type="button"
          disabled={!siblings.onNext}
          onClick={siblings.onNext}
          aria-label={label('Next', siblings.nextTitle)}
          className={stepClass}
        >
          <ChevronRight className="size-4" aria-hidden />
        </button>
      </Hint>
    </div>
  );
}

export interface CardHeaderProps {
  projectName: string;
  /** The human-readable ticket id, e.g. `WEB-42`. */
  identifier: string;
  /** The board column the card sits in. */
  statusId: string;
  statusTitle: string;
  siblings: CardSiblings;
  /** The Studio agent that filed this task, when one did. */
  agent: { name: string; onOpen?: () => void } | undefined;
  link: string;
  /**
   * For the rail and phones, where the full toolbar would cover the ticket ID:
   * labels go, and the view switcher moves into the More menu, which already
   * has Copy link.
   */
  compact: boolean;
  canEdit: boolean;
  canCreate: boolean;
  canDelete: boolean;
  hasDescription: boolean;
  hasComments: boolean;
  aiBusy: boolean;
  isSaved: boolean;
  onToggleSaved: () => void;
  /** Opens "Share in chat" for this task. */
  onShare: () => void;
  onRunAi: (task: CardAiTask) => void;
  onConvertToDoc: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function CardHeader({
  projectName,
  identifier,
  statusId,
  statusTitle,
  siblings,
  agent,
  link,
  compact,
  canEdit,
  canCreate,
  canDelete,
  hasDescription,
  hasComments,
  aiBusy,
  isSaved,
  onToggleSaved,
  onShare,
  onRunAi,
  onConvertToDoc,
  onDuplicate,
  onDelete,
  onClose,
}: CardHeaderProps) {
  return (
    <header
      className={cn(
        'h-12 gap-2 flex shrink-0 items-center justify-between border-b border-border/70',
        compact ? 'px-2' : 'px-4',
      )}
    >
      <div className="min-w-0 gap-2 text-sm flex items-center">
        {compact ? null : (
          <>
            <CubeProjectIcon className="size-4 shrink-0 text-accent-amber" />
            <span className="max-w-40 font-medium truncate text-muted-foreground">
              {projectName}
            </span>
            <span className="text-muted-foreground/60" aria-hidden>
              /
            </span>
          </>
        )}
        <span
          className="min-w-0 gap-1.5 font-medium inline-flex items-center text-foreground"
          title={`In ${statusTitle}`}
        >
          <StatusIcon
            status={statusId}
            className="size-4 shrink-0"
            showTooltip={false}
          />
          <span className={cn('truncate', compact ? 'max-w-20' : 'max-w-36')}>
            {statusTitle}
          </span>
        </span>

        <span className="text-muted-foreground/60" aria-hidden>
          /
        </span>
        <TicketId identifier={identifier} />


        {agent ? (
          <button
            type="button"
            disabled={!agent.onOpen}
            onClick={agent.onOpen}
            title={`Created by the agent ${agent.name}`}
            className="h-6 min-w-0 gap-1 px-1.5 font-medium inline-flex items-center overflow-hidden rounded-md bg-accent-violet-soft text-accent-violet enabled:hover:underline disabled:cursor-default"
          >
            <Sparkles className="size-3 shrink-0" aria-hidden />
            <span className="max-w-28 truncate">{agent.name}</span>
          </button>
        ) : null}
      </div>

      <div className="gap-1 flex shrink-0 items-center">
        {siblings.total > 1 ? (
          <>
            <CardStepper siblings={siblings} />
            <span className="mx-1 h-4 w-px shrink-0 bg-border/80" aria-hidden />
          </>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              loading={aiBusy}
              aria-label="Brain² AI actions"
              className="h-7 gap-1.5 text-xs font-medium text-accent-violet hover:bg-accent-violet-soft hover:text-accent-violet"
            >
              <Sparkles className="size-3.5" aria-hidden />
              {compact ? null : <span>Brain²</span>}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              disabled={!canEdit}
              onSelect={() => onRunAi('description')}
            >
              <PenLine className="mr-2 size-3.5" aria-hidden />
              {hasDescription
                ? 'Extend the description'
                : 'Write a description'}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canEdit}
              onSelect={() => onRunAi('checklist')}
            >
              <ListChecks className="mr-2 size-3.5" aria-hidden />
              Suggest action items
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!canCreate}
              onSelect={() => onRunAi('subIssues')}
            >
              <ListTree className="mr-2 size-3.5" aria-hidden />
              Break into sub-issues
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!hasComments}
              onSelect={() => onRunAi('summary')}
            >
              <MessageSquareText className="mr-2 size-3.5" aria-hidden />
              Summarize the discussion
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!canCreate} onSelect={onConvertToDoc}>
              <FileText className="mr-2 size-3.5" aria-hidden />
              Turn into a document
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {compact ? null : (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => void copyToClipboard(link, 'Link copied')}
            aria-label="Copy link to this task"
            title="Copy link"
            className="size-7 text-muted-foreground hover:text-foreground"
          >
            <Link2 className="size-3.5" aria-hidden />
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleSaved}
          aria-pressed={isSaved}
          aria-label={isSaved ? 'Remove from saved' : 'Save for later'}
          title={isSaved ? 'Remove from saved' : 'Save for later'}
          className={cn(
            'size-7',
            isSaved
              ? 'text-accent-amber'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Star
            className={cn('size-3.5', isSaved && 'fill-current')}
            aria-hidden
          />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="More actions"
              className="size-7 text-muted-foreground hover:text-foreground"
            >
              <MoreHorizontal className="size-3.5" aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem
              onSelect={() => void copyToClipboard(link, 'Link copied')}
            >
              <Copy className="mr-2 size-3.5" aria-hidden />
              Copy link
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onShare}>
              <Send className="mr-2 size-3.5" aria-hidden />
              Share in chat…
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() =>
                void copyToClipboard(identifier, `Copied ${identifier}`)
              }
            >
              <Hash className="mr-2 size-3.5" aria-hidden />
              Copy ticket ID
            </DropdownMenuItem>
            <DropdownMenuItem disabled={!canCreate} onSelect={onDuplicate}>
              <CopyPlus className="mr-2 size-3.5" aria-hidden />
              Duplicate task
            </DropdownMenuItem>
            {compact ? <CardViewMenuItems /> : null}
            {canDelete ? <DropdownMenuSeparator /> : null}
            {canDelete ? (
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 className="mr-2 size-3.5" aria-hidden />
                Delete task
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>

        {compact ? null : (
          <>
            <span className="mx-0.5 h-4 w-px bg-border/80" aria-hidden />
            <CardViewSwitcher />
          </>
        )}

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Close task"
          title="Close"
          className="size-7 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    </header>
  );
}
