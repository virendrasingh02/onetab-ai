import { ConflictException, Logger, type ArgumentsHost } from '@nestjs/common';
import { ApiErrorCode } from '@org/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter';

/** Captured from Prisma 7 through the pg driver adapter: no `meta.target`. */
const adapterError = (code: string, modelName: string, fields?: string[]) =>
  Object.assign(new Error('Invalid prisma invocation with internals'), {
    code,
    meta: {
      modelName,
      ...(fields
        ? { driverAdapterError: { cause: { constraint: { fields } } } }
        : {}),
    },
  });

function run(exception: unknown) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ method: 'POST', url: '/api/v1/things' }),
    }),
  } as unknown as ArgumentsHost;
  new HttpExceptionFilter().catch(exception, host);
  return json.mock.calls[0][0];
}

describe('HttpExceptionFilter', () => {
  let error: ReturnType<typeof vi.spyOn>;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    error = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    error.mockClear();
    warn.mockClear();
  });

  it('turns a unique violation into a 409 naming the field', () => {
    const body = run(
      adapterError('P2002', 'Project', ['"workspaceId"', 'slug']),
    );
    expect(body).toMatchObject({
      statusCode: 409,
      code: ApiErrorCode.CONFLICT,
      message: 'A project with this slug already exists.',
      errors: { slug: ['A project with this slug already exists.'] },
    });
    expect(warn).toHaveBeenCalledOnce();
    expect(error).not.toHaveBeenCalled();
  });

  it('reads the native engine shape too', () => {
    const body = run({
      code: 'P2002',
      meta: { modelName: 'AIApp', target: ['workspaceId', 'ticketPrefix'] },
    });
    expect(body.message).toBe(
      'An AI app with this ticket prefix already exists.',
    );
  });

  it('does not name scope ids', () => {
    const body = run(
      adapterError('P2002', 'ChannelMember', ['"channelId"', '"userId"']),
    );
    expect(body.statusCode).toBe(409);
    expect(body.message).toBe('This channel member already exists.');
    expect(body.errors).toBeUndefined();
  });

  it('turns a missing record into a 404', () => {
    expect(run(adapterError('P2025', 'Project'))).toMatchObject({
      statusCode: 404,
      code: ApiErrorCode.NOT_FOUND,
      message: 'This project no longer exists.',
    });
  });

  it('turns a foreign key failure into a 409', () => {
    expect(run(adapterError('P2003', 'Project')).statusCode).toBe(409);
  });

  it('never returns Prisma internals', () => {
    const body = run(adapterError('P2002', 'Project', ['slug']));
    expect(JSON.stringify(body)).not.toContain('prisma');
  });

  it('keeps unknown Prisma errors as logged 500s', () => {
    const body = run(adapterError('P1001', 'Project'));
    expect(body).toMatchObject({
      statusCode: 500,
      code: ApiErrorCode.INTERNAL,
      message: 'An unexpected error occurred.',
    });
    expect(error).toHaveBeenCalledOnce();
  });

  it('leaves HttpExceptions untouched', () => {
    expect(run(new ConflictException('Prefix in use'))).toMatchObject({
      statusCode: 409,
      message: 'Prefix in use',
    });
  });
});
