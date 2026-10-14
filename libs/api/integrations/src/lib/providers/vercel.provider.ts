import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AppActionDefinition,
  AppActionResult,
  ConnectorTriggerDefinition,
  IntegrationAccount,
  IntegrationCapabilities,
} from '@org/types';
import { connectorRequest, ConnectorHttpError } from '../core/connector-http.js';
import { SSRFGuardService } from '../core/ssrf-guard.service.js';
import type {
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';
import { boundedInt, parseCredentialBundle, requireText, textOf } from './credential-json.js';

const APP = 'Vercel';
const API_BASE = 'https://api.vercel.com';

interface VercelAuth extends Record<string, string> {
  token: string;
  /** Optional: a team id (`team_…`) so every call is scoped to that team instead of the personal account. */
  teamId: string;
}

/** `team_abc` is the id Vercel expects; accept it with stray whitespace only. */
function readAuth(accessToken: string): VercelAuth {
  const auth = parseCredentialBundle<VercelAuth>(accessToken, APP, ['token']);
  return { ...auth, teamId: auth.teamId ?? '' };
}

function compactProject(p: any) {
  return {
    id: p.id,
    name: p.name,
    framework: p.framework ?? null,
    updatedAt: p.updatedAt,
    productionUrl: p.targets?.production?.alias?.[0] ?? p.alias?.[0]?.domain ?? null,
    repo: p.link ? `${p.link.org ?? ''}/${p.link.repo ?? ''}`.replace(/^\/|\/$/g, '') || null : null,
    latestDeployment: p.latestDeployments?.[0]
      ? { id: p.latestDeployments[0].id, state: p.latestDeployments[0].readyState, url: p.latestDeployments[0].url }
      : null,
  };
}

function compactDeployment(d: any) {
  return {
    id: d.uid ?? d.id,
    name: d.name,
    url: d.url ? `https://${d.url}` : null,
    state: d.state ?? d.readyState,
    target: d.target ?? 'preview',
    createdAt: d.created ?? d.createdAt,
    ready: d.ready ?? d.readyAt ?? null,
    projectId: d.projectId ?? null,
    source: d.source ?? null,
    creator: d.creator?.username ?? d.creator?.email ?? null,
    commit: d.meta?.githubCommitSha
      ? {
          sha: String(d.meta.githubCommitSha).slice(0, 7),
          message: d.meta.githubCommitMessage ?? null,
          ref: d.meta.githubCommitRef ?? null,
          author: d.meta.githubCommitAuthorLogin ?? null,
        }
      : null,
    inspectorUrl: d.inspectorUrl ?? null,
    errorMessage: d.errorMessage ?? null,
  };
}

/**
 * Vercel REST API, connected with an access token (Account Settings → Tokens)
 * and, for team projects, an optional team id. The token is stored encrypted
 * like every manual credential and can be revoked in Vercel at any time.
 *
 * Reads are free; the two write actions (redeploy, cancel) ask for approval.
 * Environment variables are only ever returned by name, target and type — a
 * value never leaves Vercel through this connector.
 */
@Injectable()
export class VercelProvider implements ProviderAdapter {
  readonly providerId = 'VERCEL';

  constructor(private readonly ssrf: SSRFGuardService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Vercel',
      description:
        'Projects, deployments, build logs and domains — watch deploys, investigate failures and redeploy from an agent.',
      category: 'Developer tools',
      connectorCategory: 'developer_tools',
      authType: 'BEARER',
      supportsSync: false,
      supportsWebhooks: false,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      scopes: [
        { scope: 'read', description: 'Read projects, deployments, logs and domains', required: true },
        { scope: 'deploy', description: 'Redeploy and cancel deployments (each asks for approval)' },
      ],
      credentialFields: [
        {
          key: 'token',
          label: 'Access token',
          secret: true,
          help: 'Create one at vercel.com/account/tokens. Scope it to the team whose projects agents may use.',
        },
        {
          key: 'teamId',
          label: 'Team ID',
          placeholder: 'team_xxxxxxxx',
          optional: true,
          help: 'Leave empty for your personal account. For a team: Team Settings → General → Team ID.',
        },
      ],
    };
  }

  secretFields(): string[] {
    return ['token'];
  }

  private call<T = any>(
    auth: VercelAuth,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    options: { params?: Record<string, unknown>; data?: unknown } = {},
  ) {
    return connectorRequest<T>(APP, {
      method,
      url: `${API_BASE}${path}`,
      headers: { Authorization: `Bearer ${auth.token}`, Accept: 'application/json' },
      params: { ...(auth.teamId ? { teamId: auth.teamId } : {}), ...options.params },
      data: options.data,
      httpAgent: this.ssrf.agents.httpAgent,
      httpsAgent: this.ssrf.agents.httpsAgent,
    });
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const auth = readAuth(credential.accessToken);
    const { data } = await this.call(auth, 'GET', '/v2/user');
    const user = data.user ?? {};
    return {
      id: credential.id,
      provider: this.providerId,
      accountId: String(user.id ?? user.uid ?? ''),
      email: user.email,
      name: user.name || user.username,
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: { username: user.username, teamId: auth.teamId || undefined },
    };
  }

  async disconnect(): Promise<void> {
    // The token is revoked from vercel.com/account/tokens by its owner.
  }

  async sync(): Promise<SyncResult> {
    return { success: true, itemsProcessed: 0 };
  }

  async handleWebhook(payload: unknown): Promise<WebhookProcessResult> {
    return { success: true, eventType: 'vercel.webhook', data: payload };
  }

  async testConnection(
    config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    try {
      const auth = readAuth(credential ? credential.accessToken : JSON.stringify(config));
      if (auth.teamId && !/^team_[A-Za-z0-9]+$/.test(auth.teamId)) {
        return { success: false, message: 'Team ID should look like team_xxxxxxxx (Team Settings → General).' };
      }
      const { data: me } = await this.call(auth, 'GET', '/v2/user');
      let label: string = me.user?.name || me.user?.username || 'your account';
      if (auth.teamId) {
        // Also proves the token can actually see this team, which /v2/user alone does not.
        const { data: team } = await this.call(auth, 'GET', `/v2/teams/${encodeURIComponent(auth.teamId)}`);
        label = team.name || team.slug || auth.teamId;
      }
      return {
        success: true,
        message: `Connected to Vercel (${label}).`,
        details: { displayName: `Vercel · ${label}` },
      };
    } catch (error) {
      return { success: false, message: `Vercel connection failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  getTriggers(): ConnectorTriggerDefinition[] {
    return [
      {
        id: 'new_deployment',
        label: 'New deployment',
        description: 'Starts the agent for each new deployment (optionally one project or production only).',
        pollActionId: 'list_deployments',
        itemsPath: 'deployments',
        idField: 'id',
      },
      {
        id: 'deployment_failed',
        label: 'Deployment failed',
        description: 'Starts the agent when a deployment ends in an error, so it can read the logs and report the cause.',
        pollActionId: 'list_deployments',
        defaultInput: { state: 'ERROR' },
        itemsPath: 'deployments',
        idField: 'id',
      },
    ];
  }

  getActions(): AppActionDefinition[] {
    const deploymentId = { type: 'string', description: 'The deployment id (dpl_…) or its URL.' };
    const projectId = { type: 'string', description: 'The project id or name.' };
    return [
      {
        id: 'list_projects',
        label: 'List projects',
        description: 'List projects with framework, repository and latest deployment.',
        inputSchema: { type: 'object', properties: { search: { type: 'string' }, limit: { type: 'number' } } },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_project',
        label: 'Get project',
        description: 'Fetch one project by id or name.',
        inputSchema: { type: 'object', properties: { projectId }, required: ['projectId'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_deployments',
        label: 'List deployments',
        description: 'List deployments, newest first. Filter by project, target (production/preview) or state.',
        inputSchema: {
          type: 'object',
          properties: {
            projectId,
            target: { type: 'string', enum: ['production', 'preview'] },
            state: { type: 'string', enum: ['BUILDING', 'ERROR', 'INITIALIZING', 'QUEUED', 'READY', 'CANCELED'] },
            limit: { type: 'number' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_deployment',
        label: 'Get deployment',
        description: 'Fetch one deployment with its state, commit and error message.',
        inputSchema: { type: 'object', properties: { deploymentId }, required: ['deploymentId'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_build_logs',
        label: 'Get build logs',
        description: 'Read the latest build log lines of a deployment — use it to find why a deploy failed.',
        inputSchema: {
          type: 'object',
          properties: { deploymentId, limit: { type: 'number', description: 'Lines to return from the end (default 100).' } },
          required: ['deploymentId'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_domains',
        label: 'List domains',
        description: 'List the domains of one project, or every domain on the account when no project is given.',
        inputSchema: { type: 'object', properties: { projectId } },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_env_vars',
        label: 'List environment variables',
        description: 'List a project’s environment variable names, targets and types. Values are never returned.',
        inputSchema: { type: 'object', properties: { projectId }, required: ['projectId'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'redeploy',
        label: 'Redeploy',
        description: 'Create a new deployment from an existing one, keeping its target (production or preview).',
        inputSchema: { type: 'object', properties: { deploymentId }, required: ['deploymentId'] },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'cancel_deployment',
        label: 'Cancel deployment',
        description: 'Stop a deployment that is still queued or building.',
        inputSchema: { type: 'object', properties: { deploymentId }, required: ['deploymentId'] },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
    ];
  }

  async executeAction(
    credential: ResolvedCredential,
    actionId: string,
    input: Record<string, unknown>,
  ): Promise<AppActionResult> {
    const auth = readAuth(credential.accessToken);
    try {
      switch (actionId) {
        case 'list_projects': {
          const { data } = await this.call(auth, 'GET', '/v9/projects', {
            params: {
              limit: boundedInt(input['limit'], 30, 1, 100),
              ...(textOf(input['search']) ? { search: textOf(input['search']) } : {}),
            },
          });
          const projects = ((data.projects ?? []) as any[]).map(compactProject);
          return { success: true, message: `Found ${projects.length} project(s).`, data: { projects } };
        }
        case 'get_project': {
          const { projectId } = requireText(input, 'projectId');
          const { data } = await this.call(auth, 'GET', `/v9/projects/${encodeURIComponent(projectId)}`);
          return { success: true, message: `Fetched ${data.name}.`, data: { project: compactProject(data) } };
        }
        case 'list_deployments': {
          const { data } = await this.call(auth, 'GET', '/v6/deployments', {
            params: {
              limit: boundedInt(input['limit'], 20, 1, 100),
              ...(textOf(input['projectId']) ? { projectId: textOf(input['projectId']) } : {}),
              ...(textOf(input['target']) ? { target: textOf(input['target']) } : {}),
              ...(textOf(input['state']) ? { state: textOf(input['state']).toUpperCase() } : {}),
            },
          });
          const deployments = ((data.deployments ?? []) as any[]).map(compactDeployment);
          return { success: true, message: `Found ${deployments.length} deployment(s).`, data: { deployments } };
        }
        case 'get_deployment': {
          const { deploymentId } = requireText(input, 'deploymentId');
          const { data } = await this.call(auth, 'GET', `/v13/deployments/${encodeURIComponent(deploymentId)}`);
          return { success: true, message: `Deployment is ${data.readyState}.`, data: { deployment: compactDeployment(data) } };
        }
        case 'get_build_logs': {
          const { deploymentId } = requireText(input, 'deploymentId');
          const { data } = await this.call(auth, 'GET', `/v3/deployments/${encodeURIComponent(deploymentId)}/events`, {
            params: { limit: -1, builds: 1 },
          });
          const keep = boundedInt(input['limit'], 100, 1, 500);
          const lines = ((Array.isArray(data) ? data : []) as any[])
            .map((e) => ({ type: e.type, text: String(e.text ?? e.payload?.text ?? '').trimEnd() }))
            .filter((e) => e.text)
            .slice(-keep);
          return { success: true, message: `Read ${lines.length} log line(s).`, data: { logs: lines } };
        }
        case 'list_domains': {
          const projectId = textOf(input['projectId']);
          const { data } = projectId
            ? await this.call(auth, 'GET', `/v9/projects/${encodeURIComponent(projectId)}/domains`)
            : await this.call(auth, 'GET', '/v5/domains');
          const domains = ((data.domains ?? []) as any[]).map((d) => ({
            name: d.name,
            verified: d.verified ?? null,
            redirect: d.redirect ?? null,
            gitBranch: d.gitBranch ?? null,
            expiresAt: d.expiresAt ?? null,
          }));
          return { success: true, message: `Found ${domains.length} domain(s).`, data: { domains } };
        }
        case 'list_env_vars': {
          const { projectId } = requireText(input, 'projectId');
          const { data } = await this.call(auth, 'GET', `/v10/projects/${encodeURIComponent(projectId)}/env`);
          // Names only: a value, even an encrypted one, is never handed to an agent.
          const variables = ((data.envs ?? []) as any[]).map((e) => ({
            key: e.key,
            target: e.target,
            type: e.type,
            gitBranch: e.gitBranch ?? null,
            updatedAt: e.updatedAt ?? null,
          }));
          return { success: true, message: `Found ${variables.length} variable(s).`, data: { variables } };
        }
        case 'redeploy': {
          const { deploymentId } = requireText(input, 'deploymentId');
          const { data: source } = await this.call(auth, 'GET', `/v13/deployments/${encodeURIComponent(deploymentId)}`);
          const { data } = await this.call(auth, 'POST', '/v13/deployments', {
            params: { forceNew: 1 },
            data: { name: source.name, deploymentId: source.id, target: source.target ?? undefined },
          });
          return { success: true, message: `Redeploying ${source.name}.`, data: { deployment: compactDeployment(data) } };
        }
        case 'cancel_deployment': {
          const { deploymentId } = requireText(input, 'deploymentId');
          const { data } = await this.call(auth, 'PATCH', `/v12/deployments/${encodeURIComponent(deploymentId)}/cancel`);
          return { success: true, message: 'Deployment canceled.', data: { deployment: compactDeployment(data) } };
        }
        default:
          throw new BadRequestException(`Unknown Vercel action '${actionId}'.`);
      }
    } catch (error) {
      if (error instanceof ConnectorHttpError) return { success: false, message: error.message };
      throw error;
    }
  }
}
