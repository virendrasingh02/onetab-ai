import type { SearchCategory } from '@org/types';
import {
  Bot,
  CalendarClock,
  CheckSquare,
  FileText,
  FolderKanban,
  Hash,
  LayoutDashboard,
  Paperclip,
  PhoneCall,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Every searchable kind of thing, in display order, with its label and icon —
 * shared by the command palette and the full search page so they never
 * disagree about what can be found.
 */
export const SEARCH_CATEGORY_META: Record<
  SearchCategory,
  { label: string; icon: ComponentType<{ className?: string }> }
> = {
  channels: { label: 'Channels', icon: Hash },
  people: { label: 'People', icon: Users },
  docs: { label: 'Documents', icon: FileText },
  tasks: { label: 'Tasks', icon: CheckSquare },
  projects: { label: 'Projects', icon: FolderKanban },
  files: { label: 'Files', icon: Paperclip },
  meetings: { label: 'Meetings', icon: CalendarClock },
  calls: { label: 'Calls', icon: PhoneCall },
  coworkers: { label: 'AI coworkers', icon: Sparkles },
  agents: { label: 'AI agents', icon: Bot },
  workflows: { label: 'Workflows & agents', icon: Workflow },
  canvases: { label: 'Canvases', icon: LayoutDashboard },
};

export const SEARCH_CATEGORIES = Object.keys(SEARCH_CATEGORY_META) as SearchCategory[];
