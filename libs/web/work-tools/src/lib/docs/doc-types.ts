/**
 * The docs screen's view model.
 *
 * A `DocItem` is one `WorkDocument` read through {@link ../doc-content.js}: the
 * server fields (`title`, `parentId`, timestamps) plus everything the editor
 * needs that lives inside `content` — the blocks, and the presentation metadata
 * the schema has no column for.
 *
 * A `CompanyItem` is a *root* document (`parentId === null`). Teamspaces are
 * pages in Notion too, so the tree the sidebar draws is exactly the tree the
 * `parentId` chain describes.
 */

export type DocCategory =
  | 'Architecture'
  | 'Design System'
  | 'Engineering'
  | 'General'
  | 'Security';

export type DocStatus = 'Draft' | 'In Review' | 'Finalized' | 'Archived';

export type BlockType =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'paragraph'
  | 'bullet_list'
  | 'numbered_list'
  | 'checklist'
  | 'toggle'
  | 'callout'
  | 'code'
  | 'quote'
  | 'divider'
  | 'table'
  | 'ai_prompt';

export interface NotionBlock {
  id: string;
  type: BlockType;
  content: string;
  checked?: boolean;
  isOpen?: boolean;
  variant?: 'info' | 'tip' | 'warning' | 'quote';
  icon?: string;
  language?: string;
  headers?: string[];
  rows?: string[][];
  aiPrompt?: string;
}

export interface CompanyItem {
  /** The root document's id. */
  id: string;
  name: string;
  icon?: string;
}

export interface DocComment {
  id: string;
  author: string;
  avatar?: string;
  text: string;
  createdAt: string;
}

export interface DocItem {
  id: string;
  /** The id of the root document this one descends from. */
  companyId: string;
  title: string;
  category: DocCategory;
  /** Preformatted for display, e.g. "2 hours ago". */
  updatedAt: string;
  snippet: string;
  pinned?: boolean;
  favorite?: boolean;
  icon?: string;
  iconColor?: string;
  cover?: string;
  status?: DocStatus;
  /** Set only when the parent is another doc, not the company itself. */
  parentId?: string;
  blocks: NotionBlock[];
  comments: DocComment[];
}

export const DOC_CATEGORIES: readonly DocCategory[] = [
  'Architecture',
  'Design System',
  'Engineering',
  'General',
  'Security',
];

export const DOC_STATUSES: readonly DocStatus[] = [
  'Draft',
  'In Review',
  'Finalized',
  'Archived',
];

export const COVER_PRESETS = [
  { id: 'gradient-blue', name: 'Blue Nebula', style: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)' },
  { id: 'gradient-purple', name: 'Cosmic Violet', style: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' },
  { id: 'gradient-emerald', name: 'Emerald Glow', style: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' },
  { id: 'gradient-amber', name: 'Sunset Amber', style: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' },
  { id: 'dark-glass', name: 'Dark Glassmorphism', style: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
  { id: 'subtle-cyber', name: 'Cyberpunk Neon', style: 'linear-gradient(135deg, #3b82f6 0%, #d946ef 100%)' },
];

export const EMOJI_PRESETS = ['🏢', '📝', '🚀', '⚡', '🎨', '🛡️', '📊', '💡', '📚', '🧩', '🔬', '⚙️', '🌐'];

export const DEFAULT_COVER = COVER_PRESETS[0].style;
