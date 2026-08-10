import { useEffect, useState } from 'react';
import { createSeedBoard } from './seed.js';
import type { BoardState, KanbanList } from './types.js';

export type ProjectCategory =
  | 'Engineering'
  | 'Design'
  | 'Marketing'
  | 'Product'
  | 'Operations';

/*
 * A subset of the design system's `Accent` names, so a project colour can be
 * rendered straight through `accentClasses` instead of a parallel set of
 * hand-written Tailwind palette classes.
 */
export type ProjectColor =
  | 'blue'
  | 'green'
  | 'violet'
  | 'amber'
  | 'rose'
  | 'cyan';

export interface ProjectBoardItem {
  id: string;
  name: string;
  category: ProjectCategory;
  color: ProjectColor;
  icon?: string;
  iconColor?: string;
  description: string;
  board: BoardState;
  updatedAt: string;
}

const STORAGE_KEY = 'onetab_project_boards_v2';

function createSeedProjects(): ProjectBoardItem[] {
  const seedBoard = createSeedBoard();

  return [
    {
      id: 'proj_shopify',
      name: 'Shopify',
      category: 'Product',
      color: 'amber',
      icon: 'ShoppingBag',
      iconColor: '#f59e0b',
      description: 'E-commerce storefront integration and custom theme workflows.',
      board: { ...seedBoard, title: 'Shopify' },
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj_product',
      name: 'Q3 Product & Platform Release',
      category: 'Product',
      color: 'violet',
      icon: 'Rocket',
      iconColor: '#5E6AD2',
      description: 'Core product features, resizable sidebars, and AI Copilot integration.',
      board: { ...seedBoard, title: 'Q3 Product & Platform Release' },
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj_design',
      name: 'Website & UI Redesign',
      category: 'Design',
      color: 'blue',
      icon: 'Sparkles',
      iconColor: '#4EA7FC',
      description: 'New design system tokens, responsive glassmorphism themes, and dark mode.',
      board: {
        title: 'Website & UI Redesign',
        labels: seedBoard.labels,
        members: seedBoard.members,
        currentMemberId: seedBoard.currentMemberId,
        lists: [
          {
            id: 'design_todo',
            title: 'Design To Do',
            cards: [
              {
                id: 'c_design_1',
                title: 'Figma Component Tokens',
                description: 'Sync dark mode HSL CSS variables with Tailwind design system.',
                labelIds: ['l_design'],
                memberIds: ['m_you'],
                dueComplete: false,
                priority: 'HIGH',
                checklist: [{ id: 'chk_1', text: 'Color tokens', done: true }],
                comments: [],
                createdAt: new Date().toISOString(),
              },
            ],
          },
          {
            id: 'design_doing',
            title: 'In Design',
            cards: [
              {
                id: 'c_design_2',
                title: 'Files Detail Row View Redesign',
                description: 'Refactor Files page to match high-fidelity reference layout with custom type badges.',
                labelIds: ['l_design', 'l_platform'],
                memberIds: ['m_you', 'm_dev'],
                dueComplete: false,
                priority: 'URGENT',
                checklist: [{ id: 'chk_2', text: 'Type Badges', done: true }, { id: 'chk_3', text: 'Filter Pills', done: true }],
                comments: [],
                createdAt: new Date().toISOString(),
              },
            ],
          },
          {
            id: 'design_done',
            title: 'Approved',
            cards: [
              {
                id: 'c_design_3',
                title: 'Resizable Layout Splitter',
                description: 'Implement drag handles with double-click reset and localStorage persistence.',
                labelIds: ['l_design'],
                memberIds: ['m_you'],
                dueComplete: true,
                priority: 'HIGH',
                checklist: [],
                comments: [],
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ],
      },
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'proj_api',
      name: 'AI & Vector Infrastructure',
      category: 'Engineering',
      color: 'green',
      description: 'Qdrant vector embeddings, hybrid search engine, and local Ollama model runner.',
      board: {
        title: 'AI & Vector Infrastructure',
        labels: seedBoard.labels,
        members: seedBoard.members,
        currentMemberId: seedBoard.currentMemberId,
        lists: [
          {
            id: 'eng_backlog',
            title: 'Backlog',
            cards: [
              {
                id: 'c_eng_1',
                title: 'Qdrant Collection Sharding',
                description: 'Configure HNSW index parameters for multi-tenant workspace isolation.',
                labelIds: ['l_ai', 'l_infra'],
                memberIds: ['m_sam'],
                dueComplete: false,
                priority: 'MEDIUM',
                checklist: [],
                comments: [],
                createdAt: new Date().toISOString(),
              },
            ],
          },
          {
            id: 'eng_doing',
            title: 'In Development',
            cards: [
              {
                id: 'c_eng_2',
                title: 'Ollama nomic-embed-text Integration',
                description: 'Stream embeddings over HTTP API with local fallback vector caching.',
                labelIds: ['l_ai'],
                memberIds: ['m_dev'],
                dueComplete: false,
                priority: 'HIGH',
                checklist: [],
                comments: [],
                createdAt: new Date().toISOString(),
              },
            ],
          },
        ],
      },
      updatedAt: new Date().toISOString(),
    },
  ];
}

/*
 * `emerald` was the pre-design-system name for what is now the `green` accent.
 * Boards saved under the old name would otherwise resolve to no accent at all,
 * so they are renamed on read.
 */
const LEGACY_COLORS: Record<string, ProjectColor> = { emerald: 'green' };

function migrateColors(projects: ProjectBoardItem[]): ProjectBoardItem[] {
  return projects.map((p) =>
    LEGACY_COLORS[p.color] ? { ...p, color: LEGACY_COLORS[p.color] } : p,
  );
}

export function useProjectBoards() {
  const [projects, setProjects] = useState<ProjectBoardItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return migrateColors(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load saved project boards:', e);
    }
    return createSeedProjects();
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return projects[0]?.id ?? 'proj_product';
  });

  // Save projects state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
      window.dispatchEvent(new Event('onetab_projects_updated'));
    } catch (e) {
      console.warn('Failed to persist project boards:', e);
    }
  }, [projects]);

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? projects[0];

  const updateActiveBoardState = (newBoardState: BoardState) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === activeProjectId
          ? { ...p, board: newBoardState, updatedAt: new Date().toISOString() }
          : p,
      ),
    );
  };

  const createProject = ({
    name,
    category,
    color,
    description,
    preset,
  }: {
    name: string;
    category: ProjectCategory;
    color: ProjectColor;
    description: string;
    preset?: 'standard' | 'sprint' | 'bug';
  }) => {
    const seed = createSeedBoard();
    let lists: KanbanList[];

    if (preset === 'sprint') {
      lists = [
        { id: `l_sp_${Date.now()}_1`, title: 'Sprint Backlog', cards: [] },
        { id: `l_sp_${Date.now()}_2`, title: 'In Progress', cards: [] },
        { id: `l_sp_${Date.now()}_3`, title: 'Code Review', cards: [] },
        { id: `l_sp_${Date.now()}_4`, title: 'QA & Testing', cards: [] },
        { id: `l_sp_${Date.now()}_5`, title: 'Done', cards: [] },
      ];
    } else if (preset === 'bug') {
      lists = [
        { id: `l_bg_${Date.now()}_1`, title: 'Reported Bugs', cards: [] },
        { id: `l_bg_${Date.now()}_2`, title: 'Investigating', cards: [] },
        { id: `l_bg_${Date.now()}_3`, title: 'Fix in Progress', cards: [] },
        { id: `l_bg_${Date.now()}_4`, title: 'Resolved & Closed', cards: [] },
      ];
    } else {
      lists = [
        { id: `l_std_${Date.now()}_1`, title: 'To Do', cards: [] },
        { id: `l_std_${Date.now()}_2`, title: 'In Progress', cards: [] },
        { id: `l_std_${Date.now()}_3`, title: 'In Review', cards: [] },
        { id: `l_std_${Date.now()}_4`, title: 'Done', cards: [] },
      ];
    }

    const newProject: ProjectBoardItem = {
      id: `proj_${Date.now()}`,
      name,
      category,
      color,
      description,
      board: {
        title: name,
        labels: seed.labels,
        members: seed.members,
        currentMemberId: seed.currentMemberId,
        lists,
      },
      updatedAt: new Date().toISOString(),
    };

    setProjects((prev) => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    return newProject.id;
  };

  const updateProjectIcon = (id: string, icon: string, iconColor?: string) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, icon, iconColor, updatedAt: new Date().toISOString() }
          : p,
      ),
    );
  };

  const updateProject = (id: string, updates: Partial<Omit<ProjectBoardItem, 'id' | 'board'>>) => {
    setProjects((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, ...updates, updatedAt: new Date().toISOString() }
          : p,
      ),
    );
  };

  const deleteProject = (id: string) => {
    if (projects.length <= 1) return; // Keep at least one project
    setProjects((prev) => {
      const filtered = prev.filter((p) => p.id !== id);
      if (activeProjectId === id) {
        setActiveProjectId(filtered[0]?.id ?? '');
      }
      return filtered;
    });
  };

  return {
    projects,
    activeProject,
    activeProjectId,
    setActiveProjectId,
    updateActiveBoardState,
    updateProjectIcon,
    updateProject,
    createProject,
    deleteProject,
  };
}
