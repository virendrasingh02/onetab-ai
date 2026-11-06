import { MarkdownMessage } from '@org/chat-ui';
import { Button, Textarea } from '@org/ui';
import { AlignLeft, Pencil, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Section, SectionAction } from './primitives.js';

export interface CardDescriptionProps {
  description: string;
  canEdit: boolean;
  aiBusy: boolean;
  /** Text Brain² wrote, to review in the editor before it is kept. */
  aiDraft: string | null;
  onAiDraftTaken: () => void;
  onWriteWithAi: () => void;
  onSave: (description: string) => void;
}

/**
 * Saves when focus leaves, the way the title does, so closing the card or
 * clicking elsewhere can't throw typing away. Only Escape and Cancel discard.
 */
export function CardDescription({
  description,
  canEdit,
  aiBusy,
  aiDraft,
  onAiDraftTaken,
  onWriteWithAi,
  onSave,
}: CardDescriptionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description);
  const editorRef = useRef<HTMLDivElement>(null);

  // Read at unmount, when this render's closure is long gone.
  const latest = useRef({ editing, draft, description, onSave });
  latest.current = { editing, draft, description, onSave };

  const persist = () => {
    const current = latest.current;
    const next = current.draft.trim();
    if (next !== current.description.trim()) current.onSave(next);
  };

  useEffect(
    () => () => {
      if (latest.current.editing) persist();
    },
    [],
  );

  useEffect(() => {
    if (aiDraft === null) return;
    setDraft((current) => (current ? `${current}\n\n${aiDraft}` : aiDraft));
    setEditing(true);
    onAiDraftTaken();
  }, [aiDraft, onAiDraftTaken]);

  const startEditing = () => {
    if (!canEdit) return;
    setDraft(description);
    setEditing(true);
  };

  const finish = () => {
    persist();
    setEditing(false);
  };

  const discard = () => {
    setDraft(description);
    setEditing(false);
  };

  const handleReadClick = (event: MouseEvent) => {
    // A link is for following, and a selection is for copying.
    if ((event.target as HTMLElement).closest('a')) return;
    if (window.getSelection()?.toString()) return;
    startEditing();
  };

  const action =
    canEdit && !editing ? (
      <>
        <SectionAction
          icon={Sparkles}
          onClick={onWriteWithAi}
          disabled={aiBusy}
          className="text-accent-violet hover:text-accent-violet"
        >
          {description ? 'Extend' : 'Write with AI'}
        </SectionAction>
        {description ? (
          <SectionAction icon={Pencil} onClick={startEditing}>
            Edit
          </SectionAction>
        ) : null}
      </>
    ) : null;

  return (
    <Section title="Description" icon={AlignLeft} action={action}>
      {editing ? (
        <div
          ref={editorRef}
          className="space-y-2"
          onBlur={(event) => {
            // Leaving the window isn't leaving the editor.
            if (document.activeElement === event.target) return;
            if (editorRef.current?.contains(event.relatedTarget)) return;
            finish();
          }}
        >
          <Textarea
            autoFocus
            minRows={5}
            maxLength={10000}
            value={draft}
            aria-label="Task description"
            placeholder="What needs doing, and how will you know it's done? Markdown works."
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') discard();
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                finish();
              }
            }}
            className="text-sm"
          />
          <div className="gap-2 flex items-center">
            <Button size="sm" onClick={finish}>
              Save
            </Button>
            {/* Keeps focus put, or the blur would save what Cancel discards. */}
            <Button
              size="sm"
              variant="ghost"
              onMouseDown={(event) => event.preventDefault()}
              onClick={discard}
            >
              Cancel
            </Button>
            <span className="ml-auto text-[11px] text-muted-foreground">
              Saves when you click away
            </span>
          </div>
        </div>
      ) : description ? (
        // The Edit action above is the keyboard route to this same editor.
        <div
          onClick={handleReadClick}
          className={canEdit ? 'cursor-text' : undefined}
        >
          <MarkdownMessage text={description} className="text-sm" />
        </div>
      ) : (
        <button
          type="button"
          onClick={startEditing}
          disabled={!canEdit}
          className="px-3 py-3 text-sm w-full rounded-lg border border-dashed border-border text-left text-muted-foreground transition-colors enabled:hover:border-input enabled:hover:bg-accent/30"
        >
          {canEdit ? 'Add a description…' : 'No description.'}
        </button>
      )}
    </Section>
  );
}
