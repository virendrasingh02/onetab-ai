import type { ComponentType, ReactNode } from 'react';
import { create } from 'zustand';
import { toast } from 'sonner';
import { confirm, type ConfirmOptions } from '../confirm-dialog.js';

/*
 * The action model behind every contextual menu on the platform.
 *
 * A screen describes *what can be done* to an entity as a flat list of
 * `EntityAction`s — derived from the entity's type, state, ownership and the
 * viewer's permissions — and hands that one list to whichever surface is
 * showing it: the right-click menu, the row's "⋯" dropdown, or the touch
 * action sheet. The surfaces never decide what an entity offers; the list
 * never decides how it is drawn. That split is what stops the "⋯" menu and the
 * right-click menu for the same row from drifting apart.
 */

export type ActionIcon = ComponentType<{ className?: string }>;

export interface EntityAction {
  /** Unique within one list. Also the dedupe key for in-flight runs. */
  id: string;
  label: string;
  icon?: ActionIcon;
  /**
   * Consecutive actions sharing a group are drawn together; a separator is
   * drawn between groups. Groups keep the order they first appear in.
   */
  group?: string;
  /** Keys shown at the right edge, e.g. `['mod', 'E']` or `'E'`. Display only. */
  shortcut?: string | string[];
  /** Muted secondary line under the label. */
  description?: ReactNode;
  /** Muted text at the right edge (a role, a relative time). */
  hint?: ReactNode;
  /** Filtered out entirely — use for actions the viewer may never take. */
  hidden?: boolean;
  /** Shown but inert — use when the action exists but not right now. */
  disabled?: boolean;
  /** Why it is disabled; surfaced as the row's tooltip / sheet sub-line. */
  disabledReason?: string;
  destructive?: boolean;
  /** Renders a check mark (toggles, the current value inside a submenu). */
  checked?: boolean;
  /**
   * Ask before running. `true` builds a sensible destructive prompt from the
   * label; an object is passed to `confirm()` as-is.
   */
  confirm?: boolean | ConfirmOptions;
  /**
   * The work. May return a promise: while it is pending the action shows a
   * spinner, cannot be started again, and its result drives the
   * success/error toast below.
   */
  run?: () => unknown;
  /** Toast shown when `run` settles successfully. */
  successMessage?: string;
  /**
   * Toast shown when `run` throws/rejects. Defaults to a generic message built
   * from the label. Set `false` when the handler already reports its own
   * errors (many mutation hooks toast in `onError`).
   */
  errorMessage?: string | false;
  /** A submenu. An action with `children` never runs itself. */
  children?: EntityAction[];
}

export interface ActionSection {
  key: string;
  items: EntityAction[];
}

/**
 * Drops hidden actions (and submenus left with nothing visible) and splits the
 * rest into groups. Pure — every surface calls it on the same list, so the
 * right-click menu and the "⋯" menu can only differ in presentation.
 */
export function resolveActionSections(
  actions: readonly (EntityAction | null | undefined | false)[],
): ActionSection[] {
  const sections: ActionSection[] = [];
  const byKey = new Map<string, ActionSection>();

  for (const action of actions) {
    if (!action || action.hidden) continue;
    let resolved: EntityAction = action;
    if (action.children) {
      const childSections = resolveActionSections(action.children);
      if (childSections.length === 0) continue;
      resolved = { ...action, children: flattenWithGroups(childSections) };
    }
    const key = action.group ?? '__default';
    let section = byKey.get(key);
    if (!section) {
      section = { key, items: [] };
      byKey.set(key, section);
      sections.push(section);
    }
    section.items.push(resolved);
  }
  return sections;
}

/** Re-flattens resolved sections, keeping each item's group for separators. */
function flattenWithGroups(sections: ActionSection[]): EntityAction[] {
  return sections.flatMap((section) =>
    section.items.map((item) => ({ ...item, group: section.key })),
  );
}

/** True when a list would render nothing — callers skip the menu entirely. */
export function hasVisibleActions(
  actions: readonly (EntityAction | null | undefined | false)[],
): boolean {
  return resolveActionSections(actions).length > 0;
}

/* -------------------------------------------------------------------------- */
/* Running actions                                                            */
/* -------------------------------------------------------------------------- */

interface PendingActionsStore {
  pending: Record<string, true>;
  start: (key: string) => boolean;
  finish: (key: string) => void;
}

/**
 * In-flight actions, keyed by `scope:actionId`. Module-level on purpose: the
 * menu that started an action closes (and unmounts) the moment it is chosen,
 * but reopening it — or opening the same entity's other menu — must still see
 * the action as busy rather than let it be fired twice.
 */
export const usePendingActions = create<PendingActionsStore>()((set, get) => ({
  pending: {},
  start: (key) => {
    if (get().pending[key]) return false;
    set((s) => ({ pending: { ...s.pending, [key]: true } }));
    return true;
  },
  finish: (key) =>
    set((s) => {
      if (!s.pending[key]) return s;
      const next = { ...s.pending };
      delete next[key];
      return { pending: next };
    }),
}));

export function actionKey(scope: string | undefined, id: string): string {
  return `${scope ?? 'global'}:${id}`;
}

function confirmOptionsFor(action: EntityAction): ConfirmOptions | null {
  if (!action.confirm) return null;
  if (action.confirm === true) {
    return {
      title: `${action.label.replace(/…$/, '')}?`,
      description: 'This can’t be undone.',
      confirmLabel: action.label.replace(/…$/, ''),
      destructive: action.destructive ?? true,
    };
  }
  return action.confirm;
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as PromiseLike<unknown>).then === 'function'
  );
}

/**
 * Runs one action through the shared pipeline: disabled guard → confirmation
 * → in-flight dedupe → handler → success / error feedback. Resolves `true`
 * when the handler ran and did not throw.
 */
export async function runEntityAction(
  action: EntityAction,
  scope?: string,
): Promise<boolean> {
  if (action.disabled || action.children || !action.run) return false;
  const key = actionKey(scope, action.id);
  const store = usePendingActions.getState();
  if (store.pending[key]) return false;

  const confirmOptions = confirmOptionsFor(action);
  if (confirmOptions && !(await confirm(confirmOptions))) return false;

  if (!usePendingActions.getState().start(key)) return false;
  try {
    const result = action.run();
    if (isPromiseLike(result)) await result;
    if (action.successMessage) toast.success(action.successMessage);
    return true;
  } catch (error) {
    if (action.errorMessage !== false) {
      const fallback = `Couldn’t ${action.label.replace(/…$/, '').toLowerCase()}`;
      const detail = error instanceof Error && error.message ? error.message : undefined;
      toast.error(action.errorMessage ?? fallback, detail ? { description: detail } : undefined);
    }
    return false;
  } finally {
    usePendingActions.getState().finish(key);
  }
}

/* -------------------------------------------------------------------------- */
/* Registry — extension points                                                */
/* -------------------------------------------------------------------------- */

/**
 * Lets one module contribute actions to another module's entity without the
 * owner importing it — e.g. the work-tools module adding "Create task from
 * message" to chat messages. Providers are plain functions (not hooks) so they
 * can run lazily when a menu opens.
 */
export type EntityActionProvider<TEntity = unknown> = (
  entity: TEntity,
) => (EntityAction | null | undefined | false)[];

const providers = new Map<string, Set<EntityActionProvider<never>>>();

export function registerEntityActions<TEntity>(
  entityType: string,
  provider: EntityActionProvider<TEntity>,
): () => void {
  let set = providers.get(entityType);
  if (!set) {
    set = new Set();
    providers.set(entityType, set);
  }
  set.add(provider as EntityActionProvider<never>);
  return () => {
    set?.delete(provider as EntityActionProvider<never>);
  };
}

/** Base actions plus whatever other modules registered for `entityType`. */
export function collectEntityActions<TEntity>(
  entityType: string | undefined,
  entity: TEntity,
  base: readonly (EntityAction | null | undefined | false)[],
): (EntityAction | null | undefined | false)[] {
  if (!entityType) return [...base];
  const extra = providers.get(entityType);
  if (!extra || extra.size === 0) return [...base];
  const contributed: (EntityAction | null | undefined | false)[] = [];
  for (const provider of extra) {
    try {
      contributed.push(...(provider as EntityActionProvider<TEntity>)(entity));
    } catch {
      // One broken contributor must not take the whole menu down.
    }
  }
  const ids = new Set(base.filter(Boolean).map((a) => (a as EntityAction).id));
  return [...base, ...contributed.filter((a) => a && !ids.has(a.id))];
}
