import { Badge, Button, Input, ScrollArea } from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Bot,
  Building2,
  Calendar,
  FileCode,
  FolderArchive,
  Kanban,
  MessageSquare,
  Plug,
  Search,
  ShieldCheck,
  Sliders,
  Sparkles,
  UploadCloud,
  User,
  UserPlus,
  Users,
  Workflow,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

export interface NavGroup {
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
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const backUrl = workspaceSlug ? `/w/${workspaceSlug}` : '/';

  const navGroups: NavGroup[] = [
    {
      title: 'Account & Personal',
      items: [
        { id: 'preferences', label: 'Preferences', icon: Sliders },
        { id: 'profile', label: 'Profile & Details', icon: User },
        { id: 'notifications', label: 'Notifications & Alerts', icon: Bell },
        { id: 'security', label: 'Account Security', icon: ShieldCheck },
      ],
    },
    {
      title: 'AI & Automation',
      items: [
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
      title: 'Work Tools & Collaboration',
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
      title: 'Integrations & Migration',
      items: [
        { id: 'integrations', label: 'Integration Hub', icon: Plug },
        { id: 'import-export', label: 'Import & Export', icon: UploadCloud },
      ],
    },
    {
      title: 'Workspace Administration',
      items: [
        { id: 'general', label: 'General Settings', icon: Building2 },
        {
          id: 'members',
          label: 'Members & Directory',
          icon: Users,
          href: workspaceSlug ? `/w/${workspaceSlug}/members` : undefined,
        },
        {
          id: 'invitations',
          label: 'Workspace Invitations',
          icon: UserPlus,
          href: workspaceSlug ? `/w/${workspaceSlug}/invitations` : undefined,
        },
        {
          id: 'analytics',
          label: 'Analytics & Usage',
          icon: BarChart3,
          href: workspaceSlug ? `/w/${workspaceSlug}/analytics` : undefined,
        },
        { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex h-screen w-screen bg-background text-foreground overflow-hidden font-sans antialiased">
      {/* Left Dedicated Settings Sidebar */}
      <aside className="w-72 shrink-0 border-r border-border bg-surface flex flex-col h-full select-none">
        {/* Top Header Link & Search */}
        <div className="p-3.5 border-b border-border space-y-3">
          <Link
            to={backUrl}
            className="inline-flex items-center gap-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all px-2.5 py-1.5 rounded-xl hover:bg-accent/60 w-full group"
          >
            <ArrowLeft className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-x-0.5 group-hover:text-foreground" />
            <span>Back to workspace</span>
          </Link>
          <div className="relative">
            <Input
              type="text"
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              leadingIcon={<Search className="size-4" />}
              className="h-8.5 text-xs bg-surface-inset border-border placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Scrollable Nav Items */}
        <ScrollArea className="min-h-0 flex-1" contentClassName="p-3 space-y-4">
          {navGroups.map((group) => {
            const filteredItems = group.items.filter((item) =>
              item.label.toLowerCase().includes(searchQuery.toLowerCase()),
            );

            if (searchQuery && filteredItems.length === 0) return null;

            return (
              <div key={group.title} className="space-y-1">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-subtle uppercase tracking-wider">
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
                        'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all text-left',
                        isActive
                          ? 'bg-accent/80 text-foreground font-semibold shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="size-4 shrink-0 text-muted-foreground" />
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

      {/* Main Full-Page Settings Content Area */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-surface-inset/30">
        {/* Subtle Top Utility Bar */}
        <div className="h-12 border-b border-border/60 bg-surface/50 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Settings</span>
            <span>/</span>
            <span className="font-semibold text-foreground capitalize">
              {activeTab.replace('-', ' ')}
            </span>
          </div>
          <Link to={backUrl}>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close settings"
              className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Button>
          </Link>
        </div>

        {/* Scrollable Content */}
        <ScrollArea className="min-h-0 flex-1" contentClassName="p-6 md:p-12">
          <div className="max-w-4xl mx-auto space-y-8">{children}</div>
        </ScrollArea>
      </main>
    </div>
  );
}
