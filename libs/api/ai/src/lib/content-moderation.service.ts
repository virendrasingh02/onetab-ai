import {
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiErrorCode,
  checkContent,
  CONTENT_BLOCKED_MESSAGE,
} from '@org/types';
import sharp from 'sharp';
import { extensionOf, extractTextFromFile } from './knowledge-extract.js';

export type ModerationVerdict =
  | {
      allowed: true;
      /** False when nothing could look at it: no model, a timeout, an unknown format. */
      scanned: boolean;
    }
  | { allowed: false; scanned: true; category: string };

export interface ModeratedFile {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
}

const DEFAULT_MODEL = 'meta/llama-guard-4-12b';
const DEFAULT_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const DEFAULT_TRANSCRIBE_MODEL = 'whisper-1';
const GUARD_TIMEOUT_MS = 10_000;
const TRANSCRIBE_TIMEOUT_MS = 30_000;
const EXTRACT_TIMEOUT_MS = 8_000;
/** The guard reads the head of long text; the local filter reads all of it. */
const GUARD_TEXT_CHARS = 4_000;
const GUARD_IMAGE_EDGE = 1024;

/**
 * Llama Guard's MLCommons hazard codes that this product blocks. The rest
 * (non-violent crime, defamation, specialised advice, privacy, IP, elections,
 * code abuse) describe ordinary business talk too often to refuse outright.
 */
export const BLOCKED_GUARD_CATEGORIES: Readonly<Record<string, string>> = {
  S1: 'violence',
  S3: 'sex_crimes',
  S4: 'child_safety',
  S9: 'weapons',
  S10: 'hate',
  S11: 'self_harm',
  S12: 'sexual',
};

const IMAGE_FORMATS = new Set([
  'jpeg',
  'png',
  'webp',
  'gif',
  'tiff',
  'avif',
  'heif',
  'svg',
]);
const AUDIO_EXTENSIONS = new Set([
  'mp3',
  'm4a',
  'wav',
  'ogg',
  'oga',
  'opus',
  'webm',
  'aac',
  'flac',
]);
const TEXT_DOCUMENT_EXTENSIONS = new Set([
  'pdf',
  'docx',
  'txt',
  'md',
  'markdown',
  'csv',
  'tsv',
  'log',
]);

/** The guard's answer: `safe`, or `unsafe` then a line of codes such as `S1,S10`. */
export function parseGuardReply(reply: string): string | null {
  const [verdict, codes = ''] = reply.trim().split(/\r?\n/);
  if (verdict?.trim().toLowerCase() !== 'unsafe') return null;
  for (const code of codes.split(/[,\s]+/)) {
    const category = BLOCKED_GUARD_CATEGORIES[code.trim().toUpperCase()];
    if (category) return category;
  }
  return null;
}

/**
 * Checks content the word filter cannot read: images, voice, files, and text
 * whose meaning is in the phrasing rather than a term.
 *
 * Fails open. If the provider is missing or down, posts go through and the
 * verdict says `scanned: false`, so an outage cannot stop a whole workplace
 * from sharing files. The local word filter still applies to any text.
 */
@Injectable()
export class ContentModerationService {
  private readonly logger = new Logger(ContentModerationService.name);

  constructor(private readonly config: ConfigService) {}

  /** Throws the 422 every client already shows as a plain message. */
  private reject(): never {
    throw new UnprocessableEntityException({
      code: ApiErrorCode.CONTENT_BLOCKED,
      message: CONTENT_BLOCKED_MESSAGE,
    });
  }

  async assertTextAllowed(text: string | null | undefined): Promise<void> {
    if (!(await this.moderateText(text)).allowed) this.reject();
  }

  async assertFileAllowed(file: ModeratedFile): Promise<ModerationVerdict> {
    const verdict = await this.moderateFile(file);
    if (!verdict.allowed) this.reject();
    return verdict;
  }

  async moderateText(
    text: string | null | undefined,
  ): Promise<ModerationVerdict> {
    if (!text?.trim()) return { allowed: true, scanned: true };
    const local = checkContent(text);
    if (!local.allowed) return this.blocked('text', local.category);
    return this.askGuard('text', [
      { type: 'text', text: text.slice(0, GUARD_TEXT_CHARS) },
    ]);
  }

  async moderateImage(buffer: Buffer): Promise<ModerationVerdict> {
    let jpeg: Buffer;
    try {
      jpeg = await sharp(buffer)
        .rotate()
        .resize(GUARD_IMAGE_EDGE, GUARD_IMAGE_EDGE, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: 80 })
        .toBuffer();
    } catch {
      return { allowed: true, scanned: false };
    }
    return this.askGuard('image', [
      // The hosted model answers 500 to an image with no text beside it.
      { type: 'text', text: 'Shared image.' },
      {
        type: 'image_url',
        image_url: { url: `data:image/jpeg;base64,${jpeg.toString('base64')}` },
      },
    ]);
  }

  /** Audio is read as its transcript; there is no model that listens directly. */
  async moderateAudio(file: ModeratedFile): Promise<ModerationVerdict> {
    const transcript = await this.transcribe(file);
    if (transcript === null) return { allowed: true, scanned: false };
    return this.moderateText(transcript);
  }

  /**
   * Routes by what the bytes are, not what the upload claims, so a picture
   * renamed `.bin` is still looked at. Videos and other binaries get the file
   * name check only.
   */
  async moderateFile(file: ModeratedFile): Promise<ModerationVerdict> {
    const name = checkContent(file.originalname);
    if (!name.allowed) return this.blocked('filename', name.category);

    if (await this.isImage(file.buffer)) return this.moderateImage(file.buffer);

    const extension = extensionOf(file.originalname);
    if (
      file.mimetype?.startsWith('audio/') ||
      AUDIO_EXTENSIONS.has(extension)
    ) {
      return this.moderateAudio(file);
    }
    if (TEXT_DOCUMENT_EXTENSIONS.has(extension)) {
      const text = await this.extractText(file);
      return text === null
        ? { allowed: true, scanned: false }
        : this.moderateText(text);
    }
    return { allowed: true, scanned: false };
  }

  private async isImage(buffer: Buffer): Promise<boolean> {
    try {
      const { format } = await sharp(buffer).metadata();
      return IMAGE_FORMATS.has(format);
    } catch {
      return false;
    }
  }

  /** A scanned PDF can mean minutes of OCR, which an upload cannot wait for. */
  private async extractText(file: ModeratedFile): Promise<string | null> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), EXTRACT_TIMEOUT_MS);
    });
    try {
      const extracted = extractTextFromFile(file.buffer, file.originalname)
        .then(({ text }) => text)
        .catch(() => null);
      return await Promise.race([extracted, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  private async askGuard(
    kind: string,
    content: Array<Record<string, unknown>>,
  ): Promise<ModerationVerdict> {
    const apiKey =
      this.config.get<string>('CONTENT_MODERATION_API_KEY') ||
      this.config.get<string>('NVIDIA_API_KEY');
    if (!apiKey) return { allowed: true, scanned: false };

    const baseUrl = (
      this.config.get<string>('CONTENT_MODERATION_BASE_URL') ||
      this.config.get<string>('NVIDIA_BASE_URL') ||
      DEFAULT_BASE_URL
    ).replace(/\/+$/, '');

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model:
            this.config.get<string>('CONTENT_MODERATION_MODEL') ||
            DEFAULT_MODEL,
          temperature: 0,
          max_tokens: 20,
          messages: [{ role: 'user', content }],
        }),
        signal: AbortSignal.timeout(GUARD_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const body = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const reply = body.choices?.[0]?.message?.content;
      if (typeof reply !== 'string') throw new Error('empty reply');
      const category = parseGuardReply(reply);
      return category
        ? this.blocked(kind, category)
        : { allowed: true, scanned: true };
    } catch (error) {
      this.logger.warn({
        event: 'content_moderation_unavailable',
        kind,
        error: error instanceof Error ? error.message : String(error),
      });
      return { allowed: true, scanned: false };
    }
  }

  private async transcribe(file: ModeratedFile): Promise<string | null> {
    const apiKey =
      this.config.get<string>('CONTENT_TRANSCRIBE_API_KEY') ||
      this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return null;

    const baseUrl = (
      this.config.get<string>('CONTENT_TRANSCRIBE_BASE_URL') ||
      this.config.get<string>('OPENAI_BASE_URL') ||
      'https://api.openai.com/v1'
    ).replace(/\/+$/, '');

    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype || 'application/octet-stream',
      }),
      file.originalname,
    );
    form.append(
      'model',
      this.config.get<string>('CONTENT_TRANSCRIBE_MODEL') ||
        DEFAULT_TRANSCRIBE_MODEL,
    );

    try {
      const response = await fetch(`${baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
        signal: AbortSignal.timeout(TRANSCRIBE_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`status ${response.status}`);
      const body = (await response.json()) as { text?: string };
      return typeof body.text === 'string' ? body.text : null;
    } catch (error) {
      this.logger.warn({
        event: 'content_transcription_unavailable',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /** Logs the kind and category only: never the content. */
  private blocked(kind: string, category: string): ModerationVerdict {
    this.logger.warn({ event: 'content_blocked', kind, category });
    return { allowed: false, scanned: true, category };
  }
}
