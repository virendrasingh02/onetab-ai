import { app } from 'electron';
import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Sanitizes sensitive tokens, auth codes, and passwords before logging.
 *
 * The *name* is what must survive: an earlier version replaced the match with
 * its own capture group — the secret value — so `code=abc` was logged as
 * `abc=[REDACTED]`, writing the one-time sign-in code to disk as a key.
 */
export function sanitize(message: string): string {
  return message
    .replace(/\b(code|token|authorization|password|secret|key|verifier)=([^\s&]+)/gi, '$1=[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, 'Bearer [REDACTED]')
    .replace(/"(accessToken|refreshToken|code|codeVerifier|password|secret)":\s*"[^"]+"/gi, '"$1":"[REDACTED]"');
}

/**
 * `JSON.stringify(new Error('x'))` is `{}`, which is how every `warn(tag, msg, error)`
 * call lost the one thing it was written to record. Errors are written out by
 * name, message and stack instead; anything that cannot be serialised (a
 * circular structure) falls back to its string form rather than throwing.
 */
export function serializeMeta(meta: unknown): string {
  try {
    return JSON.stringify(meta, (_key, value) =>
      value instanceof Error
        ? { name: value.name, message: value.message, stack: value.stack }
        : value,
    );
  } catch {
    return String(meta);
  }
}

class DesktopLogger {
  private logFilePath: string | null = null;

  private getLogPath(): string {
    if (!this.logFilePath) {
      try {
        // `logs` is Electron's per-OS convention (~/Library/Logs on macOS) and
        // is what Diagnostics reveals; it nests under userData on Windows/Linux.
        const dir = app.getPath('logs');
        mkdirSync(dir, { recursive: true });
        this.logFilePath = join(dir, 'desktop.log');
      } catch {
        // No resolvable logs folder (before Electron is up, or under a test
        // double). Writing `desktop.log` into the working directory instead is
        // what once put a log file into the repository on every test run.
        this.logFilePath = '';
      }
    }
    return this.logFilePath;
  }

  private write(level: LogLevel, tag: string, message: string, meta?: unknown): void {
    const timestamp = new Date().toISOString();
    const cleanMessage = sanitize(message);
    const metaString = meta !== undefined ? ` | ${sanitize(serializeMeta(meta))}` : '';
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
      const path = this.getLogPath();
      if (path) appendFileSync(path, `${line}\n`, 'utf8');
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
