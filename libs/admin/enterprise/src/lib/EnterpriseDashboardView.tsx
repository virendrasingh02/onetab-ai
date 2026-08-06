import { Badge, Card, Page, PageHeader, Panel, StatCard } from '@org/ui';
import { Building2, CreditCard, Layers, Shield, Users } from 'lucide-react';

const departments = [
  { name: 'Engineering', code: 'ENG', members: 32 },
  { name: 'Product & design', code: 'PROD', members: 14 },
  { name: 'Customer success', code: 'CS', members: 8 },
];

export function EnterpriseDashboardView() {
  return (
    <Page>
      <PageHeader
        title="Enterprise governance"
        description="Organisation-wide management, departments, security policies and subscriptions."
        icon={<Building2 />}
        accent="blue"
        actions={
          <Badge variant="primary" className="font-mono uppercase">
            Enterprise plan
          </Badge>
        }
      />

      <div className="mb-6 gap-4 sm:grid-cols-2 xl:grid-cols-4 grid grid-cols-1">
        <StatCard
          label="Licensed seats"
          value="54 / 100"
          icon={Users}
          accent="blue"
        />
        <StatCard
          label="Departments"
          value="3 active"
          icon={Layers}
          accent="violet"
        />
        <StatCard
          label="SSO & SCIM"
          value="SAML active"
          icon={Shield}
          accent="green"
        />
        <StatCard
          label="Billing cycle"
          value="Annual auto-renew"
          icon={CreditCard}
          accent="amber"
        />
      </div>

      <Panel title="Departments">
        <ul className="gap-4 md:grid-cols-3 grid grid-cols-1">
          {departments.map((department) => (
            <li key={department.code}>
              <Card className="gap-2 p-4 flex-row items-center justify-between bg-background">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium truncate text-foreground">
                    {department.name}
                  </h3>
                  <p className="text-xs font-mono text-muted-foreground">
                    {department.code}
                  </p>
                </div>
                <Badge variant="primary" className="shrink-0 tabular-nums">
                  {department.members} members
                </Badge>
              </Card>
            </li>
          ))}
        </ul>
      </Panel>
    </Page>
  );
}
