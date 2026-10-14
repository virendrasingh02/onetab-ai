import { Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, compactObject, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface AsanaAuth extends Record<string, string> {
  token: string;
}

const TASK_FIELDS = 'name,completed,assignee.name,due_on,created_at,permalink_url,notes';

const compactTask = (t: any) => ({
  id: t.gid,
  name: t.name,
  completed: t.completed ?? false,
  assignee: t.assignee?.name ?? null,
  dueOn: t.due_on ?? null,
  createdAt: t.created_at ?? null,
  url: t.permalink_url ?? null,
  notes: t.notes ?? '',
});

/** Asana with a personal access token (My Settings → Apps → Developer apps). */
@Injectable()
export class AsanaProvider extends RestConnector<AsanaAuth> {
  readonly providerId = 'ASANA';
  protected readonly app = 'Asana';
  protected readonly requiredFields = ['token'] as const;
  protected readonly secrets = ['token'];

  protected capabilities() {
    return {
      displayName: 'Asana',
      description: 'Tasks, projects and assignments — find, create, update and comment on tasks.',
      category: 'Project management',
      connectorCategory: 'project_management',
      authType: 'BEARER' as const,
      scopes: [
        { scope: 'default', description: 'Read workspaces, projects and tasks', required: true },
        { scope: 'write', description: 'Create and update tasks and comments (each asks for approval)' },
      ],
      credentialFields: [{ key: 'token', label: 'Personal access token', secret: true, help: 'Asana → profile → Settings → Apps → Developer apps → New access token.' }],
    };
  }

  protected target(auth: AsanaAuth) {
    return { baseUrl: 'https://app.asana.com/api/1.0', headers: { Authorization: `Bearer ${auth.token}` } };
  }

  protected async ping(_auth: AsanaAuth, call: RestCall) {
    const { data } = await call('GET', '/users/me');
    return { label: data?.name ?? 'your account', accountId: data?.gid, email: data?.email };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [
      {
        id: 'new_task',
        label: 'New task',
        description: 'Starts the agent for each new task in a project.',
        pollActionId: 'list_tasks',
        inputSchema: { type: 'object', properties: { projectId: str('The project to watch.') }, required: ['projectId'] },
        itemsPath: 'tasks',
        idField: 'id',
      },
    ];
  }

  protected actions(): RestAction<AsanaAuth>[] {
    const taskId = str('The task id (gid).');
    return [
      action({ id: 'list_workspaces', label: 'List workspaces', description: 'Workspaces this token can see.', level: 'read' }, async ({ call }) => {
        const { data } = await call('GET', '/workspaces');
        const workspaces = ((data ?? []) as any[]).map((w) => ({ id: w.gid, name: w.name }));
        return { message: `Found ${workspaces.length} workspace(s).`, data: { workspaces } };
      }),
      action({ id: 'list_projects', label: 'List projects', description: 'Projects in a workspace.', level: 'read', properties: { workspaceId: str('Workspace id.') }, required: ['workspaceId'] }, async ({ input, call }) => {
        const { workspaceId } = requireText(input, 'workspaceId');
        const { data } = await call('GET', '/projects', { params: { workspace: workspaceId, archived: false, limit: 100, opt_fields: 'name,permalink_url' } });
        const projects = ((data ?? []) as any[]).map((p) => ({ id: p.gid, name: p.name, url: p.permalink_url ?? null }));
        return { message: `Found ${projects.length} project(s).`, data: { projects } };
      }),
      action({ id: 'list_tasks', label: 'List tasks', description: 'Tasks in a project.', level: 'read', properties: { projectId: str('Project id.'), limit: num('Max results (default 30).') }, required: ['projectId'] }, async ({ input, call }) => {
        const { projectId } = requireText(input, 'projectId');
        const { data } = await call('GET', '/tasks', { params: { project: projectId, limit: boundedInt(input['limit'], 30, 1, 100), opt_fields: TASK_FIELDS } });
        const tasks = ((data ?? []) as any[]).map(compactTask);
        return { message: `Found ${tasks.length} task(s).`, data: { tasks } };
      }),
      action({ id: 'get_task', label: 'Get task', description: 'Fetch one task.', level: 'read', properties: { taskId }, required: ['taskId'] }, async ({ input, call }) => {
        const { taskId } = requireText(input, 'taskId');
        const { data } = await call('GET', `/tasks/${encodeURIComponent(taskId)}`, { params: { opt_fields: TASK_FIELDS } });
        return { message: `Fetched ${data.name}.`, data: { task: compactTask(data) } };
      }),
      action(
        { id: 'create_task', label: 'Create task', description: 'Add a task to a project.', level: 'write', properties: { projectId: str('Project id.'), name: str('Task title.'), notes: str('Details.'), assignee: str('Assignee user id, or "me".'), dueOn: str('Due date, YYYY-MM-DD.') }, required: ['projectId', 'name'] },
        async ({ input, call }) => {
          const { projectId, name } = requireText(input, 'projectId', 'name');
          const { data } = await call('POST', '/tasks', {
            params: { opt_fields: TASK_FIELDS },
            data: { data: compactObject({ name, projects: [projectId], notes: textOf(input['notes']), assignee: textOf(input['assignee']), due_on: textOf(input['dueOn']) }) },
          });
          return { message: `Created task ${data.name}.`, data: { task: compactTask(data) } };
        },
      ),
      action(
        { id: 'update_task', label: 'Update task', description: 'Change a task, or mark it complete.', level: 'write', properties: { taskId, name: str('New title.'), notes: str('New details.'), completed: { type: 'boolean', description: 'Mark complete / reopen.' }, dueOn: str('Due date, YYYY-MM-DD.') }, required: ['taskId'] },
        async ({ input, call }) => {
          const { taskId } = requireText(input, 'taskId');
          const { data } = await call('PUT', `/tasks/${encodeURIComponent(taskId)}`, {
            params: { opt_fields: TASK_FIELDS },
            data: { data: compactObject({ name: textOf(input['name']), notes: textOf(input['notes']), due_on: textOf(input['dueOn']), completed: typeof input['completed'] === 'boolean' ? input['completed'] : undefined }) },
          });
          return { message: 'Updated the task.', data: { task: compactTask(data) } };
        },
      ),
      action({ id: 'add_comment', label: 'Add comment', description: 'Comment on a task.', level: 'write', properties: { taskId, text: str('Comment text.') }, required: ['taskId', 'text'] }, async ({ input, call }) => {
        const { taskId, text } = requireText(input, 'taskId', 'text');
        await call('POST', `/tasks/${encodeURIComponent(taskId)}/stories`, { data: { data: { text } } });
        return { message: 'Comment added.', data: { taskId } };
      }),
    ];
  }
}
