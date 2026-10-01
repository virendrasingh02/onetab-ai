import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService, type Prisma } from '@org/database';
import {
  AIEntitiesService,
  TrackerMonitorSweepService,
  buildTrackerMonitor,
  classifyMonitor,
} from '@org/api-agents';
import { AppEvent } from '@org/api-common';
import type { CoworkerPermissions, CoworkerStatus, TrackerMonitor } from '@org/types';
import type { CreateTrackerMonitorInput, UpdateTrackerMonitorInput } from '@org/validation';

@Injectable()
export class CoworkersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitiesService: AIEntitiesService,
    private readonly events: EventEmitter2,
    private readonly monitorSweep: TrackerMonitorSweepService,
  ) {}

  async initializeDefaultCoworkers(workspaceId: string, creatorId?: string): Promise<void> {
    return this.entitiesService.initializeDefaultCoworkers(workspaceId, creatorId);
  }

  async getCoworkers(workspaceId: string) {
    return this.entitiesService.getEntities(workspaceId, 'coworker');
  }

  async getCoworker(workspaceId: string, coworkerId: string) {
    return this.entitiesService.getEntity(workspaceId, coworkerId);
  }

  async createCoworker(
    workspaceId: string,
    creatorId: string,
    data: {
      name: string;
      role?: string;
      description?: string;
      avatarUrl?: string | null;
      personality?: string;
      welcomeMessage?: string;
      systemInstructions?: string;
      provider?: string;
      model?: string;
      permissions?: CoworkerPermissions;
      configuration?: Record<string, unknown>;
      agentIds?: string[];
      integrationIds?: string[];
    },
  ) {
    return this.entitiesService.createEntity(workspaceId, creatorId, {
      ...data,
      type: 'coworker',
    });
  }

  async updateCoworker(
    workspaceId: string,
    coworkerId: string,
    data: {
      name?: string;
      role?: string;
      description?: string;
      avatarUrl?: string | null;
      personality?: string;
      welcomeMessage?: string;
      systemInstructions?: string;
      provider?: string;
      model?: string;
      isActive?: boolean;
      status?: CoworkerStatus;
      permissions?: CoworkerPermissions;
      configuration?: Record<string, unknown>;
    },
  ) {
    return this.entitiesService.updateEntity(workspaceId, coworkerId, data);
  }

  async deleteCoworker(workspaceId: string, coworkerId: string): Promise<void> {
    return this.entitiesService.deleteEntity(workspaceId, coworkerId);
  }

  async setStatus(coworkerId: string, status: CoworkerStatus): Promise<void> {
    await this.prisma.aIAgent.update({
      where: { id: coworkerId },
      data: { status, lastActiveAt: new Date() },
    });
  }

  async linkAgent(workspaceId: string, coworkerId: string, agentId: string) {
    return this.entitiesService.linkAgent(workspaceId, coworkerId, agentId);
  }

  async unlinkAgent(workspaceId: string, coworkerId: string, agentId: string) {
    return this.entitiesService.unlinkAgent(workspaceId, coworkerId, agentId);
  }

  async linkApp(workspaceId: string, coworkerId: string, integrationId: string) {
    return this.entitiesService.linkApp(workspaceId, coworkerId, integrationId);
  }

  async unlinkApp(workspaceId: string, coworkerId: string, integrationId: string) {
    return this.entitiesService.unlinkApp(workspaceId, coworkerId, integrationId);
  }

  async getExecutionLogs(workspaceId: string, coworkerId: string) {
    return this.entitiesService.getEntityLogs(workspaceId, coworkerId);
  }

  async getWorkspaceLogs(workspaceId: string) {
    return this.entitiesService.getWorkspaceLogs(workspaceId, 'coworker');
  }

  // -------------------------------------------------------------------------
  // Channel links
  // -------------------------------------------------------------------------

  async listChannelCoworkers(workspaceId: string, channelId: string) {
    await this.assertChannel(workspaceId, channelId);
    const rows = await this.prisma.channelCoworker.findMany({
      where: { channelId },
      include: {
        coworker: {
          select: {
            id: true,
            name: true,
            role: true,
            description: true,
            avatarUrl: true,
            personality: true,
            status: true,
            model: true,
            provider: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      channelId: r.channelId,
      coworkerId: r.coworkerId,
      isEnabled: r.isEnabled,
      addedById: r.addedById,
      createdAt: r.createdAt.toISOString(),
      coworker: r.coworker,
    }));
  }

  async addChannelCoworker(
    workspaceId: string,
    channelId: string,
    coworkerId: string,
    addedById?: string,
  ) {
    await this.assertChannel(workspaceId, channelId);
    await this.entitiesService.getEntity(workspaceId, coworkerId);

    // Checked before the upsert so a re-add of an already-enabled link never
    // posts a duplicate `coworker_added` system event (brief §30).
    const existing = await this.prisma.channelCoworker.findUnique({
      where: { channelId_coworkerId: { channelId, coworkerId } },
      select: { isEnabled: true },
    });

    await this.prisma.channelCoworker.upsert({
      where: { channelId_coworkerId: { channelId, coworkerId } },
      create: { channelId, coworkerId, addedById: addedById ?? null },
      update: { isEnabled: true },
    });

    if (!existing) {
      this.events.emit(AppEvent.ChannelAiEntityLinked, {
        workspaceId,
        actorId: addedById ?? null,
        channelId,
        entityId: coworkerId,
        entityType: 'coworker',
      });
    } else if (!existing.isEnabled) {
      this.events.emit(AppEvent.ChannelAiEntityEnabledChanged, {
        workspaceId,
        actorId: addedById ?? null,
        channelId,
        entityId: coworkerId,
        entityType: 'coworker',
        isEnabled: true,
      });
    }

    const list = await this.listChannelCoworkers(workspaceId, channelId);
    const found = list.find((c) => c.coworkerId === coworkerId);
    if (!found) throw new NotFoundException('Failed to add channel coworker');
    return found;
  }

  async setChannelCoworkerEnabled(
    workspaceId: string,
    channelId: string,
    coworkerId: string,
    isEnabled: boolean,
    actorId?: string,
  ) {
    await this.assertChannel(workspaceId, channelId);
    const link = await this.prisma.channelCoworker.findUnique({
      where: { channelId_coworkerId: { channelId, coworkerId } },
      select: { id: true, isEnabled: true },
    });
    if (!link) throw new NotFoundException('Coworker is not linked to this channel.');
    await this.prisma.channelCoworker.update({
      where: { id: link.id },
      data: { isEnabled },
    });

    if (link.isEnabled !== isEnabled) {
      this.events.emit(AppEvent.ChannelAiEntityEnabledChanged, {
        workspaceId,
        actorId: actorId ?? null,
        channelId,
        entityId: coworkerId,
        entityType: 'coworker',
        isEnabled,
      });
    }

    const list = await this.listChannelCoworkers(workspaceId, channelId);
    const found = list.find((c) => c.coworkerId === coworkerId);
    if (!found) throw new NotFoundException('Channel coworker not found');
    return found;
  }

  async removeChannelCoworker(
    workspaceId: string,
    channelId: string,
    coworkerId: string,
    actorId?: string,
  ): Promise<void> {
    await this.assertChannel(workspaceId, channelId);
    const { count } = await this.prisma.channelCoworker.deleteMany({
      where: { channelId, coworkerId },
    });

    if (count > 0) {
      this.events.emit(AppEvent.ChannelAiEntityUnlinked, {
        workspaceId,
        actorId: actorId ?? null,
        channelId,
        entityId: coworkerId,
        entityType: 'coworker',
      });
    }
  }

  // -------------------------------------------------------------------------
  // Project links
  // -------------------------------------------------------------------------

  async listProjectCoworkers(workspaceId: string, projectId: string) {
    await this.assertProject(workspaceId, projectId);
    const rows = await this.prisma.projectCoworker.findMany({
      where: { projectId },
      include: {
        coworker: {
          select: {
            id: true,
            name: true,
            role: true,
            description: true,
            avatarUrl: true,
            personality: true,
            status: true,
            model: true,
            provider: true,
            isActive: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      projectId: r.projectId,
      coworkerId: r.coworkerId,
      addedById: r.addedById,
      createdAt: r.createdAt.toISOString(),
      coworker: r.coworker,
    }));
  }

  async addProjectCoworker(
    workspaceId: string,
    projectId: string,
    coworkerId: string,
    addedById?: string,
  ) {
    await this.assertProject(workspaceId, projectId);
    await this.entitiesService.getEntity(workspaceId, coworkerId);
    await this.prisma.projectCoworker.upsert({
      where: { projectId_coworkerId: { projectId, coworkerId } },
      create: { projectId, coworkerId, addedById: addedById ?? null },
      update: {},
    });
    const list = await this.listProjectCoworkers(workspaceId, projectId);
    const found = list.find((c) => c.coworkerId === coworkerId);
    if (!found) throw new NotFoundException('Failed to add project coworker');
    return found;
  }

  async removeProjectCoworker(
    workspaceId: string,
    projectId: string,
    coworkerId: string,
  ): Promise<void> {
    await this.assertProject(workspaceId, projectId);
    await this.prisma.projectCoworker.deleteMany({
      where: { projectId, coworkerId },
    });
  }

  private async assertChannel(workspaceId: string, channelId: string) {
    const found = await this.prisma.channel.findFirst({
      where: { id: channelId, workspaceId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Channel not found.');
  }

  private async assertProject(workspaceId: string, projectId: string) {
    const found = await this.prisma.project.findFirst({
      where: { id: projectId, workspaceId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Project not found.');
  }

  // -------------------------------------------------------------------------
  // Tracker Monitors — checked on schedule by `TrackerMonitorSweepService`
  // -------------------------------------------------------------------------

  private async monitorHost(workspaceId: string, coworkerId: string) {
    const coworker = await this.prisma.aIAgent.findFirst({
      where: { id: coworkerId, workspaceId, type: 'coworker' },
      select: { id: true, configuration: true },
    });
    if (!coworker) throw new NotFoundException('Coworker not found');
    const config = (coworker.configuration ?? {}) as Record<string, unknown>;
    const monitors: TrackerMonitor[] = Array.isArray(config['monitors'])
      ? [...(config['monitors'] as TrackerMonitor[])]
      : [];
    return { coworker, config, monitors };
  }

  private async saveMonitors(coworkerId: string, config: Record<string, unknown>, monitors: TrackerMonitor[]) {
    await this.prisma.aIAgent.update({
      where: { id: coworkerId },
      data: { configuration: { ...config, monitors } as unknown as Prisma.InputJsonValue },
    });
  }

  private assertCheckable(monitor: Pick<TrackerMonitor, 'type' | 'condition'>) {
    if (classifyMonitor(monitor) === 'unsupported') {
      throw new BadRequestException(
        `Tracker can't check “${monitor.condition}” automatically. Use overdue, due soon, completed, status changes or a progress summary.`,
      );
    }
  }

  async listMonitors(workspaceId: string, coworkerId: string): Promise<TrackerMonitor[]> {
    return (await this.monitorHost(workspaceId, coworkerId)).monitors;
  }

  async createMonitor(
    workspaceId: string,
    coworkerId: string,
    createdBy: string,
    input: CreateTrackerMonitorInput,
  ): Promise<TrackerMonitor> {
    const { coworker, config, monitors } = await this.monitorHost(workspaceId, coworkerId);
    const monitor = buildTrackerMonitor(input, { workspaceId, coworkerId, createdBy });
    this.assertCheckable(monitor);
    await this.saveMonitors(coworker.id, config, [...monitors, monitor]);
    return monitor;
  }

  async updateMonitor(
    workspaceId: string,
    coworkerId: string,
    monitorId: string,
    input: UpdateTrackerMonitorInput,
  ): Promise<TrackerMonitor> {
    const { coworker, config, monitors } = await this.monitorHost(workspaceId, coworkerId);
    const idx = monitors.findIndex((m) => m.id === monitorId);
    if (idx === -1) throw new NotFoundException('Monitor not found');
    const current = monitors[idx];
    const updated: TrackerMonitor = {
      ...current,
      ...input,
      id: current.id,
      workspaceId,
      coworkerId,
    };
    this.assertCheckable(updated);
    // A changed question starts over: the next check reports everything matching.
    if (
      (input.condition !== undefined && input.condition !== current.condition) ||
      (input.target !== undefined && input.target !== current.target)
    ) {
      updated.lastCheckedAt = null;
      updated.lastResult = null;
      updated.lastError = null;
    }
    monitors[idx] = updated;
    await this.saveMonitors(coworker.id, config, monitors);
    return updated;
  }

  async deleteMonitor(workspaceId: string, coworkerId: string, monitorId: string): Promise<void> {
    const { coworker, config, monitors } = await this.monitorHost(workspaceId, coworkerId);
    await this.saveMonitors(
      coworker.id,
      config,
      monitors.filter((m) => m.id !== monitorId),
    );
  }

  async checkMonitorNow(workspaceId: string, coworkerId: string, monitorId: string): Promise<TrackerMonitor> {
    const checked = await this.monitorSweep.checkNow(workspaceId, coworkerId, monitorId);
    if (!checked) throw new NotFoundException('Monitor not found');
    return checked;
  }

  // -------------------------------------------------------------------------
  // Scheduler Schedules
  // -------------------------------------------------------------------------

  async listSchedules(workspaceId: string, coworkerId: string) {
    const coworker = await this.prisma.aIAgent.findFirst({
      where: { id: coworkerId, workspaceId },
      include: { schedules: true },
    });
    if (!coworker) throw new NotFoundException('Coworker not found');
    return coworker.schedules;
  }

  async createSchedule(
    workspaceId: string,
    coworkerId: string,
    data: { cronExpression: string; description?: string },
  ) {
    return this.entitiesService.createSchedule(workspaceId, coworkerId, data);
  }

  async updateSchedule(
    workspaceId: string,
    coworkerId: string,
    scheduleId: string,
    data: { cronExpression?: string; description?: string; isActive?: boolean },
  ) {
    return this.entitiesService.updateSchedule(workspaceId, coworkerId, scheduleId, data);
  }

  async deleteSchedule(workspaceId: string, coworkerId: string, scheduleId: string) {
    return this.entitiesService.deleteSchedule(workspaceId, coworkerId, scheduleId);
  }
}
