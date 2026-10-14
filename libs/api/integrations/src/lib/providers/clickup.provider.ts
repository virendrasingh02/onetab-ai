import { Injectable } from '@nestjs/common';
import type { ConnectorTriggerDefinition } from '@org/types';
import { action, compactObject, num, RestConnector, str, type RestAction, type RestCall } from '../core/rest-connector.js';
import { boundedInt, requireText, textOf } from './credential-json.js';

interface ClickUpAuth extends Record<string, string> {
  token: string;
}

const compactTask = (t: any) => ({
  id: t.id,
  name: t.name,
  status: t.status?.status ?? null,
  priority: t.priority?.priority ?? null,
  assignees: (t.assignees ?? []).map((a: any) => a.username ?? a.email),
  dueDate: t.due_date ? new Date(Number(t.due_date)).toISOString() : null,
  list: t.list?.name ?? null,
  url: t.url,
  createdAt: t.date_created ? new Date(Number(t.date_created)).toISOString() : null,
});

/** ClickUp with a personal API token (Settings → Apps → API Token). */
@Injectable()
export class ClickUpProvider extends RestConnector<ClickUpAuth> {
  readonly providerId = 'CLICKUP';
  protected readonly app = 'ClickUp';
  protected readonly requiredFields = ['token'] as const;
  protected readonly secrets = ['token'];

  protected capabilities() {
    return {
      displayName: 'ClickUp',
      description: 'Tasks, lists and team operations — find, create, update and comment on tasks.',
      category: 'Project management',
      connectorCategory: 'project_management',
      authType: 'API_KEY_HEADER' as const,
      scopes: [
        { scope: 'read', description: 'Read workspaces, lists and tasks', required: true },
        { scope: 'write', description: 'Create and update tasks and comments (each asks for approval)' },
      ],
      credentialFields: [{ key: 'token', label: 'Personal API token', secret: true, help: 'ClickUp → avatar → Settings → Apps → API Token.' }],
    };
  }

  protected target(auth: ClickUpAuth) {
    return { baseUrl: 'https://api.clickup.com/api/v2', headers: { Authorization: auth.token } };
  }

  protected async ping(_auth: ClickUpAuth, call: RestCall) {
    const { user } = await call('GET', '/user');
    return { label: user?.username ?? user?.email ?? 'your account', accountId: String(user?.id ?? ''), email: user?.email };
  }

  protected override triggers(): ConnectorTriggerDefinition[] {
    return [
      {
        id: 'new_task',
        label: 'New task',
        description: 'Starts the agent for each new task in a list.',
        pollActionId: 'list_tasks',
        inputSchema: { type: 'object', properties: { listId: str('The list to watch.') }, required: ['listId'] },
        itemsPath: 'tasks',
        idField: 'id',
      },
    ];
  }

  protected actions(): RestAction<ClickUpAuth>[] {
    const taskId = str('The task id.');
    return [
      action({ id: 'list_workspaces', label: 'List workspaces', description: 'The workspaces (teams) this token can see.', level: 'read' }, async ({ call }) => {
        const data = await call('GET', '/team');
        const workspaces = ((data.teams ?? []) as any[]).map((t) => ({ id: t.id, name: t.name }));
        return { message: `Found ${workspaces.length} workspace(s).`, data: { workspaces } };
      }),
      action({ id: 'list_spaces', label: 'List spaces', description: 'Spaces in a workspace.', level: 'read', properties: { workspaceId: str('Workspace id.') }, required: ['workspaceId'] }, async ({ input, call }) => {
        const { workspaceId } = requireText(input, 'workspaceId');
        const data = await call('GET', `/team/${encodeURIComponent(workspaceId)}/space`, { params: { archived: false } });
        const spaces = ((data.spaces ?? []) as any[]).map((s) => ({ id: s.id, name: s.name }));
        return { message: `Found ${spaces.length} space(s).`, data: { spaces } };
      }),
      action({ id: 'list_lists', label: 'List lists', description: 'Lists in a space that are not inside a folder.', level: 'read', properties: { spaceId: str('Space id.') }, required: ['spaceId'] }, async ({ input, call }) => {
        const { spaceId } = requireText(input, 'spaceId');
        const data = await call('GET', `/space/${encodeURIComponent(spaceId)}/list`, { params: { archived: false } });
        const lists = ((data.lists ?? []) as any[]).map((l) => ({ id: l.id, name: l.name, taskCount: l.task_count ?? null }));
        return { message: `Found ${lists.length} list(s).`, data: { lists } };
      }),
      action(
        { id: 'list_tasks', label: 'List tasks', description: 'Tasks in a list, newest first.', level: 'read', properties: { listId: str('List id.'), includeClosed: { type: 'boolean', description: 'Include completed tasks.' } }, required: ['listId'] },
        async ({ input, call }) => {
          const { listId } = requireText(input, 'listId');
          const data = await call('GET', `/list/${encodeURIComponent(listId)}/task`, { params: { order_by: 'created', reverse: false, include_closed: input['includeClosed'] === true } });
          const tasks = ((data.tasks ?? []) as any[]).map(compactTask);
          return { message: `Found ${tasks.length} task(s).`, data: { tasks } };
        },
      ),
      action({ id: 'get_task', label: 'Get task', description: 'Fetch one task.', level: 'read', properties: { taskId }, required: ['taskId'] }, async ({ input, call }) => {
        const { taskId } = requireText(input, 'taskId');
        const data = await call('GET', `/task/${encodeURIComponent(taskId)}`);
        return { message: `Fetched ${data.name}.`, data: { task: { ...compactTask(data), description: data.text_content ?? data.description ?? '' } } };
      }),
      action(
        { id: 'create_task', label: 'Create task', description: 'Add a task to a list.', level: 'write', properties: { listId: str('List id.'), name: str('Task title.'), description: str('Details.'), priority: num('1 urgent, 2 high, 3 normal, 4 low.') }, required: ['listId', 'name'] },
        async ({ input, call }) => {
          const { listId, name } = requireText(input, 'listId', 'name');
          const data = await call('POST', `/list/${encodeURIComponent(listId)}/task`, {
            data: compactObject({ name, description: textOf(input['description']), priority: input['priority'] === undefined ? undefined : boundedInt(input['priority'], 3, 1, 4) }),
          });
          return { message: `Created task ${data.name}.`, data: { task: compactTask(data) } };
        },
      ),
      action(
        { id: 'update_task', label: 'Update task', description: 'Change a task’s name, description or status.', level: 'write', properties: { taskId, name: str('New title.'), description: str('New details.'), status: str('Status name, e.g. "in progress".') }, required: ['taskId'] },
        async ({ input, call }) => {
          const { taskId } = requireText(input, 'taskId');
          const data = await call('PUT', `/task/${encodeURIComponent(taskId)}`, { data: compactObject({ name: textOf(input['name']), description: textOf(input['description']), status: textOf(input['status']) }) });
          return { message: 'Updated the task.', data: { task: compactTask(data) } };
        },
      ),
      action({ id: 'add_comment', label: 'Add comment', description: 'Comment on a task.', level: 'write', properties: { taskId, text: str('Comment text.') }, required: ['taskId', 'text'] }, async ({ input, call }) => {
        const { taskId, text } = requireText(input, 'taskId', 'text');
        await call('POST', `/task/${encodeURIComponent(taskId)}/comment`, { data: { comment_text: text } });
        return { message: 'Comment added.', data: { taskId } };
      }),
    ];
  }
}
