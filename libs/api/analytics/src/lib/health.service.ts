import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { HealthStatus, ServiceHealth, ServiceState } from '@org/types';
import { MetricsService } from './metrics.service.js';

/** A probe that hangs is a failed probe — the dashboard must stay responsive. */
const PROBE_TIMEOUT_MS = 2_000;

/** Above this, a service answers but is not answering well. */
const DEGRADED_LATENCY_MS = 500;

@Injectable()
export class HealthService {
  constructor(
    private readonly config: ConfigService,
    private readonly metrics: MetricsService,
  ) {}

  async getHealth(): Promise<HealthStatus> {
    const matrixUrl = this.config.get<string>('MATRIX_HOMESERVER_URL');
    const ollamaUrl = this.config.get<string>('OLLAMA_URL');
    const minioUrl = this.config.get<string>('MINIO_ENDPOINT');
    const nvidiaKey = this.config.get<string>('NVIDIA_API_KEY');
    const nvidiaBaseUrl =
      this.config.get<string>('NVIDIA_BASE_URL') ?? 'https://integrate.api.nvidia.com/v1';

    const services: ServiceHealth[] = [
      await this.checkDatabase(),
      this.checkApi(),
      await this.checkNvidia(nvidiaKey, nvidiaBaseUrl),
      await this.checkHttp(
        'Matrix Homeserver',
        matrixUrl ? `${trimSlash(matrixUrl)}/_matrix/client/versions` : null,
      ),
      await this.checkHttp(
        'AI Gateway (Ollama)',
        ollamaUrl ? `${trimSlash(ollamaUrl)}/api/tags` : null,
      ),
      await this.checkHttp(
        'Object Storage (MinIO)',
        minioUrl ? `${trimSlash(minioUrl)}/minio/health/live` : null,
      ),
      this.checkCache(),
    ];

    const memory = process.memoryUsage();

    return {
      status: rollUp(services),
      checkedAt: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      services,
      process: {
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
        rssBytes: memory.rss,
        nodeVersion: process.version,
        platform: process.platform,
        pid: process.pid,
      },
    };
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const latencyMs = await this.metrics.probeDatabase();
    if (latencyMs < 0) {
      return {
        name: 'PostgreSQL',
        status: 'DOWN',
        latencyMs: null,
        detail: 'Query failed — the database is unreachable.',
      };
    }
    return {
      name: 'PostgreSQL',
      status: latencyMs < DEGRADED_LATENCY_MS ? 'HEALTHY' : 'DEGRADED',
      latencyMs,
      detail: `SELECT 1 round-trip in ${latencyMs}ms.`,
    };
  }

  private checkApi(): ServiceHealth {
    return {
      name: 'API Server',
      status: 'HEALTHY',
      latencyMs: 0,
      detail: `Serving for ${Math.round(process.uptime())}s on pid ${process.pid}.`,
    };
  }

  private checkCache(): ServiceHealth {
    return {
      name: 'Cache (in-process)',
      status: 'HEALTHY',
      latencyMs: 0,
      detail: 'In-memory cache store — not backed by Redis in this deployment.',
    };
  }

  /** `null` url means the service is not configured, which is not a failure. */
  private async checkHttp(
    name: string,
    url: string | null,
  ): Promise<ServiceHealth> {
    if (!url) {
      return {
        name,
        status: 'DEGRADED',
        latencyMs: null,
        detail: 'Not configured for this environment.',
      };
    }

    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      const latencyMs = Date.now() - started;
      const ok = response.ok || response.status === 403;
      return {
        name,
        status: !ok
          ? 'DOWN'
          : latencyMs < DEGRADED_LATENCY_MS
            ? 'HEALTHY'
            : 'DEGRADED',
        latencyMs,
        detail: `HTTP ${response.status} in ${latencyMs}ms.`,
      };
    } catch (error) {
      return {
        name,
        status: 'DOWN',
        latencyMs: null,
        detail:
          error instanceof Error && error.name === 'AbortError'
            ? `No response within ${PROBE_TIMEOUT_MS}ms.`
            : `Unreachable: ${error instanceof Error ? error.message : error}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private async checkNvidia(
    apiKey: string | undefined,
    baseUrl: string
  ): Promise<ServiceHealth> {
    if (!apiKey) {
      return {
        name: 'AI Gateway (NVIDIA)',
        status: 'DEGRADED',
        latencyMs: null,
        detail: 'NVIDIA_API_KEY is not configured in environment.',
      };
    }

    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

    try {
      const response = await fetch(`${trimSlash(baseUrl)}/models`, {
        signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const latencyMs = Date.now() - started;
      const ok = response.ok || response.status === 200;
      return {
        name: 'AI Gateway (NVIDIA)',
        status: !ok
          ? 'DEGRADED'
          : latencyMs < DEGRADED_LATENCY_MS
            ? 'HEALTHY'
            : 'DEGRADED',
        latencyMs: ok ? latencyMs : null,
        detail: ok
          ? `Connected (Default model: Nemotron 3 Super) in ${latencyMs}ms.`
          : `HTTP ${response.status} from NVIDIA API.`,
      };
    } catch (error) {
      return {
        name: 'AI Gateway (NVIDIA)',
        status: 'DEGRADED',
        latencyMs: null,
        detail:
          error instanceof Error && error.name === 'AbortError'
            ? `No response within ${PROBE_TIMEOUT_MS}ms.`
            : `Unreachable: ${error instanceof Error ? error.message : error}`,
      };
    } finally {
      clearTimeout(timer);
    }
  }
}

function trimSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

/** Worst state wins: one down dependency makes the platform degraded. */
function rollUp(services: ServiceHealth[]): ServiceState {
  if (services.some((s) => s.status === 'DOWN')) return 'DEGRADED';
  if (services.some((s) => s.status === 'DEGRADED')) return 'DEGRADED';
  return 'HEALTHY';
}
