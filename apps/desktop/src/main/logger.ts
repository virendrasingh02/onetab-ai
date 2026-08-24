import { app } from 'electron';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Sanitizes sensitive tokens, auth codes, and passwords before logging. */
function sanitize(message: string): string {
  return message
    .replace(/(?:code|token|authorization|password|secret|key|verifier)=([^\s&]+)/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/"(accessToken|refreshToken|code|codeVerifier|password|secret)":\s*"[^"]+"/gi, '"$1":"[REDACTED]"');
}

class DesktopLogger {
  private logFilePath: string | null = null;

  private getLogPath(): string {
    if (!this.logFilePath) {
      try {
        const dir = app.getPath('userData');
        mkdirSync(dir, { recursive: true });
        this.logFilePath = join(dir, 'desktop.log');
      } catch {
        this.logFilePath = 'desktop.log';
      }
    }
    return this.logFilePath;
  }

  private write(level: LogLevel, tag: string, message: string, meta?: unknown): void {
    const timestamp = new Date().toISOString();
    const cleanMessage = sanitize(message);
    const metaString = meta !== undefined ? ` | ${sanitize(JSON.stringify(meta))}` : '';
    const line = `[${timestamp}] [${level.toUpperCase()}] [${tag}] ${cleanMessage}${metaString}`;

    if (level === 'error') {
      console.error(line);
    } else if (level === 'warn') {
      console.warn(line);
    } else if (level === 'debug') {
      if (!app.isPackaged) console.debug(line);
    } else {
      console.log(line);
    }

    try {
      appendFileSync(this.getLogPath(), `${line}\n`, 'utf8');
    } catch {
      // Logging must never crash the app
    }
  }

  debug(tag: string, message: string, meta?: unknown): void {
    this.write('debug', tag, message, meta);
  }

  info(tag: string, message: string, meta?: unknown): void {
    this.write('info', tag, message, meta);
  }

  warn(tag: string, message: string, meta?: unknown): void {
    this.write('warn', tag, message, meta);
  }

  error(tag: string, message: string, error?: unknown): void {
    const errDetail =
      error instanceof Error
        ? `${error.message}\n${error.stack ?? ''}`
        : error !== undefined
          ? String(error)
          : '';
    this.write('error', tag, `${message} ${errDetail}`.trim());
  }
}

export const logger = new DesktopLogger();
