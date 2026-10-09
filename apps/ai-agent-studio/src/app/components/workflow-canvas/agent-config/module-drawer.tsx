import {
  Button,
  confirm,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SearchInput,
  Skeleton,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import type { StudioGraphIssue } from '@org/types';
import type { Edge, Node } from '@xyflow/react';
import {
  ChevronDown,
  ChevronLeft,
  ClipboardCopy,
  Download,
  FlaskConical,
  History,
  MoreHorizontal,
  RotateCcw,
  Undo2,
  Upload,
  X,
} from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ComponentType } from 'react';
import type { CatalogNodeItem } from '../node-library.js';
import type { AgentSlotId } from '../agent-slots.js';
import {
  AGENT_MODULES,
  applyDraft,
  draftChanges,
  emptyDraft,
  exportModule,
  importModule,
  MODULE_BY_ID,
  MODULE_DEFAULTS,
  moduleConfigKeys,
  patchDraft,
  patchLimits,
  readAgentModules,
  summarizeModule,
  validateModule,
  type AgentModuleId,
  type AgentModulesView,
  type ModuleDraft,
  type ModuleIssue,
} from './agent-module-model.js';
import { fieldDomId, IssueList, MODULE_ICONS, SectionsContext, sectionDomId, StatusPill } from './config-primitives.js';
import { useDebouncedValue } from './use-agent-config-data.js';

/** Structural changes the drawer can make on the canvas (they apply at once and can be undone). */
export interface ModuleActions {
  /** Plug a new node into one of this agent's slots. */
  attach: (item: CatalogNodeItem, slot: AgentSlotId) => void;
  /** Remove a plugged-in card (knowledge source, tool card). */
  deleteNode: (nodeId: string) => void;
  /** Unplug one node from this agent's slot, keeping the node. */
  detach: (targetId: string, slot: AgentSlotId) => void;
  /** Plug an existing node on the canvas into one of this agent's slots (validated like a drag). */
  connect: (targetId: string, slot: AgentSlotId) => void;
  /** Open another node's panel (a sub-agent). */
  selectNode: (nodeId: string, moduleId?: AgentModuleId) => void;
  /** Start a test run of the whole agent in the run console. */
  runAgentTest: () => void;
}

export interface ModuleEditorProps {
  view: AgentModulesView;
  agent: Node;
  /** The graph with the draft applied. */
  nodes: Node[];
  edges: Edge[];
  issues: ModuleIssue[];
  readOnly: boolean;
  setConfig: (nodeId: string, patch: Record<string, unknown>) => void;
  setLimits: (patch: Record<string, number | undefined>) => void;
  actions: ModuleActions;
  jumpTo: (issue: Pick<ModuleIssue, 'section' | 'field'>) => void;
  /** Bumped when the header's Test button is pressed. */
  testSignal: number;
}

const EDITORS: Record<AgentModuleId, ComponentType<ModuleEditorProps>> = {
  prompt: lazy(() => import('./prompt-module.js').then((m) => ({ default: m.PromptModule }))),
  llm: lazy(() => import('./llm-module.js').then((m) => ({ default: m.LlmModule }))),
  knowledge: lazy(() => import('./knowledge-module.js').then((m) => ({ default: m.KnowledgeModule }))),
  tools: lazy(() => import('./tools-module.js').then((m) => ({ default: m.ToolsModule }))),
  subAgents: lazy(() => import('./subagents-module.js').then((m) => ({ default: m.SubAgentsModule }))),
};

export interface ModuleDrawerProps {
  moduleId: AgentModuleId;
  agent: Node;
  nodes: Node[];
  edges: Edge[];
  graphSettings: Record<string, unknown> | undefined;
  issuesByNode: Map<string, StudioGraphIssue[]>;
  readOnly: boolean;
  initialSection?: string;
  initialField?: string;
  actions: ModuleActions;
  /** Write the draft into the graph. */
  onApply: (draft: ModuleDraft) => void;
  /** Persist the agent now (after applying). */
  onSaveNow: () => void;
  onBack: () => void;
  onClose: () => void;
  onSwitchModule: (id: AgentModuleId) => void;
  /** Tells the inspector whether there are unsaved edits (it guards its own close). */
  onDirtyChange?: (dirty: boolean) => void;
}

const isTyping = (el: EventTarget | null) =>
  el instanceof HTMLElement && Boolean(el.closest('input, textarea, select, [contenteditable="true"], [role="listbox"], [role="combobox"]'));

export function ModuleDrawer({
  moduleId,
  agent,
  nodes,
  edges,
  graphSettings,
  issuesByNode,
  readOnly,
  initialSection,
  initialField,
  actions,
  onApply,
  onSaveNow,
  onBack,
  onClose,
  onSwitchModule,
  onDirtyChange,
}: ModuleDrawerProps) {
  const def = MODULE_BY_ID.get(moduleId)!;
  const Icon = MODULE_ICONS[moduleId];
  const Editor = EDITORS[moduleId];

  const [draft, setDraft] = useState<ModuleDraft>(emptyDraft);
  const draftNodes = useMemo(() => applyDraft(nodes, draft), [nodes, draft]);
  const settingsView = draft.graphSettings ?? graphSettings;
  const draftAgent = draftNodes.find((n) => n.id === agent.id) ?? agent;
  const view = useMemo(() => readAgentModules(draftAgent, draftNodes, edges, settingsView), [draftAgent, draftNodes, edges, settingsView]);
  const stepIds = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const deferredView = useDebouncedValue(view, 150);
  const issues = useMemo(
    () => validateModule(moduleId, deferredView, { issuesByNode, stepIds }),
    [moduleId, deferredView, issuesByNode, stepIds],
  );
  const summary = useMemo(() => summarizeModule(moduleId, view, { issuesByNode, stepIds }), [moduleId, view, issuesByNode, stepIds]);
  const changes = useMemo(() => draftChanges(nodes, draft, graphSettings), [nodes, draft, graphSettings]);
  const dirty = changes.nodeIds.length > 0 || changes.settings;

  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  const setConfig = useCallback(
    (nodeId: string, patch: Record<string, unknown>) => {
      if (readOnly) return;
      setDraft((d) => patchDraft(d, nodes, nodeId, patch));
    },
    [nodes, readOnly],
  );
  const setLimits = useCallback(
    (patch: Record<string, number | undefined>) => {
      if (readOnly) return;
      setDraft((d) => patchLimits(d, graphSettings, patch));
    },
    [graphSettings, readOnly],
  );

  /* -- sections: search, collapse, scroll-spy, jump-to-field ------------ */

  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query.trim().toLowerCase(), 120);
  const hidden = useMemo(() => {
    if (!debouncedQuery) return new Set<string>();
    const words = debouncedQuery.split(/\s+/);
    return new Set(
      def.sections
        .filter((s) => !words.every((w) => `${s.label} ${s.keywords}`.toLowerCase().includes(w)))
        .map((s) => s.id),
    );
  }, [debouncedQuery, def.sections]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = useCallback(
    (id: string) =>
      setCollapsed((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }),
    [],
  );
  const sectionsCtx = useMemo(() => ({ hidden, collapsed, toggle, readOnly }), [hidden, collapsed, toggle, readOnly]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState(def.sections[0]?.id);
  // Scroll-spy: the active section is the last one whose top has scrolled past the
  // top of the body (or the last one, at the very bottom).
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const sections = [...root.querySelectorAll<HTMLElement>('[data-config-section]')];
      if (sections.length === 0) return;
      const top = root.getBoundingClientRect().top;
      const atBottom = root.scrollTop + root.clientHeight >= root.scrollHeight - 4;
      let current = sections[0];
      for (const el of sections) if (el.getBoundingClientRect().top - top <= 48) current = el;
      if (atBottom && root.scrollTop > 0) current = sections[sections.length - 1];
      const id = current.dataset['configSection'];
      if (id) setActiveSection(id);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    const t = setTimeout(update, 300);
    return () => {
      root.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(t);
    };
  }, [moduleId, hidden, collapsed]);

  const goToSection = useCallback((id: string) => {
    setCollapsed((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    requestAnimationFrame(() => {
      document.getElementById(sectionDomId(id))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
    });
  }, []);

  const jumpTo = useCallback(
    (issue: Pick<ModuleIssue, 'section' | 'field'>) => {
      setQuery('');
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(issue.section);
        return next;
      });
      // Wait for the section to render (and a lazy editor to load) before focusing.
      let tries = 0;
      const attempt = () => {
        const target = (issue.field && document.getElementById(fieldDomId(issue.field))) || document.getElementById(sectionDomId(issue.section));
        if (!target) {
          if (tries++ < 20) setTimeout(attempt, 50);
          return;
        }
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const focusable = target.querySelector<HTMLElement>('input, textarea, select, button:not([disabled]), [tabindex="0"]');
        focusable?.focus({ preventScroll: true });
        target.classList.add('ring-2', 'ring-primary/40', 'rounded-lg');
        setTimeout(() => target.classList.remove('ring-2', 'ring-primary/40', 'rounded-lg'), 1400);
        setActiveSection(issue.section);
      };
      requestAnimationFrame(attempt);
    },
    [],
  );

  useEffect(() => {
    if (initialSection || initialField) jumpTo({ section: initialSection ?? def.sections[0].id, field: initialField });
    // Only when the drawer opens on a target.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [testSignal, setTestSignal] = useState(0);
  const hasTesting = def.sections.some((s) => s.id === 'testing');
  const runTest = () => {
    if (hasTesting) {
      goToSection('testing');
      setTestSignal((n) => n + 1);
    } else actions.runAgentTest();
  };

  /* -- save / discard / leave ------------------------------------------- */

  const discard = () => setDraft(emptyDraft());
  const save = (persist: boolean) => {
    if (!dirty) {
      if (persist) onSaveNow();
      return;
    }
    const blocking = validateModule(moduleId, view, { issuesByNode, stepIds }).filter((i) => i.level === 'error');
    if (blocking.length) {
      toast.error(`Fix ${blocking.length === 1 ? 'this' : 'these'} first: ${blocking[0].message}`);
      jumpTo(blocking[0]);
      return;
    }
    onApply(draft);
    setDraft(emptyDraft());
    if (persist) onSaveNow();
    toast.success(`${def.label} saved`);
  };

  const leave = async (then: () => void) => {
    if (dirty) {
      const ok = await confirm({
        title: 'Discard unsaved changes?',
        description: `Your ${def.label} edits haven’t been saved.`,
        confirmLabel: 'Discard',
        cancelLabel: 'Keep editing',
        destructive: true,
      });
      if (!ok) return;
    }
    then();
  };

  /* -- more menu --------------------------------------------------------- */

  const fileRef = useRef<HTMLInputElement>(null);
  const exported = () => exportModule(moduleId, view, draftNodes);
  const copyConfig = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(exported(), null, 2));
      toast.success(`${def.label} settings copied`);
    } catch {
      toast.error('Couldn’t reach the clipboard');
    }
  };
  const downloadConfig = () => {
    const blob = new Blob([JSON.stringify(exported(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${view.agentLabel.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'agent'}-${moduleId}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importConfig = async (file: File) => {
    try {
      const payload = JSON.parse(await file.text()) as unknown;
      const result = importModule(moduleId, view, draft, nodes, payload);
      if (result.applied === 0) {
        toast('Nothing in that file applies to this agent');
        return;
      }
      setDraft(result.draft);
      toast.success(`Imported ${result.applied} setting${result.applied === 1 ? '' : 's'} — review and Save`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'That file isn’t a settings export');
    }
  };
  const resetDefaults = async () => {
    const ok = await confirm({
      title: `Reset ${def.label} to defaults?`,
      description: 'This resets the advanced settings in the draft. Nothing changes until you Save.',
      confirmLabel: 'Reset',
    });
    if (!ok) return;
    const keys = moduleConfigKeys(moduleId, view);
    let next = draft;
    for (const [nodeId, list] of Object.entries(keys)) {
      const patch = Object.fromEntries(Object.entries(MODULE_DEFAULTS[moduleId]).filter(([k]) => list.includes(k)));
      if (Object.keys(patch).length) next = patchDraft(next, nodes, nodeId, patch);
    }
    if (moduleId === 'subAgents') next = { ...next, graphSettings: { ...(next.graphSettings ?? graphSettings ?? {}), limits: {} } };
    setDraft(next);
  };

  return (
    <SectionsContext.Provider value={sectionsCtx}>
      <div
        className="relative flex min-h-0 flex-1 flex-col"
        onKeyDown={(e) => {
          const mod = e.ctrlKey || e.metaKey;
          if (mod && e.key.toLowerCase() === 's') {
            e.preventDefault();
            e.stopPropagation();
            save(true);
          } else if (e.key === 'Escape' && !isTyping(e.target)) {
            e.stopPropagation();
            void leave(onBack);
          } else if (e.key === '/' && !isTyping(e.target)) {
            e.preventDefault();
            (e.currentTarget.querySelector('[data-settings-search] input') as HTMLInputElement | null)?.focus();
          }
        }}
      >
        {/* Sticky header */}
        <header className="relative shrink-0 space-y-3 border-b border-border px-4 pb-3 pt-3.5">
          <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <button
              type="button"
              onClick={() => void leave(onBack)}
              className="inline-flex min-w-0 items-center gap-0.5 rounded px-1 py-0.5 hover:bg-surface-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            >
              <ChevronLeft className="size-3.5 shrink-0" />
              <span className="max-w-[10rem] truncate">{view.agentLabel}</span>
            </button>
            <span aria-hidden>/</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 font-medium text-foreground hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  aria-label={`${def.label} — switch module`}
                >
                  {def.label}
                  <ChevronDown className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {AGENT_MODULES.map((m) => {
                  const MIcon = MODULE_ICONS[m.id];
                  return (
                    <DropdownMenuItem key={m.id} disabled={m.id === moduleId} onSelect={() => void leave(() => onSwitchModule(m.id))}>
                      <MIcon className="size-3.5" />
                      {m.label}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>

          <div className="flex items-start gap-2.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                {def.label}
                {dirty && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-warning/12 px-1.5 py-0.5 text-[10px] font-medium text-warning-text">
                    <span className="size-1.5 rounded-full bg-warning" aria-hidden />
                    Unsaved
                  </span>
                )}
              </h3>
              <p className="truncate text-[11px] text-muted-foreground">{def.description}</p>
              <StatusPill state={summary.state} className="mt-1" />
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button type="button" variant="outline" size="xs" onClick={runTest} title="Test this module">
                <FlaskConical className="size-3.5" />
                Test
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="More actions">
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel>{def.label} settings</DropdownMenuLabel>
                  <DropdownMenuItem onSelect={() => void copyConfig()}>
                    <ClipboardCopy className="size-3.5" />
                    Copy configuration
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={downloadConfig}>
                    <Download className="size-3.5" />
                    Export as JSON
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={readOnly} onSelect={() => fileRef.current?.click()}>
                    <Upload className="size-3.5" />
                    Import from JSON…
                  </DropdownMenuItem>
                  {def.sections.some((s) => s.id === 'versions') && (
                    <DropdownMenuItem onSelect={() => goToSection('versions')}>
                      <History className="size-3.5" />
                      Version history
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem disabled={!dirty} onSelect={discard}>
                    <Undo2 className="size-3.5" />
                    Discard changes
                  </DropdownMenuItem>
                  <DropdownMenuItem disabled={readOnly} onSelect={() => void resetDefaults()}>
                    <RotateCcw className="size-3.5" />
                    Reset to defaults
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button type="button" variant="ghost" size="icon-xs" onClick={() => void leave(onClose)} aria-label="Close panel" title="Close (Esc goes back)">
                <X className="size-4" />
              </Button>
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) void importConfig(file);
            }}
          />

          <div data-settings-search>
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search settings…  ( / )"
              label={`Search ${def.label} settings`}
              className="h-8 text-xs"
            />
          </div>
          <nav aria-label={`${def.label} sections`} className="-mx-1 flex gap-1 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
            {def.sections
              .filter((s) => !hidden.has(s.id))
              .map((s) => {
                const count = issues.filter((i) => i.section === s.id && i.level !== 'info').length;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => goToSection(s.id)}
                    aria-current={activeSection === s.id ? 'true' : undefined}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                      activeSection === s.id ? 'bg-primary/12 text-primary-text' : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground',
                    )}
                  >
                    {s.label}
                    {count > 0 && <span className="size-1.5 rounded-full bg-warning" aria-label={`${count} issue${count === 1 ? '' : 's'}`} />}
                  </button>
                );
              })}
          </nav>
        </header>

        {/* Body */}
        <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4">
          {hidden.size === def.sections.length ? (
            <p className="py-8 text-center text-xs text-muted-foreground">No {def.label} settings match “{query}”.</p>
          ) : (
            <Suspense
              fallback={
                <div className="space-y-3 py-4" aria-busy="true" aria-label="Loading settings">
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-4 w-1/4" />
                  <Skeleton className="h-9 w-full" />
                </div>
              }
            >
              <Editor
                view={view}
                agent={draftAgent}
                nodes={draftNodes}
                edges={edges}
                issues={issues}
                readOnly={readOnly}
                setConfig={setConfig}
                setLimits={setLimits}
                actions={actions}
                jumpTo={jumpTo}
                testSignal={testSignal}
              />
            </Suspense>
          )}
        </div>

        {/* Sticky footer */}
        <footer className="shrink-0 space-y-2 border-t border-border px-4 py-3">
          {issues.some((i) => i.level === 'error') && (
            <div className="max-h-20 overflow-y-auto">
              <IssueList issues={issues.filter((i) => i.level === 'error')} onJump={jumpTo} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <p className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" aria-live="polite">
              {readOnly ? 'Canvas is locked' : dirty ? 'Unsaved changes' : 'All changes applied'}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={discard} disabled={!dirty}>
              Discard
            </Button>
            <Button type="button" size="sm" onClick={() => save(true)} disabled={readOnly || !dirty} title="Save (Ctrl+S)">
              Save
            </Button>
          </div>
        </footer>
      </div>
    </SectionsContext.Provider>
  );
}
