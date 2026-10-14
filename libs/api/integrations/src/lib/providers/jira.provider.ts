import { BadRequestException, Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface JiraAuth extends Record<string, string> {
  domain: string;
  email: string;
  apiToken: string;
}

/** `acme` or `acme.atlassian.net` → `acme`. Anything else is refused so the credential can't point elsewhere. */
export function jiraSite(domain: string): string {
  const site = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\.atlassian\.net\/?$/, '');
  if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(site)) {
    throw new BadRequestException('Jira site should look like acme or acme.atlassian.net.');
  }
  return site;
}

/** Jira's rich-text format: one paragraph per blank-line-separated block. */
export function toAdf(text: string) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return {
    type: 'doc',
    version: 1,
    content: (paragraphs.length ? paragraphs : ['']).map((p) => ({
      type: 'paragraph',
      content: p ? [{ type: 'text', text: p }] : [],
    })),
  };
}

const compactIssue = (i: any) => ({
  key: i.key,
  id: i.id,
  summary: i.fields?.summary,
  status: i.fields?.status?.name ?? null,
  type: i.fields?.issuetype?.name ?? null,
  priority: i.fields?.priority?.name ?? null,
  assignee: i.fields?.assignee?.displayName ?? null,
  reporter: i.fields?.reporter?.displayName ?? null,
  project: i.fields?.project?.key ?? null,
  created: i.fields?.created ?? null,
  updated: i.fields?.updated ?? null,
});

/** Jira Cloud with an Atlassian API token (id.atlassian.com → Security → API tokens). */
@Injectable()
export class JiraProvider extends RestConnector<JiraAuth> {
  readonly providerId = 'JIRA';
  protected readonly app = 'Jira';
  protected readonly requiredFields = ['domain', 'email', 'apiToken'] as const;
  protected readonly secrets = ['apiToken'];

  protected capabilities() {
    return {
      displayName: 'Jira',
      description: 'Issues, projects and service requests — search with JQL, create, comment and move issues.',
      category: 'Project management',
      connectorCategory: 'project_management',
      authType: 'BEARER' as const,
      scopes: [
        { scope: 'read:jira-work', description: 'Search and read issues and projects', required: true },
        { scope: 'write:jira-work', description: 'Create, comment on and transition issues (each asks for approval)' },
      ],
      credentialFields: [
        { key: 'domain', label: 'Jira site', placeholder: 'acme.atlassian.net', help: 'The address you open Jira at.' },
        { key: 'email', label: 'Account email', help: 'The Atlassian account that owns the token.' },
        { key: 'apiToken', label: 'API token', secret: true, help: 'Create one at id.atlassian.com → Security → API tokens.' },
      ],
    };
  }

  protected override validate(auth: JiraAuth) {
    jiraSite(auth.domain);
  }

  protected target(auth: JiraAuth) {
    return { baseUrl: `https://${jiraSite(auth.domain)}.atlassian.net`, basic: { username: auth.email, password: auth.apiToken } };
  }

  protected async ping(_auth: JiraAuth, call: RestCall) {
    const me = await call('GET', '/rest/api/3/myself');
    return { label: me.displayName ?? me.emailAddress ?? 'your account', accountId: me.accountId, email: me.emailAddress };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [
      {
        id: 'new_issue',
        label: 'New issue',
        description: 'Starts the agent for each new issue (optionally narrowed with JQL).',
        pollActionId: 'search_issues',
        defaultInput: { jql: 'created >= -1d ORDER BY created DESC' },
        inputSchema: { type: 'object', properties: { jql: str('JQL to narrow the issues watched.') } },
        itemsPath: 'issues',
        idField: 'key',
      },
    ];
  }

  protected actions(): RestAction<JiraAuth>[] {
    const key = str('Issue key, e.g. PROJ-123.');
    return [
      action(
        { id: 'search_issues', label: 'Search issues', description: 'Find issues with JQL, e.g. project = PROJ AND status = "In Progress".', level: 'read', properties: { jql: str('JQL query.'), limit: num('Max results (default 20).') } },
        async ({ input, call }) => {
          const data = await call('POST', '/rest/api/3/search/jql', {
            data: {
              jql: textOf(input['jql']) || 'created >= -30d ORDER BY created DESC',
              maxResults: boundedInt(input['limit'], 20, 1, 100),
              fields: ['summary', 'status', 'issuetype', 'priority', 'assignee', 'reporter', 'project', 'created', 'updated'],
            },
          });
          const issues = ((data.issues ?? []) as any[]).map(compactIssue);
          return { message: `Found ${issues.length} issue(s).`, data: { issues } };
        },
      ),
      action(
        { id: 'get_issue', label: 'Get issue', description: 'Fetch one issue by key.', level: 'read', properties: { issueKey: key }, required: ['issueKey'] },
        async ({ input, call }) => {
          const { issueKey } = requireText(input, 'issueKey');
          const data = await call('GET', `/rest/api/3/issue/${encodeURIComponent(issueKey)}`);
          return { message: `Fetched ${data.key}.`, data: { issue: compactIssue(data) } };
        },
      ),
      action({ id: 'list_projects', label: 'List projects', description: 'List the projects you can see.', level: 'read', properties: { limit: num('Max results (default 50).') } }, async ({ input, call }) => {
        const data = await call('GET', '/rest/api/3/project/search', { params: { maxResults: boundedInt(input['limit'], 50, 1, 100) } });
        const projects = ((data.values ?? []) as any[]).map((p) => ({ key: p.key, name: p.name, type: p.projectTypeKey }));
        return { message: `Found ${projects.length} project(s).`, data: { projects } };
      }),
      action(
        { id: 'create_issue', label: 'Create issue', description: 'Create an issue in a project.', level: 'write', properties: { projectKey: str('Project key, e.g. PROJ.'), summary: str('Issue title.'), description: str('Details.'), issueType: str('Issue type name (default Task).') }, required: ['projectKey', 'summary'] },
        async ({ input, call }) => {
          const { projectKey, summary } = requireText(input, 'projectKey', 'summary');
          const data = await call('POST', '/rest/api/3/issue', {
            data: { fields: { project: { key: projectKey }, summary, issuetype: { name: textOf(input['issueType']) || 'Task' }, ...(textOf(input['description']) ? { description: toAdf(textOf(input['description'])) } : {}) } },
          });
          return { message: `Created ${data.key}.`, data: { issue: { key: data.key, id: data.id } } };
        },
      ),
      action(
        { id: 'add_comment', label: 'Add comment', description: 'Comment on an issue.', level: 'write', properties: { issueKey: key, text: str('Comment text.') }, required: ['issueKey', 'text'] },
        async ({ input, call }) => {
          const { issueKey, text } = requireText(input, 'issueKey', 'text');
          const data = await call('POST', `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`, { data: { body: toAdf(text) } });
          return { message: `Commented on ${issueKey}.`, data: { commentId: data.id } };
        },
      ),
      action(
        { id: 'list_transitions', label: 'List transitions', description: 'The statuses an issue can move to right now.', level: 'read', properties: { issueKey: key }, required: ['issueKey'] },
        async ({ input, call }) => {
          const { issueKey } = requireText(input, 'issueKey');
          const data = await call('GET', `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`);
          const transitions = ((data.transitions ?? []) as any[]).map((t) => ({ id: t.id, name: t.name, to: t.to?.name }));
          return { message: `${transitions.length} transition(s) available.`, data: { transitions } };
        },
      ),
      action(
        { id: 'transition_issue', label: 'Move issue', description: 'Move an issue to another status. Use list_transitions for the ids.', level: 'write', properties: { issueKey: key, transitionId: str('Transition id.') }, required: ['issueKey', 'transitionId'] },
        async ({ input, call }) => {
          const { issueKey, transitionId } = requireText(input, 'issueKey', 'transitionId');
          await call('POST', `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`, { data: { transition: { id: transitionId } } });
          return { message: `Moved ${issueKey}.`, data: { issueKey } };
        },
      ),
    ];
  }
}
