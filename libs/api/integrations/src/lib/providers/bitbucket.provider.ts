import { Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface BitbucketAuth extends Record<string, string> {
  /** Atlassian account email (API tokens) or Bitbucket username (app passwords). */
  username: string;
  apiToken: string;
  workspace: string;
}

const slug = (value: string) => encodeURIComponent(value.trim());

const compactPr = (p: any) => ({ id: p.id, title: p.title, state: p.state, author: p.author?.display_name ?? null, source: p.source?.branch?.name ?? null, destination: p.destination?.branch?.name ?? null, url: p.links?.html?.href ?? null, updatedAt: p.updated_on, commentCount: p.comment_count ?? 0 });
const compactPipeline = (p: any) => ({ id: p.uuid, number: p.build_number, state: p.state?.name ?? null, result: p.state?.result?.name ?? null, ref: p.target?.ref_name ?? null, commit: String(p.target?.commit?.hash ?? '').slice(0, 8), createdAt: p.created_on, completedAt: p.completed_on ?? null, durationSec: p.duration_in_seconds ?? null });

/**
 * Bitbucket Cloud with an Atlassian API token (or a legacy app password) for
 * one workspace. Reads are free; triggering a pipeline asks for approval.
 */
@Injectable()
export class BitbucketProvider extends RestConnector<BitbucketAuth> {
  readonly providerId = 'BITBUCKET';
  protected readonly app = 'Bitbucket';
  protected readonly requiredFields = ['username', 'apiToken', 'workspace'] as const;
  protected readonly secrets = ['apiToken'];

  protected capabilities() {
    return {
      displayName: 'Bitbucket',
      description: 'Repositories, pull requests and Pipelines in a Bitbucket Cloud workspace.',
      category: 'Developer tools',
      connectorCategory: 'developer_tools' as const,
      authType: 'BASIC' as const,
      scopes: [
        { scope: 'read', description: 'Read repositories, pull requests and pipelines', required: true },
        { scope: 'pipeline:write', description: 'Run pipelines (asks for approval)' },
      ],
      credentialFields: [
        { key: 'username', label: 'Email or username', placeholder: 'you@company.com', help: 'Your Atlassian account email for an API token, or your Bitbucket username for an app password.' },
        { key: 'apiToken', label: 'API token', secret: true, help: 'Atlassian account → Security → API tokens (scoped to Bitbucket), or a Bitbucket app password.' },
        { key: 'workspace', label: 'Workspace', placeholder: 'my-team', help: 'The workspace slug from bitbucket.org/<workspace>.' },
      ],
    };
  }

  protected target(auth: BitbucketAuth) {
    return { baseUrl: 'https://api.bitbucket.org/2.0', basic: { username: auth.username, password: auth.apiToken } };
  }

  protected async ping(auth: BitbucketAuth, call: RestCall) {
    const ws = await call('GET', `/workspaces/${slug(auth.workspace)}`);
    return { label: ws.name ?? auth.workspace, accountId: ws.uuid };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    const repo = { type: 'object', properties: { repo: str('Repository slug.') }, required: ['repo'] };
    return [
      { id: 'new_pull_request', label: 'New pull request', description: 'Starts the agent for each new open pull request.', pollActionId: 'list_pull_requests', inputSchema: repo, itemsPath: 'pullRequests', idField: 'id' },
      { id: 'pipeline_failed', label: 'Pipeline failed', description: 'Starts the agent for each failed pipeline.', pollActionId: 'list_pipelines', defaultInput: { failedOnly: true }, inputSchema: repo, itemsPath: 'pipelines', idField: 'id' },
    ];
  }

  protected actions(): RestAction<BitbucketAuth>[] {
    const limit = { limit: num('Max results (default 20).') };
    const repo = { repo: str('Repository slug.') };
    const lim = (input: Record<string, unknown>) => boundedInt(input['limit'], 20, 1, 50);
    const base = (auth: BitbucketAuth, input: Record<string, unknown>) => `/repositories/${slug(auth.workspace)}/${slug(requireText(input, 'repo')['repo'])}`;
    return [
      action({ id: 'list_repositories', label: 'List repositories', description: 'Repositories in the workspace, recently updated first.', level: 'read', properties: limit }, async ({ auth, input, call }) => {
        const res = await call('GET', `/repositories/${slug(auth.workspace)}`, { params: { pagelen: lim(input), sort: '-updated_on' } });
        const repositories = ((res.values ?? []) as any[]).map((r) => ({ slug: r.slug, name: r.name, private: r.is_private, mainBranch: r.mainbranch?.name ?? null, updatedAt: r.updated_on, url: r.links?.html?.href ?? null }));
        return { message: `Found ${repositories.length} repositor${repositories.length === 1 ? 'y' : 'ies'}.`, data: { repositories } };
      }),
      action({ id: 'list_pull_requests', label: 'List pull requests', description: 'Pull requests in a repository.', level: 'read', properties: { ...repo, ...limit, state: str('OPEN, MERGED, DECLINED (default OPEN).') }, required: ['repo'] }, async ({ auth, input, call }) => {
        const res = await call('GET', `${base(auth, input)}/pullrequests`, { params: { pagelen: lim(input), state: (textOf(input['state']) || 'OPEN').toUpperCase() } });
        const pullRequests = ((res.values ?? []) as any[]).map(compactPr);
        return { message: `Found ${pullRequests.length} pull request(s).`, data: { pullRequests } };
      }),
      action({ id: 'get_pull_request', label: 'Get pull request', description: 'One pull request with its description.', level: 'read', properties: { ...repo, id: num('Pull request id.') }, required: ['repo', 'id'] }, async ({ auth, input, call }) => {
        const p = await call('GET', `${base(auth, input)}/pullrequests/${boundedInt(input['id'], 0, 1, 1e9)}`);
        return { message: 'Fetched the pull request.', data: { pullRequest: { ...compactPr(p), description: p.description ?? '' } } };
      }),
      action({ id: 'list_pipelines', label: 'List pipelines', description: 'Pipelines in a repository, newest first.', level: 'read', properties: { ...repo, ...limit, failedOnly: { type: 'boolean', description: 'Only failed pipelines.' } }, required: ['repo'] }, async ({ auth, input, call }) => {
        const res = await call('GET', `${base(auth, input)}/pipelines`, { params: { pagelen: lim(input), sort: '-created_on' } });
        let pipelines = ((res.values ?? []) as any[]).map(compactPipeline);
        if (input['failedOnly'] === true) pipelines = pipelines.filter((p) => p.result === 'FAILED' || p.result === 'ERROR');
        return { message: `Found ${pipelines.length} pipeline(s).`, data: { pipelines } };
      }),
      action({ id: 'run_pipeline', label: 'Run pipeline', description: 'Start the pipeline for a branch.', level: 'write', properties: { ...repo, branch: str('Branch to build.') }, required: ['repo', 'branch'] }, async ({ auth, input, call }) => {
        const { branch } = requireText(input, 'branch');
        const p = await call('POST', `${base(auth, input)}/pipelines`, { data: { target: { type: 'pipeline_ref_target', ref_type: 'branch', ref_name: branch } } });
        return { message: `Started pipeline #${p.build_number} on ${branch}.`, data: { pipeline: compactPipeline(p) } };
      }),
    ];
  }
}
