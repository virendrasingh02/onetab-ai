import { BadRequestException, Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface CircleCiAuth extends Record<string, string> {
  token: string;
  /** e.g. gh/acme/api — the project the triggers and defaults use. */
  projectSlug: string;
}

/** `gh/org/repo`, `bb/org/repo` or `circleci/<org-id>/<project-id>`. */
export function circleProjectSlug(value: unknown): string {
  const s = textOf(value);
  if (!/^(gh|github|bb|bitbucket|circleci)\/[\w.-]+\/[\w.-]+$/.test(s)) {
    throw new BadRequestException('Project slug must look like gh/org/repo, bb/org/repo or circleci/<org>/<project>.');
  }
  return s.split('/').map(encodeURIComponent).join('/');
}

const compactPipeline = (p: any) => ({ id: p.id, number: p.number, state: p.state, branch: p.vcs?.branch ?? null, commit: String(p.vcs?.revision ?? '').slice(0, 8), trigger: p.trigger?.type ?? null, createdAt: p.created_at });
const compactWorkflow = (w: any) => ({ id: w.id, name: w.name, status: w.status, pipelineNumber: w.pipeline_number, createdAt: w.created_at, stoppedAt: w.stopped_at ?? null });

/**
 * CircleCI v2 API with a personal API token. Reads are free; rerunning or
 * cancelling a workflow and triggering a pipeline ask for approval.
 */
@Injectable()
export class CircleCiProvider extends RestConnector<CircleCiAuth> {
  readonly providerId = 'CIRCLECI';
  protected readonly app = 'CircleCI';
  protected readonly requiredFields = ['token'] as const;
  protected readonly secrets = ['token'];

  protected capabilities() {
    return {
      displayName: 'CircleCI',
      description: 'Pipelines, workflows and jobs — find what failed and rerun it.',
      category: 'Developer tools',
      connectorCategory: 'developer_tools' as const,
      authType: 'API_KEY_HEADER' as const,
      scopes: [
        { scope: 'read', description: 'Read pipelines, workflows and jobs', required: true },
        { scope: 'write', description: 'Trigger pipelines, rerun and cancel workflows (each asks for approval)' },
      ],
      credentialFields: [
        { key: 'token', label: 'Personal API token', secret: true, help: 'User Settings → Personal API Tokens.' },
        { key: 'projectSlug', label: 'Default project', optional: true, placeholder: 'gh/acme/api', help: 'Used when an action or trigger names no project.' },
      ],
    };
  }

  protected override validate(auth: CircleCiAuth) {
    if (auth.projectSlug) circleProjectSlug(auth.projectSlug);
  }

  protected target(auth: CircleCiAuth) {
    return { baseUrl: 'https://circleci.com/api/v2', headers: { 'Circle-Token': auth.token } };
  }

  protected async ping(_auth: CircleCiAuth, call: RestCall) {
    const me = await call('GET', '/me');
    return { label: me.login ?? me.name ?? 'CircleCI user', accountId: me.id };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [{ id: 'workflow_failed', label: 'Workflow failed', description: 'Starts the agent for each failed workflow in the project.', pollActionId: 'list_failed_workflows', itemsPath: 'workflows', idField: 'id' }];
  }

  protected actions(): RestAction<CircleCiAuth>[] {
    const projectProp = { project: str('Project slug, e.g. gh/acme/api. Defaults to the connection’s project.') };
    const slugOf = (auth: CircleCiAuth, input: Record<string, unknown>) => circleProjectSlug(textOf(input['project']) || auth.projectSlug);
    const pipelines = async (call: RestCall, slug: string, branch?: string) =>
      ((await call('GET', `/project/${slug}/pipeline`, { params: branch ? { branch } : {} })).items ?? []) as any[];
    return [
      action({ id: 'list_pipelines', label: 'List pipelines', description: 'Recent pipelines of a project.', level: 'read', properties: { ...projectProp, branch: str('Only this branch.'), limit: num('Max results (default 20).') } }, async ({ auth, input, call }) => {
        const rows = (await pipelines(call, slugOf(auth, input), textOf(input['branch']) || undefined)).slice(0, boundedInt(input['limit'], 20, 1, 50)).map(compactPipeline);
        return { message: `Found ${rows.length} pipeline(s).`, data: { pipelines: rows } };
      }),
      action({ id: 'get_pipeline_workflows', label: 'Get pipeline workflows', description: 'Workflows of one pipeline and their status.', level: 'read', properties: { pipelineId: str('Pipeline id (UUID).') }, required: ['pipelineId'] }, async ({ input, call }) => {
        const { pipelineId } = requireText(input, 'pipelineId');
        const res = await call('GET', `/pipeline/${encodeURIComponent(pipelineId)}/workflow`);
        const workflows = ((res.items ?? []) as any[]).map(compactWorkflow);
        return { message: `Found ${workflows.length} workflow(s).`, data: { workflows } };
      }),
      action({ id: 'list_failed_workflows', label: 'List failed workflows', description: 'Failed workflows across the project’s recent pipelines.', level: 'read', properties: projectProp }, async ({ auth, input, call }) => {
        const recent = (await pipelines(call, slugOf(auth, input))).slice(0, 10);
        const all = await Promise.all(recent.map((p) => call('GET', `/pipeline/${p.id}/workflow`).then((r) => (r.items ?? []) as any[])));
        const workflows = all.flat().filter((w) => w.status === 'failed' || w.status === 'error').map(compactWorkflow);
        return { message: `Found ${workflows.length} failed workflow(s).`, data: { workflows } };
      }),
      action({ id: 'get_workflow_jobs', label: 'Get workflow jobs', description: 'Jobs in a workflow — which one failed.', level: 'read', properties: { workflowId: str('Workflow id.') }, required: ['workflowId'] }, async ({ input, call }) => {
        const { workflowId } = requireText(input, 'workflowId');
        const res = await call('GET', `/workflow/${encodeURIComponent(workflowId)}/job`);
        const jobs = ((res.items ?? []) as any[]).map((j) => ({ id: j.id, number: j.job_number ?? null, name: j.name, status: j.status, type: j.type, startedAt: j.started_at ?? null, stoppedAt: j.stopped_at ?? null }));
        return { message: `Found ${jobs.length} job(s).`, data: { jobs } };
      }),
      action({ id: 'rerun_workflow', label: 'Rerun workflow', description: 'Rerun a workflow (only its failed jobs by default).', level: 'write', properties: { workflowId: str('Workflow id.'), fromFailed: { type: 'boolean', description: 'Only rerun failed jobs (default true).' } }, required: ['workflowId'] }, async ({ input, call }) => {
        const { workflowId } = requireText(input, 'workflowId');
        const res = await call('POST', `/workflow/${encodeURIComponent(workflowId)}/rerun`, { data: { from_failed: input['fromFailed'] !== false } });
        return { message: 'Workflow rerun started.', data: { workflowId: res.workflow_id ?? workflowId } };
      }),
      action({ id: 'cancel_workflow', label: 'Cancel workflow', description: 'Cancel a running workflow.', level: 'destructive', properties: { workflowId: str('Workflow id.') }, required: ['workflowId'] }, async ({ input, call }) => {
        const { workflowId } = requireText(input, 'workflowId');
        await call('POST', `/workflow/${encodeURIComponent(workflowId)}/cancel`);
        return { message: 'Workflow canceled.', data: { workflowId } };
      }),
      action({ id: 'trigger_pipeline', label: 'Trigger pipeline', description: 'Start a pipeline on a branch.', level: 'write', properties: { ...projectProp, branch: str('Branch to build.') }, required: ['branch'] }, async ({ auth, input, call }) => {
        const { branch } = requireText(input, 'branch');
        const p = await call('POST', `/project/${slugOf(auth, input)}/pipeline`, { data: { branch } });
        return { message: `Triggered pipeline #${p.number} on ${branch}.`, data: { pipeline: { id: p.id, number: p.number, state: p.state } } };
      }),
    ];
  }
}
