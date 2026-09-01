import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RagIngestListener } from './rag-ingest.listener.js';

describe('RagIngestListener', () => {
  let prisma: { workDocument: { findUnique: ReturnType<typeof vi.fn> } };
  let ai: {
    ingestDocumentForRAG: ReturnType<typeof vi.fn>;
    removeDocumentFromRAG: ReturnType<typeof vi.fn>;
  };
  let vectorStore: { isConfigured: ReturnType<typeof vi.fn> };
  let listener: RagIngestListener;

  beforeEach(() => {
    prisma = { workDocument: { findUnique: vi.fn() } };
    ai = {
      ingestDocumentForRAG: vi.fn().mockResolvedValue(undefined),
      removeDocumentFromRAG: vi.fn().mockResolvedValue(undefined),
    };
    vectorStore = { isConfigured: vi.fn().mockReturnValue(true) };
    listener = new RagIngestListener(
      prisma as never,
      ai as never,
      vectorStore as never,
    );
  });

  const evt = {
    workspaceId: 'ws-1',
    actorId: 'u-1',
    documentId: 'doc-1',
    title: 'Spec',
  };

  it('does nothing when the vector store is not configured', async () => {
    vectorStore.isConfigured.mockReturnValue(false);
    await listener.onDocumentCreated(evt);
    expect(prisma.workDocument.findUnique).not.toHaveBeenCalled();
    expect(ai.ingestDocumentForRAG).not.toHaveBeenCalled();
  });

  it('ingests a newly created document', async () => {
    prisma.workDocument.findUnique.mockResolvedValue({
      workspaceId: 'ws-1',
      title: 'Spec',
      content: 'hello world',
      kind: 'DOC',
      deletedAt: null,
    });
    await listener.onDocumentCreated(evt);
    expect(ai.ingestDocumentForRAG).toHaveBeenCalledWith('ws-1', 'doc-1', 'hello world', {
      title: 'Spec',
      kind: 'DOC',
      resourceType: 'document',
    });
  });

  it('re-ingests on update only when the body changed', async () => {
    prisma.workDocument.findUnique.mockResolvedValue({
      workspaceId: 'ws-1',
      title: 'Spec',
      content: 'new body',
      kind: 'DOC',
      deletedAt: null,
    });

    await listener.onDocumentUpdated({ ...evt, contentChanged: false });
    expect(ai.ingestDocumentForRAG).not.toHaveBeenCalled();

    await listener.onDocumentUpdated({ ...evt, contentChanged: true });
    expect(ai.ingestDocumentForRAG).toHaveBeenCalledTimes(1);
  });

  it('skips a document that is missing, soft-deleted, or cross-tenant', async () => {
    prisma.workDocument.findUnique.mockResolvedValueOnce(null);
    await listener.onDocumentCreated(evt);

    prisma.workDocument.findUnique.mockResolvedValueOnce({
      workspaceId: 'ws-1',
      title: 'x',
      content: 'x',
      kind: 'DOC',
      deletedAt: new Date(),
    });
    await listener.onDocumentCreated(evt);

    prisma.workDocument.findUnique.mockResolvedValueOnce({
      workspaceId: 'other-ws',
      title: 'x',
      content: 'x',
      kind: 'DOC',
      deletedAt: null,
    });
    await listener.onDocumentCreated(evt);

    expect(ai.ingestDocumentForRAG).not.toHaveBeenCalled();
  });

  it('drops the document from the index on delete', async () => {
    await listener.onDocumentDeleted({
      workspaceId: 'ws-1',
      actorId: null,
      documentId: 'doc-1',
    });
    expect(ai.removeDocumentFromRAG).toHaveBeenCalledWith('doc-1');
  });

  it('swallows indexing errors so the document write is never affected', async () => {
    prisma.workDocument.findUnique.mockResolvedValue({
      workspaceId: 'ws-1',
      title: 'Spec',
      content: 'body',
      kind: 'DOC',
      deletedAt: null,
    });
    ai.ingestDocumentForRAG.mockRejectedValue(new Error('qdrant down'));
    await expect(listener.onDocumentCreated(evt)).resolves.toBeUndefined();
  });
});
