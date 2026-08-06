import { useEffect, useState } from 'react';

export type DocCategory =
  | 'Architecture'
  | 'Design System'
  | 'Engineering'
  | 'General'
  | 'Security';

export interface DocItem {
  id: string;
  title: string;
  category: DocCategory;
  updatedAt: string;
  snippet: string;
  content: string;
  pinned?: boolean;
}

const STORAGE_KEY = 'onetab_docs_v2';

function createSeedDocs(): DocItem[] {
  return [
    {
      id: 'doc_arch',
      title: 'Workspace Architecture & State Flow',
      category: 'Architecture',
      updatedAt: 'Just now',
      snippet: 'High-level diagram and monorepo modular design boundaries.',
      content: 'This document describes the workspace architecture, standardizing HSL design tokens, resizable sidebars, and multi-project Kanban board state isolation.',
      pinned: true,
    },
    {
      id: 'doc_design',
      title: 'Design System Tokens & Glassmorphism Guidelines',
      category: 'Design System',
      updatedAt: 'Today',
      snippet: 'Tokens for HSL theme colors, badges, buttons, and layout handles.',
      content: 'Guidelines for component styling using Vanilla CSS design tokens, smooth micro-animations, accessible ARIA roles, and high-fidelity views.',
      pinned: true,
    },
    {
      id: 'doc_ollama',
      title: 'Ollama Vector RAG Local Setup Guide',
      category: 'Engineering',
      updatedAt: 'Yesterday',
      snippet: 'Configuring Qdrant vector database collection embeddings.',
      content: 'Steps to configure nomic-embed-text with local Ollama model runner for off-line AI vector search and document index querying.',
      pinned: false,
    },
    {
      id: 'doc_security',
      title: 'API Security & Workspace Role Matrix',
      category: 'Security',
      updatedAt: '3 days ago',
      snippet: 'Granular permissions, OAuth2 JWT tokens, and role scopes.',
      content: 'Detailed permission matrix for workspace Admin, Developer, and Guest roles with fine-grained access control.',
      pinned: false,
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

  const createDoc = (title?: string, category?: DocCategory) => {
    const newDoc: DocItem = {
      id: `doc_${Date.now()}`,
      title: title || 'Untitled Document',
      category: category || 'General',
      updatedAt: 'Just now',
      snippet: 'Start writing your document notes here...',
      content: 'Type your rich markdown content here...',
      pinned: false,
    };
    setDocs((prev) => [newDoc, ...prev]);
    setActiveDocId(newDoc.id);
    return newDoc.id;
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
    createDoc,
    deleteDoc,
  };
}
