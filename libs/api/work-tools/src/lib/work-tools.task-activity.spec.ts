import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { AppEvent } from '@org/api-common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkToolsService } from './work-tools.service.js';

const task = {
  id: 'task-1',
  workspaceId: 'ws-1',
  title: 'Old title',
  identifier: 'WEB-1',
  description: 'Old text',
  status: 'TODO',
  priority: 'MEDIUM',
  type: 'TASK',
  assigneeId: null,
  assigneeIds: [],
  labels: ['api'],
  estimate: null,
  timeSpent: 30,
  startDate: null,
  dueDate: null,
  teamId: null,
  epicId: null,
  cycleId: null,
  moduleId: null,
  parentId: null,
  customFields: {},
};

const comment = {
  id: 'comment-1',
  taskId: 'task-1',
  authorId: 'author',
  content: 'Hello',
  task: { workspaceId: 'ws-1' },
};

function setup() {
  const prisma = {
    task: {
      findFirst: vi.fn().mockResolvedValue(task),
      update: vi.fn(({ data }) => Promise.resolve({ ...task, ...data })),
    },
    taskComment: {
      findFirst: vi.fn().mockResolvedValue(comment),
      findUnique: vi.fn().mockResolvedValue(comment),
      update: vi.fn().mockResolvedValue({ ...comment, content: 'Edited' }),
      delete: vi.fn().mockResolvedValue(comment),
    },
    workItemActivity: { create: vi.fn().mockResolvedValue({}) },
    workspaceMember: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const events = { emit: vi.fn() };
  const service = new WorkToolsService(prisma as never, events as never);
  return { prisma, events, service };
}

describe('task comments', () => {
  let ctx: ReturnType<typeof setup>;
  beforeEach(() => {
    ctx = setup();
  });

  it('lets the author edit, and tells other clients to refetch', async () => {
    await ctx.service.updateTaskComment(
      'ws-1',
      'task-1',
      'comment-1',
      'author',
      { content: 'Edited' },
    );
    expect(ctx.prisma.taskComment.update).toHaveBeenCalled();
    expect(ctx.events.emit).toHaveBeenCalledWith(
      AppEvent.TaskCommentChanged,
      expect.objectContaining({ taskId: 'task-1', commentId: 'comment-1' }),
    );
  });

  it('refuses an edit from anyone else, admins included', async () => {
    await expect(
      ctx.service.updateTaskComment('ws-1', 'task-1', 'comment-1', 'admin', {
        content: 'Edited',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ctx.prisma.taskComment.update).not.toHaveBeenCalled();
  });

  it('does not find a comment through another task', async () => {
    ctx.prisma.taskComment.findFirst.mockResolvedValue(null);
    await expect(
      ctx.service.updateTaskComment('ws-1', 'task-2', 'comment-1', 'author', {
        content: 'Edited',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lets the author delete without the delete permission', async () => {
    await ctx.service.deleteTaskComment('ws-1', 'comment-1', 'author', false);
    expect(ctx.prisma.taskComment.delete).toHaveBeenCalled();
  });

  it('lets a moderator delete someone else’s comment', async () => {
    await ctx.service.deleteTaskComment('ws-1', 'comment-1', 'admin', true);
    expect(ctx.prisma.taskComment.delete).toHaveBeenCalled();
  });

  it('refuses a member deleting someone else’s comment', async () => {
    await expect(
      ctx.service.deleteTaskComment('ws-1', 'comment-1', 'member', false),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(ctx.prisma.taskComment.delete).not.toHaveBeenCalled();
  });

  it('hides a comment from another workspace', async () => {
    await expect(
      ctx.service.deleteTaskComment('ws-2', 'comment-1', 'author', true),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('task history', () => {
  const logged = (ctx: ReturnType<typeof setup>) =>
    ctx.prisma.workItemActivity.create.mock.calls.map(([arg]) => arg.data);

  it('writes changes to the columns, with metadata as an object', async () => {
    const ctx = setup();
    await ctx.service.updateTask(
      'ws-1',
      'task-1',
      { title: 'New title', timeSpent: 90 },
      'actor',
    );
    expect(logged(ctx)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: 'FIELD_CHANGED',
          fieldChanged: 'title',
          oldValue: 'Old title',
          newValue: 'New title',
          metadata: {},
        }),
        expect.objectContaining({
          fieldChanged: 'timeSpent',
          oldValue: '30',
          newValue: '90',
        }),
      ]),
    );
  });

  it('records that a description changed, not its text', async () => {
    const ctx = setup();
    await ctx.service.updateTask(
      'ws-1',
      'task-1',
      { description: 'New text' },
      'actor',
    );
    expect(logged(ctx)).toEqual([
      expect.objectContaining({
        fieldChanged: 'description',
        oldValue: null,
        newValue: null,
      }),
    ]);
  });

  it('skips fields that were sent but did not change', async () => {
    const ctx = setup();
    await ctx.service.updateTask(
      'ws-1',
      'task-1',
      { title: 'Old title', labels: ['api'] },
      'actor',
    );
    expect(logged(ctx)).toEqual([]);
  });
});
