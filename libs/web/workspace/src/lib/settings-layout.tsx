import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Input,
  KbdShortcut,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { NotificationEnableBar } from '@org/notifications';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Bot,
  Building2,
  Calendar,
  ChevronDown,
  CreditCard,
  Cpu,
  Download,
  FileCode,
  FolderArchive,
  Globe,
  Kanban,
  Key,
  Mail,
  MessageSquare,
  Palette,
  Plug,
  Search,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  User,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getDirtySettingsEntries,
  useSettingsDirty,
} from './settings-dirty.store.js';
import { WorkspacePreferencesEffects } from './settings-preferences.store.js';
import { useCurrentWorkspace } from './use-workspaces.js';

export interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: string;
  href?: string;
  /** Extra words matched by the search box beyond the label. */
  keywords?: string;
}

export interface NavGroup {
  id: string;
  title: string;
  items: NavItem[];
}

/**
 * The settings navigation, grouped by what a setting is *about* rather than one
 * flat 20-item list. Ids are unchanged — `WorkspaceSettingsPage` still switches
 * on them — so this is purely how they are labelled, ordered and bucketed.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    id: 'account',
    title: 'Account',
    items: [
      { id: 'profile', label: 'Profile', icon: User, keywords: 'name avatar bio timezone status details' },
      { id: 'language', label: 'Language & Region', icon: Globe, keywords: 'locale translation date time format' },
      { id: 'notifications', label: 'Notifications', icon: Bell, keywords: 'push digest email mute alerts' },
      { id: 'security', label: 'Account Security', icon: ShieldCheck, keywords: 'password 2fa totp passkey sessions' },
      { id: 'downloads', label: 'Apps & Downloads', icon: Download, badge: 'APP', keywords: 'desktop mobile install' },
    ],
  },
  {
    id: 'workspace',
    title: 'Workspace',
    items: [
      { id: 'general', label: 'General Settings', icon: Building2, keywords: 'name slug url logo' },
      { id: 'appearance', label: 'Appearance & Preferences', icon: Palette, keywords: 'theme dark light font density branding accent' },
      { id: 'members', label: 'Members', icon: Users, keywords: 'people roles admins directory' },
      { id: 'invitations', label: 'Invitations & Access', icon: Mail, keywords: 'invite invitations shareable link join pending resend revoke access email' },
      { id: 'import-export', label: 'Import & Export', icon: UploadCloud, keywords: 'migrate backup data slack' },
      { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, keywords: 'delete archive transfer' },
    ],
  },
  {
    id: 'collaboration',
    title: 'Collaboration',
    items: [
      { id: 'channels', label: 'Channels & DMs', icon: MessageSquare, keywords: 'chat rooms private public encrypted' },
      { id: 'chat', label: 'Chat & Messaging', icon: MessageSquare, keywords: 'composer read receipts typing' },
      { id: 'schedule', label: 'Schedule & Meetings', icon: Calendar, keywords: 'calendar huddle recording google' },
      { id: 'pulse', label: 'Pulse Activity Feed', icon: Activity, keywords: 'presence commits status' },
    ],
  },
  {
    id: 'productivity',
    title: 'Productivity',
    items: [
      { id: 'kanban-tasks', label: 'Tasks & Kanban', icon: Kanban, keywords: 'board cards projects columns' },
      { id: 'documents', label: 'Notes & Documents', icon: FileCode, keywords: 'docs autosave grammar wiki' },
      { id: 'files', label: 'Files & Storage', icon: FolderArchive, keywords: 'uploads retention video quality' },
    ],
  },
  {
    id: 'ai-automation',
    title: 'AI & Automation',
    items: [
      { id: 'ai-providers', label: 'AI Providers & Keys', icon: Key, badge: 'NEW', keywords: 'openai anthropic api key' },
      { id: 'ai-persona', label: 'AI Models & Persona', icon: Sparkles, badge: 'AI', keywords: 'model prompt temperature context' },
      { id: 'enterprise-custom-llm', label: 'Custom LLM (Enterprise)', icon: Cpu, badge: 'ENT', keywords: 'self-hosted endpoint' },
      { id: 'agent-marketplace', label: 'Agent Marketplace', icon: Bot, keywords: 'agents install bots' },
      { id: 'automations', label: 'Workflow Automations', icon: Workflow, keywords: 'triggers webhooks runs retries' },
    ],
  },
  {
    id: 'plan-data',
    title: 'Plan & Data',
    items: [
      { id: 'billing', label: 'Plans & Billing', icon: CreditCard, badge: 'PRO', keywords: 'subscription invoice upgrade seats' },
      { id: 'analytics', label: 'Company Analytics & Usage', icon: BarChart3, keywords: 'usage metrics reports' },
      { id: 'integrations', label: 'Integration Hub', icon: Plug, keywords: 'connect apps github linear jira' },
    ],
  },
];

const COLLAPSE_STORAGE_KEY = 'onetab_settings_nav_collapsed';

function readCollapsed(): Record<string, boolean> {
  if (typeof window === 'undefined') return {};
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(COLLAPSE_STORAGE_KEY) ?? '{}',
    );
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function SettingsLayout({
  activeTab,
  onTabChange,
  children,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  children: React.ReactNode;
}) {
  const { workspaceSlug } = useParams<{ workspaceSlug?: string }>();
  const { workspace, workspaceId } = useCurrentWorkspace();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    readCollapsed,
  );

  const backUrl = workspaceSlug ? `/w/${workspaceSlug}` : '/';

  // --- Unsaved-changes guard -------------------------------------------------
  const isDirty = useSettingsDirty();
  // Holds the "where the user was trying to go" until they confirm/cancel.
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const leaveOpen = pendingLeave !== null;

  const guardedLeave = useCallback((proceed: () => void) => {
    if (getDirtySettingsEntries().length === 0) {
      proceed();
    } else {
      setPendingLeave(() => proceed);
    }
  }, []);

  const keepEditing = () => setPendingLeave(null);

  const discardAndLeave = () => {
    for (const entry of getDirtySettingsEntries()) entry.reset?.();
    const proceed = pendingLeave;
    setPendingLeave(null);
    proceed?.();
  };

  const saveAndLeave = async () => {
    const proceed = pendingLeave;
    setSaving(true);
    try {
      for (const entry of getDirtySettingsEntries()) {
        if (entry.save) await entry.save();
      }
    } catch {
      toast.error('Could not save your changes — check the highlighted fields.');
      setSaving(false);
      return;
    }
    setSaving(false);
    if (getDirtySettingsEntries().length > 0) {
      // A form blocked its own save (validation) — surface it, don't leave.
      toast.error('Some changes still need attention before you can leave.');
      setPendingLeave(null);
      return;
    }
    setPendingLeave(null);
    proceed?.();
  };

  // Warn on tab close / refresh while there are unsaved edits.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Escape returns to the workspace — through the same guard.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (pendingLeave) return; // the dialog owns Escape while it is open
      guardedLeave(() => navigate(backUrl));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, backUrl, guardedLeave, pendingLeave]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        COLLAPSE_STORAGE_KEY,
        JSON.stringify(collapsed),
      );
    } catch {
      // storage unavailable — collapse state is a convenience, not critical
    }
  }, [collapsed]);

  const navGroups = NAV_GROUPS;

  const activeGroupId = useMemo(
    () =>
      navGroups.find((group) =>
        group.items.some((item) => item.id === activeTab),
      )?.id,
    [navGroups, activeTab],
  );

  // Never leave the section you're looking at hidden inside a collapsed group.
  useEffect(() => {
    if (!activeGroupId) return;
    setCollapsed((current) =>
      current[activeGroupId] ? { ...current, [activeGroupId]: false } : current,
    );
  }, [activeGroupId]);

  const needle = searchQuery.trim().toLowerCase();
  const isSearching = needle.length > 0;

  const matches = (item: NavItem) =>
    !needle ||
    item.label.toLowerCase().includes(needle) ||
    (item.keywords ?? '').toLowerCase().includes(needle);

  const groupsToRender = navGroups
    .map((group) => ({
      group,
      items: group.items.filter(matches),
    }))
    .filter(({ items }) => items.length > 0);

  const toggleGroup = (id: string) =>
    setCollapsed((current) => ({ ...current, [id]: !current[id] }));

  return (
    <div className="gap-1.5 p-1.5 flex h-screen w-screen flex-col overflow-hidden bg-background font-sans text-foreground">
      {/* Live-apply preferences (font size, …) so a change previews here. */}
      <WorkspacePreferencesEffects workspaceId={workspaceId} />

      {/* Main Settings Card Box */}
      <div className="min-h-0 flex h-full w-full flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs">
        {/* Top Header Bar */}
        <header className="h-12 backdrop-blur-md px-4 sm:px-6 flex shrink-0 items-center justify-between border-b border-border/70 bg-surface/60">
          <div className="gap-2.5 text-xs flex items-center">
            <button
              type="button"
              onClick={() => guardedLeave(() => navigate(backUrl))}
              className="gap-1.5 font-medium px-2 py-1 inline-flex items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back</span>
            </button>
            <span className="text-muted-foreground/50">/</span>
            <div className="gap-2 flex items-center">
              <span className="font-semibold text-foreground">Settings</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary capitalize">
                {activeTab.replace(/-/g, ' ')}
              </span>
            </div>
            {workspace?.name ? (
              <Badge
                variant="neutral"
                className="sm:inline-flex font-medium hidden text-xs text-foreground/80"
              >
                {workspace.name}
              </Badge>
            ) : null}
          </div>

          <div className="gap-2 flex items-center">
            <Button
              variant="ghost"
              size="sm"
              aria-label="Close settings"
              onClick={() => guardedLeave(() => navigate(backUrl))}
              className="h-8 gap-1.5 px-2.5 text-xs rounded-lg text-muted-foreground hover:text-foreground"
            >
              <span>Close</span>
              <KbdShortcut
                keys={['Escape']}
                size="xs"
                variant="muted"
                responsive
              />
              <X className="size-3.5" />
            </Button>
          </div>
        </header>

        {/* Inner Content Area: Sidebar + Scrollable Main Content */}
        <div className="min-h-0 flex flex-1 overflow-hidden">
          {/* Left Dedicated Settings Sidebar */}
          <aside className="w-64 sm:w-72 flex h-full shrink-0 flex-col border-r border-border bg-surface-muted/50 select-none">
            {/* Search Input */}
            <div className="p-3">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leadingIcon={
                    <Search className="size-3.5 text-muted-foreground" />
                  }
                  className="h-8 text-xs rounded-lg border-border bg-surface-inset placeholder:text-muted-foreground pr-7"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Native Scrollable Nav Items */}
            <div className="min-h-0 py-1 px-3 flex-1 overflow-y-auto overflow-x-hidden space-y-3 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
              {groupsToRender.length === 0 ? (
                <div className="px-2.5 py-10 text-center">
                  <Search className="size-5 mx-auto mb-2 text-muted-foreground/60" />
                  <p className="text-xs text-muted-foreground">
                    No settings match “{searchQuery}”.
                  </p>
                </div>
              ) : (
                groupsToRender.map(({ group, items }) => {
                  const isCollapsed = !isSearching && collapsed[group.id];

                  return (
                    <div key={group.id} className="space-y-1">
                      <button
                        type="button"
                        onClick={() => toggleGroup(group.id)}
                        aria-expanded={!isCollapsed}
                        className="group/hdr px-2.5 py-1 flex w-full items-center justify-between rounded-md text-left transition-colors hover:bg-accent/40"
                      >
                        <span className="gap-1.5 flex items-center font-bold tracking-wider text-[10.5px] text-muted-foreground uppercase">
                          {group.title}
                          <span className="font-semibold tabular-nums text-[10px] text-muted-foreground/60 normal-case">
                            {items.length}
                          </span>
                        </span>
                        {!isSearching ? (
                          <ChevronDown
                            className={cn(
                              'size-3.5 text-muted-foreground/60 transition-transform group-hover/hdr:text-muted-foreground',
                              isCollapsed && '-rotate-90',
                            )}
                          />
                        ) : null}
                      </button>

                      {!isCollapsed ? (
                        <div className="space-y-0.5">
                          {items.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() =>
                                  guardedLeave(() => {
                                    if (item.href) navigate(item.href);
                                    else onTabChange(item.id);
                                  })
                                }
                                aria-current={isActive ? 'page' : undefined}
                                className={cn(
                                  'px-2.5 py-1.5 font-medium flex w-full items-center justify-between rounded-xl text-left text-[13px] transition-all cursor-pointer',
                                  isActive
                                    ? 'font-semibold shadow-2xs bg-accent text-foreground'
                                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                                )}
                              >
                                <div className="gap-2.5 min-w-0 flex items-center">
                                  <Icon
                                    className={cn(
                                      'size-4 shrink-0',
                                      isActive
                                        ? 'text-primary'
                                        : 'text-muted-foreground',
                                    )}
                                  />
                                  <span className="truncate">{item.label}</span>
                                </div>
                                {item.badge ? (
                                  <Badge
                                    variant="neutral"
                                    className="px-1.5 py-0 font-semibold text-[10px]"
                                  >
                                    {item.badge}
                                  </Badge>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </aside>

          {/* Main Settings Content Area (Native Scrolling) */}
          <main className="min-h-0 flex flex-1 flex-col overflow-y-auto overflow-x-hidden bg-surface-inset/20 p-6 md:p-10 [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]">
            <div className="max-w-4xl space-y-8 mx-auto w-full">{children}</div>
          </main>
        </div>
      </div>

      {/* Bottom Managed Notification Bar */}
      <NotificationEnableBar workspaceId={workspaceId} />

      {/* Unsaved-changes guard */}
      <AlertDialog
        open={leaveOpen}
        onOpenChange={(open) => {
          if (!open && !saving) setPendingLeave(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ve changed settings in this section that haven&apos;t been
              saved yet. Save them now, discard them, or stay and keep editing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button
              variant="ghost"
              size="sm"
              onClick={keepEditing}
              disabled={saving}
            >
              Keep editing
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={discardAndLeave}
              disabled={saving}
              className="text-destructive hover:text-destructive"
            >
              Discard changes
            </Button>
            <Button size="sm" onClick={saveAndLeave} loading={saving}>
              Save &amp; leave
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
