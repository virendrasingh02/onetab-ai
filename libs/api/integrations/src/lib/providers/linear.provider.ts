import { BadRequestException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AppActionDefinition,
  AppActionResult,
  IntegrationAccount,
  IntegrationCapabilities,
} from '@org/types';
import axios from 'axios';
import type {
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  TokenResult,
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';

const LINEAR_SCOPES = ['read', 'write'];
const GRAPHQL_URL = 'https://api.linear.app/graphql';

/** Every issue field a screen or the AI would plausibly need, in one place. */
const ISSUE_FIELDS = `
  id
  identifier
  title
  description
  priority
  priorityLabel
  url
  createdAt
  updatedAt
  dueDate
  state { id name type }
  team { id key name }
  assignee { id name email }
  labels { nodes { id name color } }
  cycle { id number name }
`;

@Injectable()
export class LinearProvider implements ProviderAdapter {
  readonly providerId = 'LINEAR';
  private readonly logger = new Logger(LinearProvider.name);

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Linear',
      description:
        'Teams, projects, cycles, and issues — read and manage real Linear issues, with each team\'s own identifier prefix (e.g. ENG-123).',
      category: 'Productivity & Project Management',
      authType: 'OAUTH2',
      supportsSync: true,
      supportsWebhooks: true,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      scopes: [
        { scope: 'read', description: 'Read your Linear workspace data', required: true },
        { scope: 'write', description: 'Create and update issues on your behalf', required: false },
      ],
    };
  }

  private clientCreds() {
    const clientId = this.config.get<string>('LINEAR_CLIENT_ID');
    const clientSecret = this.config.get<string>('LINEAR_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        'Linear OAuth is not configured on this server (LINEAR_CLIENT_ID / LINEAR_CLIENT_SECRET missing). ' +
          'An administrator must register an OAuth application at linear.app/settings/api/applications first.',
      );
    }
    return { clientId, clientSecret };
  }

  private redirectUri(override?: string) {
    return (
      override ||
      this.config.get<string>('LINEAR_REDIRECT_URI') ||
      'http://localhost:3000/api/v1/integrations/linear/callback'
    );
  }

  async getAuthorizationUrl(
    state: string,
    options?: { redirectUri?: string; scopes?: string[] },
  ): Promise<string> {
    const { clientId } = this.clientCreds();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri(options?.redirectUri),
      response_type: 'code',
      scope: (options?.scopes?.length ? options.scopes : LINEAR_SCOPES).join(','),
      state,
      prompt: 'consent',
    });
    return `https://linear.app/oauth/authorize?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    _state: string,
    options?: { redirectUri?: string },
  ): Promise<TokenResult> {
    const { clientId, clientSecret } = this.clientCreds();
    try {
      const tokenRes = await axios.post<{
        access_token: string;
        token_type: string;
        expires_in?: number;
        scope: string;
      }>(
        'https://api.linear.app/oauth/token',
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: this.redirectUri(options?.redirectUri),
          grant_type: 'authorization_code',
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const accessToken = tokenRes.data.access_token;
      const viewer = await this.graphql<{ viewer: { id: string; name: string; email: string; avatarUrl?: string } }>(
        accessToken,
        `query { viewer { id name email avatarUrl } }`,
      );

      return {
        accessToken,
        // Linear OAuth tokens do not expire under the standard app flow.
        scopes: tokenRes.data.scope ? tokenRes.data.scope.split(',') : LINEAR_SCOPES,
        accountId: viewer.viewer.id,
        accountEmail: viewer.viewer.email,
        accountName: viewer.viewer.name,
        metadata: { avatarUrl: viewer.viewer.avatarUrl },
      };
    } catch (err: any) {
      this.logger.error(`Linear OAuth token exchange failed: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`);
      throw new UnauthorizedException('Failed to exchange Linear authorization code.');
    }
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const res = await this.graphql<{ viewer: { id: string; name: string; email: string; avatarUrl?: string } }>(
      credential.accessToken,
      `query { viewer { id name email avatarUrl } }`,
    );
    return {
      id: credential.id,
      provider: this.providerId,
      accountId: res.viewer.id,
      email: res.viewer.email,
      name: res.viewer.name,
      avatarUrl: res.viewer.avatarUrl,
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
    };
  }

  async disconnect(credential: ResolvedCredential): Promise<void> {
    try {
      await axios.post(
        'https://api.linear.app/oauth/revoke',
        new URLSearchParams({ access_token: credential.accessToken }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );
    } catch (err: any) {
      this.logger.warn(`Linear token revocation notice: ${err.message}`);
    }
  }

  async testConnection(
    _config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    if (!credential) return { success: false, message: 'No credential provided for Linear connection test.' };
    try {
      const account = await this.getAccount(credential);
      return { success: true, message: `Successfully connected to Linear as ${account.email}`, details: account };
    } catch (err: any) {
      return { success: false, message: `Linear connection test failed: ${err.message}` };
    }
  }

  async sync(credential: ResolvedCredential): Promise<SyncResult> {
    const res = await this.graphql<{ issues: { nodes: unknown[] } }>(
      credential.accessToken,
      `query { issues(filter: { assignee: { isMe: { eq: true } } }, first: 50) { nodes { id } } }`,
    );
    return { success: true, itemsProcessed: res.issues.nodes.length };
  }

  async handleWebhook(payload: unknown, headers: Record<string, string>): Promise<WebhookProcessResult> {
    const eventType = (payload as any)?.type || headers['linear-event'] || 'linear.event';
    return { success: true, eventType: `linear.${String(eventType).toLowerCase()}`, data: payload };
  }

  getActions(): AppActionDefinition[] {
    return [
      {
        id: 'list_teams',
        label: 'List teams',
        description: "List your Linear teams and each one's issue-identifier prefix (e.g. ENG).",
        inputSchema: { type: 'object', properties: {} },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_projects',
        label: 'List projects',
        description: 'List projects, optionally scoped to one team.',
        inputSchema: { type: 'object', properties: { teamId: { type: 'string' } } },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_issues',
        label: 'List issues',
        description: 'List issues, filterable by assignment to you, team, priority, or state.',
        inputSchema: {
          type: 'object',
          properties: {
            assignedToMe: { type: 'boolean' },
            teamId: { type: 'string' },
            priority: { type: 'number', description: '0=none,1=urgent,2=high,3=medium,4=low' },
            stateName: { type: 'string' },
          },
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'get_issue',
        label: 'Get issue',
        description: "Fetch one issue by its identifier (e.g. ENG-123) or internal id.",
        inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'search_issues',
        label: 'Search issues',
        description: 'Free-text search across issue titles and descriptions.',
        inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'list_cycles',
        label: 'List cycles',
        description: "List a team's cycles (sprints).",
        inputSchema: { type: 'object', properties: { teamId: { type: 'string' } }, required: ['teamId'] },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'create_issue',
        label: 'Create issue',
        description: 'Create a new issue on a team.',
        inputSchema: {
          type: 'object',
          properties: {
            teamId: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            priority: { type: 'number' },
            assigneeId: { type: 'string' },
          },
          required: ['teamId', 'title'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'update_issue',
        label: 'Update issue',
        description: "Update an issue's state, priority, or assignee (e.g. move to In Progress).",
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            stateName: { type: 'string' },
            priority: { type: 'number' },
            assigneeId: { type: 'string' },
            title: { type: 'string' },
          },
          required: ['id'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
      {
        id: 'add_comment',
        label: 'Comment on issue',
        description: 'Post a comment on an issue.',
        inputSchema: {
          type: 'object',
          properties: { issueId: { type: 'string' }, body: { type: 'string' } },
          required: ['issueId', 'body'],
        },
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
    const token = credential.accessToken;

    switch (actionId) {
      case 'list_teams': {
        const res = await this.graphql<{ teams: { nodes: Array<{ id: string; key: string; name: string }> } }>(
          token,
          `query { teams(first: 100) { nodes { id key name } } }`,
        );
        return { success: true, message: `Found ${res.teams.nodes.length} team(s).`, data: { teams: res.teams.nodes } };
      }
      case 'list_projects': {
        const teamId = str(input['teamId']);
        const res = await this.graphql<{ projects: { nodes: unknown[] } }>(
          token,
          `query Projects($filter: ProjectFilter) { projects(first: 100, filter: $filter) { nodes { id name state url targetDate } } }`,
          { filter: teamId ? { accessibleTeams: { some: { id: { eq: teamId } } } } : undefined },
        );
        return { success: true, message: `Found ${res.projects.nodes.length} project(s).`, data: { projects: res.projects.nodes } };
      }
      case 'list_issues': {
        const filter: Record<string, unknown> = {};
        if (input['assignedToMe']) filter['assignee'] = { isMe: { eq: true } };
        if (input['teamId']) filter['team'] = { id: { eq: input['teamId'] } };
        if (typeof input['priority'] === 'number') filter['priority'] = { eq: input['priority'] };
        if (input['stateName']) filter['state'] = { name: { eqIgnoreCase: input['stateName'] } };

        const res = await this.graphql<{ issues: { nodes: unknown[] } }>(
          token,
          `query Issues($filter: IssueFilter) { issues(first: 50, filter: $filter, orderBy: updatedAt) { nodes { ${ISSUE_FIELDS} } } }`,
          { filter },
        );
        return { success: true, message: `Found ${res.issues.nodes.length} issue(s).`, data: { issues: res.issues.nodes } };
      }
      case 'get_issue': {
        const res = await this.graphql<{ issue: unknown }>(
          token,
          `query Issue($id: String!) { issue(id: $id) { ${ISSUE_FIELDS} comments { nodes { id body user { name } createdAt } } } }`,
          { id: String(input['id'] ?? '') },
        );
        return { success: true, message: 'Fetched issue.', data: { issue: res.issue } };
      }
      case 'search_issues': {
        const query = String(input['query'] ?? '');
        const res = await this.graphql<{ issues: { nodes: unknown[] } }>(
          token,
          `query Search($filter: IssueFilter) { issues(first: 30, filter: $filter) { nodes { ${ISSUE_FIELDS} } } }`,
          { filter: { or: [{ title: { containsIgnoreCase: query } }, { description: { containsIgnoreCase: query } }] } },
        );
        return { success: true, message: `Found ${res.issues.nodes.length} matching issue(s).`, data: { issues: res.issues.nodes } };
      }
      case 'list_cycles': {
        const res = await this.graphql<{ team: { cycles: { nodes: unknown[] } } }>(
          token,
          `query Cycles($teamId: String!) { team(id: $teamId) { cycles(first: 20) { nodes { id number name startsAt endsAt completedAt } } } }`,
          { teamId: String(input['teamId'] ?? '') },
        );
        return { success: true, message: `Found ${res.team.cycles.nodes.length} cycle(s).`, data: { cycles: res.team.cycles.nodes } };
      }
      case 'create_issue': {
        const res = await this.graphql<{ issueCreate: { success: boolean; issue: any } }>(
          token,
          `mutation Create($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { ${ISSUE_FIELDS} } } }`,
          {
            input: {
              teamId: input['teamId'],
              title: input['title'],
              description: input['description'],
              priority: input['priority'],
              assigneeId: input['assigneeId'],
            },
          },
        );
        if (!res.issueCreate.success) throw new BadRequestException('Linear refused to create the issue.');
        return { success: true, message: `Created ${res.issueCreate.issue.identifier}.`, data: { issue: res.issueCreate.issue } };
      }
      case 'update_issue': {
        let stateId: string | undefined;
        if (input['stateName']) {
          const current = await this.graphql<{ issue: { team: { id: string } } }>(
            token,
            `query($id: String!) { issue(id: $id) { team { id } } }`,
            { id: String(input['id']) },
          );
          const states = await this.graphql<{ workflowStates: { nodes: Array<{ id: string; name: string }> } }>(
            token,
            `query($teamId: ID) { workflowStates(filter: { team: { id: { eq: $teamId } } }) { nodes { id name } } }`,
            { teamId: current.issue.team.id },
          );
          const match = states.workflowStates.nodes.find(
            (s) => s.name.toLowerCase() === String(input['stateName']).toLowerCase(),
          );
          if (!match) {
            throw new BadRequestException(`No workflow state named "${input['stateName']}" on this issue's team.`);
          }
          stateId = match.id;
        }

        const res = await this.graphql<{ issueUpdate: { success: boolean; issue: any } }>(
          token,
          `mutation Update($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { ${ISSUE_FIELDS} } } }`,
          {
            id: String(input['id']),
            input: {
              stateId,
              priority: input['priority'],
              assigneeId: input['assigneeId'],
              title: input['title'],
            },
          },
        );
        if (!res.issueUpdate.success) throw new BadRequestException('Linear refused to update the issue.');
        return { success: true, message: `Updated ${res.issueUpdate.issue.identifier}.`, data: { issue: res.issueUpdate.issue } };
      }
      case 'add_comment': {
        const res = await this.graphql<{ commentCreate: { success: boolean; comment: any } }>(
          token,
          `mutation Comment($input: CommentCreateInput!) { commentCreate(input: $input) { success comment { id body createdAt } } }`,
          { input: { issueId: input['issueId'], body: input['body'] } },
        );
        if (!res.commentCreate.success) throw new BadRequestException('Linear refused to post the comment.');
        return { success: true, message: 'Comment posted.', data: { comment: res.commentCreate.comment } };
      }
      default:
        throw new BadRequestException(`Unknown Linear action '${actionId}'.`);
    }
  }

  private async graphql<T>(token: string, query: string, variables?: Record<string, unknown>): Promise<T> {
    try {
      const res = await axios.post<{ data?: T; errors?: Array<{ message: string }> }>(
        GRAPHQL_URL,
        { query, variables },
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );
      if (res.data.errors?.length) {
        throw new BadRequestException(`Linear API error: ${res.data.errors.map((e) => e.message).join('; ')}`);
      }
      if (!res.data.data) throw new BadRequestException('Linear API returned no data.');
      return res.data.data;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      if (err.response?.status === 401) {
        throw new UnauthorizedException('Linear access token is invalid or has been revoked.');
      }
      throw err;
    }
  }
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}
