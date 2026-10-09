import { describe, it, expect, beforeEach } from 'vitest';
import { AITelemetryService } from './ai-telemetry.service.js';

describe('AITelemetryService', () => {
  let service: AITelemetryService;

  beforeEach(() => {
    service = new AITelemetryService();
  });

  describe('Model Cost Calculation', () => {
    it('calculates cost accurately for OpenAI gpt-4o', () => {
      // gpt-4o: $2.50 per 1M input ($0.0000025/tok), $10.00 per 1M output ($0.00001/tok)
      const cost = service.calculateCost('gpt-4o', 1000, 500);
      // 1000 * 0.0000025 + 500 * 0.0000100 = 0.0025 + 0.0050 = 0.0075
      expect(cost).toBeCloseTo(0.0075, 5);
    });

    it('calculates cost accurately for Anthropic claude-3-5-sonnet', () => {
      // claude-3-5-sonnet: $3.00/M input, $15.00/M output
      const cost = service.calculateCost('claude-3-5-sonnet-20241022', 2000, 1000);
      // 2000 * 0.000003 + 1000 * 0.000015 = 0.006 + 0.015 = 0.021
      expect(cost).toBeCloseTo(0.021, 5);
    });

    it('applies prompt caching discounts when available', () => {
      const normalCost = service.calculateCost('claude-3-5-sonnet-20241022', 1000, 100);
      const cachedCost = service.calculateCost('claude-3-5-sonnet-20241022', 1000, 100, 800);
      expect(cachedCost).toBeLessThan(normalCost);
    });

    it('falls back to default pricing for unrecognized models', () => {
      const cost = service.calculateCost('custom-finetuned-model-xyz', 1000, 1000);
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('Error Classification & Fingerprinting', () => {
    it('classifies 429 rate limit errors properly', () => {
      const err = new Error('Rate limit exceeded: 429 Too Many Requests from OpenAI');
      const classified = service.classifyError(err);
      expect(classified.category).toBe('RATE_LIMIT');
      expect(classified.fingerprint).toHaveLength(16);
    });

    it('classifies auth & permission errors', () => {
      const err = { message: 'Invalid API key provided, 401 Unauthorized', code: 'UNAUTHORIZED' };
      const classified = service.classifyError(err);
      expect(classified.category).toBe('AUTHENTICATION_PERMISSION');
    });

    it('classifies timeout errors', () => {
      const err = new Error('Gateway Timeout: execution timed out after 30000ms');
      const classified = service.classifyError(err);
      expect(classified.category).toBe('TIMEOUT');
    });

    it('classifies tool and connector failures', () => {
      const err = new Error('Tool execution failed: external slack connector rejected payload');
      const classified = service.classifyError(err);
      expect(classified.category).toBe('CONNECTOR');
    });
  });

  describe('Deep Credential & Secret Redaction', () => {
    it('redacts authorization Bearer headers and api keys', () => {
      const sensitivePayload = {
        authorization: 'Bearer secret_token_abc_123_xyz',
        apiKey: 'sk-proj-9876543210abcdef',
        nested: {
          clientSecret: 'super_secret_client_pass',
          normalData: 'visible message',
        },
      };

      const redacted = service.redactSensitiveData(sensitivePayload) as any;
      expect(redacted.authorization).toBe('[REDACTED]');
      expect(redacted.apiKey).toBe('[REDACTED]');
      expect(redacted.nested.clientSecret).toBe('[REDACTED]');
      expect(redacted.nested.normalData).toBe('visible message');
    });

    it('handles primitive and string values safely', () => {
      expect(service.redactSensitiveData('regular text')).toBe('regular text');
      expect(service.redactSensitiveData(42)).toBe(42);
      expect(service.redactSensitiveData(null)).toBeNull();
    });
  });

  describe('Latency Percentile Calculations', () => {
    it('computes accurate p50, p90, p95, p99 percentiles', () => {
      // 100 sample latencies from 1ms to 100ms
      const latencies = Array.from({ length: 100 }, (_, i) => i + 1);
      const percentiles = service.calculatePercentiles(latencies);

      expect(percentiles.p50).toBe(50);
      expect(percentiles.p90).toBe(90);
      expect(percentiles.p95).toBe(95);
      expect(percentiles.p99).toBe(99);
      expect(percentiles.avg).toBe(51);
      expect(percentiles.median).toBe(50);
    });

    it('handles empty latency array gracefully', () => {
      const percentiles = service.calculatePercentiles([]);
      expect(percentiles.p50).toBe(0);
      expect(percentiles.p90).toBe(0);
      expect(percentiles.p95).toBe(0);
      expect(percentiles.p99).toBe(0);
      expect(percentiles.avg).toBe(0);
    });
  });

  describe('Distributed Trace Hierarchy Builder', () => {
    it('builds waterfall trace spans and flags bottlenecks', () => {
      const mockExecution = {
        id: 'exec-123',
        workspaceId: 'ws-1',
        entityType: 'AGENT',
        entityId: 'agent-1',
        status: 'SUCCESS',
        startedAt: new Date('2026-10-09T10:00:00Z'),
        completedAt: new Date('2026-10-09T10:00:05Z'),
        durationMs: 5000,
        tokensUsed: 1200,
        cost: 0.012,
        metadata: { triggerType: 'API' },
        steps: [
          {
            id: 'step-1',
            stepType: 'PROMPT',
            status: 'SUCCESS',
            startedAt: new Date('2026-10-09T10:00:00Z'),
            completedAt: new Date('2026-10-09T10:00:01Z'),
            durationMs: 1000,
            tokensUsed: 200,
            cost: 0.002,
            input: { query: 'Hello' },
            output: { prompt: 'System prompt' },
          },
          {
            id: 'step-2',
            stepType: 'MODEL_CALL',
            status: 'SUCCESS',
            startedAt: new Date('2026-10-09T10:00:01Z'),
            completedAt: new Date('2026-10-09T10:00:04Z'),
            durationMs: 3000, // 60% of total duration -> bottleneck
            tokensUsed: 1000,
            cost: 0.01,
            input: { prompt: 'System prompt' },
            output: { answer: 'Agent response' },
          },
        ],
      };

      const trace = service.buildTraceHierarchy(mockExecution);
      expect(trace.executionId).toBe('exec-123');
      expect(trace.spans.length).toBe(3); // Root span + 2 step spans
      // Must equal a real span's id so the waterfall can highlight it.
      expect(trace.bottleneckSpanId).toBe('sp_step-2'); // Consumed 60% of time
      expect(trace.spans?.some((s) => s.spanId === trace.bottleneckSpanId)).toBe(true);
    });
  });
});
