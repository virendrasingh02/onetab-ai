import { describe, expect, it } from 'vitest';
import {
  buildTrackerMonitor,
  classifyMonitor,
  isMonitorDue,
  isWholeWorkspaceTarget,
  monitorIntervalMinutes,
  parseMonitorDestinations,
} from './tracker-monitors.js';

const ids = { workspaceId: 'ws-1', coworkerId: 'tracker-1', createdBy: 'user-1' };

describe('classifyMonitor', () => {
  it.each([
    ['becomes overdue', 'overdue'],
    ['anything past due', 'overdue'],
    ['due soon', 'due_soon'],
    ['tasks approaching their deadline', 'due_soon'],
    ['when tasks are completed', 'completed'],
    ['status changes', 'changed'],
    ['weekly progress summary', 'project_progress'],
  ])('reads “%s” as %s', (condition, check) => {
    expect(classifyMonitor({ type: 'task', condition })).toBe(check);
  });

  it('falls back on the monitor type', () => {
    expect(classifyMonitor({ type: 'deadline', condition: 'watch it' })).toBe('overdue');
    expect(classifyMonitor({ type: 'project', condition: 'watch it' })).toBe('project_progress');
  });

  it('says unsupported instead of guessing', () => {
    expect(classifyMonitor({ type: 'metric', condition: 'revenue goes up' })).toBe('unsupported');
  });

  it('does not read "latest" as late', () => {
    expect(classifyMonitor({ type: 'metric', condition: 'the latest numbers' })).toBe('unsupported');
  });
});

describe('scheduling', () => {
  it('maps frequency words to intervals, explicit minutes first', () => {
    expect(monitorIntervalMinutes({ frequency: 'realtime' })).toBe(5);
    expect(monitorIntervalMinutes({ frequency: 'daily' })).toBe(1_440);
    expect(monitorIntervalMinutes({ frequency: 'daily', intervalMinutes: 30 })).toBe(30);
    expect(monitorIntervalMinutes({ frequency: 'whenever' })).toBe(60);
  });

  it('is due when never checked, or when its interval has passed', () => {
    const now = new Date('2026-10-01T12:00:00Z');
    const monitor = buildTrackerMonitor({ condition: 'overdue', frequency: 'hourly' }, ids, now);
    expect(isMonitorDue(monitor, now)).toBe(true);
    expect(isMonitorDue({ ...monitor, lastCheckedAt: '2026-10-01T11:30:00Z' }, now)).toBe(false);
    expect(isMonitorDue({ ...monitor, lastCheckedAt: '2026-10-01T11:00:00Z' }, now)).toBe(true);
    expect(isMonitorDue({ ...monitor, enabled: false }, now)).toBe(false);
  });
});

describe('buildTrackerMonitor', () => {
  it('fills sensible defaults and starts unchecked', () => {
    const m = buildTrackerMonitor({ type: 'bogus', condition: '' }, ids);
    expect(m.type).toBe('task');
    expect(m.target).toBe('All tasks');
    expect(m.condition).toBe('becomes overdue');
    expect(m.destinations).toEqual(['me']);
    expect(m.lastCheckedAt).toBeNull();
    expect(m.createdBy).toBe('user-1');
  });
});

describe('targets and destinations', () => {
  it('knows the whole-workspace targets', () => {
    expect(isWholeWorkspaceTarget('All tasks')).toBe(true);
    expect(isWholeWorkspaceTarget('')).toBe(true);
    expect(isWholeWorkspaceTarget('Product Launch')).toBe(false);
  });

  it('parses owner, assignees and channels', () => {
    expect(parseMonitorDestinations(['me', 'assignees', '#launch'])).toEqual({
      owner: true,
      assignees: true,
      channels: ['launch'],
    });
    expect(parseMonitorDestinations([])).toEqual({ owner: true, assignees: false, channels: [] });
    expect(parseMonitorDestinations(['team'])).toEqual({ owner: false, assignees: true, channels: [] });
  });
});
