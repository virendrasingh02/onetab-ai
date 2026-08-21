import { HttpException, HttpStatus, Logger, UnauthorizedException } from '@nestjs/common';
import type {
  AIChatResponse,
  AIErrorCode,
  AIModelMetadata,
  AIProvider,
  AIStreamEvent,
  ProviderConnectionTestResult,
} from '@org/types';
import type {
  ChatExecutionOptions,
  IProviderAdapter,
  ProviderValidationResult,
} from './provider-adapter.interface.js';

export abstract class BaseProviderAdapter implements IProviderAdapter {
  protected abstract readonly logger: Logger;
  abstract readonly provider: AIProvider;
  abstract readonly defaultModel: string;

  abstract getModels(): AIModelMetadata[];
  abstract validateConfig(): ProviderValidationResult;
  abstract isConfigured(): boolean;
  abstract chat(options: ChatExecutionOptions): Promise<AIChatResponse>;
  abstract stream(
    options: ChatExecutionOptions
  ): AsyncGenerator<AIStreamEvent, void, unknown>;

  async healthCheck(): Promise<ProviderConnectionTestResult> {
    const start = Date.now();
    const configCheck = this.validateConfig();

    if (!configCheck.valid) {
      return {
        provider: this.provider,
        model: this.defaultModel,
        status: 'NOT_CONFIGURED',
        latencyMs: null,
        detail: configCheck.reason ?? `${this.provider} API credentials are not configured.`,
        checkedAt: new Date().toISOString(),
      };
    }

    try {
      const pingResponse = await this.chat({
        model: this.defaultModel,
        messages: [{ role: 'user', content: 'Ping' }],
        maxTokens: 10,
      });

      const latencyMs = Date.now() - start;
      return {
        provider: this.provider,
        model: pingResponse.model ?? this.defaultModel,
        status: 'CONNECTED',
        latencyMs,
        detail: `Connected to ${this.provider.toUpperCase()} (${pingResponse.model ?? this.defaultModel}) in ${latencyMs}ms.`,
        checkedAt: new Date().toISOString(),
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isAuthError =
        err instanceof UnauthorizedException ||
        (err instanceof HttpException && err.getStatus() === 401) ||
        errorMsg.toLowerCase().includes('auth') ||
        errorMsg.toLowerCase().includes('unauthorized');

      return {
        provider: this.provider,
        model: this.defaultModel,
        status: isAuthError ? 'AUTH_ERROR' : 'ERROR',
        latencyMs,
        detail: `Connection test failed: ${errorMsg}`,
        checkedAt: new Date().toISOString(),
      };
    }
  }

  protected normalizeHttpError(
    status: number,
    responseBody: Record<string, unknown> | string,
    defaultMessage?: string
  ): HttpException {
    let detailMessage = defaultMessage ?? `Provider ${this.provider} returned HTTP ${status}`;

    if (typeof responseBody === 'object' && responseBody !== null) {
      if (typeof responseBody['message'] === 'string') {
        detailMessage = responseBody['message'];
      } else if (
        typeof responseBody['error'] === 'object' &&
        responseBody['error'] !== null &&
        typeof (responseBody['error'] as Record<string, unknown>)['message'] === 'string'
      ) {
        detailMessage = (responseBody['error'] as Record<string, unknown>)['message'] as string;
      } else if (typeof responseBody['error'] === 'string') {
        detailMessage = responseBody['error'];
      }
    }

    if (status === 401 || status === 403) {
      return new UnauthorizedException({
        statusCode: HttpStatus.UNAUTHORIZED,
        error: 'AI_PROVIDER_AUTH_ERROR' as AIErrorCode,
        message: `Invalid or missing credentials for provider '${this.provider}': ${detailMessage}`,
      });
    }

    if (status === 429) {
      return new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'AI_RATE_LIMITED' as AIErrorCode,
          message: `${this.provider} rate limit exceeded. Please retry shortly. (${detailMessage})`,
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }

    if (status === 404 || status === 503) {
      return new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'AI_MODEL_UNAVAILABLE' as AIErrorCode,
          message: `${this.provider} model is currently unavailable: ${detailMessage}`,
        },
        HttpStatus.SERVICE_UNAVAILABLE
      );
    }

    return new HttpException(
      {
        statusCode: HttpStatus.BAD_GATEWAY,
        error: 'AI_PROVIDER_ERROR' as AIErrorCode,
        message: `${this.provider} inference failed: ${detailMessage}`,
      },
      HttpStatus.BAD_GATEWAY
    );
  }

  protected handleCatchError(err: unknown): HttpException {
    if (err instanceof HttpException) return err;

    const isTimeout =
      err instanceof Error &&
      (err.name === 'AbortError' || err.message.includes('timeout'));

    if (isTimeout) {
      return new HttpException(
        {
          statusCode: HttpStatus.GATEWAY_TIMEOUT,
          error: 'AI_REQUEST_TIMEOUT' as AIErrorCode,
          message: `${this.provider} inference request timed out.`,
        },
        HttpStatus.GATEWAY_TIMEOUT
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    return new HttpException(
      {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        error: 'AI_PROVIDER_ERROR' as AIErrorCode,
        message: `An error occurred during ${this.provider} inference: ${message}`,
      },
      HttpStatus.INTERNAL_SERVER_ERROR
    );
  }
}
