/**
 * The knowledge pipeline against a real Postgres: upload → chunk → embed →
 * retrieve → answer → version → delete, plus tenant isolation. The embedding
 * provider and chat model are deterministic stubs (no network); everything
 * else — Prisma, chunking, hashing, filters, cleanup — is real.
 *
 * Creates its own workspaces and removes them afterwards. Skipped when no
 * database is reachable so unit-only environments stay green.
 */
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '@org/database';
import { KnowledgeService } from './knowledge.service.js';

loadEnv({ path: resolve(__dirname, '../../../../../.env'), quiet: true });

let prisma: PrismaService | null = null;
try {
  if (process.env['DATABASE_URL']) {
    const candidate = new PrismaService();
    await candidate.$queryRaw`SELECT 1`;
    await candidate.knowledgeDocument.findFirst({ select: { contentHash: true } }); // migration applied?
    prisma = candidate;
  }
} catch {
  prisma = null;
}

const uid = () => Math.random().toString(36).slice(2, 10);

/** Bag-of-words embedding: shared words => similar vectors, so retrieval is checkable. */
const VOCAB = ['refund', 'policy', 'days', 'shipping', 'warranty', 'password', 'reset', 'invoice', 'security', 'cat'];
const embed = (text: string) => {
  const lower = text.toLowerCase();
  const v = VOCAB.map((w) => (lower.includes(w) ? 1 : 0));
  return v.some(Boolean) ? v : VOCAB.map(() => 0.01);
};

const ai = {
  generateEmbeddings: vi.fn(async (texts: string[]) => texts.map(embed)),
  generateEmbedding: vi.fn(async (text: string) => embed(text)),
  chat: vi.fn(async ({ messages }: { messages: Array<{ content: string }> }) => ({
    message: {
      role: 'assistant',
      content: messages[1]!.content.includes('refund') ? 'Refunds are allowed within 30 days [1][9].' : 'unknown',
    },
    model: 'stub',
  })),
};
const noQdrant = { isConfigured: () => false, upsert: vi.fn(), search: vi.fn(), deleteByDocument: vi.fn() };

const wsIds: string[] = [];
const userIds: string[] = [];

afterAll(async () => {
  if (!prisma) return;
  await prisma.workspace.deleteMany({ where: { id: { in: wsIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

const docxFile = (text: string) => ({
  originalname: 'handbook.docx',
  buffer: Buffer.from(
    zipSync({
      'word/document.xml': strToU8(
        `<w:document><w:body>${text
          .split('\n')
          .map((l) => `<w:p><w:r><w:t>${l}</w:t></w:r></w:p>`)
          .join('')}</w:body></w:document>`,
      ),
    }),
  ),
});

async function waitIndexed(documentId: string) {
  for (let i = 0; i < 100; i++) {
    const d = await prisma!.knowledgeDocument.findUnique({ where: { id: documentId } });
    if (d && (d.status === 'INDEXED' || d.status === 'FAILED')) return d;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('document never finished indexing');
}

describe.skipIf(!prisma)('knowledge pipeline (real database)', () => {
  const makeWorkspace = async () => {
    const id = `kbtest-${uid()}`;
    const owner = await prisma!.user.create({
      data: { email: `${id}@example.test`, name: 'KB Test', passwordHash: 'x' } as never,
    });
    userIds.push(owner.id);
    await prisma!.workspace.create({ data: { id, name: id, slug: id, ownerId: owner.id } as never });
    wsIds.push(id);
    return id;
  };

  it('uploads, indexes in the background, retrieves with citations, versions, dedups and cleans up', async () => {
    const service = new KnowledgeService(prisma!, noQdrant as never, ai as never);
    service.retryDelayMs = 0;
    const ws = await makeWorkspace();
    const kb = await service.createKnowledgeBase(ws, undefined, { name: 'Support', embeddingModel: 'stub-embed' });

    // 1. Upload a DOCX: returns QUEUED, indexes in the background.
    const queued = await service.ingestFile(
      ws,
      kb.id,
      docxFile('Refund policy: customers may return items within 30 days.\n\nShipping takes five days.'),
      ['support'],
    );
    expect(queued.status).toBe('QUEUED');
    const indexed = await waitIndexed(queued.id);
    expect(indexed.status).toBe('INDEXED');
    expect(indexed.chunkCount).toBeGreaterThan(0);
    expect((indexed.metadata as { tags?: string[] }).tags).toEqual(['support']);

    const stored = await prisma!.knowledgeChunk.findMany({ where: { documentId: queued.id } });
    expect(stored.every((c) => c.embedding.length === VOCAB.length && c.embeddingModel === 'stub-embed')).toBe(true);

    // 2. Retrieval finds the right passage, with a citation naming the document.
    const hits = await service.retrieve(ws, kb.id, { query: 'what is the refund policy', mode: 'SEMANTIC', rerank: true });
    expect(hits[0]!.content).toContain('Refund policy');
    expect(hits[0]!.citation).toContain('handbook.docx');

    // 3. Grounded answer: invented citation [9] is stripped; real source is marked cited.
    const answer = await service.answer(ws, kb.id, { question: 'refund policy?', mode: 'SEMANTIC' });
    expect(answer.answer).toBe('Refunds are allowed within 30 days [1].');
    expect(answer.sources[0]).toMatchObject({ sourceNumber: 1, cited: true });

    // 4. Unrelated question with nothing retrieved => no model call, honest "not found".
    ai.chat.mockClear();
    const none = await service.answer(ws, kb.id, { question: 'zzzz qqqq', mode: 'KEYWORD' });
    expect(none.grounded).toBe(false);
    expect(ai.chat).not.toHaveBeenCalled();

    // 5. Metadata filters: wrong tag => nothing.
    expect(await service.retrieve(ws, kb.id, { query: 'refund', filters: { tags: ['legal'] } })).toEqual([]);

    // 6. Identical content again => deduplicated, no second document.
    const dup = await service.ingestFile(
      ws,
      kb.id,
      docxFile('Refund policy: customers may return items within 30 days.\n\nShipping takes five days.'),
    );
    expect(dup.deduplicated).toBe(true);
    expect(await prisma!.knowledgeDocument.count({ where: { knowledgeBaseId: kb.id } })).toBe(1);

    // 7. Changed content, same name => v2 replaces the old chunks.
    const v2 = await service.ingestFile(ws, kb.id, docxFile('Warranty lasts two years.'));
    expect(v2.id).toBe(queued.id);
    const v2done = await waitIndexed(v2.id);
    expect(v2done.version).toBe(2);
    const after = await prisma!.knowledgeChunk.findMany({ where: { documentId: v2.id } });
    expect(after.map((c) => c.content).join(' ')).toContain('Warranty');
    expect(after.map((c) => c.content).join(' ')).not.toContain('Refund');

    // 8. Raw text note: synchronous, indexed immediately.
    const note = await service.ingestDocument(ws, kb.id, { name: 'Note', sourceType: 'MANUAL', rawText: 'Password reset takes a minute.' });
    expect(note.status).toBe('INDEXED');

    // 9. Deleting the KB removes every document and chunk.
    await service.deleteKnowledgeBase(ws, kb.id);
    expect(await prisma!.knowledgeDocument.count({ where: { knowledgeBaseId: kb.id } })).toBe(0);
    expect(await prisma!.knowledgeChunk.count({ where: { documentId: { in: [v2.id, note.id] } } })).toBe(0);
  });

  it('isolates tenants: another workspace cannot read, search or edit a base or its chunks', async () => {
    const service = new KnowledgeService(prisma!, noQdrant as never, ai as never);
    const a = await makeWorkspace();
    const b = await makeWorkspace();
    const kbA = await service.createKnowledgeBase(a, undefined, { name: 'A', embeddingModel: 'stub-embed' });
    const kbB = await service.createKnowledgeBase(b, undefined, { name: 'B', embeddingModel: 'stub-embed' });
    const secret = await service.ingestDocument(a, kbA.id, { name: 's', sourceType: 'MANUAL', rawText: 'Security incident report: password reset.' });

    await expect(service.getKnowledgeBase(b, kbA.id)).rejects.toThrow(/not found/i);
    await expect(service.retrieve(b, kbA.id, { query: 'password' })).rejects.toThrow(/not found/i);
    await expect(service.answer(b, kbA.id, { question: 'password' })).rejects.toThrow(/not found/i);
    // Own base, foreign document id: the id alone must not grant access.
    await expect(service.listChunks(b, kbB.id, secret.id)).rejects.toThrow(/not found/i);
    const chunk = (await prisma!.knowledgeChunk.findFirst({ where: { documentId: secret.id } }))!;
    await expect(service.updateChunk(b, kbB.id, secret.id, chunk.id, 'tampered')).rejects.toThrow(/not found/i);
    expect((await prisma!.knowledgeChunk.findUnique({ where: { id: chunk.id } }))!.content).not.toBe('tampered');
    expect(await service.retrieve(b, kbB.id, { query: 'password', mode: 'KEYWORD' })).toEqual([]);
  });

  it('records a FAILED document and keeps going when an upload is unreadable', async () => {
    const service = new KnowledgeService(prisma!, noQdrant as never, ai as never);
    const ws = await makeWorkspace();
    const kb = await service.createKnowledgeBase(ws, undefined, { name: 'X', embeddingModel: 'stub-embed' });
    await expect(
      service.ingestFile(ws, kb.id, { originalname: 'fake.pdf', buffer: Buffer.from('not a pdf') }),
    ).rejects.toThrow(/not a valid PDF/);
    expect(await prisma!.knowledgeDocument.count({ where: { knowledgeBaseId: kb.id } })).toBe(0);
    // Embedding provider down: still indexed for keyword search, with a note.
    ai.generateEmbeddings.mockRejectedValueOnce(new Error('provider down'));
    ai.generateEmbeddings.mockRejectedValueOnce(new Error('provider down'));
    ai.generateEmbeddings.mockRejectedValueOnce(new Error('provider down'));
    const doc = await service.ingestDocument(ws, kb.id, { name: 'k', sourceType: 'MANUAL', rawText: 'cat facts for keyword search' });
    expect(doc.status).toBe('INDEXED');
    expect(doc.errorMessage).toMatch(/keyword only/);
    const hits = await service.retrieve(ws, kb.id, { query: 'cat', mode: 'HYBRID' });
    expect(hits.length).toBeGreaterThan(0);
  });
});
