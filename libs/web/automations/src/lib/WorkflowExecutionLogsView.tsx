import {
  Badge,
  Page,
  PageHeader,
  Panel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import { Activity, CheckCircle } from 'lucide-react';

const executions = [
  {
    id: 'exec_1',
    workflow: 'GitHub webhook → AI code review → Matrix alert',
    trigger: 'WEBHOOK',
    status: 'SUCCESS',
    stepsExecuted: 4,
    duration: '480ms',
    time: '10 mins ago',
  },
  {
    id: 'exec_2',
    workflow: 'Daily standup summary generator',
    trigger: 'CRON',
    status: 'SUCCESS',
    stepsExecuted: 3,
    duration: '1.2s',
    time: '4 hours ago',
  },
  {
    id: 'exec_3',
    workflow: 'Overdue task escalation bot',
    trigger: 'EVENT',
    status: 'SUCCESS',
    stepsExecuted: 2,
    duration: '120ms',
    time: '1 day ago',
  },
];

export function WorkflowExecutionLogsView() {
  return (
    <Page>
      <PageHeader
        title="Execution logs"
        description="Audit trail, step payloads and run timings for every workflow."
        icon={<Activity />}
        accent="green"
      />

      <Panel flush>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Workflow</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Steps</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {executions.map((execution) => (
              <TableRow key={execution.id}>
                <TableCell className="font-medium">
                  {execution.workflow}
                </TableCell>
                <TableCell className="text-xs font-mono text-warning">
                  {execution.trigger}
                </TableCell>
                <TableCell className="text-xs font-mono">
                  {execution.stepsExecuted} nodes
                </TableCell>
                <TableCell>
                  <Badge variant="success">
                    <CheckCircle aria-hidden />
                    {execution.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">
                  {execution.duration}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {execution.time}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </Page>
  );
}
