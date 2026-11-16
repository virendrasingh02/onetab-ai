import type { WorkItemType } from '@org/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@org/ui';
import {
  AlertOctagon,
  BookOpen,
  Bug,
  Check,
  CheckSquare,
  Inbox,
  LifeBuoy,
  Lightbulb,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import { ValueButton } from './primitives.js';

export const TYPE_OPTIONS: Array<{
  type: WorkItemType;
  label: string;
  icon: LucideIcon;
}> = [
  { type: 'TASK', label: 'Task', icon: CheckSquare },
  { type: 'BUG', label: 'Bug', icon: Bug },
  { type: 'FEATURE', label: 'Feature', icon: Lightbulb },
  { type: 'IMPROVEMENT', label: 'Improvement', icon: TrendingUp },
  { type: 'STORY', label: 'Story', icon: BookOpen },
  { type: 'REQUEST', label: 'Request', icon: Inbox },
  { type: 'SUPPORT', label: 'Support', icon: LifeBuoy },
  { type: 'INCIDENT', label: 'Incident', icon: AlertOctagon },
];

/** The work item's type, as a property-rail value with its own menu. */
export function CardTypePicker({
  type,
  disabled,
  onChange,
}: {
  type: string | undefined;
  disabled: boolean;
  onChange: (type: WorkItemType) => void;
}) {
  const current =
    TYPE_OPTIONS.find((option) => option.type === type) ?? TYPE_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <ValueButton disabled={disabled}>
          <current.icon className="size-4 text-muted-foreground" aria-hidden />
          <span className="truncate">{current.label}</span>
        </ValueButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {TYPE_OPTIONS.map((option) => (
          <DropdownMenuItem
            key={option.type}
            onSelect={() => {
              if (option.type !== current.type) onChange(option.type);
            }}
          >
            <option.icon className="mr-2 size-3.5" aria-hidden />
            <span className="flex-1">{option.label}</span>
            {option.type === current.type ? (
              <Check className="size-3.5" aria-hidden />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
