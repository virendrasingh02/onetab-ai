import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  menuListClasses,
  menuSearchClasses,
  menuSearchInputClasses,
  UserAvatar,
} from '@org/ui';
import {
  Calendar,
  CircleDot,
  Diamond,
  Signal,
  Sparkles,
  Users,
} from 'lucide-react';
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { PriorityIcon, StatusIcon } from './kanban-icons.js';
import { useWorkflowStates } from './task-states.js';
import type { BoardFilter, DueFilter } from './card-meta.js';
import type { BoardMember, Priority } from './types.js';

export interface LinearFilterMenuProps {
  filter: BoardFilter;
  setFilter: Dispatch<SetStateAction<BoardFilter>>;
  members: BoardMember[];
  /** Milestone titles on the open project. */
  milestones: string[];
  isOpen: boolean;
  onClose: () => void;
  /** Opens/closes the menu from its trigger. Defaults to closing only. */
  onOpenChange?: (open: boolean) => void;
  /** The button the menu drops from. Without one it anchors top-right. */
  trigger?: ReactNode;
  onActivateAIFilter: () => void;
}

interface FilterOption {
  key: string;
  label: string;
  icon: ReactNode;
  checked: boolean;
  toggle: () => void;
}

interface FilterCategory {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  activeCount: number;
  options: FilterOption[];
  empty: string;
}

const PRIORITIES: Priority[] = ['URGENT', 'HIGH', 'MEDIUM', 'LOW'];
const DUE_OPTIONS: Array<{ value: DueFilter; label: string }> = [
  { value: 'today', label: 'Due today' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'week', label: 'Due this week' },
  { value: 'none', label: 'No due date' },
];

function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

/** Board filter menu, built on the shared dropdown so it matches every menu. */
export function LinearFilterMenu({
  filter,
  setFilter,
  members,
  milestones,
  isOpen,
  onClose,
  onOpenChange,
  trigger,
  onActivateAIFilter,
}: LinearFilterMenuProps) {
  const { states } = useWorkflowStates();
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const smartPickedRef = useRef(false);

  // Radix focuses the menu surface on open; hand focus to the search box.
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [isOpen]);

  /*
   * Only facets the tasks API stores. A filter the server cannot honour would
   * hide cards on a rule nothing else in the product knows about.
   */
  const categories: FilterCategory[] = [
    {
      id: 'status',
      label: 'Status',
      icon: CircleDot,
      activeCount: filter.status.length,
      empty: 'No statuses',
      options: states.map(({ id, name }) => ({
        key: id,
        label: name,
        icon: <StatusIcon status={id} showTooltip={false} />,
        checked: filter.status.includes(id),
        toggle: () =>
          setFilter((prev) => ({ ...prev, status: toggleIn(prev.status, id) })),
      })),
    },
    {
      id: 'priority',
      label: 'Priority',
      icon: Signal,
      activeCount: filter.priorities.length,
      empty: 'No priorities',
      options: PRIORITIES.map((p) => ({
        key: p,
        label: p.charAt(0) + p.slice(1).toLowerCase(),
        icon: <PriorityIcon priority={p} />,
        checked: filter.priorities.includes(p),
        toggle: () =>
          setFilter((prev) => ({
            ...prev,
            priorities: toggleIn(prev.priorities, p),
          })),
      })),
    },
    {
      id: 'assignee',
      label: 'Assignee',
      icon: Users,
      activeCount: filter.memberIds.length,
      empty: 'No workspace members',
      options: members.map((m) => ({
        key: m.id,
        label: m.displayName || m.name,
        icon: (
          <UserAvatar
            name={m.displayName || m.name}
            seed={m.id}
            src={m.avatarUrl}
            size="xs"
          />
        ),
        checked: filter.memberIds.includes(m.id),
        toggle: () =>
          setFilter((prev) => ({
            ...prev,
            memberIds: toggleIn(prev.memberIds, m.id),
          })),
      })),
    },
    {
      id: 'dates',
      label: 'Due date',
      icon: Calendar,
      activeCount: filter.due !== 'any' ? 1 : 0,
      empty: '',
      options: DUE_OPTIONS.map(({ value, label }) => ({
        key: value,
        label,
        icon: null,
        checked: filter.due === value,
        toggle: () =>
          setFilter((prev) => ({
            ...prev,
            due: prev.due === value ? 'any' : value,
          })),
      })),
    },
    {
      id: 'milestones',
      label: 'Milestone',
      icon: Diamond,
      activeCount: filter.milestones.length,
      empty: 'This project has no milestones',
      options: milestones.map((title) => ({
        key: title,
        label: title,
        icon: null,
        checked: filter.milestones.includes(title),
        toggle: () =>
          setFilter((prev) => ({
            ...prev,
            milestones: toggleIn(prev.milestones, title),
          })),
      })),
    },
  ];

  const needle = query.trim().toLowerCase();
  // Searching flattens the menu: matching values from every facet, grouped.
  const matches = needle
    ? categories
        .map((cat) => ({
          ...cat,
          options: cat.label.toLowerCase().includes(needle)
            ? cat.options
            : cat.options.filter((o) => o.label.toLowerCase().includes(needle)),
        }))
        .filter((cat) => cat.options.length > 0)
    : [];

  const renderOption = (option: FilterOption) => (
    <DropdownMenuCheckboxItem
      key={option.key}
      checked={option.checked}
      // Keep the menu open so several values can be picked in one go.
      onSelect={(event) => event.preventDefault()}
      onCheckedChange={option.toggle}
    >
      {option.icon}
      <span className="truncate">{option.label}</span>
    </DropdownMenuCheckboxItem>
  );

  return (
    <DropdownMenu
      open={isOpen}
      onOpenChange={(open) => (onOpenChange ? onOpenChange(open) : !open && onClose())}
    >
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <span aria-hidden className="right-4 top-12 pointer-events-none absolute" />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64"
        // Smart filter opens its own input; don't pull focus back to the trigger.
        onCloseAutoFocus={(event) => {
          if (smartPickedRef.current) {
            smartPickedRef.current = false;
            event.preventDefault();
          }
        }}
      >
        <div className={menuSearchClasses}>
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            // Typing belongs to the input, not the menu's typeahead.
            onKeyDown={(e) => {
              if (e.key !== 'Escape' && e.key !== 'ArrowDown') {
                e.stopPropagation();
              }
            }}
            placeholder="Filter by…"
            aria-label="Search filters"
            className={menuSearchInputClasses}
          />
        </div>

        {needle ? (
          matches.length === 0 ? (
            <p className="px-2.5 py-1.5 text-body-sm text-muted-foreground">
              No matching filters
            </p>
          ) : (
            <div className={menuListClasses}>
              {matches.map((cat, index) => (
                <Fragment key={cat.id}>
                  {index > 0 ? <DropdownMenuSeparator /> : null}
                  <DropdownMenuLabel>{cat.label}</DropdownMenuLabel>
                  {cat.options.map(renderOption)}
                </Fragment>
              ))}
            </div>
          )
        ) : (
          <>
            <DropdownMenuItem
              onSelect={() => {
                smartPickedRef.current = true;
                onActivateAIFilter();
              }}
            >
              <Sparkles className="text-accent-violet" />
              Smart filter
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {categories.map((cat) => {
              const Icon = cat.icon;
              return (
                <DropdownMenuSub key={cat.id}>
                  <DropdownMenuSubTrigger>
                    <Icon />
                    <span className="flex-1">{cat.label}</span>
                    {cat.activeCount > 0 ? (
                      <span className="px-1.5 min-w-5 rounded-full bg-brand/20 text-center text-xs font-medium text-brand-text tabular-nums">
                        {cat.activeCount}
                      </span>
                    ) : null}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-56">
                    {cat.options.length === 0 ? (
                      <p className="px-2.5 py-1.5 text-body-sm text-muted-foreground">
                        {cat.empty}
                      </p>
                    ) : (
                      <div className={menuListClasses}>
                        {cat.options.map(renderOption)}
                      </div>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              );
            })}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
