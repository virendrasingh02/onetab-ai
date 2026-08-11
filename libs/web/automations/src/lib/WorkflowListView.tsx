import { useWorkflows, type WorkflowRegistryItem } from '@org/hooks';
import { Badge, Button, Card, Page, PageHeader } from '@org/ui';
import { Clock, Play, Plus, Webhook, Workflow } from 'lucide-react';

/**
 * Kept as an alias so existing importers of `WorkflowItem` keep working. The
 * list itself now comes from the shared registry the sidebar reads, so the two
 * cannot drift.
 */
export type WorkflowItem = WorkflowRegistryItem;

export function WorkflowListView() {
  const [workflows] = useWorkflows();

  return (
    <Page>
      <PageHeader
        title="Automations"
        description="Automate workspace tasks, webhooks, agent steps and integrations."
        icon={<Workflow />}
        accent="amber"
        actions={<Button leadingIcon={<Plus />}>Create workflow</Button>}
      />

      <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
        {workflows.map((workflow) => (
          <li key={workflow.id}>
            <Card className="p-5 h-full justify-between transition-colors duration-(--duration-fast) hover:border-border-strong">
              <div>
                <div className="mb-3 gap-2 flex items-center justify-between">
                  <Badge variant="warning" className="font-mono uppercase">
                    {workflow.triggerType === 'WEBHOOK' ? (
                      <Webhook aria-hidden />
                    ) : (
                      <Clock aria-hidden />
                    )}
                    {workflow.triggerType}
                  </Badge>
                  <Badge variant={workflow.isActive ? 'success' : 'neutral'}>
                    {workflow.isActive ? 'Active' : 'Disabled'}
                  </Badge>
                </div>

                <h2 className="mb-2 text-sm font-semibold text-foreground">
                  {workflow.name}
                </h2>

                <dl className="mb-4 gap-4 text-xs flex items-center text-muted-foreground">
                  <div className="gap-1 flex">
                    <dt>Runs:</dt>
                    <dd className="font-medium text-foreground tabular-nums">
                      {workflow.totalExecutions}
                    </dd>
                  </div>
                  <div className="gap-1 flex">
                    <dt>Last run:</dt>
                    <dd className="font-medium text-foreground">
                      {workflow.lastRun}
                    </dd>
                  </div>
                </dl>
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="w-full"
                leadingIcon={<Play className="text-success" />}
              >
                Run now
                <span className="sr-only"> — {workflow.name}</span>
              </Button>
            </Card>
          </li>
        ))}
      </ul>
    </Page>
  );
}
