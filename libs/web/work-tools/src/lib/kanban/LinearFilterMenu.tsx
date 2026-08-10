import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  SlidersHorizontal,
  CircleDot,
  Signal,
  Tag,
  User,
  Users,
  UserCheck,
  Activity,
  Calendar,
  Compass,
  Diamond,
  Flag,
  FileText,
  FileEdit,
  Target,
  ChevronRight,
  Check,
  Search,
} from 'lucide-react';
import { cn } from '@org/utils';
import type { BoardFilter, DueFilter } from './card-meta.js';
import type { BoardLabel, BoardMember, Priority } from './types.js';

export interface LinearFilterMenuProps {
  filter: BoardFilter;
  setFilter: React.Dispatch<React.SetStateAction<BoardFilter>>;
  labels: BoardLabel[];
  members: BoardMember[];
  lists: Array<{ id: string; title: string }>;
  isOpen: boolean;
  onClose: () => void;
  onActivateAIFilter: () => void;
}

export function LinearFilterMenu({
  filter,
  setFilter,
  labels,
  members,
  lists,
  isOpen,
  onClose,
  onActivateAIFilter,
}: LinearFilterMenuProps) {
  const [menuSearch, setMenuSearch] = useState('');
  const [activeSubMenu, setActiveSubMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Keyboard shortcut listener ('F' key)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'f' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const toggleStatus = (id: string) => {
    setFilter((prev) => ({
      ...prev,
      status: prev.status.includes(id)
        ? prev.status.filter((s) => s !== id)
        : [...prev.status, id],
    }));
  };

  const togglePriority = (p: Priority) => {
    setFilter((prev) => ({
      ...prev,
      priorities: prev.priorities.includes(p)
        ? prev.priorities.filter((item) => item !== p)
        : [...prev.priorities, p],
    }));
  };

  const toggleLabel = (id: string) => {
    setFilter((prev) => ({
      ...prev,
      labelIds: prev.labelIds.includes(id)
        ? prev.labelIds.filter((l) => l !== id)
        : [...prev.labelIds, id],
    }));
  };

  const toggleMember = (id: string) => {
    setFilter((prev) => ({
      ...prev,
      memberIds: prev.memberIds.includes(id)
        ? prev.memberIds.filter((m) => m !== id)
        : [...prev.memberIds, id],
    }));
  };

  const toggleLead = (id: string) => {
    setFilter((prev) => ({
      ...prev,
      leadIds: prev.leadIds.includes(id)
        ? prev.leadIds.filter((l) => l !== id)
        : [...prev.leadIds, id],
    }));
  };

  const toggleHealth = (h: string) => {
    setFilter((prev) => ({
      ...prev,
      health: prev.health.includes(h)
        ? prev.health.filter((item) => item !== h)
        : [...prev.health, h],
    }));
  };

  const setDue = (d: DueFilter) => {
    setFilter((prev) => ({ ...prev, due: prev.due === d ? 'any' : d }));
  };

  const toggleNoInitiatives = () => {
    setFilter((prev) => ({ ...prev, noInitiatives: !prev.noInitiatives }));
  };

  const filterCategories = [
    {
      id: 'status',
      label: 'Status',
      icon: CircleDot,
      hasArrow: true,
      activeCount: filter.status.length,
    },
    {
      id: 'priority',
      label: 'Priority',
      icon: Signal,
      hasArrow: true,
      activeCount: filter.priorities.length,
    },
    {
      id: 'labels',
      label: 'Labels',
      icon: Tag,
      hasArrow: true,
      activeCount: filter.labelIds.length,
    },
    {
      id: 'lead',
      label: 'Lead',
      icon: User,
      hasArrow: true,
      activeCount: filter.leadIds.length,
    },
    {
      id: 'members',
      label: 'Members',
      icon: Users,
      hasArrow: true,
      activeCount: filter.memberIds.length,
    },
    {
      id: 'creator',
      label: 'Creator',
      icon: UserCheck,
      hasArrow: true,
      activeCount: filter.creatorIds.length,
    },
    {
      id: 'health',
      label: 'Health',
      icon: Activity,
      hasArrow: true,
      activeCount: filter.health.length,
    },
    {
      id: 'dates',
      label: 'Dates',
      icon: Calendar,
      hasArrow: true,
      activeCount: filter.due !== 'any' ? 1 : 0,
    },
    {
      id: 'initiatives',
      label: 'No Initiatives',
      icon: Compass,
      hasArrow: false,
      activeCount: filter.noInitiatives ? 1 : 0,
      onClick: toggleNoInitiatives,
    },
    {
      id: 'milestones',
      label: 'Milestones',
      icon: Diamond,
      hasArrow: true,
      activeCount: filter.milestones.length,
    },
    {
      id: 'relations',
      label: 'Relations',
      icon: Flag,
      hasArrow: true,
      activeCount: 0,
    },
  ];

  const propertyFilters = [
    { id: 'template', label: 'Template', icon: FileText, hasArrow: true },
    { id: 'summary', label: 'Title & summary', icon: FileEdit, hasArrow: true },
    { id: 'project', label: 'Specific project', icon: Target, hasArrow: true },
  ];

  const filteredCategories = filterCategories.filter((cat) =>
    cat.label.toLowerCase().includes(menuSearch.toLowerCase())
  );

  return (
    <div
      ref={menuRef}
      className={cn(
        'absolute right-4 top-14 z-50 w-72 rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-2xl p-1.5 text-xs font-sans text-popover-foreground transition-all duration-200 animate-in fade-in slide-in-from-top-2'
      )}
    >
      {/* Search Header */}
      <div className="relative mb-1 px-1.5 py-1">
        <div className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-2 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
            placeholder="Add Filter..."
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            autoFocus
          />
          <kbd className="shrink-0 pointer-events-none inline-flex h-4 items-center rounded border border-border bg-muted px-1 text-[10px] font-mono font-medium text-muted-foreground">
            F
          </kbd>
        </div>
      </div>

      {/* Main Filter Action Items */}
      <div className="space-y-0.5 px-1">
        <button
          onClick={() => {
            onActivateAIFilter();
            onClose();
          }}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-accent-violet hover:bg-accent-violet-soft transition-colors"
        >
          <Sparkles className="size-3.5 text-accent-violet shrink-0 animate-pulse" />
          <span>AI filter</span>
        </button>

        <button
          onClick={() => setActiveSubMenu(activeSubMenu === 'advanced' ? null : 'advanced')}
          className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="size-3.5 shrink-0" />
            <span>Advanced filter</span>
          </div>
          <ChevronRight className="size-3 text-muted-foreground/60" />
        </button>
      </div>

      <div className="my-1.5 border-t border-border/50" />

      {/* Filter Categories List */}
      <div className="max-h-64 overflow-y-auto no-scrollbar space-y-0.5 px-1">
        {filteredCategories.map((cat) => {
          const IconComponent = cat.icon;
          const isSubOpen = activeSubMenu === cat.id;

          return (
            <div key={cat.id} className="relative group">
              <button
                onClick={() => {
                  if (cat.onClick) {
                    cat.onClick();
                  } else {
                    setActiveSubMenu(isSubOpen ? null : cat.id);
                  }
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors',
                  (isSubOpen || cat.activeCount > 0) && 'bg-accent/60 font-medium text-foreground'
                )}
              >
                <div className="flex items-center gap-2.5">
                  <IconComponent className="size-3.5 text-muted-foreground/80 shrink-0" />
                  <span>{cat.label}</span>
                </div>

                <div className="flex items-center gap-1">
                  {cat.activeCount > 0 && (
                    <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.2 text-[10px] font-semibold">
                      {cat.activeCount}
                    </span>
                  )}
                  {cat.hasArrow && (
                    <ChevronRight className="size-3 text-muted-foreground/60 transition-transform duration-150" />
                  )}
                </div>
              </button>

              {/* Submenu Dropdown Popover */}
              {isSubOpen && (
                <div className="mt-1 ml-4 rounded-lg border border-border/80 bg-surface/95 p-1.5 shadow-lg space-y-0.5 text-xs animate-in fade-in">
                  {cat.id === 'status' &&
                    lists.map((l) => (
                      <button
                        key={l.id}
                        onClick={() => toggleStatus(l.id)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-accent hover:text-foreground"
                      >
                        <span className="capitalize">{l.title}</span>
                        {filter.status.includes(l.id) && <Check className="size-3 text-primary" />}
                      </button>
                    ))}

                  {cat.id === 'priority' &&
                    (['URGENT', 'HIGH', 'MEDIUM', 'LOW'] as Priority[]).map((p) => (
                      <button
                        key={p}
                        onClick={() => togglePriority(p)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-accent hover:text-foreground"
                      >
                        <span className="capitalize">{p.toLowerCase()}</span>
                        {filter.priorities.includes(p) && <Check className="size-3 text-primary" />}
                      </button>
                    ))}

                  {cat.id === 'labels' &&
                    labels.map((lbl) => (
                      <button
                        key={lbl.id}
                        onClick={() => toggleLabel(lbl.id)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-accent hover:text-foreground"
                      >
                        <div className="flex items-center gap-2">
                          <span className="size-2 rounded-full bg-primary" />
                          <span>{lbl.name}</span>
                        </div>
                        {filter.labelIds.includes(lbl.id) && <Check className="size-3 text-primary" />}
                      </button>
                    ))}

                  {cat.id === 'members' &&
                    members.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => toggleMember(m.id)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-accent hover:text-foreground"
                      >
                        <span>{m.name}</span>
                        {filter.memberIds.includes(m.id) && <Check className="size-3 text-primary" />}
                      </button>
                    ))}

                  {cat.id === 'lead' &&
                    members.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => toggleLead(m.id)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-accent hover:text-foreground"
                      >
                        <span>{m.name}</span>
                        {filter.leadIds.includes(m.id) && <Check className="size-3 text-primary" />}
                      </button>
                    ))}

                  {cat.id === 'health' &&
                    ['ON_TRACK', 'AT_RISK', 'OFF_TRACK'].map((h) => (
                      <button
                        key={h}
                        onClick={() => toggleHealth(h)}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-accent hover:text-foreground"
                      >
                        <span>{h.replace('_', ' ')}</span>
                        {filter.health.includes(h) && <Check className="size-3 text-primary" />}
                      </button>
                    ))}

                  {cat.id === 'dates' && (
                    <React.Fragment>
                      {(['today', 'overdue', 'week', 'none'] as DueFilter[]).map((d) => (
                        <button
                          key={d}
                          onClick={() => setDue(d)}
                          className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-accent hover:text-foreground"
                        >
                          <span className="capitalize">{d === 'none' ? 'No due date' : d}</span>
                          {filter.due === d && <Check className="size-3 text-primary" />}
                        </button>
                      ))}
                    </React.Fragment>
                  )}

                  {cat.id === 'milestones' &&
                    ['Sprint 1', 'Q3 Release', 'v2.0 Launch'].map((ms) => (
                      <button
                        key={ms}
                        onClick={() =>
                          setFilter((prev) => ({
                            ...prev,
                            milestones: prev.milestones.includes(ms)
                              ? prev.milestones.filter((item) => item !== ms)
                              : [...prev.milestones, ms],
                          }))
                        }
                        className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-xs hover:bg-accent hover:text-foreground"
                      >
                        <span>{ms}</span>
                        {filter.milestones.includes(ms) && <Check className="size-3 text-primary" />}
                      </button>
                    ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="my-1.5 border-t border-border/50" />

      {/* Property Filters */}
      <div className="space-y-0.5 px-1">
        {propertyFilters.map((prop) => {
          const IconComponent = prop.icon;
          return (
            <button
              key={prop.id}
              onClick={() => setActiveSubMenu(activeSubMenu === prop.id ? null : prop.id)}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <IconComponent className="size-3.5 text-muted-foreground/80 shrink-0" />
                <span>{prop.label}</span>
              </div>
              <ChevronRight className="size-3 text-muted-foreground/60" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
