import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgeImportService } from './knowledge-import.service.js';

describe('KnowledgeImportService', () => {
  let prisma: any;
  let integrations: any;
  let knowledge: any;
  let service: KnowledgeImportService;

  beforeEach(() => {
    prisma = { externalIntegration: { findFirst: vi.fn().mockResolvedValue({ provider: 'NOTION' }) } };
    integrations = { executeAction: vi.fn() };
    knowledge = {
      getKnowledgeBase: vi.fn().mockResolvedValue({ id: 'kb-1' }),
      ingestDocument: vi.fn(async (_w: string, _k: string, d: any) => ({ id: 'doc', name: d.name, status: 'QUEUED' })),
    };
    service = new KnowledgeImportService(prisma, integrations, knowledge);
  });

  it('refuses providers other than Drive and Notion', async () => {
    prisma.externalIntegration.findFirst.mockResolvedValue({ provider: 'SLACK' });
    await expect(service.browse('ws', 'u', 'int')).rejects.toThrow(/Google Drive or Notion/);
  });

  it('refuses an integration that is not this workspace\'s (lookup is workspace-scoped)', async () => {
    prisma.externalIntegration.findFirst.mockResolvedValue(null);
    await expect(service.importItems('ws', 'u', 'kb-1', 'foreign', [{ id: 'p' }])).rejects.toThrow(/connected/);
    expect(prisma.externalIntegration.findFirst.mock.calls[0][0].where.OR).toContainEqual({ workspaceId: 'ws' });
    expect(knowledge.ingestDocument).not.toHaveBeenCalled();
  });

  it('browses Notion pages', async () => {
    integrations.executeAction.mockResolvedValue({
      success: true,
      data: { results: [{ id: 'p1', title: 'Handbook', url: 'https://notion.so/p1', lastEditedTime: '2026-01-01' }] },
    });
    const items = await service.browse('ws', 'u', 'int', 'hand');
    expect(items).toEqual([{ id: 'p1', name: 'Handbook', kind: 'page', modifiedAt: '2026-01-01', url: 'https://notion.so/p1' }]);
    expect(integrations.executeAction).toHaveBeenCalledWith('int', 'search', { query: 'hand', type: 'page' }, undefined, 'u', 'ws');
  });

  it('imports a Notion page as an APP document keyed by its source id', async () => {
    integrations.executeAction.mockResolvedValue({ success: true, data: { title: 'Handbook', plainText: 'Refunds in 30 days.' } });
    const res = await service.importItems('ws', 'u', 'kb-1', 'int', [{ id: 'p1' }], ['hr']);
    expect(res.failed).toEqual([]);
    expect(knowledge.ingestDocument).toHaveBeenCalledWith(
      'ws',
      'kb-1',
      expect.objectContaining({ sourceType: 'APP', sourceUri: 'notion:p1', rawText: 'Refunds in 30 days.', metadata: { provider: 'NOTION', tags: ['hr'] } }),
      { background: true },
    );
  });

  it('verifies the knowledge base belongs to the workspace before reading anything', async () => {
    knowledge.getKnowledgeBase.mockRejectedValue(new Error('Knowledge base not found'));
    await expect(service.importItems('ws', 'u', 'foreign-kb', 'int', [{ id: 'p' }])).rejects.toThrow(/not found/);
    expect(integrations.executeAction).not.toHaveBeenCalled();
  });

  it('isolates failures: one empty page does not stop the rest', async () => {
    integrations.executeAction
      .mockResolvedValueOnce({ success: true, data: { title: 'Empty', plainText: '' } })
      .mockResolvedValueOnce({ success: true, data: { title: 'Good', plainText: 'content' } });
    const res = await service.importItems('ws', 'u', 'kb-1', 'int', [{ id: 'a' }, { id: 'b' }]);
    expect(res.documents).toHaveLength(1);
    expect(res.failed).toEqual([expect.objectContaining({ id: 'a', error: expect.stringContaining('no text') })]);
  });

  it('reads Drive text directly and runs binaries through the validated extractor', async () => {
    prisma.externalIntegration.findFirst.mockResolvedValue({ provider: 'GOOGLE_DRIVE' });
    integrations.executeAction
      .mockResolvedValueOnce({ success: true, data: { name: 'Doc', mimeType: 'text/plain', text: 'plain drive text' } })
      .mockResolvedValueOnce({
        success: true,
        data: { name: 'notes.txt', mimeType: 'application/octet-stream', contentBase64: Buffer.from('from binary').toString('base64') },
      })
      .mockResolvedValueOnce({
        success: true,
        data: { name: 'evil.pdf', mimeType: 'application/pdf', contentBase64: Buffer.from('not a pdf').toString('base64') },
      });
    const res = await service.importItems('ws', 'u', 'kb-1', 'int', [{ id: '1' }, { id: '2' }, { id: '3' }]);
    expect(knowledge.ingestDocument.mock.calls.map((c: any[]) => c[2].rawText)).toEqual(['plain drive text', 'from binary']);
    expect(res.failed).toEqual([expect.objectContaining({ id: '3', error: expect.stringContaining('not a valid PDF') })]);
    expect(knowledge.ingestDocument.mock.calls[0][2].sourceUri).toBe('google_drive:1');
  });

  it('reports a failed app action instead of importing nothing silently', async () => {
    integrations.executeAction.mockResolvedValue({ success: false, message: 'token expired' });
    const res = await service.importItems('ws', 'u', 'kb-1', 'int', [{ id: 'a' }]);
    expect(res.documents).toEqual([]);
    expect(res.failed[0]!.error).toBe('token expired');
  });
});
