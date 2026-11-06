import type { TaskChecklistItem } from '@org/types';
import { Checkbox } from '@org/ui';
import { cn } from '@org/utils';
import { ListChecks, Plus, Sparkles, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ProgressBar, Section, SectionAction } from './primitives.js';

function ChecklistRow({
  item,
  canEdit,
  onChange,
  onRemove,
}: {
  item: TaskChecklistItem;
  canEdit: boolean;
  onChange: (patch: Partial<TaskChecklistItem>) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    const text = draft?.trim();
    if (text && text !== item.text) onChange({ text });
    setDraft(null);
  };

  return (
    <div className="group min-h-8 gap-2 px-1 flex items-center rounded-md transition-colors hover:bg-accent/40">
      <Checkbox
        checked={item.done}
        disabled={!canEdit}
        aria-label={item.text}
        onCheckedChange={(checked) => onChange({ done: checked === true })}
      />
      {draft !== null ? (
        <input
          autoFocus
          value={draft}
          aria-label="Action item"
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit();
            if (event.key === 'Escape') setDraft(null);
          }}
          className="min-w-0 text-sm flex-1 bg-transparent text-foreground outline-none"
        />
      ) : (
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => setDraft(item.text)}
          className={cn(
            'min-w-0 text-sm flex-1 truncate text-left disabled:cursor-default',
            item.done && 'text-muted-foreground line-through',
          )}
        >
          {item.text}
        </button>
      )}
      {canEdit ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.text}`}
          className="rounded p-1 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
        >
          <X className="size-3" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export interface CardChecklistProps {
  items: TaskChecklistItem[];
  canEdit: boolean;
  aiBusy: boolean;
  onChange: (items: TaskChecklistItem[]) => void;
  onSuggest: () => void;
}

export function CardChecklist({
  items,
  canEdit,
  aiBusy,
  onChange,
  onSuggest,
}: CardChecklistProps) {
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const done = items.filter((item) => item.done).length;

  // The field stays open after Enter: items usually arrive several at a time.
  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onChange([...items, { id: `${Date.now()}`, text: trimmed, done: false }]);
    setText('');
  };

  if (items.length === 0 && !adding && !canEdit) return null;

  return (
    <Section
      title="Action items"
      icon={ListChecks}
      summary={items.length > 0 ? `${done}/${items.length}` : undefined}
      action={
        canEdit ? (
          <>
            {items.length === 0 ? (
              <SectionAction
                icon={Sparkles}
                onClick={onSuggest}
                disabled={aiBusy}
                className="text-accent-violet hover:text-accent-violet"
              >
                Suggest
              </SectionAction>
            ) : null}
            <SectionAction icon={Plus} onClick={() => setAdding(true)}>
              Add item
            </SectionAction>
          </>
        ) : null
      }
    >
      {items.length > 0 || adding ? (
        <div>
          <ProgressBar done={done} total={items.length} />
          {items.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              canEdit={canEdit}
              onChange={(patch) =>
                onChange(
                  items.map((entry) =>
                    entry.id === item.id ? { ...entry, ...patch } : entry,
                  ),
                )
              }
              onRemove={() =>
                onChange(items.filter((entry) => entry.id !== item.id))
              }
            />
          ))}
          {adding ? (
            <form onSubmit={handleAdd} className="gap-2 px-1 flex items-center">
              <Plus
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <input
                autoFocus
                value={text}
                aria-label="New action item"
                placeholder="Add an item and press Enter"
                onChange={(event) => setText(event.target.value)}
                onBlur={() => {
                  if (!text.trim()) setAdding(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setText('');
                    setAdding(false);
                  }
                }}
                className="h-8 min-w-0 text-sm flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground/70"
              />
            </form>
          ) : null}
        </div>
      ) : null}
    </Section>
  );
}
