import { UnprocessableEntityException } from '@nestjs/common';
import {
  ApiErrorCode,
  checkAllContent,
  CONTENT_BLOCKED_MESSAGE,
} from '@org/types';

/**
 * Stops objectionable text at the API. Chat bypasses this (clients talk to
 * Matrix directly) and is filtered in the composers and the Matrix client.
 */
export function assertContentAllowed(
  ...texts: Array<string | null | undefined>
): void {
  if (checkAllContent(...texts).allowed) return;
  throw new UnprocessableEntityException({
    code: ApiErrorCode.CONTENT_BLOCKED,
    message: CONTENT_BLOCKED_MESSAGE,
  });
}
