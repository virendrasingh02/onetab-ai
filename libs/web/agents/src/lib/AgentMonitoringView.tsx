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
import { Activity, CheckCircle, Wrench } from 'lucide-react';

const logs = [
  {
    id: 'log_1',
    agent: 'Agile sprint manager',
    prompt: 'Audit task backlog and summarise sprint status',
    status: 'SUCCESS',
    toolUsed: 'search_docs',
    tokens: 184,
    time: '5 mins ago',
  },
  {
    id: 'log_2',
    agent: 'Code sentinel & reviewer',
    prompt: 'Inspect PR #42 security patches',
    status: 'SUCCESS',
    toolUsed: 'create_task',
    tokens: 210,
    time: '20 mins ago',
  },
  {
    id: 'log_3',
    agent: 'Workspace knowledge curator',
    prompt: 'Re-index modified documentation into the vector collection',
    status: 'SUCCESS',
    toolUsed: 'search_docs',
    tokens: 140,
    time: '1 hour ago',
  },
];

export function AgentMonitoringView() {
  return (
    <Page>
      <PageHeader
        title="Agent telemetry"
        description="Tool call traces, execution audit logs and token usage."
        icon={<Activity />}
        accent="green"
      />

      <Panel flush>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Agent</TableHead>
              <TableHead>Prompt</TableHead>
              <TableHead>Tool call</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tokens</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{log.agent}</TableCell>
                <TableCell className="max-w-xs truncate text-muted-foreground">
                  {log.prompt}
                </TableCell>
                <TableCell>
                  <span className="gap-1 text-xs flex items-center font-mono text-accent-violet">
                    <Wrench className="size-3.5" aria-hidden />
                    {log.toolUsed}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant="success">
                    <CheckCircle aria-hidden />
                    {log.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground tabular-nums">
                  {log.tokens}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {log.time}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>
    </Page>
  );
}
