import type { CardComponentNode, CardComponentType } from '@org/types';
import { Badge } from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertCircle,
  AlertTriangle,
  AlignLeft,
  Calendar,
  CheckSquare,
  ChevronDown,
  Clock,
  Code,
  CreditCard,
  ExternalLink,
  FileCode,
  FileSpreadsheet,
  FileText,
  FormInput,
  Grid,
  Heading,
  Image,
  Layers,
  Layout,
  List,
  Mail,
  Maximize2,
  Minus,
  MousePointer,
  Package,
  Plus,
  Radio,
  Sliders,
  Sparkles,
  Square,
  Table,
  Tag,
  Type,
  User,
} from 'lucide-react';
import React, { useState } from 'react';

export interface PaletteItem {
  type: CardComponentType;
  label: string;
  category: 'layout' | 'typography' | 'media' | 'elements' | 'data' | 'forms' | 'feedback';
  icon: React.ElementType;
  description: string;
  createDefaultNode: () => CardComponentNode;
}

export const COMPONENT_CATALOG: PaletteItem[] = [
  // Layout
  {
    type: 'container',
    label: 'Container',
    category: 'layout',
    icon: Square,
    description: 'Card section with padding, background, and borders',
    createDefaultNode: () => ({
      id: `container-${Math.random().toString(36).slice(2, 6)}`,
      type: 'container',
      style: { padding: '12px', borderRadius: '12px', background: 'surface', border: '1px solid border' },
      children: [],
    }),
  },
  {
    type: 'row',
    label: 'Row',
    category: 'layout',
    icon: Layout,
    description: 'Horizontal flex container',
    createDefaultNode: () => ({
      id: `row-${Math.random().toString(36).slice(2, 6)}`,
      type: 'row',
      style: { justifyContent: 'between', alignItems: 'center', gap: '8px' },
      children: [],
    }),
  },
  {
    type: 'column',
    label: 'Column / Stack',
    category: 'layout',
    icon: Layers,
    description: 'Vertical stack container',
    createDefaultNode: () => ({
      id: `column-${Math.random().toString(36).slice(2, 6)}`,
      type: 'column',
      style: { gap: '8px' },
      children: [],
    }),
  },
  {
    type: 'grid',
    label: 'Grid',
    category: 'layout',
    icon: Grid,
    description: 'Multi-column responsive grid',
    createDefaultNode: () => ({
      id: `grid-${Math.random().toString(36).slice(2, 6)}`,
      type: 'grid',
      props: { columns: 2 },
      style: { gap: '8px' },
      children: [],
    }),
  },
  {
    type: 'divider',
    label: 'Divider',
    category: 'layout',
    icon: Minus,
    description: 'Horizontal separator line',
    createDefaultNode: () => ({
      id: `divider-${Math.random().toString(36).slice(2, 6)}`,
      type: 'divider',
    }),
  },

  // Typography
  {
    type: 'heading',
    label: 'Heading',
    category: 'typography',
    icon: Heading,
    description: 'Title text (H1, H2, H3)',
    createDefaultNode: () => ({
      id: `heading-${Math.random().toString(36).slice(2, 6)}`,
      type: 'heading',
      props: { text: 'Heading Title', level: 3 },
    }),
  },
  {
    type: 'text',
    label: 'Text / Paragraph',
    category: 'typography',
    icon: Type,
    description: 'Body text with dynamic binding support',
    createDefaultNode: () => ({
      id: `text-${Math.random().toString(36).slice(2, 6)}`,
      type: 'text',
      props: { text: 'Paragraph text or {{field}}', size: 'sm' },
    }),
  },
  {
    type: 'markdown',
    label: 'Markdown',
    category: 'typography',
    icon: AlignLeft,
    description: 'Rich Markdown renderer',
    createDefaultNode: () => ({
      id: `markdown-${Math.random().toString(36).slice(2, 6)}`,
      type: 'markdown',
      props: { content: '**Bold text** and `code` snippets' },
    }),
  },

  // Media
  {
    type: 'avatar',
    label: 'Avatar',
    category: 'media',
    icon: User,
    description: 'User avatar with fallback initials',
    createDefaultNode: () => ({
      id: `avatar-${Math.random().toString(36).slice(2, 6)}`,
      type: 'avatar',
      props: { name: '{{name}}', size: 'md' },
    }),
  },
  {
    type: 'image',
    label: 'Image',
    category: 'media',
    icon: Image,
    description: 'Image with aspect ratio and fallback',
    createDefaultNode: () => ({
      id: `image-${Math.random().toString(36).slice(2, 6)}`,
      type: 'image',
      props: { src: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=60', alt: 'Image' },
    }),
  },

  // Elements
  {
    type: 'badge',
    label: 'Badge',
    category: 'elements',
    icon: Tag,
    description: 'Status or category pill',
    createDefaultNode: () => ({
      id: `badge-${Math.random().toString(36).slice(2, 6)}`,
      type: 'badge',
      props: { text: '{{status}}', variant: 'primary' },
    }),
  },
  {
    type: 'button',
    label: 'Button',
    category: 'elements',
    icon: MousePointer,
    description: 'Interactive button triggering structured actions',
    createDefaultNode: () => ({
      id: `btn-${Math.random().toString(36).slice(2, 6)}`,
      type: 'button',
      props: { label: 'Click Action', variant: 'primary', icon: 'Sparkles' },
    }),
  },
  {
    type: 'button_group',
    label: 'Button Group',
    category: 'elements',
    icon: Layout,
    description: 'Horizontal row of action buttons',
    createDefaultNode: () => ({
      id: `btngroup-${Math.random().toString(36).slice(2, 6)}`,
      type: 'button_group',
      style: { justifyContent: 'end', gap: '8px' },
      children: [
        {
          id: `btn-1-${Math.random().toString(36).slice(2, 6)}`,
          type: 'button',
          props: { label: 'Cancel', variant: 'outline' },
        },
        {
          id: `btn-2-${Math.random().toString(36).slice(2, 6)}`,
          type: 'button',
          props: { label: 'Confirm', variant: 'primary' },
        },
      ],
    }),
  },

  // Data
  {
    type: 'key_value',
    label: 'Key / Value',
    category: 'data',
    icon: CreditCard,
    description: 'Labeled data metric box',
    createDefaultNode: () => ({
      id: `kv-${Math.random().toString(36).slice(2, 6)}`,
      type: 'key_value',
      props: { label: 'Metric', value: '{{value}}' },
    }),
  },
  {
    type: 'progress',
    label: 'Progress Bar',
    category: 'data',
    icon: Sliders,
    description: 'Progress bar with percentage label',
    createDefaultNode: () => ({
      id: `progress-${Math.random().toString(36).slice(2, 6)}`,
      type: 'progress',
      props: { label: 'Progress', value: '75', max: 100 },
    }),
  },

  // Forms
  {
    type: 'input',
    label: 'Text Input',
    category: 'forms',
    icon: FormInput,
    description: 'Single-line text input field',
    createDefaultNode: () => ({
      id: `input-${Math.random().toString(36).slice(2, 6)}`,
      type: 'input',
      props: { label: 'Field Label', name: 'fieldName', placeholder: 'Enter value…' },
    }),
  },
  {
    type: 'checkbox',
    label: 'Checkbox',
    category: 'forms',
    icon: CheckSquare,
    description: 'Boolean checkbox toggle',
    createDefaultNode: () => ({
      id: `chk-${Math.random().toString(36).slice(2, 6)}`,
      type: 'checkbox',
      props: { label: 'I agree to terms', name: 'agree' },
    }),
  },

  // Feedback
  {
    type: 'alert',
    label: 'Alert Banner',
    category: 'feedback',
    icon: AlertTriangle,
    description: 'Callout notification banner',
    createDefaultNode: () => ({
      id: `alert-${Math.random().toString(36).slice(2, 6)}`,
      type: 'alert',
      props: { title: 'Attention Required', description: 'Important message details here.', variant: 'default' },
    }),
  },
];

export interface ComponentPaletteProps {
  onAddComponent: (node: CardComponentNode) => void;
}

export function ComponentPalette({ onAddComponent }: ComponentPaletteProps) {
  const [activeCategory, setActiveCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All' },
    { id: 'layout', label: 'Layout' },
    { id: 'typography', label: 'Text' },
    { id: 'elements', label: 'Elements' },
    { id: 'data', label: 'Data' },
    { id: 'forms', label: 'Forms' },
    { id: 'feedback', label: 'Feedback' },
  ];

  const filteredItems = COMPONENT_CATALOG.filter(
    (item) => activeCategory === 'all' || item.category === activeCategory,
  );

  return (
    <div className="flex flex-col h-full bg-surface border-r border-border/60">
      {/* Header */}
      <div className="p-3 border-b border-border/60">
        <span className="text-xs font-bold text-foreground block">Component Palette</span>
        <span className="text-[10px] text-muted-foreground">Click to add to selected container</span>
      </div>

      {/* Category Pills */}
      <div className="p-2 border-b border-border/60 flex items-center gap-1 overflow-x-auto">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id)}
            className={cn(
              'px-2 py-0.5 rounded text-[11px] font-semibold transition-colors shrink-0',
              activeCategory === c.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Components List */}
      <div className="p-2 overflow-y-auto space-y-1.5 flex-1">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.type}
              type="button"
              onClick={() => onAddComponent(item.createDefaultNode())}
              className="w-full p-2 rounded-xl border border-border/60 bg-surface-raised hover:bg-accent/80 hover:border-primary/50 text-left transition-all group flex items-start gap-2.5 cursor-pointer shadow-2xs"
            >
              <div className="size-7 rounded-lg bg-surface border border-border/60 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                <Icon className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground block">{item.label}</span>
                  <Plus className="size-3 text-muted-foreground group-hover:text-primary transition-colors opacity-0 group-hover:opacity-100" />
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight truncate">
                  {item.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
