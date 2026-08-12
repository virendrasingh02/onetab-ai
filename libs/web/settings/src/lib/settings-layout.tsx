import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  Sliders,
  User,
  Bell,
  Code2,
  ShieldCheck,
  Link2,
  Sparkles,
  Tag,
  FileText,
  Clock,
  Layers,
  CircleDot,
  Radio,
  Target,
  FileCode,
  MessageSquare,
  Rocket,
  Activity,
  HelpCircle,
  Smile,
  Plug,
  Users,
  UploadCloud,
  AlertTriangle,
  Search,
} from 'lucide-react';

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
      title: 'Personal',
      items: [
        { id: 'preferences', label: 'Preferences', icon: Sliders },
        { id: 'profile', label: 'Profile', icon: User },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'code', label: 'Code & reviews', icon: Code2 },
        { id: 'security', label: 'Security & access', icon: ShieldCheck },
        { id: 'connected', label: 'Connected accounts', icon: Link2 },
        { id: 'agent-personalization', label: 'Agent personalization', icon: Sparkles },
      ],
    },
    {
      title: 'Issues',
      items: [
        { id: 'issues-labels', label: 'Labels', icon: Tag },
        { id: 'issues-templates', label: 'Templates', icon: FileText },
        { id: 'issues-sla', label: "SLA's", icon: Clock },
      ],
    },
    {
      title: 'Projects',
      items: [
        { id: 'projects-labels', label: 'Labels', icon: Tag },
        { id: 'projects-templates', label: 'Templates', icon: Layers },
        { id: 'projects-statuses', label: 'Statuses', icon: CircleDot },
        { id: 'projects-updates', label: 'Updates', icon: Radio },
      ],
    },
    {
      title: 'Features',
      items: [
        { id: 'ai-agents', label: 'AI & Agents', icon: Sparkles },
        { id: 'initiatives', label: 'Initiatives', icon: Target },
        { id: 'documents', label: 'Documents', icon: FileCode },
        { id: 'customer-requests', label: 'Customer requests', icon: MessageSquare },
        { id: 'releases', label: 'Releases', icon: Rocket },
        { id: 'pulse', label: 'Pulse', icon: Activity },
        { id: 'asks', label: 'Asks', icon: HelpCircle },
        { id: 'emojis', label: 'Emojis', icon: Smile },
        { id: 'integrations', label: 'Integrations', icon: Plug },
      ],
    },
    {
      title: 'Administration',
      items: [
        { id: 'general', label: 'Workspace General', icon: Building2 },
        { id: 'members', label: 'Members & Teams', icon: Users, href: workspaceSlug ? `/w/${workspaceSlug}/members` : undefined },
        { id: 'import-export', label: 'Import & Export', icon: UploadCloud },
        { id: 'danger', label: 'Danger Zone', icon: AlertTriangle },
      ],
    },
  ];

  return (
    <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans antialiased">
      {/* Linear Left Sidebar */}
      <aside className="w-64 shrink-0 border-r border-border/60 bg-muted/20 flex flex-col h-full select-none">
        {/* Top Header Link & Search */}
        <div className="p-3 border-b border-border/40 space-y-2">
          <Link
            to={backUrl}
            className="inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1.5 rounded-md hover:bg-muted/50 w-full"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to app</span>
          </Link>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-muted/40 border border-border/50 rounded-lg text-xs pl-8 pr-3 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all"
            />
          </div>
        </div>

        {/* Scrollable Nav Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-4 text-xs scrollbar-thin">
          {navGroups.map((group) => {
            const filteredItems = group.items.filter((item) =>
              item.label.toLowerCase().includes(searchQuery.toLowerCase())
            );

            if (searchQuery && filteredItems.length === 0) return null;

            return (
              <div key={group.title} className="space-y-1">
                <div className="px-2.5 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.title}
                </div>
                {filteredItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        if (item.href) {
                          navigate(item.href);
                        } else {
                          onTabChange(item.id);
                        }
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-accent/80 text-foreground font-semibold shadow-2xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon className="size-3.5 shrink-0" />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge ? (
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                          {item.badge}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </aside>

      {/* Main Settings Content Area */}
      <main className="flex-1 overflow-y-auto bg-muted/5 p-6 md:p-10 scrollbar-thin">
        <div className="max-w-3xl mx-auto space-y-8">{children}</div>
      </main>
    </div>
  );
}
