import { useCallback, useEffect, useState } from 'react';

/*
 * Local-storage backed stubs for the sidebar trees.
 *
 * These stand in for endpoints that do not exist yet. They live in one typed
 * module rather than being inlined as `any` blobs in the middle of the nav
 * components, so the shapes are checked and there is a single place to delete
 * once the real queries land.
 */

export interface SidebarProject {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  iconColor?: string;
}

export interface SidebarCompany {
  id: string;
  name: string;
  icon?: string;
}

export interface SidebarDoc {
  id: string;
  companyId: string;
  title: string;
  icon?: string;
  iconColor?: string;
  parentId?: string;
  snippet?: string;
  updatedAt?: string;
}

export interface DocsStore {
  companies: SidebarCompany[];
  docs: SidebarDoc[];
}

const PROJECTS_KEY = 'onetab_project_boards_v2';
const PROJECTS_EVENT = 'onetab_projects_updated';
const DOCS_KEY = 'onetab_company_docs_v1';
const DOCS_EVENT = 'onetab_docs_updated';

const DEFAULT_PROJECTS: SidebarProject[] = [
  { id: 'proj_product', name: 'Q3 Product & Release', color: 'violet', icon: 'Rocket', iconColor: '#5E6AD2' },
  { id: 'proj_design', name: 'Website & UI Redesign', color: 'blue', icon: 'Sparkles', iconColor: '#4EA7FC' },
  { id: 'proj_api', name: 'AI & Vector Pipeline', color: 'green', icon: 'Cpu', iconColor: '#4CB782' },
];

const DEFAULT_DOCS: DocsStore = {
  companies: [{ id: 'company_onetab', name: 'Onetab AI', icon: '🏢' }],
  docs: [
    { id: 'doc_onetab_arch', companyId: 'company_onetab', title: 'Onetab AI System Architecture', icon: '🏗️' },
    { id: 'doc_onetab_guide', companyId: 'company_onetab', title: 'Onetab AI Design System Tokens', icon: '🎨' },
    { id: 'doc_onetab_roadmap', companyId: 'company_onetab', title: 'Onetab AI Product Roadmap 2026', icon: '⚡' },
  ],
};

function read<T>(key: string, isValid: (value: unknown) => value is T, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Shared plumbing: read on mount, re-read when this tab or another tab writes,
 * and expose a setter that persists and broadcasts.
 */
function useLocalStore<T>(
  key: string,
  event: string,
  isValid: (value: unknown) => value is T,
  fallback: T,
) {
  const [value, setValue] = useState<T>(() => read(key, isValid, fallback));

  useEffect(() => {
    const sync = () => setValue(read(key, isValid, fallback));
    window.addEventListener(event, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(event, sync);
      window.removeEventListener('storage', sync);
    };
    // `isValid` and `fallback` are module constants.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, event]);

  const save = useCallback(
    (next: T) => {
      setValue(next);
      if (typeof window === 'undefined') return;
      try {
        window.localStorage.setItem(key, JSON.stringify(next));
        window.dispatchEvent(new Event(event));
      } catch {
        /* Quota or private mode. */
      }
    },
    [key, event],
  );

  return [value, save] as const;
}

const isProjectList = (value: unknown): value is SidebarProject[] =>
  Array.isArray(value) && value.length > 0;

const isDocsStore = (value: unknown): value is DocsStore =>
  typeof value === 'object' &&
  value !== null &&
  Array.isArray((value as DocsStore).companies) &&
  (value as DocsStore).companies.length > 0 &&
  Array.isArray((value as DocsStore).docs);

export function useSidebarProjects() {
  return useLocalStore(PROJECTS_KEY, PROJECTS_EVENT, isProjectList, DEFAULT_PROJECTS);
}

export function useSidebarDocs() {
  return useLocalStore(DOCS_KEY, DOCS_EVENT, isDocsStore, DEFAULT_DOCS);
}
