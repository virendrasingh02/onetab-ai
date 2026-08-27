import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PUBLIC_USER_SELECT, toUpload } from '@org/api-common';
import { PrismaService } from '@org/database';
import type { Upload } from '@org/types';
import { StorageService } from './storage.service.js';

/** 25 MB. Large enough for documents and screenshots, small enough to stream. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/**
 * What a workspace file is allowed to be.
 *
 * The browser-supplied `mimetype` is not trustworthy on its own, but combined
 * with `Content-Disposition: attachment` + `nosniff` on the download route it
 * is enough to keep executables and inline-script types (`.html`, `.svg`,
 * `.xhtml`) out of storage (audit S12). Deep magic-byte sniffing and an async
 * malware scan are still to come — tracked as Tier 2.
 */
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

/** Extensions refused regardless of the declared MIME type. */
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
  // `image/svg+xml` is script-capable — keep it out even though it is `image/`.
  if (type === 'image/svg+xml') return false;
  if (ALLOWED_MIME_EXACT.has(type)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => type.startsWith(prefix));
}

export interface IncomingFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

@Injectable()
export class UploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(workspaceId: string, channelId?: string): Promise<Upload[]> {
    const rows = await this.prisma.upload.findMany({
      where: { workspaceId, ...(channelId ? { channelId } : {}) },
      include: { uploader: { select: PUBLIC_USER_SELECT } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toUpload);
  }

  /**
   * Writes the bytes, then records the row.
   *
   * In that order on purpose: a row pointing at bytes that were never written
   * is a broken download, whereas bytes with no row are only wasted disk that
   * nothing links to.
   */
  async create(
    workspaceId: string,
    uploaderId: string,
    file: IncomingFile,
    channelId?: string,
  ): Promise<Upload> {
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

    // A channel from another workspace would file the upload out of tenancy.
    if (channelId) {
      const channel = await this.prisma.channel.findFirst({
        where: { id: channelId, workspaceId },
        select: { id: true },
      });
      if (!channel) throw new NotFoundException('Channel not found.');
    }

    const key = this.storage.buildKey(workspaceId, file.originalname);
    const stored = await this.storage.put(key, file.buffer);

    const row = await this.prisma.upload.create({
      data: {
        workspaceId,
        channelId: channelId ?? null,
        uploaderId,
        // The browser-supplied name is metadata only — it never reaches the
        // filesystem, because `buildKey` decides the path.
        filename: file.originalname.slice(0, 255),
        mimeType: file.mimetype || 'application/octet-stream',
        size: stored.size,
        storageKey: stored.key,
        checksum: stored.checksum,
      },
      include: { uploader: { select: PUBLIC_USER_SELECT } },
    });

    return toUpload(row);
  }

  /** The row plus its bytes, for the download route. */
  async read(
    workspaceId: string,
    uploadId: string,
  ): Promise<{ filename: string; mimeType: string; content: Buffer }> {
    const row = await this.prisma.upload.findFirst({
      where: { id: uploadId, workspaceId },
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

  async remove(workspaceId: string, uploadId: string): Promise<void> {
    const row = await this.prisma.upload.findFirst({
      where: { id: uploadId, workspaceId },
      select: { id: true, storageKey: true },
    });
    if (!row) throw new NotFoundException('File not found.');

    await this.prisma.upload.delete({ where: { id: row.id } });
    await this.storage.delete(row.storageKey);
  }
}
