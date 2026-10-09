import { Badge, Button, Input, Switch } from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Bot,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Circle,
  Cpu,
  Info,
  Network,
  Plus,
  RotateCw,
  ScrollText,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react';
import { createContext, useContext, useId, useState, type ReactNode } from 'react';
import type { AgentModuleId, ModuleIssue, ModuleState } from './agent-module-model.js';

/**
 * Building blocks every module drawer is made of. Sections register with the
 * drawer through context so its search can hide what doesn't match and its
 * navigation can jump to (and expand) a section.
 */

export const MODULE_ICONS: Record<AgentModuleId, LucideIcon> = {
  prompt: ScrollText,
  llm: Cpu,
  knowledge: BookOpen,
  tools: Wrench,
  subAgents: Network,
};

export { Bot as AgentIcon };

interface DrawerSectionsContext {
  /** Sections the settings search filtered out. */
  hidden: Set<string>;
  /** Sections collapsed by the person. */
  collapsed: Set<string>;
  toggle: (id: string) => void;
  readOnly: boolean;
}

export const SectionsContext = createContext<DrawerSectionsContext>({
  hidden: new Set(),
  collapsed: new Set(),
  toggle: () => undefined,
  readOnly: false,
});

export const useSections = () => useContext(SectionsContext);

/** Element id of a field, for "jump to the problem". */
export const fieldDomId = (field: string) => `cfg-field-${field}`;
export const sectionDomId = (section: string) => `cfg-section-${section}`;

export function SettingSection({
  id,
  title,
  description,
  actions,
  issues,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Issues in this section — counted on its header. */
  issues?: ModuleIssue[];
  children: ReactNode;
}) {
  const { hidden, collapsed, toggle } = useSections();
  if (hidden.has(id)) return null;
  const open = !collapsed.has(id);
  const bodyId = `${sectionDomId(id)}-body`;
  const problems = (issues ?? []).filter((i) => i.level !== 'info').length;
  return (
    <section id={sectionDomId(id)} data-config-section={id} aria-labelledby={`${sectionDomId(id)}-title`} className="scroll-mt-2 border-b border-border/70 py-4 last:border-b-0">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => toggle(id)}
          aria-expanded={open}
          aria-controls={bodyId}
          className="group flex min-w-0 flex-1 items-start gap-1.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          <ChevronDown className={cn('mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none', !open && '-rotate-90')} />
          <span className="min-w-0">
            <span id={`${sectionDomId(id)}-title`} className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
              {title}
              {problems > 0 && (
                <Badge variant="warning" className="h-4 px-1 text-[9px]" aria-label={`${problems} issue${problems === 1 ? '' : 's'}`}>
                  {problems}
                </Badge>
              )}
            </span>
            {description && <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{description}</span>}
          </span>
        </button>
        {actions && open && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </div>
      {open && (
        <div id={bodyId} className="mt-3 space-y-3.5">
          {children}
        </div>
      )}
    </section>
  );
}

export function SettingField({
  field,
  label,
  hint,
  error,
  required,
  htmlFor,
  aside,
  children,
}: {
  /** Stable field key — focus target for validation jumps. */
  field?: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  htmlFor?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  const errorId = useId();
  return (
    <div id={field ? fieldDomId(field) : undefined} className="space-y-1.5 scroll-mt-16">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={htmlFor} className="text-[11px] font-semibold text-foreground">
          {label}
          {required && <span className="ml-0.5 text-destructive" aria-hidden>*</span>}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1 text-[11px] text-destructive">
          <AlertCircle className="mt-0.5 size-3 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function SettingSwitch({
  field,
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  field?: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const { readOnly } = useSections();
  return (
    <div id={field ? fieldDomId(field) : undefined} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-surface-raised/40 px-3 py-2.5">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-xs font-medium text-foreground">{label}</span>
        {hint && <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{hint}</span>}
      </label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} disabled={disabled || readOnly} aria-label={label} />
    </div>
  );
}

/** A number box; clearing it sets `undefined` (back to the default). */
export function NumberSetting({
  field,
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
  suffix,
}: {
  field: string;
  label: string;
  hint?: ReactNode;
  value: number | undefined;
  onChange: (next: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  suffix?: string;
}) {
  const id = useId();
  const { readOnly } = useSections();
  const outOfRange = value !== undefined && ((min !== undefined && value < min) || (max !== undefined && value > max));
  return (
    <SettingField field={field} label={label} hint={hint} htmlFor={id} error={outOfRange ? `Must be between ${min ?? '−∞'} and ${max ?? '∞'}.` : null}>
      <Input
        id={id}
        type="number"
        inputSize="sm"
        min={min}
        max={max}
        step={step}
        value={value ?? ''}
        placeholder={placeholder}
        disabled={readOnly}
        invalid={outOfRange}
        suffix={suffix ? <span className="text-[11px] text-muted-foreground">{suffix}</span> : undefined}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(undefined);
          const n = e.target.valueAsNumber;
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </SettingField>
  );
}

/** An editable list of short strings (goals, constraints, rules). */
export function StringListEditor({
  field,
  items,
  onChange,
  placeholder,
  addLabel = 'Add',
  emptyText,
}: {
  field: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  addLabel?: string;
  emptyText?: string;
}) {
  const [draft, setDraft] = useState('');
  const { readOnly } = useSections();
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft('');
  };
  const move = (i: number, d: -1 | 1) => {
    const next = [...items];
    const [x] = next.splice(i, 1);
    next.splice(i + d, 0, x);
    onChange(next);
  };
  return (
    <div id={fieldDomId(field)} className="space-y-1.5 scroll-mt-16">
      {items.length === 0 && emptyText && <p className="text-[11px] text-muted-foreground">{emptyText}</p>}
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={`${i}-${item}`} className="group flex items-center gap-1 rounded-md border border-border bg-surface-raised/40 py-1 pl-2.5 pr-1">
              <Input
                inputSize="sm"
                value={item}
                disabled={readOnly}
                aria-label={`Item ${i + 1}`}
                onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
                onBlur={(e) => {
                  if (!e.target.value.trim()) onChange(items.filter((_, j) => j !== i));
                }}
                className="h-7 flex-1 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0"
              />
              {!readOnly && (
                <span className="flex shrink-0 items-center opacity-60 group-hover:opacity-100 group-focus-within:opacity-100">
                  <Button type="button" variant="ghost" size="icon-xs" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">
                    <ArrowUp className="size-3" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" disabled={i === items.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
                    <ArrowDown className="size-3" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove">
                    <X className="size-3" />
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      {!readOnly && (
        <div className="flex gap-1.5">
          <Input
            inputSize="sm"
            value={draft}
            placeholder={placeholder}
            aria-label={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            className="text-xs"
          />
          <Button type="button" variant="outline" size="sm" onClick={add} disabled={!draft.trim()}>
            <Plus className="size-3.5" />
            {addLabel}
          </Button>
        </div>
      )}
    </div>
  );
}

const ISSUE_ICON = { error: AlertCircle, warning: AlertTriangle, info: Info } as const;
const ISSUE_TONE = { error: 'text-destructive', warning: 'text-warning', info: 'text-muted-foreground' } as const;

/** Issues as a list; clicking one jumps to its field. */
export function IssueList({ issues, onJump, empty }: { issues: ModuleIssue[]; onJump?: (issue: ModuleIssue) => void; empty?: string }) {
  if (issues.length === 0) {
    return empty ? (
      <p className="flex items-center gap-1.5 text-[11px] text-success-text">
        <CheckCircle2 className="size-3.5 text-success" />
        {empty}
      </p>
    ) : null;
  }
  return (
    <ul className="space-y-1" aria-live="polite">
      {issues.map((issue, i) => {
        const Icon = ISSUE_ICON[issue.level];
        return (
          <li key={`${i}-${issue.message}`}>
            <button
              type="button"
              onClick={() => onJump?.(issue)}
              disabled={!onJump}
              className="flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] leading-relaxed text-foreground hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:hover:bg-transparent"
            >
              <Icon className={cn('mt-0.5 size-3.5 shrink-0', ISSUE_TONE[issue.level])} aria-label={issue.level} />
              <span>{issue.message}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export const STATE_META: Record<ModuleState, { label: string; dot: string; text: string; Icon: LucideIcon }> = {
  configured: { label: 'Configured', dot: 'bg-success', text: 'text-success-text', Icon: CheckCircle2 },
  empty: { label: 'Not set up', dot: 'bg-muted-foreground/40', text: 'text-muted-foreground', Icon: Circle },
  warning: { label: 'Needs attention', dot: 'bg-warning', text: 'text-warning', Icon: AlertTriangle },
  error: { label: 'Has errors', dot: 'bg-destructive', text: 'text-destructive', Icon: AlertCircle },
};

export function StatusPill({ state, className }: { state: ModuleState; className?: string }) {
  const meta = STATE_META[state];
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11px] font-medium', meta.text, className)}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} aria-hidden />
      {meta.label}
    </span>
  );
}

export function StatGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-lg border border-border bg-surface-raised/40 px-2.5 py-2">
          <dt className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 truncate text-xs font-semibold text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A load failure with the reason and a retry, never a blank area. */
export function LoadError({ what, error, onRetry }: { what: string; error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : 'Something went wrong.';
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px]">
      <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">Couldn’t load {what}</p>
        <p className="mt-0.5 break-words text-muted-foreground">{message}</p>
      </div>
      {onRetry && (
        <Button type="button" variant="outline" size="xs" onClick={onRetry}>
          <RotateCw className="size-3" />
          Retry
        </Button>
      )}
    </div>
  );
}

/** Empty state inside a section. */
export function SectionEmpty({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border px-4 py-5 text-center">
      <Icon className="size-5 text-muted-foreground/60" />
      <p className="mt-1.5 text-xs font-medium text-foreground">{title}</p>
      {children && <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{children}</div>}
    </div>
  );
}

/** Pre-formatted output (resolved prompts, model replies, tool results). */
export function OutputBlock({ label, children, tone = 'default' }: { label?: string; children: ReactNode; tone?: 'default' | 'error' }) {
  return (
    <div className="space-y-1">
      {label && <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>}
      <pre
        tabIndex={0}
        className={cn(
          'max-h-72 min-w-0 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] rounded-lg border px-3 py-2 font-mono text-[11px] leading-relaxed',
          tone === 'error' ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-border bg-surface-inset text-foreground',
        )}
      >
        {children}
      </pre>
    </div>
  );
}
