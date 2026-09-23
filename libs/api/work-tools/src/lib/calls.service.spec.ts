import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AppEvent } from '@org/api-common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CallAccessService } from './call-access.service.js';
import { CallsService } from './calls.service.js';

const user = (id: string) => ({
  id,
  name: id,
  displayName: null,
  avatarUrl: null,
  email: `${id}@example.com`,
  presence: 'ONLINE',
  statusText: null,
  statusEmoji: null,
});

function callRow(overrides: Record<string, unknown> = {}) {
  const at = new Date('2026-09-23T10:00:00Z');
  return {
    id: 'call_1',
    workspaceId: 'ws_1',
    conversationId: '!room:hs',
    channelId: null,
    meetingId: null,
    title: 'Call with Ana',
    kind: 'AUDIO',
    status: 'ACTIVE',
    startedById: 'u_ana',
    startedAt: at,
    endedAt: null,
    recordingUrl: null,
    matrixCallId: 'mx_1',
    sharedWithWorkspace: false,
    sharedWithUserIds: [],
    createdAt: at,
    updatedAt: at,
    startedBy: user('u_ana'),
    participants: [],
    summary: null,
    ...overrides,
  };
}

describe('CallsService', () => {
  let prisma: any;
  let events: { emit: ReturnType<typeof vi.fn> };
  let access: CallAccessService;
  let summary: { generateSummary: ReturnType<typeof vi.fn> };
  let workTools: { createTask: ReturnType<typeof vi.fn>; updateTask: ReturnType<typeof vi.fn> };
  let service: CallsService;

  beforeEach(() => {
    prisma = {
      call: {
        count: vi.fn().mockResolvedValue(1),
        findFirst: vi.fn().mockResolvedValue(null),
        findUniqueOrThrow: vi.fn().mockResolvedValue(callRow()),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue(callRow()),
      },
      callParticipant: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        upsert: vi.fn().mockResolvedValue({}),
      },
      callNote: {
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      channel: { findFirst: vi.fn().mockResolvedValue(null) },
      channelMember: { count: vi.fn().mockResolvedValue(1) },
      meeting: { count: vi.fn().mockResolvedValue(1) },
      workspaceMember: { findMany: vi.fn().mockResolvedValue([]) },
      callTranscriptItem: { findMany: vi.fn().mockResolvedValue([]) },
      callActionItem: { create: vi.fn() },
    };
    events = { emit: vi.fn() };
    access = new CallAccessService(prisma);
    summary = { generateSummary: vi.fn().mockResolvedValue(undefined) };
    workTools = { createTask: vi.fn(), updateTask: vi.fn() };
    service = new CallsService(
      prisma,
      events as never,
      access,
      summary as never,
      workTools as never,
    );
  });

  describe('endCall', () => {
    it('closes the session once and reports it closed it', async () => {
      prisma.call.findUniqueOrThrow.mockResolvedValue(callRow({ status: 'ENDED' }));

      const result = await service.endCall('ws_1', 'u_ana', 'call_1');

      expect(result.endedNow).toBe(true);
      expect(prisma.call.updateMany).toHaveBeenCalledWith({
        where: { id: 'call_1', status: 'ACTIVE' },
        data: { status: 'ENDED', endedAt: expect.any(Date) },
      });
      expect(events.emit).toHaveBeenCalledWith(AppEvent.CallEnded, expect.anything());
      expect(summary.generateSummary).toHaveBeenCalledTimes(1);
    });

    it('is a no-op for the second participant reporting the same hang-up', async () => {
      prisma.call.updateMany.mockResolvedValue({ count: 0 });
      prisma.call.findUniqueOrThrow.mockResolvedValue(callRow({ status: 'ENDED' }));

      const result = await service.endCall('ws_1', 'u_bo', 'call_1');

      expect(result.endedNow).toBe(false);
      expect(events.emit).not.toHaveBeenCalledWith(AppEvent.CallEnded, expect.anything());
      expect(summary.generateSummary).not.toHaveBeenCalled();
    });

    it('refuses someone who can see the call but was not on it', async () => {
      // Visible (1), but not a participant (0).
      prisma.call.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

      await expect(service.endCall('ws_1', 'u_eve', 'call_1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.call.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('access', () => {
    it('answers 404 for a call the user may not see — transcript included', async () => {
      prisma.call.count.mockResolvedValue(0);

      await expect(service.getTranscript('ws_1', 'u_eve', 'call_1')).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.callTranscriptItem.findMany).not.toHaveBeenCalled();
    });

    it('scopes visibility to the workspace and the caller', async () => {
      await service.getTranscript('ws_1', 'u_ana', 'call_1');

      const where = prisma.call.count.mock.calls[0][0].where;
      expect(where).toMatchObject({ id: 'call_1', workspaceId: 'ws_1' });
      expect(where.OR).toEqual(
        expect.arrayContaining([
          { startedById: 'u_ana' },
          { participants: { some: { userId: 'u_ana' } } },
          { sharedWithUserIds: { has: 'u_ana' } },
        ]),
      );
    });

    it('will not assign an action item to someone outside the workspace', async () => {
      prisma.workspaceMember.findMany.mockResolvedValue([]);

      await expect(
        service.addActionItem('ws_1', 'call_1', 'u_ana', {
          title: 'Ship it',
          priority: 'MEDIUM',
          assigneeId: 'u_outsider',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.callActionItem.create).not.toHaveBeenCalled();
    });
  });

  describe('notes', () => {
    const noteRow = (content: string) => ({
      id: 'note_1',
      callId: 'call_1',
      workspaceId: 'ws_1',
      authorId: 'u_ana',
      content,
      createdAt: new Date(),
      updatedAt: new Date(),
      author: user('u_ana'),
    });

    it('autosaves into one running note per person', async () => {
      prisma.callNote.findFirst.mockResolvedValue({ id: 'note_1' });
      prisma.callNote.update.mockResolvedValue(noteRow('second draft'));

      const note = await service.upsertMyNote('ws_1', 'call_1', 'u_ana', {
        content: 'second draft',
      });

      expect(prisma.callNote.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'note_1' }, data: { content: 'second draft' } }),
      );
      expect(prisma.callNote.create).not.toHaveBeenCalled();
      expect(note.content).toBe('second draft');
    });

    it('creates the note on the first save', async () => {
      prisma.callNote.findFirst.mockResolvedValue(null);
      prisma.callNote.create.mockResolvedValue(noteRow('first'));

      await service.upsertMyNote('ws_1', 'call_1', 'u_ana', { content: 'first' });

      expect(prisma.callNote.create).toHaveBeenCalledTimes(1);
    });

    it("never lets one person edit another's note", async () => {
      prisma.callNote.findFirst.mockResolvedValue({ authorId: 'u_ana' });

      await expect(
        service.updateNote('ws_1', 'call_1', 'note_1', 'u_bo', { content: 'rewritten' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.callNote.update).not.toHaveBeenCalled();
    });
  });

  describe('startCall', () => {
    it('joins the live session both ends of the Matrix call report', async () => {
      prisma.call.findFirst.mockResolvedValue({
        id: 'call_1',
        matrixCallId: 'mx_1',
        startedById: 'u_ana',
      });

      await service.startCall('ws_1', 'u_bo', {
        conversationId: '!room:hs',
        matrixCallId: 'mx_1',
        title: 'Call with Ana',
        kind: 'AUDIO',
      });

      expect(prisma.callParticipant.upsert).toHaveBeenCalled();
      expect(prisma.call.create).not.toHaveBeenCalled();
    });

    it('closes an orphaned session instead of reusing it for a new call', async () => {
      prisma.call.findFirst
        .mockResolvedValueOnce({ id: 'call_old', matrixCallId: 'mx_old', startedById: 'u_ana' })
        .mockResolvedValueOnce(null);

      await service.startCall('ws_1', 'u_ana', {
        conversationId: '!room:hs',
        matrixCallId: 'mx_new',
        title: 'Call with Bo',
        kind: 'AUDIO',
      });

      expect(prisma.call.updateMany).toHaveBeenCalledWith({
        where: { id: 'call_old', status: 'ACTIVE' },
        data: { status: 'ENDED', endedAt: expect.any(Date) },
      });
      expect(prisma.call.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ matrixCallId: 'mx_new' }),
        }),
      );
    });

    it('refuses a private channel the caller is not in', async () => {
      prisma.channel.findFirst.mockResolvedValue({ id: 'ch_1', visibility: 'PRIVATE' });
      prisma.channelMember.count.mockResolvedValue(0);

      await expect(
        service.startCall('ws_1', 'u_eve', {
          conversationId: '!private:hs',
          title: 'Sneaky',
          kind: 'AUDIO',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.call.create).not.toHaveBeenCalled();
    });
  });
});
