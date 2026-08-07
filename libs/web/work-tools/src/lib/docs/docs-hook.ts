import { useEffect, useState } from 'react';

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

export interface DocComment {
  id: string;
  author: string;
  avatar?: string;
  text: string;
  createdAt: string;
}

export interface DocItem {
  id: string;
  title: string;
  category: DocCategory;
  updatedAt: string;
  snippet: string;
  content: string;
  pinned?: boolean;
  favorite?: boolean;
  icon?: string;
  cover?: string;
  status?: DocStatus;
  parentId?: string;
  blocks: NotionBlock[];
  comments: DocComment[];
}

export const COVER_PRESETS = [
  { id: 'gradient-blue', name: 'Blue Nebula', style: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)' },
  { id: 'gradient-purple', name: 'Cosmic Violet', style: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' },
  { id: 'gradient-emerald', name: 'Emerald Glow', style: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' },
  { id: 'gradient-amber', name: 'Sunset Amber', style: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' },
  { id: 'dark-glass', name: 'Dark Glassmorphism', style: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
  { id: 'subtle-cyber', name: 'Cyberpunk Neon', style: 'linear-gradient(135deg, #3b82f6 0%, #d946ef 100%)' },
];

export const EMOJI_PRESETS = ['📝', '🚀', '⚡', '🎨', '🛡️', '📊', '💡', '📚', '🧩', '🔬', '⚙️', '🌐'];

const STORAGE_KEY = 'onetab_docs_v3';

function createSeedDocs(): DocItem[] {
  return [
    {
      id: 'doc_arch',
      title: 'Workspace Architecture & State Flow',
      category: 'Architecture',
      updatedAt: 'Just now',
      snippet: 'High-level diagram, monorepo modular design, and state management.',
      content: 'This document describes the workspace architecture, standardizing HSL design tokens, resizable sidebars, and multi-project Kanban board state isolation.',
      pinned: true,
      favorite: true,
      icon: '🏗️',
      cover: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
      status: 'Finalized',
      comments: [
        {
          id: 'c1',
          author: 'Alex Morgan',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
          text: 'Verified HSL token sync across apps. Clean architecture layout!',
          createdAt: '10 mins ago',
        },
      ],
      blocks: [
        {
          id: 'b1',
          type: 'h1',
          content: 'Workspace Architecture Overview',
        },
        {
          id: 'b2',
          type: 'callout',
          variant: 'info',
          icon: '💡',
          content: 'All frontend packages follow strict boundary decoupling. Design tokens are injected at global HTML level.',
        },
        {
          id: 'b3',
          type: 'h2',
          content: 'Core Modules & Responsibilities',
        },
        {
          id: 'b4',
          type: 'paragraph',
          content: 'The application uses Nx monorepo packages for high isolation and fast independent builds. State flows seamlessly across workspace routes.',
        },
        {
          id: 'b5',
          type: 'checklist',
          checked: true,
          content: 'Decoupled UI components in @org/ui package',
        },
        {
          id: 'b6',
          type: 'checklist',
          checked: true,
          content: 'Strict TypeScript interfaces for state persistence',
        },
        {
          id: 'b7',
          type: 'checklist',
          checked: false,
          content: 'Offline local state caching using indexedDB & localStorage',
        },
        {
          id: 'b8',
          type: 'h2',
          content: 'System Configuration',
        },
        {
          id: 'b9',
          type: 'code',
          language: 'typescript',
          content: `export interface AppConfig {\n  workspaceId: string;\n  theme: 'dark' | 'light' | 'system';\n  syncFrequencyMs: number;\n}`,
        },
        {
          id: 'b10',
          type: 'toggle',
          isOpen: false,
          content: 'Advanced Routing Protocols & Guards',
        },
        {
          id: 'b11',
          type: 'table',
          content: 'Module Matrix',
          headers: ['Module', 'Package', 'Status', 'Owner'],
          rows: [
            ['@org/web-work-tools', 'Work Tools Suite', 'Active', 'Frontend Team'],
            ['@org/ui', 'Shared UI Components', 'Stable', 'Design System Team'],
            ['@org/api-workspace', 'Workspace Backend', 'Production', 'Backend Team'],
          ],
        },
      ],
    },
    {
      id: 'doc_design',
      title: 'Design System Tokens & Glassmorphism Guidelines',
      category: 'Design System',
      updatedAt: 'Today',
      snippet: 'Tokens for HSL theme colors, badges, buttons, and layout handles.',
      content: 'Guidelines for component styling using Vanilla CSS design tokens, smooth micro-animations, accessible ARIA roles, and high-fidelity views.',
      pinned: true,
      favorite: true,
      icon: '🎨',
      cover: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)',
      status: 'In Review',
      comments: [],
      blocks: [
        {
          id: 'b101',
          type: 'h1',
          content: 'Design Tokens & UI Visual Language',
        },
        {
          id: 'b102',
          type: 'paragraph',
          content: 'Our visual design language relies on standard CSS variables with HSL color tuples for rapid theme dynamic recalculations.',
        },
        {
          id: 'b103',
          type: 'callout',
          variant: 'tip',
          icon: '✨',
          content: 'Always prefer theme tokens like bg-surface, bg-surface-raised, and text-foreground over fixed hex values.',
        },
        {
          id: 'b104',
          type: 'h2',
          content: 'Color Palette Tokens',
        },
        {
          id: 'b105',
          type: 'code',
          language: 'css',
          content: `:root {\n  --surface: 220 14% 10%;\n  --surface-raised: 220 14% 14%;\n  --accent-blue: 217 91% 60%;\n  --foreground: 210 20% 98%;\n}`,
        },
        {
          id: 'b106',
          type: 'checklist',
          checked: true,
          content: 'Accessible contrast ratios (WCAG AAA)',
        },
        {
          id: 'b107',
          type: 'checklist',
          checked: true,
          content: 'Smooth 150ms micro-interactions on buttons',
        },
        {
          id: 'b108',
          type: 'quote',
          content: 'Good design is as little design as possible. — Dieter Rams',
        },
      ],
    },
    {
      id: 'doc_ollama',
      title: 'Ollama Vector RAG Local Setup Guide',
      category: 'Engineering',
      updatedAt: 'Yesterday',
      snippet: 'Configuring Qdrant vector database collection embeddings.',
      content: 'Steps to configure nomic-embed-text with local Ollama model runner for off-line AI vector search and document index querying.',
      pinned: false,
      favorite: false,
      icon: '🤖',
      cover: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
      status: 'Draft',
      comments: [],
      blocks: [
        {
          id: 'b201',
          type: 'h1',
          content: 'Local AI RAG Setup Guide',
        },
        {
          id: 'b202',
          type: 'paragraph',
          content: 'Run embed models directly on your hardware without external API reliance.',
        },
        {
          id: 'b203',
          type: 'code',
          language: 'bash',
          content: 'ollama pull nomic-embed-text\nollama run mistral',
        },
        {
          id: 'b204',
          type: 'callout',
          variant: 'warning',
          icon: '⚡',
          content: 'Ensure at least 8GB of free VRAM for optimal inference latency.',
        },
      ],
    },
    {
      id: 'doc_security',
      title: 'API Security & Workspace Role Matrix',
      category: 'Security',
      updatedAt: '3 days ago',
      snippet: 'Granular permissions, OAuth2 JWT tokens, and role scopes.',
      content: 'Detailed permission matrix for workspace Admin, Developer, and Guest roles with fine-grained access control.',
      pinned: false,
      favorite: false,
      icon: '🛡️',
      cover: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)',
      status: 'Finalized',
      comments: [],
      blocks: [
        {
          id: 'b301',
          type: 'h1',
          content: 'Security & Scope Matrix',
        },
        {
          id: 'b302',
          type: 'table',
          content: 'Roles & Scopes Table',
          headers: ['Role', 'Read Scopes', 'Write Scopes', 'Admin Scope'],
          rows: [
            ['Admin', 'All Workspace Resources', 'Full Workspace', 'Granted'],
            ['Developer', 'Repo & Docs', 'Docs & Code', 'Denied'],
            ['Guest', 'Shared Docs', 'None', 'Denied'],
          ],
        },
      ],
    },
  ];
}

export function useDocsState() {
  const [docs, setDocs] = useState<DocItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load saved docs:', e);
    }
    return createSeedDocs();
  });

  const [activeDocId, setActiveDocId] = useState<string>(() => docs[0]?.id ?? 'doc_arch');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    } catch (e) {
      console.warn('Failed to persist docs:', e);
    }
  }, [docs]);

  const activeDoc = docs.find((d) => d.id === activeDocId) ?? docs[0];

  const updateDocTitle = (id: string, newTitle: string) => {
    setDocs((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, title: newTitle, updatedAt: 'Just now' } : d,
      ),
    );
  };

  const updateDocCategory = (id: string, category: DocCategory) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, category, updatedAt: 'Just now' } : d)),
    );
  };

  const updateDocStatus = (id: string, status: DocStatus) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status, updatedAt: 'Just now' } : d)),
    );
  };

  const updateDocCover = (id: string, cover: string) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, cover, updatedAt: 'Just now' } : d)),
    );
  };

  const updateDocIcon = (id: string, icon: string) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, icon, updatedAt: 'Just now' } : d)),
    );
  };

  const toggleFavorite = (id: string) => {
    setDocs((prev) =>
      prev.map((d) => (d.id === id ? { ...d, favorite: !d.favorite } : d)),
    );
  };

  const updateDocBlocks = (id: string, blocks: NotionBlock[]) => {
    setDocs((prev) =>
      prev.map((d) => {
        if (d.id === id) {
          const textSnippet = blocks
            .map((b) => b.content)
            .filter(Boolean)
            .join(' ')
            .slice(0, 90);
          return {
            ...d,
            blocks,
            snippet: textSnippet ? `${textSnippet}...` : d.snippet,
            updatedAt: 'Just now',
          };
        }
        return d;
      }),
    );
  };

  const addComment = (id: string, author: string, text: string) => {
    const newComment: DocComment = {
      id: `c_${Date.now()}`,
      author,
      text,
      createdAt: 'Just now',
    };
    setDocs((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, comments: [...(d.comments || []), newComment] } : d,
      ),
    );
  };

  const createDoc = (title?: string, category?: DocCategory, template?: string) => {
    let initialBlocks: NotionBlock[] = [
      {
        id: `b_${Date.now()}_1`,
        type: 'h1',
        content: title || 'Untitled Document',
      },
      {
        id: `b_${Date.now()}_2`,
        type: 'paragraph',
        content: 'Press / to insert blocks (Headings, Checklists, Callouts, Code, Tables, AI Copilot)...',
      },
    ];

    let icon = '📝';
    let cover = 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)';

    if (template === 'prd') {
      icon = '🚀';
      cover = 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)';
      initialBlocks = [
        { id: 't1', type: 'h1', content: 'Product Requirements Document (PRD)' },
        { id: 't2', type: 'callout', variant: 'info', icon: '🎯', content: 'Define problem, target user persona, scope, and key deliverables.' },
        { id: 't3', type: 'h2', content: 'User Stories & Goals' },
        { id: 't4', type: 'checklist', checked: true, content: 'User can create Notion-like document blocks' },
        { id: 't5', type: 'checklist', checked: false, content: 'User can export document to Markdown and HTML' },
        { id: 't6', type: 'h2', content: 'Technical Architecture & Table' },
        {
          id: 't7',
          type: 'table',
          content: 'PRD Feature Table',
          headers: ['Feature', 'Priority', 'Owner'],
          rows: [
            ['Slash Commands', 'P0', 'Frontend Team'],
            ['Block Drag & Drop', 'P1', 'Design Team'],
            ['AI Summary Copilot', 'P0', 'AI Infra Team'],
          ],
        },
      ];
    } else if (template === 'meeting') {
      icon = '📊';
      cover = 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)';
      initialBlocks = [
        { id: 'm1', type: 'h1', content: 'Sprint Sync & Planning Notes' },
        { id: 'm2', type: 'paragraph', content: 'Date: ' + new Date().toLocaleDateString() + ' | Attendees: Team Sync' },
        { id: 'm3', type: 'h2', content: 'Agenda Items' },
        { id: 'm4', type: 'bullet_list', content: 'Review recent release deployments' },
        { id: 'm5', type: 'bullet_list', content: 'Address blockers in work-tools package' },
        { id: 'm6', type: 'h2', content: 'Action Items' },
        { id: 'm7', type: 'checklist', checked: false, content: 'Update design system documentation' },
        { id: 'm8', type: 'checklist', checked: false, content: 'Run test suite on monorepo targets' },
      ];
    }

    const newDoc: DocItem = {
      id: `doc_${Date.now()}`,
      title: title || (template === 'prd' ? 'Product Requirements Document' : template === 'meeting' ? 'Sprint Sync Notes' : 'Untitled Document'),
      category: category || 'General',
      updatedAt: 'Just now',
      snippet: 'Start writing your Notion-like document notes...',
      content: '',
      pinned: false,
      favorite: false,
      icon,
      cover,
      status: 'Draft',
      blocks: initialBlocks,
      comments: [],
    };

    setDocs((prev) => [newDoc, ...prev]);
    setActiveDocId(newDoc.id);
    return newDoc.id;
  };

  const duplicateDoc = (id: string) => {
    const source = docs.find((d) => d.id === id);
    if (!source) return;

    const dupDoc: DocItem = {
      ...source,
      id: `doc_${Date.now()}`,
      title: `${source.title} (Copy)`,
      updatedAt: 'Just now',
      blocks: source.blocks.map((b) => ({ ...b, id: `b_${Math.random().toString(36).substring(2, 9)}` })),
    };

    setDocs((prev) => [dupDoc, ...prev]);
    setActiveDocId(dupDoc.id);
  };

  const deleteDoc = (id: string) => {
    if (docs.length <= 1) return;
    setDocs((prev) => {
      const filtered = prev.filter((d) => d.id !== id);
      if (activeDocId === id) {
        setActiveDocId(filtered[0]?.id ?? '');
      }
      return filtered;
    });
  };

  return {
    docs,
    activeDoc,
    activeDocId,
    setActiveDocId,
    updateDocTitle,
    updateDocCategory,
    updateDocStatus,
    updateDocCover,
    updateDocIcon,
    toggleFavorite,
    updateDocBlocks,
    addComment,
    createDoc,
    duplicateDoc,
    deleteDoc,
  };
}
