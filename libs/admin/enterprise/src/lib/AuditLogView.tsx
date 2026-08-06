import {
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
import { ShieldAlert } from 'lucide-react';

const logs = [
  {
    id: 'log_1',
    actor: 'admin@acme.com',
    action: 'SSO_CONFIG_UPDATED',
    target: 'SAML 2.0 identity provider',
    ip: '192.168.1.42',
    time: '10 mins ago',
  },
  {
    id: 'log_2',
    actor: 'scim-service@okta.com',
    action: 'USER_PROVISIONED',
    target: 'john.doe@acme.com',
    ip: '52.14.88.10',
    time: '45 mins ago',
  },
  {
    id: 'log_3',
    actor: 'sec-lead@acme.com',
    action: 'AGENT_PERMISSIONS_CHANGED',
    target: 'Agile sprint manager',
    ip: '192.168.1.100',
    time: '2 hours ago',
  },
];

export function AuditLogView() {
  return (
    <Page>
      <PageHeader
        title="Audit trail"
        description="Immutable security events, SCIM syncs, SSO logins and permission changes."
        icon={<ShieldAlert />}
        accent="violet"
      />

      <Panel flush>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Actor</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>IP address</TableHead>
              <TableHead>When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="font-medium">{log.actor}</TableCell>
                <TableCell className="text-xs font-mono text-accent-blue">
                  {log.action}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {log.target}
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">
                  {log.ip}
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
