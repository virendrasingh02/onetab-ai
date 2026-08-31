import { Badge, Button, Input, KbdShortcut, ScrollArea } from '@org/ui';
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
  Palette,
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
  const [selectedSection] = useState<
    'all' | 'workspace' | 'account'
  >('all');

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
        { id: 'preferences', label: 'Preferences', icon: Sliders },
        {
          id: 'theme',
          label: 'Theme & Customization',
          icon: Palette,
          badge: 'NEW',
        },
        { id: 'chat', label: 'Chat & Messaging', icon: MessageSquare },
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
        {
          id: 'analytics',
          label: 'Company Analytics & Usage',
          icon: BarChart3,
        },
        {
          id: 'billing',
          label: 'Plans & Billing',
          icon: CreditCard,
          badge: 'PRO',
        },
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
      items: [{ id: 'danger', label: 'Danger Zone', icon: AlertTriangle }],
    },
  ];

  const visibleGroups = navGroups.filter(
    (g) => selectedSection === 'all' || g.section === selectedSection,
  );

  return (
    <div className="gap-1.5 p-1.5 flex h-screen w-screen flex-col overflow-hidden bg-background font-sans text-foreground">
      {/* Main Settings Card Box */}
      <div className="min-h-0 flex h-full w-full flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-xs">
        {/* Top Header Bar */}
        <header className="h-12 backdrop-blur-md px-4 sm:px-6 flex shrink-0 items-center justify-between border-b border-border/70 bg-surface/60">
          <div className="gap-2.5 text-xs flex items-center">
            <Link
              to={backUrl}
              className="gap-1.5 font-medium px-2 py-1 inline-flex items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back</span>
            </Link>
            <span className="text-muted-foreground/50">/</span>
            <div className="gap-2 flex items-center">
              <span className="font-semibold text-foreground">Settings</span>
              <span className="text-muted-foreground/50">/</span>
              <span className="font-medium px-2 py-0.5 rounded-md bg-primary/10 text-primary capitalize">
                {activeTab.replace('-', ' ')}
              </span>
            </div>
            {workspace?.name ? (
              <Badge
                variant="neutral"
                className="sm:inline-flex font-normal hidden text-[10px] text-muted-foreground"
              >
                {workspace.name}
              </Badge>
            ) : null}
          </div>

          <div className="gap-2 flex items-center">
            <Link to={backUrl}>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Close settings"
                className="h-8 gap-1.5 px-2.5 text-xs rounded-lg text-muted-foreground hover:text-foreground"
              >
                <span>Close</span>
                <KbdShortcut keys={['Escape']} size="xs" variant="muted" responsive />
                <X className="size-3.5" />
              </Button>
            </Link>
          </div>
        </header>

        {/* Inner Content Area: Sidebar + Scrollable Main Content */}
        <div className="min-h-0 flex flex-1 overflow-hidden">
          {/* Left Dedicated Settings Sidebar */}
          <aside className="w-64 sm:w-72 flex h-full shrink-0 flex-col border-r border-border bg-surface-muted/50 select-none">
            {/* Search & Section Filter Pills */}
            <div className="p-3 space-y-2.5">
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Search settings..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leadingIcon={<Search className="size-4" />}
                  className="h-8 text-xs rounded-lg border-border bg-surface-inset placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Scrollable Nav Items */}
            <ScrollArea
              className="min-h-0 py-3 px-3 flex-1"
              contentClassName="p-2.5 space-y-4"
            >
              {visibleGroups.map((group) => {
                const filteredItems = group.items.filter((item) =>
                  item.label.toLowerCase().includes(searchQuery.toLowerCase()),
                );

                if (searchQuery && filteredItems.length === 0) return null;

                return (
                  <div key={group.title} className="space-y-1">
                    <div className="px-2.5 py-1 font-bold tracking-wider text-[10.5px] text-muted-foreground uppercase">
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
                            'px-2.5 py-1.5 font-medium flex w-full items-center justify-between rounded-xl text-left text-[13px] transition-all',
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
                );
              })}
            </ScrollArea>
          </aside>

          {/* Main Settings Content Area */}
          <main className="min-h-0 flex flex-1 flex-col overflow-hidden bg-surface-inset/20">
            <ScrollArea
              className="min-h-0 flex-1"
              contentClassName="p-6 md:p-10"
            >
              <div className="max-w-4xl space-y-8 mx-auto">{children}</div>
            </ScrollArea>
          </main>
        </div>
      </div>

      {/* Bottom Managed Notification Bar */}
      <NotificationEnableBar workspaceId={workspaceId} />
    </div>
  );
}
