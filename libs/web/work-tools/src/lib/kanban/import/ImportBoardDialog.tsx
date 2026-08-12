import {
  accentClasses,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardPaste,
  Columns3,
  FileUp,
  Import,
  Tag,
  Users,
} from 'lucide-react';
import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type ReactNode,
} from 'react';
import { DEFAULT_PROJECT_HEX, PROJECT_COLORS } from '../project-color.js';
import type { ImportedBoard } from './board-ir.js';
import type { CsvTable } from './csv.js';
import { buildBoardState, type ImportSourceId } from './normalize.js';
import {
  ACCEPTED_FILE_TYPES,
  CSV_FIELDS,
  detectSource,
  guessMapping,
  IMPORT_SOURCES,
  ImportError,
  parseImport,
  type CsvFieldKey,
  type CsvFieldMapping,
  type ParsedFile,
} from './sources.js';

export interface ImportResult {
  /** The parsed board, before it is narrowed to tasks. */
  board: ImportedBoard;
  name: string;
  /** Hex, as `Project.color` stores it. Only used when `mode` is `new`. */
  color: string;
  source: ImportSourceId;
  /** `new` creates a project for the tasks; `merge` files them on the open one. */
  mode: 'new' | 'merge';
}

export interface ImportBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (result: ImportResult) => void;
  /** Enables the "merge into this project" option. */
  currentProjectName?: string;
}

const selectClass =
  'w-full px-2 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary';
const inputClass =
  'w-full px-3 py-1.5 bg-surface border border-border rounded-md text-xs text-foreground placeholder:text-subtle focus:outline-none focus:ring-1 focus:ring-primary';

export function ImportBoardDialog({
  open,
  onOpenChange,
  onImport,
  currentProjectName,
}: ImportBoardDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sourceChoice, setSourceChoice] = useState<ImportSourceId | 'auto'>('auto');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [pasting, setPasting] = useState(false);
  const [pasteDraft, setPasteDraft] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  const [mapping, setMapping] = useState<CsvFieldMapping | null>(null);
  const [groupBy, setGroupBy] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [mode, setMode] = useState<'new' | 'merge'>('new');

  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [color, setColor] = useState<string>(DEFAULT_PROJECT_HEX);

  const reset = useCallback(() => {
    setSourceChoice('auto');
    setText('');
    setFileName('');
    setPasting(false);
    setPasteDraft('');
    setReadError(null);
    setMapping(null);
    setGroupBy('');
    setIncludeArchived(false);
    setMode('new');
    setName('');
    setNameTouched(false);
    setColor(DEFAULT_PROJECT_HEX);
  }, []);

  const close = useCallback(() => {
    onOpenChange(false);
    // Deferred so the dialog's exit animation is not interrupted by the tree
    // collapsing back to the empty state mid-transition.
    setTimeout(reset, 200);
  }, [onOpenChange, reset]);

  /*
   * Parsing is a pure function of the file text and the user's choices, so it
   * re-runs on every mapping tweak rather than being cached in state — which
   * keeps the preview honest without an effect to keep in sync.
   */
  const parsed = useMemo((): { file: ParsedFile } | { error: string } | null => {
    if (!text.trim()) return null;
    try {
      const source =
        sourceChoice === 'auto' ? detectSource(text, fileName) : sourceChoice;
      if (!source) {
        return {
          error:
            'Could not recognise this file. Pick the source it came from below.',
        };
      }
      return {
        file: parseImport(text, source, {
          mapping: mapping ?? undefined,
          groupBy: groupBy || undefined,
          fallbackTitle: fileName.replace(/\.[^.]+$/, ''),
        }),
      };
    } catch (error) {
      return {
        error:
          error instanceof ImportError
            ? error.message
            : 'That file could not be read.',
      };
    }
  }, [text, sourceChoice, fileName, mapping, groupBy]);

  const file = parsed && 'file' in parsed ? parsed.file : null;

  const preview = useMemo(() => {
    if (!file) return null;
    return buildBoardState(file.board, {
      includeArchived,
      title: nameTouched ? name : file.board.title,
    });
  }, [file, includeArchived, name, nameTouched]);

  const effectiveName = nameTouched ? name : (file?.board.title ?? '');

  const acceptText = useCallback(
    (value: string, sourceFileName: string) => {
      setText(value);
      setFileName(sourceFileName);
      setReadError(null);
      // A freshly loaded file gets a freshly guessed mapping; keeping the old
      // one would silently apply one file's columns to another's headers.
      setMapping(null);
      setGroupBy('');
      setNameTouched(false);
      setName('');
    },
    [],
  );

  const readFile = useCallback(
    async (selected: File) => {
      try {
        acceptText(await selected.text(), selected.name);
      } catch {
        setReadError(`Could not read ${selected.name}.`);
      }
    },
    [acceptText],
  );

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) void readFile(dropped);
  };

  const submit = () => {
    if (!preview || !file) return;
    onImport({
      board: { ...preview.board, title: effectiveName || preview.board.title },
      name: effectiveName || preview.board.title,
      color,
      source: file.source,
      mode,
    });
    close();
  };

  const cardCount = preview
    ? preview.board.lists.reduce((total, list) => total + list.cards.length, 0)
    : 0;

  const sourceName =
    IMPORT_SOURCES.find((entry) => entry.id === file?.source)?.name ?? '';

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-2xl text-xs">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Import className="size-4 text-primary" />
            Import a board
          </DialogTitle>
          <DialogDescription className="text-[11px] text-muted-foreground">
            Bring a project across from Trello, Linear, Asana, Jira, GitHub, or
            any CSV. Everything is read in your browser — nothing is uploaded.
          </DialogDescription>
        </DialogHeader>

        {/* ---------------------------------------------- step 1: the file */}
        {!text ? (
          <div className="space-y-3 py-1">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={cn(
                'flex flex-col items-center justify-center gap-2 rounded-card border border-dashed p-6 text-center transition-colors',
                dragOver
                  ? 'border-primary bg-accent-violet-soft'
                  : 'border-border bg-surface/40',
              )}
            >
              <FileUp className="size-6 text-muted-foreground" />
              <p className="text-xs font-medium text-foreground">
                Drop an export here
              </p>
              <p className="text-[11px] text-muted-foreground">
                .json from Trello or GitHub · .csv from Linear, Asana, or Jira
              </p>
              <div className="flex items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Choose file
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => setPasting((value) => !value)}
                >
                  <ClipboardPaste className="size-3.5" />
                  Paste instead
                </Button>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_FILE_TYPES}
                className="hidden"
                onChange={(event) => {
                  const selected = event.target.files?.[0];
                  if (selected) void readFile(selected);
                  // Cleared so re-picking the same file still fires `change`.
                  event.target.value = '';
                }}
              />
            </div>

            {pasting && (
              <div className="space-y-1.5">
                <textarea
                  rows={5}
                  autoFocus
                  value={pasteDraft}
                  onChange={(event) => setPasteDraft(event.target.value)}
                  placeholder="Paste CSV rows or JSON here..."
                  className={cn(inputClass, 'resize-none font-mono text-[11px]')}
                />
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  disabled={!pasteDraft.trim()}
                  onClick={() => acceptText(pasteDraft, 'pasted-data')}
                >
                  Read pasted data
                </Button>
              </div>
            )}

            {readError && (
              <p className="flex items-center gap-1.5 text-[11px] text-destructive">
                <AlertTriangle className="size-3.5" />
                {readError}
              </p>
            )}

            {/* How to get an export out of each product */}
            <div className="space-y-1.5 rounded-card border border-border bg-surface/40 p-3">
              <p className="text-[11px] font-medium text-foreground">
                Where to find your export
              </p>
              <dl className="space-y-1">
                {IMPORT_SOURCES.map((entry) => (
                  <div key={entry.id} className="flex gap-2 text-[11px]">
                    <dt className="w-24 shrink-0 font-medium text-muted-foreground">
                      {entry.name}
                    </dt>
                    <dd className="min-w-0 flex-1 text-subtle">{entry.help}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        ) : (
          /* ------------------------------------------- step 2: the preview */
          <div className="max-h-[60vh] space-y-3 overflow-y-auto py-1 pr-1">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1.5 px-2 text-xs"
                  onClick={() => {
                    setText('');
                    setFileName('');
                    setMapping(null);
                  }}
                >
                  <ArrowLeft className="size-3.5" />
                  Back
                </Button>
                <span className="truncate text-[11px] text-muted-foreground">
                  {fileName}
                </span>
              </div>

              <select
                value={sourceChoice}
                onChange={(event) =>
                  setSourceChoice(event.target.value as ImportSourceId | 'auto')
                }
                aria-label="Read this file as"
                className={cn(selectClass, 'w-auto')}
              >
                <option value="auto">
                  Detect automatically{sourceName ? ` (${sourceName})` : ''}
                </option>
                {IMPORT_SOURCES.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    Read as {entry.name}
                  </option>
                ))}
              </select>
            </div>

            {parsed && 'error' in parsed ? (
              <p className="flex items-start gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-[11px] text-destructive">
                <AlertTriangle className="mt-px size-3.5 shrink-0" />
                {parsed.error}
              </p>
            ) : null}

            {file && preview && (
              <>
                {/* Summary */}
                <div className="grid grid-cols-3 gap-2">
                  <Summary
                    icon={<Columns3 className="size-3.5" />}
                    value={preview.board.lists.length}
                    label="columns"
                  />
                  <Summary
                    icon={<FileUp className="size-3.5" />}
                    value={cardCount}
                    label="cards"
                  />
                  <Summary
                    icon={<Users className="size-3.5" />}
                    value={preview.board.members.length}
                    label="members"
                  />
                </div>

                {/* Column mapping — CSV sources only */}
                {file.table ? (
                  <ColumnMapping
                    table={file.table}
                    sourceId={file.source}
                    sourceName={sourceName}
                    mapping={mapping ?? file.mapping ?? guessMapping(file.table)}
                    onMappingChange={setMapping}
                    groupBy={groupBy}
                    onGroupByChange={setGroupBy}
                  />
                ) : null}

                {/* Board preview */}
                <div className="space-y-1.5">
                  <p className="text-[11px] font-medium text-foreground">
                    Preview
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {preview.board.lists.map((list) => (
                      <div
                        key={list.id}
                        className="w-40 shrink-0 rounded-md border border-border bg-surface p-2"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <p className="truncate text-[11px] font-medium text-foreground">
                            {list.title}
                          </p>
                          <span className="text-[10px] tabular-nums text-muted-foreground">
                            {list.cards.length}
                          </span>
                        </div>
                        <ul className="mt-1.5 space-y-1">
                          {list.cards.slice(0, 3).map((card) => (
                            <li
                              key={card.id}
                              className="truncate rounded bg-surface-inset px-1.5 py-1 text-[10px] text-muted-foreground"
                            >
                              {card.title}
                            </li>
                          ))}
                          {list.cards.length > 3 && (
                            <li className="px-1.5 text-[10px] text-subtle">
                              +{list.cards.length - 3} more
                            </li>
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                {/*
                  Shown, but struck through: tasks have no labels, so these are
                  read out of the file and then dropped. Better to say so here
                  than to have them quietly vanish.
                */}
                {preview.board.labels.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 opacity-60 line-through">
                    <Tag className="size-3.5 text-muted-foreground" />
                    {preview.board.labels.slice(0, 8).map((label) => (
                      <span
                        key={label.id}
                        className={cn(
                          'rounded-full px-2 py-1 text-[10px] font-semibold leading-none',
                          accentClasses[label.color].soft,
                        )}
                      >
                        {label.name}
                      </span>
                    ))}
                    {preview.board.labels.length > 8 && (
                      <span className="text-[10px] text-subtle">
                        +{preview.board.labels.length - 8}
                      </span>
                    )}
                  </div>
                )}

                {preview.warnings.length > 0 && (
                  <ul className="space-y-1 rounded-md border border-accent-amber/40 bg-accent-amber-soft p-2">
                    {preview.warnings.map((warning) => (
                      <li
                        key={warning}
                        className="flex items-start gap-1.5 text-[11px] text-foreground"
                      >
                        <AlertTriangle className="mt-px size-3 shrink-0 text-accent-amber" />
                        {warning}
                      </li>
                    ))}
                  </ul>
                )}

                {/* Destination */}
                <div className="space-y-2.5 rounded-card border border-border bg-surface/40 p-3">
                  {currentProjectName && (
                    <div className="flex flex-wrap items-center gap-3">
                      <RadioOption
                        checked={mode === 'new'}
                        onSelect={() => setMode('new')}
                        label="Create a new project"
                      />
                      <RadioOption
                        checked={mode === 'merge'}
                        onSelect={() => setMode('merge')}
                        label={`Add to "${currentProjectName}"`}
                      />
                    </div>
                  )}

                  {mode === 'new' && (
                    <div className="space-y-2">
                      <label className="space-y-1 block">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Project name
                        </span>
                        <input
                          type="text"
                          value={effectiveName}
                          onChange={(event) => {
                            setNameTouched(true);
                            setName(event.target.value);
                          }}
                          className={inputClass}
                        />
                      </label>

                      <div className="space-y-1">
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Colour
                        </span>
                        <div className="flex items-center gap-1.5">
                          {PROJECT_COLORS.map((option) => (
                            <button
                              key={option.hex}
                              type="button"
                              title={option.label}
                              aria-label={option.label}
                              aria-pressed={color === option.hex}
                              onClick={() => setColor(option.hex)}
                              style={{ backgroundColor: option.hex }}
                              className={cn(
                                'size-5 rounded-full transition-transform',
                                color === option.hex
                                  ? 'ring-2 ring-ring ring-offset-2 ring-offset-background scale-110'
                                  : 'hover:scale-105',
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeArchived}
                      onChange={(event) => setIncludeArchived(event.target.checked)}
                      className="size-3.5 accent-primary"
                    />
                    <span className="text-[11px] text-muted-foreground">
                      Include archived, closed, and cancelled items
                    </span>
                  </label>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={close}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!preview || cardCount === 0}
            onClick={submit}
            className="bg-primary text-primary-foreground hover:bg-primary-hover"
          >
            {cardCount > 0
              ? `Import ${cardCount} card${cardCount === 1 ? '' : 's'}`
              : 'Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Column mapping for CSV sources. Editable for a generic CSV, and collapsed but
 * still editable for the known ones — a Jira export with renamed columns needs
 * the same escape hatch a spreadsheet does.
 */
function ColumnMapping({
  table,
  sourceId,
  sourceName,
  mapping,
  onMappingChange,
  groupBy,
  onGroupByChange,
}: {
  table: CsvTable;
  sourceId: ImportSourceId;
  sourceName: string;
  mapping: CsvFieldMapping;
  onMappingChange: (mapping: CsvFieldMapping) => void;
  groupBy: string;
  onGroupByChange: (header: string) => void;
}) {
  const set = (key: CsvFieldKey, value: string) =>
    onMappingChange({ ...mapping, [key]: value || undefined });

  return (
    <details
      open={sourceId === 'csv'}
      className="rounded-card border border-border bg-surface/40 p-3"
    >
      <summary className="cursor-pointer text-[11px] font-medium text-foreground">
        Column mapping
        <span className="ml-1.5 font-normal text-subtle">
          {sourceId === 'csv'
            ? '— tell us which column is which'
            : `— ${sourceName} columns were matched automatically`}
        </span>
      </summary>

      <div className="grid grid-cols-2 gap-2 pt-2.5 sm:grid-cols-3">
        {CSV_FIELDS.map((field) => (
          <label key={field.key} className="space-y-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              {field.label}
              {field.required ? <span className="text-destructive"> *</span> : null}
            </span>
            <select
              value={mapping[field.key] ?? ''}
              onChange={(event) => set(field.key, event.target.value)}
              className={selectClass}
            >
              <option value="">— none —</option>
              {table.headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <label className="mt-2.5 block space-y-1">
        <span className="text-[11px] font-medium text-muted-foreground">
          Group cards into columns by
        </span>
        <select
          value={groupBy}
          onChange={(event) => onGroupByChange(event.target.value)}
          className={selectClass}
        >
          <option value="">Default for {sourceName || 'this source'}</option>
          {table.headers.map((header) => (
            <option key={header} value={header}>
              {header}
            </option>
          ))}
        </select>
      </label>
    </details>
  );
}

function Summary({
  icon,
  value,
  label,
}: {
  icon: ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-surface p-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm font-semibold tabular-nums text-foreground">
        {value}
      </span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}


function RadioOption({
  checked,
  onSelect,
  label,
}: {
  checked: boolean;
  onSelect: () => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5">
      <input
        type="radio"
        checked={checked}
        onChange={onSelect}
        className="size-3.5 accent-primary"
      />
      <span className="text-[11px] text-foreground">{label}</span>
    </label>
  );
}
