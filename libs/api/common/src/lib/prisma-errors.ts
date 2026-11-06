import { HttpStatus } from '@nestjs/common';

/**
 * Reading Prisma's request errors without importing the generated client.
 *
 * Matched on `code` rather than `instanceof`: this lib does not depend on
 * `@org/database`, and specs throw plain `{ code }` objects.
 */
interface PrismaLikeError {
  code: string;
  meta?: {
    modelName?: string;
    target?: string | string[];
    driverAdapterError?: {
      cause?: { constraint?: { fields?: string[] } };
    };
  };
}

export function isPrismaError(error: unknown): error is PrismaLikeError {
  const code = (error as { code?: unknown } | null | undefined)?.code;
  return typeof code === 'string' && /^P\d{4}$/.test(code);
}

/**
 * Columns behind a unique violation. Under the pg driver adapter they live in
 * `driverAdapterError` with Postgres quoting (`"workspaceId"`), and `meta.target`
 * is absent; the native engine used `meta.target`, so both are read.
 */
export function uniqueViolationFields(error: unknown): string[] {
  if (!isPrismaError(error) || error.code !== 'P2002') return [];
  const fields =
    error.meta?.driverAdapterError?.cause?.constraint?.fields ??
    error.meta?.target ??
    [];
  return (Array.isArray(fields) ? fields : [fields]).map((field) =>
    field.replace(/"/g, ''),
  );
}

/** True for a unique violation, optionally only one that involves `field`. */
export function isUniqueViolation(error: unknown, field?: string): boolean {
  if (!isPrismaError(error) || error.code !== 'P2002') return false;
  return field === undefined || uniqueViolationFields(error).includes(field);
}

/** `AIApp` → `AI app`, `ticketPrefix` → `ticket prefix`. */
function humanize(identifier: string): string {
  return identifier
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(' ')
    .map((word) => (/^[A-Z]{2,}/.test(word) ? word : word.toLowerCase()))
    .join(' ');
}

function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) ? 'An' : 'A'} ${noun}`;
}

export interface PrismaHttpError {
  status: HttpStatus;
  message: string;
  errors?: Record<string, string[]>;
}

/**
 * The client-caused request failures Prisma reports, as HTTP errors. Anything
 * else returns null and stays a logged 500, so real faults are not hidden.
 */
export function describePrismaError(error: unknown): PrismaHttpError | null {
  if (!isPrismaError(error)) return null;
  const model = error.meta?.modelName
    ? humanize(error.meta.modelName)
    : 'record';

  switch (error.code) {
    case 'P2002': {
      // Ids only scope the rule (`workspaceId`), so they say nothing to a user.
      const fields = uniqueViolationFields(error).filter(
        (field) => !/id$/i.test(field),
      );
      if (fields.length === 0) {
        return {
          status: HttpStatus.CONFLICT,
          message: `This ${model} already exists.`,
        };
      }
      const message = `${withArticle(model)} with this ${fields
        .map(humanize)
        .join(' and ')} already exists.`;
      return {
        status: HttpStatus.CONFLICT,
        message,
        errors: Object.fromEntries(fields.map((field) => [field, [message]])),
      };
    }
    case 'P2025':
      return {
        status: HttpStatus.NOT_FOUND,
        message: `This ${model} no longer exists.`,
      };
    case 'P2003':
      return {
        status: HttpStatus.CONFLICT,
        message:
          'This change conflicts with related data that was changed or removed.',
      };
    case 'P2000':
      return {
        status: HttpStatus.BAD_REQUEST,
        message: 'One of the values is too long.',
      };
    default:
      return null;
  }
}
