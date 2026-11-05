import { UnprocessableEntityException } from '@nestjs/common';
import { ApiErrorCode } from '@org/types';
import { describe, expect, it } from 'vitest';
import { assertContentAllowed } from './content-filter.js';

describe('assertContentAllowed', () => {
  it('lets ordinary text and empty fields through', () => {
    expect(() =>
      assertContentAllowed('ship it', null, undefined),
    ).not.toThrow();
  });

  it('rejects with the code clients switch on, naming no term', () => {
    try {
      assertContentAllowed('fine', 'kill yourself');
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(UnprocessableEntityException);
      const body = (error as UnprocessableEntityException).getResponse();
      expect(body).toMatchObject({ code: ApiErrorCode.CONTENT_BLOCKED });
      expect(JSON.stringify(body)).not.toContain('kill');
    }
  });
});
