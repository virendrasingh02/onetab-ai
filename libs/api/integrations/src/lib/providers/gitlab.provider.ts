import { BadRequestException, Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface GitLabAuth extends Record<string, string> {
  token: string;
  /** Self-managed instance, e.g. https://gitlab.example.com. Empty = gitlab.com. */
  baseUrl: string;
}

/** `https://host[:port]` only — no path, no credentials, no plain http. */
export function gitlabOrigin(value: string | undefined): string {
  const raw = (value ?? '').trim();
  if (!raw) return 'https://gitlab.com';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BadRequestException('GitLab URL must look like https://gitlab.example.com.');
  }
  if (url.protocol !== 'https:' || url.username || url.password) throw new BadRequestException('GitLab URL must be an https:// address without credentials.');
  return url.origin;
}

const project = (input: Record<string, unknown>) => encodeURIComponent(requireText(input, 'project')['project']);

const compactMr = (m: any) => ({ id: m.iid, title: m.title, state: m.state, author: m.author?.username ?? null, sourceBranch: m.source_branch, targetBranch: m.target_branch, draft: !!m.draft, url: m.web_url, updatedAt: m.updated_at, pipelineStatus: m.head_pipeline?.status ?? null });
const compactPipeline = (p: any) => ({ id: p.id, status: p.status, ref: p.ref, sha: String(p.sha ?? '').slice(0, 8), source: p.source ?? null, url: p.web_url, createdAt: p.created_at, updatedAt: p.updated_at });
const compactIssue = (i: any) => ({ id: i.iid, title: i.title, state: i.state, labels: i.labels ?? [], assignees: (i.assignees ?? []).map((a: any) => a.username), url: i.web_url, updatedAt: i.updated_at });

/**
 * GitLab (gitlab.com or self-managed) with a personal, group or project
 * access token. Reads are free; retrying or cancelling a pipeline and
 * opening issues ask for approval.
 */
@Injectable()
export class GitLabProvider extends RestConnector<GitLabAuth> {
  readonly providerId = 'GITLAB';
  protected readonly app = 'GitLab';
  protected readonly requiredFields = ['token'] as const;
  protected readonly secrets = ['token'];

  protected capabilities() {
    return {
      displayName: 'GitLab',
      description: 'Projects, merge requests, pipelines and issues — triage failed pipelines and summarise merge requests.',
      category: 'Developer tools',
      connectorCategory: 'developer_tools' as const,
      authType: 'BEARER' as const,
      scopes: [
        { scope: 'read_api', description: 'Read projects, merge requests, pipelines and issues', required: true },
        { scope: 'api', description: 'Retry/cancel pipelines and open issues (each asks for approval)' },
      ],
      credentialFields: [
        { key: 'token', label: 'Access token', secret: true, placeholder: 'glpat-…', help: 'User Settings → Access tokens. read_api is enough for reads; api for retries and issues.' },
        { key: 'baseUrl', label: 'GitLab URL', optional: true, placeholder: 'https://gitlab.com', help: 'Only for self-managed GitLab.' },
      ],
    };
  }

  protected override validate(auth: GitLabAuth) {
    gitlabOrigin(auth.baseUrl);
  }

  protected target(auth: GitLabAuth) {
    return { baseUrl: `${gitlabOrigin(auth.baseUrl)}/api/v4`, headers: { 'PRIVATE-TOKEN': auth.token } };
  }

  protected async ping(_auth: GitLabAuth, call: RestCall) {
    const me = await call('GET', '/user');
    return { label: `@${me.username}`, accountId: String(me.id), email: me.email ?? me.public_email ?? undefined };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [
      { id: 'pipeline_failed', label: 'Pipeline failed', description: 'Starts the agent for each failed pipeline in a project.', pollActionId: 'list_pipelines', defaultInput: { status: 'failed' }, inputSchema: { type: 'object', properties: { project: str('group/project') }, required: ['project'] }, itemsPath: 'pipelines', idField: 'id' },
      { id: 'new_merge_request', label: 'New merge request', description: 'Starts the agent for each new open merge request.', pollActionId: 'list_merge_requests', inputSchema: { type: 'object', properties: { project: str('group/project') }, required: ['project'] }, itemsPath: 'mergeRequests', idField: 'id' },
    ];
  }

  protected actions(): RestAction<GitLabAuth>[] {
    const limit = { limit: num('Max results (default 20).') };
    const projectProp = { project: str('Project path (group/project) or numeric id.') };
    const lim = (input: Record<string, unknown>) => boundedInt(input['limit'], 20, 1, 100);
    return [
      action({ id: 'list_projects', label: 'List projects', description: 'Projects you are a member of, recently active first.', level: 'read', properties: { ...limit, search: str('Name to search.') } }, async ({ input, call }) => {
        const rows = (await call('GET', '/projects', { params: { membership: true, order_by: 'last_activity_at', per_page: lim(input), ...(textOf(input['search']) ? { search: textOf(input['search']) } : {}) } })) as any[];
        const projects = rows.map((p) => ({ id: p.id, path: p.path_with_namespace, defaultBranch: p.default_branch ?? null, url: p.web_url, lastActivityAt: p.last_activity_at }));
        return { message: `Found ${projects.length} project(s).`, data: { projects } };
      }),
      action({ id: 'list_merge_requests', label: 'List merge requests', description: 'Merge requests in a project.', level: 'read', properties: { ...projectProp, ...limit, state: str('opened, merged, closed or all (default opened).') }, required: ['project'] }, async ({ input, call }) => {
        const rows = (await call('GET', `/projects/${project(input)}/merge_requests`, { params: { state: textOf(input['state']) || 'opened', order_by: 'updated_at', per_page: lim(input) } })) as any[];
        const mergeRequests = rows.map(compactMr);
        return { message: `Found ${mergeRequests.length} merge request(s).`, data: { mergeRequests } };
      }),
      action({ id: 'get_merge_request', label: 'Get merge request', description: 'One merge request with its description and pipeline.', level: 'read', properties: { ...projectProp, iid: num('Merge request number (!123 → 123).') }, required: ['project', 'iid'] }, async ({ input, call }) => {
        const m = await call('GET', `/projects/${project(input)}/merge_requests/${boundedInt(input['iid'], 0, 1, 1e9)}`);
        return { message: 'Fetched the merge request.', data: { mergeRequest: { ...compactMr(m), description: m.description ?? '', hasConflicts: !!m.has_conflicts, mergeStatus: m.detailed_merge_status ?? m.merge_status ?? null } } };
      }),
      action({ id: 'list_pipelines', label: 'List pipelines', description: 'Pipelines in a project, newest first.', level: 'read', properties: { ...projectProp, ...limit, status: str('running, success, failed, canceled…'), ref: str('Branch or tag.') }, required: ['project'] }, async ({ input, call }) => {
        const rows = (await call('GET', `/projects/${project(input)}/pipelines`, { params: { per_page: lim(input), order_by: 'id', sort: 'desc', ...(textOf(input['status']) ? { status: textOf(input['status']) } : {}), ...(textOf(input['ref']) ? { ref: textOf(input['ref']) } : {}) } })) as any[];
        const pipelines = rows.map(compactPipeline);
        return { message: `Found ${pipelines.length} pipeline(s).`, data: { pipelines } };
      }),
      action({ id: 'get_pipeline_jobs', label: 'Get pipeline jobs', description: 'Jobs of a pipeline with their status — find which one failed.', level: 'read', properties: { ...projectProp, pipelineId: num('Pipeline id.') }, required: ['project', 'pipelineId'] }, async ({ input, call }) => {
        const rows = (await call('GET', `/projects/${project(input)}/pipelines/${boundedInt(input['pipelineId'], 0, 1, Number.MAX_SAFE_INTEGER)}/jobs`, { params: { per_page: 100 } })) as any[];
        const jobs = rows.map((j) => ({ id: j.id, name: j.name, stage: j.stage, status: j.status, failureReason: j.failure_reason ?? null, durationSec: j.duration ?? null, url: j.web_url }));
        return { message: `Found ${jobs.length} job(s).`, data: { jobs } };
      }),
      action({ id: 'get_job_log', label: 'Get job log', description: 'The last part of a job’s log.', level: 'read', properties: { ...projectProp, jobId: num('Job id.') }, required: ['project', 'jobId'] }, async ({ input, call }) => {
        const log = await call<string>('GET', `/projects/${project(input)}/jobs/${boundedInt(input['jobId'], 0, 1, Number.MAX_SAFE_INTEGER)}/trace`);
        const text = typeof log === 'string' ? log : JSON.stringify(log);
        return { message: 'Fetched the job log.', data: { log: text.slice(-8000) } };
      }),
      action({ id: 'list_issues', label: 'List issues', description: 'Issues in a project.', level: 'read', properties: { ...projectProp, ...limit, state: str('opened, closed or all.') }, required: ['project'] }, async ({ input, call }) => {
        const rows = (await call('GET', `/projects/${project(input)}/issues`, { params: { state: textOf(input['state']) || 'opened', per_page: lim(input) } })) as any[];
        const issues = rows.map(compactIssue);
        return { message: `Found ${issues.length} issue(s).`, data: { issues } };
      }),
      action({ id: 'create_issue', label: 'Create issue', description: 'Open an issue in a project.', level: 'write', properties: { ...projectProp, title: str('Title.'), description: str('Markdown description.'), labels: str('Comma-separated labels.') }, required: ['project', 'title'] }, async ({ input, call }) => {
        const { title } = requireText(input, 'title');
        const i = await call('POST', `/projects/${project(input)}/issues`, { data: { title, description: textOf(input['description']) || undefined, labels: textOf(input['labels']) || undefined } });
        return { message: `Opened issue #${i.iid}.`, data: { issue: compactIssue(i) } };
      }),
      action({ id: 'retry_pipeline', label: 'Retry pipeline', description: 'Retry the failed jobs of a pipeline.', level: 'write', properties: { ...projectProp, pipelineId: num('Pipeline id.') }, required: ['project', 'pipelineId'] }, async ({ input, call }) => {
        const p = await call('POST', `/projects/${project(input)}/pipelines/${boundedInt(input['pipelineId'], 0, 1, Number.MAX_SAFE_INTEGER)}/retry`);
        return { message: 'Pipeline retried.', data: { pipeline: compactPipeline(p) } };
      }),
      action({ id: 'cancel_pipeline', label: 'Cancel pipeline', description: 'Cancel a running pipeline.', level: 'destructive', properties: { ...projectProp, pipelineId: num('Pipeline id.') }, required: ['project', 'pipelineId'] }, async ({ input, call }) => {
        const p = await call('POST', `/projects/${project(input)}/pipelines/${boundedInt(input['pipelineId'], 0, 1, Number.MAX_SAFE_INTEGER)}/cancel`);
        return { message: 'Pipeline canceled.', data: { pipeline: compactPipeline(p) } };
      }),
    ];
  }
}
