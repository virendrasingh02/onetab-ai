import { Injectable, Logger } from '@nestjs/common';
import type {
  SkillExecutionContext,
  SkillExecutionResult,
  SkillExecutionType,
  SkillPackage,
} from '@org/types';
import axios from 'axios';
import type { SkillExecutionAdapter } from './skill-adapter.interface.js';

@Injectable()
export class ApiSkillAdapter implements SkillExecutionAdapter {
  private readonly logger = new Logger(ApiSkillAdapter.name);

  canHandle(type: SkillExecutionType): boolean {
    return type === 'api';
  }

  async execute(
    skill: SkillPackage,
    context: SkillExecutionContext,
    input: Record<string, unknown>,
  ): Promise<SkillExecutionResult> {
    const startTime = Date.now();
    const endpoint = (input['endpoint'] as string) || skill.entryPoint;
    const method = ((input['method'] as string) || 'GET').toUpperCase();
    const body = input['body'] as Record<string, unknown> | undefined;
    const query = input['query'] as Record<string, unknown> | undefined;

    if (!endpoint) {
      return {
        ok: false,
        error: {
          code: 'API_ENDPOINT_MISSING',
          message: `Skill '${skill.id}' has no target API endpoint defined.`,
        },
        latencyMs: Date.now() - startTime,
      };
    }

    // SSRF Guard
    try {
      const url = new URL(endpoint);
      if (url.protocol !== 'https:' && url.protocol !== 'http:') {
        return {
          ok: false,
          error: {
            code: 'SSRF_BLOCKED',
            message: 'Only HTTP and HTTPS protocols are allowed.',
          },
          latencyMs: Date.now() - startTime,
        };
      }
      const host = url.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.startsWith('10.') ||
        host.startsWith('192.168.') ||
        host.endsWith('.internal') ||
        host === '169.254.169.254'
      ) {
        return {
          ok: false,
          error: {
            code: 'SSRF_BLOCKED',
            message: `Host '${host}' is private or reserved. External skills cannot reach local infrastructure.`,
          },
          latencyMs: Date.now() - startTime,
        };
      }

      // Check permission
      const hasNetworkPerm = context.grantedPermissions.some(
        (p) => p.includes('network') || p.includes('api') || p.includes('external'),
      );
      if (!hasNetworkPerm && !context.dryRun) {
        return {
          ok: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: `Skill requires external network access permission.`,
          },
          latencyMs: Date.now() - startTime,
        };
      }

      const headers: Record<string, string> = {
        'User-Agent': 'Mie-Skills-Engine/1.0',
      };
      if (context.secrets?.['API_KEY']) {
        headers['Authorization'] = `Bearer ${context.secrets['API_KEY']}`;
      }

      const res = await axios({
        url: endpoint,
        method,
        headers,
        params: query,
        data: body,
        timeout: 10000,
      });

      return {
        ok: true,
        data: res.data,
        latencyMs: Date.now() - startTime,
        logs: [`HTTP ${method} ${endpoint} returned status ${res.status}`],
      };
    } catch (err: any) {
      return {
        ok: false,
        error: {
          code: 'HTTP_REQUEST_FAILED',
          message: err.message || 'API request failed.',
          details: err.response?.data,
        },
        latencyMs: Date.now() - startTime,
      };
    }
  }
}
