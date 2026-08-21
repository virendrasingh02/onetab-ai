import { Badge, Button, Input, ScrollArea } from '@org/ui';
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
  CreditCard,
  FileCode,
  FolderArchive,
  Globe,
  Kanban,
  Key,
  MessageSquare,
  Plug,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  Target,
  UploadCloud,
  User,
  UserPlus,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useCurrentWorkspace } from './use-workspaces.js';

export interface NavGroup {
  section: 'account' | 'workspace';
  title: string;
  items: {
    id: string;
    label: string;
    icon: React.ElementType;
    badge?: string;
    href?: string;
  }[];
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
  const [selectedSection, setSelectedSection] = useState<'all' | 'workspace' | 'account'>('all');

  const backUrl = workspaceSlug ? `/w/${workspaceSlug}` : '/';

  // Keyboard shortcut: Escape to return back to workspace
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        navigate(backUrl);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate, backUrl]);

  const navGroups: NavGroup[] = [
    {
      section: 'account',
      title: 'Account Settings',
      items: [
        { id: 'preferences', label: 'Preferences & Theme', icon: Sliders },
        { id: 'profile', label: 'Profile & Details', icon: User },
        { id: 'timezone-region', label: 'Time Zone & Region', icon: Globe },
        { id: 'focus-status', label: 'Status & Focus Mode', icon: Target },
        { id: 'notifications', label: 'Notifications & Alerts', icon: Bell },
        { id: 'security', label: 'Account Security', icon: ShieldCheck },
      ],
    },
    {
      section: 'workspace',
      title: 'Workspace Settings',
      items: [
        { id: 'general', label: 'General Settings', icon: Building2 },
        { id: 'members', label: 'Members & Directory', icon: Users },
        { id: 'invitations', label: 'Workspace Invitations', icon: UserPlus },
        { id: 'analytics', label: 'Company Analytics & Usage', icon: BarChart3 },
        { id: 'billing', label: 'Plans & Billing', icon: CreditCard, badge: 'PRO' },
      ],
    },
    {
      section: 'workspace',
      title: 'AI & Automation',
      items: [
        {
          id: 'ai-providers',
          label: 'AI Providers & Keys',
          icon: Key,
          badge: 'NEW',
        },
        {
          id: 'ai-persona',
          label: 'AI Models & Persona',
          icon: Sparkles,
          badge: 'AI',
        },
        { id: 'agent-marketplace', label: 'Agent Marketplace', icon: Bot },
        { id: 'automations', label: 'Workflow Automations', icon: Workflow },
      ],
    },
    {
      section: 'workspace',
      title: 'Work Tools & Features',
      items: [
        { id: 'channels', label: 'Channels & DMs', icon: MessageSquare },
        { id: 'kanban-tasks', label: 'Tasks & Kanban', icon: Kanban },
        { id: 'documents', label: 'Notes & Documents', icon: FileCode },
        { id: 'files', label: 'Files & Storage', icon: FolderArchive },
        { id: 'schedule', label: 'Schedule & Meetings', icon: Calendar },
        { id: 'pulse', label: 'Pulse Activity Feed', icon: Activity },
      ],
    },
    {
      section: 'workspace',
      title: 'Integrations & Migration',
      items: [
        { id: 'integrations', label: 'Integration Hub', icon: Plug },
        { id: 'import-export', label: 'Import & Export', icon: UploadCloud },
      ],
    },
    {
      section: 'workspace',
      title: 'Security & Danger Zone',
      items: [
        { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
      ],
    },
  ];

  const visibleGroups = navGroups.filter(
    (g) => selectedSection === 'all' || g.section === selectedSection,
  );

  return (
    <div className="gap-1.5 p-1.5 flex h-screen w-screen flex-col overflow-hidden bg-background font-sans text-foreground">
      {/* Main Settings Card Box */}
      <div className="flex h-full w-full flex-1 flex-col min-h-0 rounded-xl border border-border bg-card text-card-foreground shadow-xs overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-12 border-b border-border/70 bg-surface/60 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 text-xs">
            <Link
              to={backUrl}
              className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-accent/60"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back</span>
            </Link>
            <span className="text-muted-foreground/50">/</span>
            <div className="flex items-center gap-2">
              <span className="font-bold text-foreground">Settings</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="font-semibold text-primary capitalize px-2 py-0.5 rounded-md bg-primary/10">
                {activeTab.replace('-', ' ')}
              </span>
            </div>
            {workspace?.name ? (
              <Badge variant="neutral" className="hidden sm:inline-flex text-[10px] font-normal text-muted-foreground">
                {workspace.name}
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Link to={backUrl}>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Close settings"
                className="h-8 gap-1.5 px-2.5 rounded-lg text-muted-foreground hover:text-foreground text-xs"
              >
                <span>Close</span>
                <kbd className="hidden sm:inline-block rounded border border-border bg-surface-inset px-1 text-[10px] font-medium text-muted-foreground">
                  Esc
                </kbd>
                <X className="size-3.5" />
              </Button>
            </Link>
          </div>
        </header>

        {/* Inner Content Area: Sidebar + Scrollable Main Content */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left Dedicated Settings Sidebar */}
          <aside className="w-64 sm:w-72 shrink-0 border-r border-border bg-surface-muted/50 flex flex-col h-full select-none">
            {/* Search & Section Filter Pills */}
            <div className="p-3 border-b border-border space-y-2.5">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leadingIcon={<Search className="size-4" />}
                  className="h-8 text-xs bg-surface-inset border-border placeholder:text-muted-foreground rounded-lg"
                />
              </div>

              {/* Section Filter Pills */}
              <div className="grid grid-cols-3 gap-1 bg-surface-inset p-0.5 rounded-lg border border-border/60">
                <button
                  type="button"
                  onClick={() => setSelectedSection('all')}
                  className={`py-1 text-[11px] font-semibold rounded-md transition-all text-center ${
                    selectedSection === 'all'
                      ? 'bg-surface text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSection('workspace')}
                  className={`py-1 text-[11px] font-semibold rounded-md transition-all text-center truncate px-1 ${
                    selectedSection === 'workspace'
                      ? 'bg-surface text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Workspace
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSection('account')}
                  className={`py-1 text-[11px] font-semibold rounded-md transition-all text-center truncate px-1 ${
                    selectedSection === 'account'
                      ? 'bg-surface text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Account
                </button>
              </div>
            </div>

            {/* Scrollable Nav Items */}
            <ScrollArea className="min-h-0 flex-1" contentClassName="p-2.5 space-y-4">
              {visibleGroups.map((group) => {
                const filteredItems = group.items.filter((item) =>
                  item.label.toLowerCase().includes(searchQuery.toLowerCase()),
                );

                if (searchQuery && filteredItems.length === 0) return null;

                return (
                  <div key={group.title} className="space-y-1">
                    <div className="px-2.5 py-1 text-[10.5px] font-bold text-muted-foreground uppercase tracking-wider">
                      {group.title}
                    </div>
                    {filteredItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeTab === item.id;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            if (item.href) {
                              navigate(item.href);
                            } else {
                              onTabChange(item.id);
                            }
                          }}
                          className={cn(
                            'w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all text-left',
                            isActive
                              ? 'bg-accent text-foreground font-semibold shadow-2xs'
                              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                          )}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Icon className={cn('size-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                            <span className="truncate">{item.label}</span>
                          </div>
                          {item.badge ? (
                            <Badge
                              variant="neutral"
                              className="text-[10px] px-1.5 py-0 font-semibold"
                            >
                              {item.badge}
                            </Badge>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </ScrollArea>
          </aside>

          {/* Main Settings Content Area */}
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-inset/20">
            <ScrollArea className="min-h-0 flex-1" contentClassName="p-6 md:p-10">
              <div className="max-w-4xl mx-auto space-y-8">{children}</div>
            </ScrollArea>
          </main>
        </div>
      </div>

      {/* Bottom Managed Notification Bar */}
      <NotificationEnableBar workspaceId={workspaceId} />
    </div>
  );
}

