import {
  BadRequestException,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import { ApiErrorCode } from '@org/types';
import type { ZodType } from 'zod';

/**
 * Validates a handler argument against a Zod schema.
 *
 * The schemas live in `@org/validation` and are the same objects the browser
 * uses, so a rule can never drift between client and server. Field errors are
 * flattened into `errors` keyed by dotted path, which is the shape React Hook
 * Form expects when mapping server errors back onto inputs.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown, _metadata: ArgumentMetadata): T {
    const result = this.schema.safeParse(value);

    if (result.success) return result.data;

    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.') || '_root';
      (errors[path] ??= []).push(issue.message);
    }

    throw new BadRequestException({
      code: ApiErrorCode.VALIDATION_FAILED,
      message: 'The submitted data is invalid.',
      errors,
    });
  }
}

/** Convenience factory: `@Body(zodBody(createChannelSchema))`. */
export function zodBody<T>(schema: ZodType<T>): ZodValidationPipe<T> {
  return new ZodValidationPipe(schema);
}
