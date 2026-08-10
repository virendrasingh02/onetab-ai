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

export interface CompanyItem {
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
  companyId: string;
  title: string;
  category: DocCategory;
  updatedAt: string;
  snippet: string;
  content: string;
  pinned?: boolean;
  favorite?: boolean;
  icon?: string;
  iconColor?: string;
  cover?: string;
  status?: DocStatus;
  parentId?: string;
  blocks: NotionBlock[];
  comments: DocComment[];
}

export interface DocsDataStore {
  companies: CompanyItem[];
  docs: DocItem[];
}

export const COVER_PRESETS = [
  { id: 'gradient-blue', name: 'Blue Nebula', style: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)' },
  { id: 'gradient-purple', name: 'Cosmic Violet', style: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' },
  { id: 'gradient-emerald', name: 'Emerald Glow', style: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' },
  { id: 'gradient-amber', name: 'Sunset Amber', style: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 100%)' },
  { id: 'dark-glass', name: 'Dark Glassmorphism', style: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
  { id: 'subtle-cyber', name: 'Cyberpunk Neon', style: 'linear-gradient(135deg, #3b82f6 0%, #d946ef 100%)' },
];

export const EMOJI_PRESETS = ['🏢', '📝', '🚀', '⚡', '🎨', '🛡️', '📊', '💡', '📚', '🧩', '🔬', '⚙️', '🌐'];

const STORAGE_KEY = 'onetab_company_docs_v2';

function createSeedStore(): DocsDataStore {
  const companies: CompanyItem[] = [
    { id: 'company_onetab', name: 'Onetab AI HQ', icon: '🏠' },
  ];

  const docs: DocItem[] = [
    {
      id: 'doc_teamspace',
      companyId: 'company_onetab',
      title: 'Teamspace Home',
      category: 'General',
      updatedAt: 'Just now',
      snippet: 'Main teamspace workspace page and guidelines.',
      content: 'Welcome to the Onetab AI HQ Teamspace Home.',
      pinned: true,
      favorite: true,
      icon: '🧭',
      cover: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
      status: 'Finalized',
      comments: [
        {
          id: 'c1',
          author: 'Onetab AI Team',
          text: 'Welcome to Teamspace Home!',
          createdAt: 'Just now',
        },
      ],
      blocks: [
        {
          id: 'b1',
          type: 'h1',
          content: 'Teamspace Home Overview',
        },
        {
          id: 'b2',
          type: 'callout',
          variant: 'info',
          icon: '💡',
          content: 'This teamspace contains documentation, architecture blueprints, and product roadmap guidelines.',
        },
        {
          id: 'b3',
          type: 'h2',
          content: 'Teamspace Resources',
        },
        {
          id: 'b4',
          type: 'checklist',
          checked: true,
          content: 'Monorepo Architecture & State Flow',
        },
        {
          id: 'b5',
          type: 'checklist',
          checked: true,
          content: 'Design System & HSL Color Tokens',
        },
        {
          id: 'b6',
          type: 'checklist',
          checked: false,
          content: 'Offline local state caching using indexedDB & localStorage',
        },
      ],
    },
    {
      id: 'doc_onetab_arch',
      companyId: 'company_onetab',
      parentId: 'doc_teamspace',
      title: 'System Architecture & RAG Flow',
      category: 'Architecture',
      updatedAt: 'Just now',
      snippet: 'High-level diagram, monorepo modular design, and state management.',
      content: 'This document describes the workspace architecture for Onetab AI.',
      pinned: true,
      favorite: true,
      icon: '🏗️',
      cover: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
      status: 'Finalized',
      comments: [],
      blocks: [
        {
          id: 'b1',
          type: 'h1',
          content: 'Onetab AI System Architecture',
        },
        {
          id: 'b2',
          type: 'callout',
          variant: 'info',
          icon: '💡',
          content: 'All documentation pages are hierarchically structured company-wise with live tree navigation.',
        },
      ],
    },
    {
      id: 'doc_onetab_guide',
      companyId: 'company_onetab',
      parentId: 'doc_teamspace',
      title: 'Design Tokens & UI Language',
      category: 'Design System',
      updatedAt: 'Today',
      snippet: 'Tokens for HSL theme colors, badges, buttons, and layout handles.',
      content: 'Guidelines for component styling using Vanilla CSS design tokens.',
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
          content: 'Onetab AI Visual Language',
        },
        {
          id: 'b102',
          type: 'paragraph',
          content: 'Our design language relies on standard CSS variables with HSL color tuples for theme recalculations.',
        },
      ],
    },
    {
      id: 'doc_onetab_roadmap',
      companyId: 'company_onetab',
      parentId: 'doc_teamspace',
      title: 'Product Roadmap 2026',
      category: 'Engineering',
      updatedAt: 'Yesterday',
      snippet: 'Strategic vision, vector RAG integration, and enterprise features.',
      content: 'Product roadmap milestones.',
      pinned: false,
      favorite: false,
      icon: '⚡',
      cover: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
      status: 'Draft',
      comments: [],
      blocks: [
        {
          id: 'b201',
          type: 'h1',
          content: '2026 Product Strategy',
        },
      ],
    },
  ];

  return { companies, docs };
}

export function useDocsState() {
  const [store, setStore] = useState<DocsDataStore>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && Array.isArray(parsed.companies) && parsed.companies.length > 0 && Array.isArray(parsed.docs)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load saved company docs store:', e);
    }
    return createSeedStore();
  });

  const companies = store.companies;
  const docs = store.docs;

  const [activeDocId, setActiveDocId] = useState<string>(() => docs[0]?.id ?? 'doc_teamspace');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
      window.dispatchEvent(new Event('onetab_docs_updated'));
    } catch (e) {
      console.warn('Failed to persist company docs store:', e);
    }
  }, [store]);

  const activeDoc = docs.find((d) => d.id === activeDocId) ?? docs[0] ?? {
    id: 'empty_doc',
    companyId: companies[0]?.id || 'company_onetab',
    title: 'Untitled Document',
    category: 'General',
    updatedAt: 'Just now',
    snippet: '',
    content: '',
    blocks: [],
    comments: [],
  };

  // Company Operations
  const addCompany = (name?: string, icon?: string) => {
    const companyName = name?.trim() || prompt('Enter company name:')?.trim();
    if (!companyName) return;

    const newCompany: CompanyItem = {
      id: `company_${Date.now()}`,
      name: companyName,
      icon: icon || '🏢',
    };

    setStore((prev) => ({
      ...prev,
      companies: [...prev.companies, newCompany],
    }));

    // Auto create first doc in new company
    createDoc(newCompany.id, `${companyName} Overview`);
    return newCompany.id;
  };

  const renameCompany = (companyId: string, currentName: string) => {
    const newName = prompt('Enter new company name:', currentName)?.trim();
    if (!newName) return;

    setStore((prev) => ({
      ...prev,
      companies: prev.companies.map((c) => (c.id === companyId ? { ...c, name: newName } : c)),
    }));
  };

  const deleteCompany = (companyId: string) => {
    if (companies.length <= 1) {
      alert('Workspace requires at least one company.');
      return;
    }
    if (!confirm('Are you sure you want to delete this company and all its docs?')) return;

    setStore((prev) => {
      const nextCompanies = prev.companies.filter((c) => c.id !== companyId);
      const nextDocs = prev.docs.filter((d) => d.companyId !== companyId);
      if (activeDoc && activeDoc.companyId === companyId) {
        setActiveDocId(nextDocs[0]?.id || '');
      }
      return { companies: nextCompanies, docs: nextDocs };
    });
  };

  // Doc Operations
  const updateDocTitle = (id: string, newTitle: string) => {
    setStore((prev) => ({
      ...prev,
      docs: prev.docs.map((d) => (d.id === id ? { ...d, title: newTitle, updatedAt: 'Just now' } : d)),
    }));
  };

  const updateDocCategory = (id: string, category: DocCategory) => {
    setStore((prev) => ({
      ...prev,
      docs: prev.docs.map((d) => (d.id === id ? { ...d, category, updatedAt: 'Just now' } : d)),
    }));
  };

  const updateDocStatus = (id: string, status: DocStatus) => {
    setStore((prev) => ({
      ...prev,
      docs: prev.docs.map((d) => (d.id === id ? { ...d, status, updatedAt: 'Just now' } : d)),
    }));
  };

  const updateDocCover = (id: string, cover: string) => {
    setStore((prev) => ({
      ...prev,
      docs: prev.docs.map((d) => (d.id === id ? { ...d, cover, updatedAt: 'Just now' } : d)),
    }));
  };

  const updateDocIcon = (id: string, icon: string, iconColor?: string) => {
    setStore((prev) => ({
      ...prev,
      docs: prev.docs.map((d) => (d.id === id ? { ...d, icon, iconColor, updatedAt: 'Just now' } : d)),
    }));
  };

  const toggleFavorite = (id: string) => {
    setStore((prev) => ({
      ...prev,
      docs: prev.docs.map((d) => (d.id === id ? { ...d, favorite: !d.favorite } : d)),
    }));
  };

  const moveDocToCompany = (docId: string, targetCompanyId: string) => {
    setStore((prev) => ({
      ...prev,
      docs: prev.docs.map((d) => (d.id === docId ? { ...d, companyId: targetCompanyId, updatedAt: 'Just now' } : d)),
    }));
  };

  const updateDocBlocks = (id: string, blocks: NotionBlock[]) => {
    setStore((prev) => ({
      ...prev,
      docs: prev.docs.map((d) => {
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
    }));
  };

  const addComment = (id: string, author: string, text: string) => {
    const newComment: DocComment = {
      id: `c_${Date.now()}`,
      author,
      text,
      createdAt: 'Just now',
    };
    setStore((prev) => ({
      ...prev,
      docs: prev.docs.map((d) => (d.id === id ? { ...d, comments: [...(d.comments || []), newComment] } : d)),
    }));
  };

  const createDoc = (companyId?: string, title?: string, category?: DocCategory, template?: string, parentId?: string) => {
    const targetCompanyId = companyId || companies[0]?.id || 'company_onetab';

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
      companyId: targetCompanyId,
      parentId: parentId,
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

    setStore((prev) => ({
      ...prev,
      docs: [newDoc, ...prev.docs],
    }));
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

    setStore((prev) => ({
      ...prev,
      docs: [dupDoc, ...prev.docs],
    }));
    setActiveDocId(dupDoc.id);
  };

  const deleteDoc = (id: string) => {
    if (docs.length <= 1) return;
    setStore((prev) => {
      const nextDocs = prev.docs.filter((d) => d.id !== id);
      if (activeDocId === id) {
        setActiveDocId(nextDocs[0]?.id ?? '');
      }
      return { ...prev, docs: nextDocs };
    });
  };

  return {
    companies,
    docs,
    activeDoc,
    activeDocId,
    setActiveDocId,
    addCompany,
    renameCompany,
    deleteCompany,
    moveDocToCompany,
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
