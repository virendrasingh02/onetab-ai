import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AppEvent,
  PUBLIC_USER_SELECT,
  toUpload,
  type UploadUrls,
} from '@org/api-common';
import { PrismaService } from '@org/database';
import type {
  Upload,
  UploadContext,
  UploadContextType,
  UploadDestinations,
  UploadPage,
  UploadStorageUsage,
} from '@org/types';
import { getPlanLimit, isLimitReached, isNearLimit, normalizePlanTier } from '@org/types';
import type { UpdateUploadInput } from '@org/validation';
import { StorageService } from './storage.service.js';

/** 25 MB. Large enough for documents and screenshots, small enough to stream. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Files hub page size. */
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

/** Signed content URLs last this long — long enough for a page's lifetime. */
const SIGNED_URL_TTL_SECONDS = 3600;

const ALLOWED_MIME_EXACT = new Set<string>([
  'application/pdf',
  'application/json',
  'application/zip',
  'application/gzip',
  'application/x-tar',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/octet-stream',
]);
const ALLOWED_MIME_PREFIXES = ['image/', 'video/', 'audio/', 'text/'];

const BLOCKED_EXTENSIONS = new Set<string>([
  '.html', '.htm', '.xhtml', '.svg', '.xml', '.js', '.mjs', '.exe', '.dll',
  '.bat', '.cmd', '.com', '.msi', '.sh', '.bash', '.ps1', '.scr', '.vbs',
  '.jar', '.app', '.deb', '.rpm',
]);

function isAllowedUpload(filename: string, mimeType: string): boolean {
  const dot = filename.lastIndexOf('.');
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : '';
  if (ext && BLOCKED_EXTENSIONS.has(ext)) return false;

  const type = (mimeType || 'application/octet-stream').toLowerCase();
  if (type === 'image/svg+xml') return false;
  if (ALLOWED_MIME_EXACT.has(type)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => type.startsWith(prefix));
}

/** Strips any path component from a caller-supplied filename. */
function safeFilename(name: string): string {
  return name.replace(/[/\\]/g, '_').trim().slice(0, 255);
}

export interface IncomingFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const CONTEXT_TYPES: readonly UploadContextType[] = [
  'WORKSPACE',
  'CHANNEL',
  'DIRECT',
  'PROJECT',
  'AGENT',
  'APP',
  'DOCUMENT',
  'ISSUE',
];

export interface UploadContextInput {
  contextType?: string;
  contextId?: string;
  /** Legacy: equivalent to `contextType=CHANNEL, contextId=<channelId>`. */
  channelId?: string;
}

export interface UploadListQuery extends UploadContextInput {
  cursor?: string;
  limit?: number;
}

function looksLikeRoomId(value: string): boolean {
  return value.startsWith('!') || value.startsWith('#');
}

/** `<createdAtMs>_<id>` base64url — a stable keyset cursor over `createdAt desc, id desc`. */
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.getTime()}_${id}`).toString('base64url');
}
function decodeCursor(cursor: string): { ms: number; id: string } | null {
  try {
    const [ms, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('_');
    if (!ms || !id) return null;
    return { ms: Number(ms), id };
  } catch {
    return null;
  }
}

@Injectable()
export class UploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly events: EventEmitter2,
  ) {}

  /** Short-lived signed URLs so a plain `<img>`/`<a>` can reach the bytes. */
  private urlsFor(row: { id: string; mimeType: string }): UploadUrls {
    const content = `/files/${this.storage.signContentToken(row.id, {
      ttlSeconds: SIGNED_URL_TTL_SECONDS,
    })}`;
    const download = `/files/${this.storage.signContentToken(row.id, {
      ttlSeconds: SIGNED_URL_TTL_SECONDS,
      download: true,
    })}`;
    return {
      contentUrl: content,
      downloadUrl: download,
      thumbnailUrl: row.mimeType.startsWith('image/') ? content : null,
    };
  }

  private normaliseContext(input: UploadContextInput): {
    type: UploadContextType;
    id: string | null;
  } {
    if (input.channelId && !input.contextType) {
      return { type: 'CHANNEL', id: input.channelId };
    }

    const raw = (input.contextType ?? 'WORKSPACE').toUpperCase();
    if (!CONTEXT_TYPES.includes(raw as UploadContextType)) {
      throw new BadRequestException(`Unknown upload context "${input.contextType}".`);
    }
    const type = raw as UploadContextType;
    const id = (input.contextId ?? input.channelId ?? '').trim() || null;

    if (type !== 'WORKSPACE' && !id) {
      throw new BadRequestException(`A ${type.toLowerCase()} id is required.`);
    }
    return { type, id: type === 'WORKSPACE' ? null : id };
  }

  private async assertContextInWorkspace(
    workspaceId: string,
    type: UploadContextType,
    id: string | null,
  ): Promise<void> {
    if (type === 'WORKSPACE' || !id) return;

    const found = async (
      exists: Promise<{ id: string } | null>,
      label: string,
    ) => {
      if (!(await exists)) throw new NotFoundException(`${label} not found.`);
    };

    if (type === 'CHANNEL') {
      return found(
        this.prisma.channel.findFirst({ where: { id, workspaceId }, select: { id: true } }),
        'Channel',
      );
    }
    if (type === 'PROJECT') {
      return found(
        this.prisma.project.findFirst({
          where: { id, workspaceId, deletedAt: null },
          select: { id: true },
        }),
        'Project',
      );
    }
    if (type === 'AGENT') {
      return found(
        this.prisma.aIAgent.findFirst({ where: { id, workspaceId }, select: { id: true } }),
        'Agent',
      );
    }
    if (type === 'APP') {
      return found(
        this.prisma.externalIntegration.findFirst({
          where: { id, workspaceId },
          select: { id: true },
        }),
        'App',
      );
    }
    if (type === 'DOCUMENT') {
      return found(
        this.prisma.workDocument.findFirst({
          where: { id, workspaceId, deletedAt: null },
          select: { id: true },
        }),
        'Document',
      );
    }
    if (type === 'ISSUE') {
      return found(
        this.prisma.task.findFirst({
          where: { id, workspaceId, deletedAt: null },
          select: { id: true },
        }),
        'Issue',
      );
    }
    if (looksLikeRoomId(id)) return;
    const member = await this.prisma.workspaceMember.findFirst({
      where: { workspaceId, userId: id },
      select: { id: true },
    });
    if (!member) throw new NotFoundException('Conversation partner not found.');
  }

  /** One page of the Files hub — current versions only, newest first, keyset-paginated. */
  async list(workspaceId: string, query: UploadListQuery = {}): Promise<UploadPage> {
    const limit = Math.min(
      Math.max(1, query.limit ?? DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    );

    const hasContextFilter =
      !!query.channelId || !!query.contextType || !!query.contextId;
    const context = hasContextFilter ? this.normaliseContext(query) : null;
    const keyset = query.cursor ? decodeCursor(query.cursor) : null;

    const rows = await this.prisma.upload.findMany({
      where: {
        workspaceId,
        isCurrent: true,
        ...(query.channelId ? { channelId: query.channelId } : {}),
        ...(context && context.type !== 'WORKSPACE'
          ? { contextType: context.type }
          : context?.type === 'WORKSPACE'
            ? { contextType: 'WORKSPACE' }
            : {}),
        ...(context?.id ? { contextId: context.id } : {}),
        ...(keyset
          ? {
              OR: [
                { createdAt: { lt: new Date(keyset.ms) } },
                { createdAt: new Date(keyset.ms), id: { lt: keyset.id } },
              ],
            }
          : {}),
      },
      include: { uploader: { select: PUBLIC_USER_SELECT } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const contexts = await this.resolveContexts(workspaceId, page);
    const last = page[page.length - 1];

    return {
      items: page.map((row) =>
        toUpload(
          row,
          contexts.get(`${row.contextType}:${row.contextId ?? ''}`) ?? null,
          this.urlsFor(row),
        ),
      ),
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  private async resolveContexts(
    workspaceId: string,
    rows: { contextType: UploadContextType; contextId: string | null }[],
  ): Promise<Map<string, UploadContext>> {
    const idsByType = new Map<UploadContextType, Set<string>>();
    for (const row of rows) {
      if (row.contextType === 'WORKSPACE' || !row.contextId) continue;
      const set = idsByType.get(row.contextType) ?? new Set<string>();
      set.add(row.contextId);
      idsByType.set(row.contextType, set);
    }

    const out = new Map<string, UploadContext>();
    const put = (
      type: UploadContextType,
      id: string,
      label: string | null,
      slug: string | null = null,
      parentId: string | null = null,
    ) => out.set(`${type}:${id}`, { type, id, label, slug, parentId });
    const idsFor = (type: UploadContextType) => [...(idsByType.get(type) ?? [])];

    const channelIds = idsFor('CHANNEL');
    if (channelIds.length) {
      const hits = await this.prisma.channel.findMany({
        where: { id: { in: channelIds }, workspaceId },
        select: { id: true, name: true, slug: true },
      });
      for (const c of hits) put('CHANNEL', c.id, c.name, c.slug);
    }

    const projectIds = idsFor('PROJECT');
    if (projectIds.length) {
      const hits = await this.prisma.project.findMany({
        where: { id: { in: projectIds }, workspaceId },
        select: { id: true, name: true, slug: true },
      });
      for (const p of hits) put('PROJECT', p.id, p.name, p.slug);
    }

    const agentIds = idsFor('AGENT');
    if (agentIds.length) {
      const hits = await this.prisma.aIAgent.findMany({
        where: { id: { in: agentIds }, workspaceId },
        select: { id: true, name: true },
      });
      for (const a of hits) put('AGENT', a.id, a.name);
    }

    const appIds = idsFor('APP');
    if (appIds.length) {
      const hits = await this.prisma.externalIntegration.findMany({
        where: { id: { in: appIds }, workspaceId },
        select: { id: true, displayName: true, provider: true },
      });
      for (const a of hits) put('APP', a.id, a.displayName ?? a.provider);
    }

    const docIds = idsFor('DOCUMENT');
    if (docIds.length) {
      const hits = await this.prisma.workDocument.findMany({
        where: { id: { in: docIds }, workspaceId },
        select: { id: true, title: true },
      });
      for (const d of hits) put('DOCUMENT', d.id, d.title);
    }

    const issueIds = idsFor('ISSUE');
    if (issueIds.length) {
      const hits = await this.prisma.task.findMany({
        where: { id: { in: issueIds }, workspaceId },
        select: { id: true, title: true, identifier: true, projectId: true },
      });
      for (const t of hits) {
        put('ISSUE', t.id, t.identifier ? `${t.identifier} ${t.title}` : t.title, null, t.projectId);
      }
    }

    const directIds = idsFor('DIRECT');
    const peerIds = directIds.filter((id) => !looksLikeRoomId(id));
    if (peerIds.length) {
      const hits = await this.prisma.user.findMany({
        where: { id: { in: peerIds } },
        select: { id: true, name: true, displayName: true },
      });
      for (const u of hits) put('DIRECT', u.id, u.displayName ?? u.name);
    }

    for (const [type, set] of idsByType) {
      for (const id of set) if (!out.has(`${type}:${id}`)) put(type, id, null);
    }

    return out;
  }

  async create(
    workspaceId: string,
    uploaderId: string,
    file: IncomingFile,
    contextInput: UploadContextInput = {},
  ): Promise<Upload> {
    this.assertUploadable(file);

    const usage = await this.storageUsage(workspaceId);
    if (isLimitReached(usage.usedBytes + file.size, usage.limitBytes)) {
      throw new PayloadTooLargeException(
        `This workspace has reached its ${usage.planTier} storage limit. Upgrade the plan or remove files to free space.`,
      );
    }

    const { type, id } = this.normaliseContext(contextInput);
    await this.assertContextInWorkspace(workspaceId, type, id);

    const key = this.storage.buildKey(workspaceId, file.originalname);
    const stored = await this.storage.put(key, file.buffer);

    const row = await this.prisma.upload.create({
      data: {
        workspaceId,
        uploaderId,
        contextType: type,
        contextId: id,
        channelId: type === 'CHANNEL' ? id : null,
        projectId: type === 'PROJECT' ? id : null,
        filename: safeFilename(file.originalname),
        mimeType: file.mimetype || 'application/octet-stream',
        size: stored.size,
        storageKey: stored.key,
        checksum: stored.checksum,
      },
      include: { uploader: { select: PUBLIC_USER_SELECT } },
    });

    this.emitShared(workspaceId, uploaderId, row, false);

    const contexts = await this.resolveContexts(workspaceId, [row]);
    return toUpload(
      row,
      contexts.get(`${type}:${id ?? ''}`) ?? null,
      this.urlsFor(row),
    );
  }

  /**
   * Replaces a file's content with a new version. The old row (and its bytes)
   * are kept and linked via `supersedesId`; the new row inherits the context,
   * filename and uploader-facing identity.
   */
  async replaceVersion(
    workspaceId: string,
    uploadId: string,
    uploaderId: string,
    file: IncomingFile,
  ): Promise<Upload> {
    this.assertUploadable(file);

    const current = await this.prisma.upload.findFirst({
      where: { id: uploadId, workspaceId, isCurrent: true },
    });
    if (!current) throw new NotFoundException('File not found.');

    const usage = await this.storageUsage(workspaceId);
    if (isLimitReached(usage.usedBytes + file.size, usage.limitBytes)) {
      throw new PayloadTooLargeException(
        `This workspace has reached its ${usage.planTier} storage limit.`,
      );
    }

    const key = this.storage.buildKey(workspaceId, file.originalname);
    const stored = await this.storage.put(key, file.buffer);

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.upload.update({
        where: { id: current.id },
        data: { isCurrent: false },
      });
      return tx.upload.create({
        data: {
          workspaceId,
          uploaderId,
          contextType: current.contextType,
          contextId: current.contextId,
          channelId: current.channelId,
          projectId: current.projectId,
          filename: current.filename,
          mimeType: file.mimetype || current.mimeType,
          size: stored.size,
          storageKey: stored.key,
          checksum: stored.checksum,
          version: current.version + 1,
          supersedesId: current.id,
        },
        include: { uploader: { select: PUBLIC_USER_SELECT } },
      });
    });

    this.emitShared(workspaceId, uploaderId, row, true);

    const contexts = await this.resolveContexts(workspaceId, [row]);
    return toUpload(
      row,
      contexts.get(`${row.contextType}:${row.contextId ?? ''}`) ?? null,
      this.urlsFor(row),
    );
  }

  /** The version chain for a file, newest first. */
  async listVersions(workspaceId: string, uploadId: string): Promise<Upload[]> {
    const head = await this.prisma.upload.findFirst({
      where: { id: uploadId, workspaceId },
      select: { id: true, supersedesId: true },
    });
    if (!head) throw new NotFoundException('File not found.');

    const chain: NonNullable<Awaited<ReturnType<typeof this.loadRow>>>[] = [];
    let cursor: string | null = head.id;
    // Bounded walk — a file will not have thousands of versions, and the guard
    // stops a corrupt cycle from spinning forever.
    for (let i = 0; cursor && i < 200; i += 1) {
      const row = await this.loadRow(cursor);
      if (!row) break;
      chain.push(row);
      cursor = row.supersedesId;
    }

    return chain.map((row) => toUpload(row, null, this.urlsFor(row)));
  }

  private loadRow(id: string) {
    return this.prisma.upload.findUnique({
      where: { id },
      include: { uploader: { select: PUBLIC_USER_SELECT } },
    });
  }

  /** Rename (`filename`) and/or move (`contextType`/`contextId`) a file. */
  async update(
    workspaceId: string,
    uploadId: string,
    patch: UpdateUploadInput,
  ): Promise<Upload> {
    const existing = await this.prisma.upload.findFirst({
      where: { id: uploadId, workspaceId },
      select: { id: true, contextType: true, contextId: true },
    });
    if (!existing) throw new NotFoundException('File not found.');

    const data: Record<string, unknown> = {};

    if (patch.filename !== undefined) {
      const name = safeFilename(patch.filename);
      if (!name) throw new BadRequestException('The file name cannot be empty.');
      data['filename'] = name;
    }

    if (patch.contextType !== undefined || patch.contextId !== undefined) {
      const { type, id } = this.normaliseContext({
        contextType: patch.contextType ?? existing.contextType,
        contextId:
          patch.contextId === null
            ? undefined
            : (patch.contextId ?? existing.contextId ?? undefined),
      });
      await this.assertContextInWorkspace(workspaceId, type, id);
      data['contextType'] = type;
      data['contextId'] = id;
      data['channelId'] = type === 'CHANNEL' ? id : null;
      data['projectId'] = type === 'PROJECT' ? id : null;
    }

    const row = await this.prisma.upload.update({
      where: { id: existing.id },
      data,
      include: { uploader: { select: PUBLIC_USER_SELECT } },
    });

    const contexts = await this.resolveContexts(workspaceId, [row]);
    return toUpload(
      row,
      contexts.get(`${row.contextType}:${row.contextId ?? ''}`) ?? null,
      this.urlsFor(row),
    );
  }

  async listDestinations(workspaceId: string): Promise<UploadDestinations> {
    const [channels, projects, agents, apps, members] = await Promise.all([
      this.prisma.channel.findMany({
        where: { workspaceId, isArchived: false },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.project.findMany({
        where: { workspaceId, deletedAt: null },
        select: { id: true, name: true, slug: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.aIAgent.findMany({
        where: { workspaceId, isActive: true },
        select: { id: true, name: true, avatarUrl: true },
        orderBy: { name: 'asc' },
      }),
      this.prisma.externalIntegration.findMany({
        where: { workspaceId, status: 'CONNECTED' },
        select: { id: true, displayName: true, provider: true },
        orderBy: { provider: 'asc' },
      }),
      this.prisma.workspaceMember.findMany({
        where: { workspaceId, status: 'ACTIVE' },
        select: {
          user: {
            select: { id: true, name: true, displayName: true, avatarUrl: true },
          },
        },
      }),
    ]);

    return {
      channels: channels.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
      projects: projects.map((p) => ({ id: p.id, name: p.name, slug: p.slug })),
      agents: agents.map((a) => ({ id: a.id, name: a.name, avatarUrl: a.avatarUrl })),
      apps: apps.map((a) => ({ id: a.id, name: a.displayName ?? a.provider })),
      people: members
        .map((m) => ({
          id: m.user.id,
          name: m.user.displayName ?? m.user.name,
          avatarUrl: m.user.avatarUrl,
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /** Workspace storage consumption + the current plan's cap. */
  async storageUsage(workspaceId: string): Promise<UploadStorageUsage> {
    const [agg, subscription] = await Promise.all([
      this.prisma.upload.aggregate({
        where: { workspaceId },
        _sum: { size: true },
        _count: true,
      }),
      this.prisma.workspaceSubscription.findUnique({
        where: { workspaceId },
        select: { planTier: true },
      }),
    ]);

    const planTier = normalizePlanTier(subscription?.planTier);
    const usedBytes = agg._sum.size ?? 0;
    const limitBytes = getPlanLimit(planTier, 'storage_bytes');

    return {
      usedBytes,
      limitBytes,
      fileCount: agg._count,
      planTier,
      nearLimit: isNearLimit(usedBytes, limitBytes, 90),
    };
  }

  /** The row plus its bytes, for the download route. */
  async read(
    workspaceId: string | null,
    uploadId: string,
  ): Promise<{ filename: string; mimeType: string; content: Buffer }> {
    const row = await this.prisma.upload.findFirst({
      where: workspaceId ? { id: uploadId, workspaceId } : { id: uploadId },
    });
    if (!row) throw new NotFoundException('File not found.');

    if (!(await this.storage.exists(row.storageKey))) {
      throw new NotFoundException('The stored file is no longer available.');
    }

    return {
      filename: row.filename,
      mimeType: row.mimeType,
      content: await this.storage.get(row.storageKey),
    };
  }

  /** Resolves a signed content token to the file, for the public route. */
  async readByToken(
    token: string,
  ): Promise<{ filename: string; mimeType: string; content: Buffer; download: boolean }> {
    const verified = this.storage.verifyContentToken(token);
    if (!verified) throw new NotFoundException('This link is invalid or has expired.');
    const file = await this.read(null, verified.uploadId);
    return { ...file, download: verified.download };
  }

  /** Deletes a file and every older version behind it — rows and bytes. */
  async remove(workspaceId: string, uploadId: string): Promise<void> {
    const head = await this.prisma.upload.findFirst({
      where: { id: uploadId, workspaceId },
      select: { id: true, storageKey: true, supersedesId: true },
    });
    if (!head) throw new NotFoundException('File not found.');

    const keys: string[] = [head.storageKey];
    const ids: string[] = [head.id];
    let cursor = head.supersedesId;
    for (let i = 0; cursor && i < 200; i += 1) {
      const prev: { id: string; storageKey: string; supersedesId: string | null } | null =
        await this.prisma.upload.findUnique({
          where: { id: cursor },
          select: { id: true, storageKey: true, supersedesId: true },
        });
      if (!prev) break;
      keys.push(prev.storageKey);
      ids.push(prev.id);
      cursor = prev.supersedesId;
    }

    await this.prisma.upload.deleteMany({ where: { id: { in: ids } } });
    await Promise.all(keys.map((key) => this.storage.delete(key)));
  }

  private assertUploadable(file: IncomingFile): void {
    if (!file?.buffer?.byteLength) {
      throw new BadRequestException('The uploaded file is empty.');
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
        `Files must be ${MAX_UPLOAD_BYTES / (1024 * 1024)} MB or smaller.`,
      );
    }
    if (!isAllowedUpload(file.originalname, file.mimetype)) {
      throw new BadRequestException(
        'That file type is not allowed. Executables and inline-script files (.html, .svg, .js) are rejected.',
      );
    }
  }

  private emitShared(
    workspaceId: string,
    actorId: string,
    row: {
      id: string;
      filename: string;
      contextType: UploadContextType;
      contextId: string | null;
      channelId: string | null;
    },
    isNewVersion: boolean,
  ): void {
    this.events.emit(AppEvent.FileShared, {
      workspaceId,
      actorId,
      uploadId: row.id,
      filename: row.filename,
      contextType: row.contextType,
      contextId: row.contextId,
      channelId: row.channelId,
      isNewVersion,
    });
  }
}
