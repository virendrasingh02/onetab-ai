import { queryKeys, workToolsApi } from '@org/api-client';
import { DocumentKind, type WorkDocument } from '@org/types';
import { formatRelative } from '@org/utils';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { useDocumentMutations, useDocuments } from '../use-work-tools.js';
import {
  blockId,
  decodeDocContent,
  encodeDocContent,
  snippetFor,
  type DocMeta,
} from './doc-content.js';
import {
  DEFAULT_COVER,
  type CompanyItem,
  type DocCategory,
  type DocItem,
  type DocStatus,
  type NotionBlock,
} from './doc-types.js';

/**
 * The docs tree, over the documents API.
 *
 * Root documents are the companies the sidebar groups by, and everything else is
 * a page somewhere under one of them — so `companyId` is a derived field (the
 * root of the `parentId` chain), not something stored twice.
 *
 * Edits are one `PATCH` each. The mutation writes the response straight into the
 * cache rather than invalidating, because the editor is the source of truth while
 * it has focus and a refetch mid-keystroke would fight the cursor.
 */

/* ----------------------------------------------------------- projection --- */

/** Walks up `parentId` to the root document, which is the doc's company. */
function rootIdOf(doc: WorkDocument, byId: Map<string, WorkDocument>): string {
  const seen = new Set<string>([doc.id]);
  let current = doc;

  while (current.parentId) {
    const parent = byId.get(current.parentId);
    // A missing or cyclic parent would otherwise loop; treat it as the root.
    if (!parent || seen.has(parent.id)) break;
    seen.add(parent.id);
    current = parent;
  }

  return current.id;
}

function toDocItem(
  doc: WorkDocument,
  companyId: string,
  meta: DocMeta,
  blocks: NotionBlock[],
  comments: DocItem['comments'],
): DocItem {
  return {
    id: doc.id,
    companyId,
    title: doc.title,
    category: meta.category ?? 'General',
    updatedAt: formatRelative(doc.updatedAt),
    snippet: snippetFor(blocks),
    pinned: meta.pinned,
    favorite: meta.favorite,
    icon: meta.icon,
    iconColor: meta.iconColor,
    cover: meta.cover,
    status: meta.status ?? 'Draft',
    // The company row already stands for the parent, so a doc directly under it
    // is top-level as far as the sidebar is concerned.
    parentId: doc.parentId && doc.parentId !== companyId ? doc.parentId : undefined,
    blocks,
    comments,
  };
}

/* -------------------------------------------------------------- starters --- */

function starterBlocks(title: string, template?: string): NotionBlock[] {
  if (template === 'prd') {
    return [
      { id: blockId(), type: 'h1', content: 'Product Requirements Document (PRD)' },
      {
        id: blockId(),
        type: 'callout',
        variant: 'info',
        icon: '🎯',
        content:
          'Define problem, target user persona, scope, and key deliverables.',
      },
      { id: blockId(), type: 'h2', content: 'User Stories & Goals' },
      { id: blockId(), type: 'checklist', checked: false, content: 'First user story' },
      { id: blockId(), type: 'h2', content: 'Technical Architecture' },
      {
        id: blockId(),
        type: 'table',
        content: 'PRD Feature Table',
        headers: ['Feature', 'Priority', 'Owner'],
        rows: [['', '', '']],
      },
    ];
  }

  if (template === 'meeting') {
    return [
      { id: blockId(), type: 'h1', content: 'Sprint Sync & Planning Notes' },
      {
        id: blockId(),
        type: 'paragraph',
        content: `Date: ${new Date().toLocaleDateString()} | Attendees: `,
      },
      { id: blockId(), type: 'h2', content: 'Agenda Items' },
      { id: blockId(), type: 'bullet_list', content: '' },
      { id: blockId(), type: 'h2', content: 'Action Items' },
      { id: blockId(), type: 'checklist', checked: false, content: '' },
    ];
  }

  return [
    { id: blockId(), type: 'h1', content: title },
    {
      id: blockId(),
      type: 'paragraph',
      content:
        'Press / to insert blocks (Headings, Checklists, Callouts, Code, Tables, AI Copilot)…',
    },
  ];
}

const TEMPLATE_META: Record<string, Pick<DocMeta, 'icon' | 'cover'>> = {
  prd: { icon: '🚀', cover: 'linear-gradient(135deg, #8b5cf6 0%, #ec4899 100%)' },
  meeting: {
    icon: '📊',
    cover: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
  },
};

const TEMPLATE_TITLES: Record<string, string> = {
  prd: 'Product Requirements Document',
  meeting: 'Sprint Sync Notes',
};

/* ------------------------------------------------------------------ hook --- */

export interface DocsWorkspace {
  companies: CompanyItem[];
  docs: DocItem[];
  isLoading: boolean;
  isError: boolean;

  addCompany: (name: string, icon?: string) => Promise<string | undefined>;
  renameCompany: (companyId: string, name: string) => void;
  deleteCompany: (companyId: string) => Promise<void>;

  createDoc: (
    companyId?: string,
    title?: string,
    category?: DocCategory,
    template?: string,
    parentId?: string,
  ) => Promise<string | undefined>;
  duplicateDoc: (docId: string) => Promise<string | undefined>;
  deleteDoc: (docId: string) => void;
  moveDocToCompany: (docId: string, targetCompanyId: string) => void;

  updateDocTitle: (docId: string, title: string) => void;
  updateDocCategory: (docId: string, category: DocCategory) => void;
  updateDocStatus: (docId: string, status: DocStatus) => void;
  updateDocCover: (docId: string, cover: string) => void;
  updateDocIcon: (docId: string, icon: string, iconColor?: string) => void;
  toggleFavorite: (docId: string) => void;
  updateDocBlocks: (docId: string, blocks: NotionBlock[]) => void;
  addComment: (docId: string, author: string, text: string) => void;

  isSaving: boolean;
}

export function useDocsWorkspace(
  workspaceId: string | undefined,
): DocsWorkspace {
  const query = useDocuments(workspaceId);
  const mutations = useDocumentMutations(workspaceId);
  const queryClient = useQueryClient();

  // Kept stable across renders: `?? []` inline would be a fresh array each time,
  // re-decoding every document's content on every render.
  const raw = useMemo(() => query.data ?? [], [query.data]);

  /** Decoded once per fetch: every read site needs the blocks and the metadata. */
  const decoded = useMemo(() => {
    const byId = new Map(raw.map((doc) => [doc.id, doc]));

    return raw.map((doc) => ({
      doc,
      companyId: rootIdOf(doc, byId),
      ...decodeDocContent(doc.content),
    }));
  }, [raw]);

  const companies = useMemo<CompanyItem[]>(
    () =>
      decoded
        .filter((entry) => entry.doc.parentId === null)
        .map((entry) => ({
          id: entry.doc.id,
          name: entry.doc.title,
          icon: entry.meta.icon ?? '🏢',
        })),
    [decoded],
  );

  const docs = useMemo<DocItem[]>(
    () =>
      decoded
        .filter((entry) => entry.doc.parentId !== null)
        .map((entry) =>
          toDocItem(
            entry.doc,
            entry.companyId,
            entry.meta,
            entry.blocks,
            entry.comments,
          ),
        ),
    [decoded],
  );

  /** Re-encodes a document's content with `patch` folded into its envelope. */
  const patchContent = useCallback(
    (
      docId: string,
      patch: (envelope: {
        meta: DocMeta;
        blocks: NotionBlock[];
        comments: DocItem['comments'];
      }) => {
        meta?: DocMeta;
        blocks?: NotionBlock[];
        comments?: DocItem['comments'];
      },
    ) => {
      const entry = decoded.find((candidate) => candidate.doc.id === docId);
      if (!entry) return;

      const current = {
        meta: entry.meta,
        blocks: entry.blocks,
        comments: entry.comments,
      };
      const next = patch(current);

      mutations.update.mutate({
        docId,
        input: {
          content: encodeDocContent({
            meta: next.meta ?? current.meta,
            blocks: next.blocks ?? current.blocks,
            comments: next.comments ?? current.comments,
          }),
        },
      });
    },
    [decoded, mutations.update],
  );

  const patchMeta = useCallback(
    (docId: string, meta: Partial<DocMeta>) => {
      patchContent(docId, (current) => ({
        meta: { ...current.meta, ...meta },
      }));
    },
    [patchContent],
  );

  const createDoc = useCallback(
    async (
      companyId?: string,
      title?: string,
      category?: DocCategory,
      template?: string,
      parentId?: string,
    ) => {
      if (!workspaceId) return undefined;

      const parent = parentId ?? companyId ?? companies[0]?.id;
      if (!parent) return undefined;

      const name =
        title ?? (template ? TEMPLATE_TITLES[template] : undefined) ??
        'Untitled Document';

      const created = await mutations.create.mutateAsync({
        title: name,
        parentId: parent,
        kind: DocumentKind.DOC,
        content: encodeDocContent({
          meta: {
            category: category ?? 'General',
            status: 'Draft',
            icon: TEMPLATE_META[template ?? '']?.icon ?? '📝',
            cover: TEMPLATE_META[template ?? '']?.cover ?? DEFAULT_COVER,
          },
          blocks: starterBlocks(name, template),
          comments: [],
        }),
      });

      return created.id;
    },
    [companies, mutations.create, workspaceId],
  );

  const addCompany = useCallback(
    async (name: string, icon?: string) => {
      if (!workspaceId || !name.trim()) return undefined;

      const company = await mutations.create.mutateAsync({
        title: name.trim(),
        parentId: null,
        kind: DocumentKind.WIKI,
        content: encodeDocContent({
          meta: { icon: icon || '🏢', cover: DEFAULT_COVER },
          blocks: [],
          comments: [],
        }),
      });

      // A teamspace with nothing in it has no rows to click, so it starts with
      // an overview page the way the seeded one did.
      await mutations.create.mutateAsync({
        title: `${name.trim()} Overview`,
        parentId: company.id,
        kind: DocumentKind.DOC,
        content: encodeDocContent({
          meta: { category: 'General', status: 'Draft', icon: '📝', cover: DEFAULT_COVER },
          blocks: starterBlocks(`${name.trim()} Overview`),
          comments: [],
        }),
      });

      return company.id;
    },
    [mutations.create, workspaceId],
  );

  const deleteCompany = useCallback(
    async (companyId: string) => {
      if (!workspaceId) return;

      /*
       * `DELETE /documents/:id` re-parents children rather than cascading, so
       * deleting only the root would promote every page under it to a teamspace
       * of its own. The subtree is removed deepest-first instead.
       */
      const childrenOf = new Map<string, string[]>();
      for (const doc of raw) {
        if (!doc.parentId) continue;
        childrenOf.set(doc.parentId, [
          ...(childrenOf.get(doc.parentId) ?? []),
          doc.id,
        ]);
      }

      const ordered: string[] = [];
      const walk = (id: string) => {
        for (const child of childrenOf.get(id) ?? []) walk(child);
        ordered.push(id);
      };
      walk(companyId);

      // Called directly rather than through the mutation so the whole subtree
      // costs one invalidation at the end instead of one per document.
      for (const id of ordered) {
        await workToolsApi.deleteDocument(workspaceId, id);
      }

      await queryClient.invalidateQueries({
        queryKey: queryKeys.workTools.all(workspaceId),
      });
    },
    [queryClient, raw, workspaceId],
  );

  const duplicateDoc = useCallback(
    async (docId: string) => {
      const entry = decoded.find((candidate) => candidate.doc.id === docId);
      if (!entry || !workspaceId) return undefined;

      const created = await mutations.create.mutateAsync({
        title: `${entry.doc.title} (Copy)`,
        parentId: entry.doc.parentId,
        kind: entry.doc.kind,
        content: encodeDocContent({
          meta: entry.meta,
          blocks: entry.blocks.map((block) => ({ ...block, id: blockId() })),
          // Comments belong to the original conversation.
          comments: [],
        }),
      });

      return created.id;
    },
    [decoded, mutations.create, workspaceId],
  );

  return {
    companies,
    docs,
    isLoading: query.isLoading,
    isError: query.isError,

    addCompany,
    renameCompany: (companyId, name) => {
      if (name.trim()) {
        mutations.update.mutate({
          docId: companyId,
          input: { title: name.trim() },
        });
      }
    },
    deleteCompany,

    createDoc,
    duplicateDoc,
    deleteDoc: (docId) => mutations.remove.mutate(docId),
    moveDocToCompany: (docId, targetCompanyId) =>
      mutations.update.mutate({
        docId,
        input: { parentId: targetCompanyId },
      }),

    updateDocTitle: (docId, title) => {
      if (title.trim()) {
        mutations.update.mutate({ docId, input: { title: title.trim() } });
      }
    },
    updateDocCategory: (docId, category) => patchMeta(docId, { category }),
    updateDocStatus: (docId, status) => patchMeta(docId, { status }),
    updateDocCover: (docId, cover) => patchMeta(docId, { cover }),
    updateDocIcon: (docId, icon, iconColor) =>
      patchMeta(docId, { icon, iconColor }),
    toggleFavorite: (docId) => {
      const entry = decoded.find((candidate) => candidate.doc.id === docId);
      patchMeta(docId, { favorite: !entry?.meta.favorite });
    },
    updateDocBlocks: (docId, blocks) => patchContent(docId, () => ({ blocks })),
    addComment: (docId, author, text) =>
      patchContent(docId, (current) => ({
        comments: [
          ...current.comments,
          {
            id: `c_${Date.now()}`,
            author,
            text,
            createdAt: new Date().toISOString(),
          },
        ],
      })),

    isSaving: mutations.update.isPending || mutations.create.isPending,
  };
}
