import type { AdminOrganization } from '@org/types';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Page,
  PageHeader,
  Panel,
  StatCard,
} from '@org/ui';
import { formatBytes } from '@org/utils';
import { Building2, CreditCard, Layers, Plus, Shield, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import {
  useAdminOverview,
  useDepartmentMutations,
  useOrganizations,
} from './use-enterprise.js';

/** Seats across every organisation's subscriptions. */
function seatTotals(organizations: AdminOrganization[]) {
  return organizations.reduce(
    (totals, organization) => {
      for (const subscription of organization.subscriptions) {
        totals.used += subscription.seatsUsed;
        totals.total += subscription.seatsTotal;
      }
      return totals;
    },
    { used: 0, total: 0 },
  );
}

export function EnterpriseDashboardView() {
  const overview = useAdminOverview();
  const organizations = useOrganizations();

  const rows = organizations.data ?? [];
  const seats = seatTotals(rows);
  const departmentCount = rows.reduce(
    (count, organization) => count + organization.departments.length,
    0,
  );
  const ssoCount = rows.reduce(
    (count, organization) => count + organization._count.ssoConfigs,
    0,
  );
  // Every subscription shares a tier in practice; show the distinct set.
  const planTiers = [
    ...new Set(
      rows.flatMap((organization) =>
        organization.subscriptions.map((subscription) => subscription.planTier),
      ),
    ),
  ];

  if (organizations.isLoading || overview.isLoading) {
    return (
      <Page>
        <LoadingState label="Loading enterprise governance…" />
      </Page>
    );
  }

  if (organizations.isError) {
    return (
      <Page>
        <ErrorState
          title="Could not load organisations"
          description="The enterprise directory is unavailable. Check that the API is reachable and that this account is a platform operator."
        />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Enterprise governance"
        description="Organisation-wide management, departments, security policies and subscriptions."
        icon={<Building2 />}
        accent="blue"
        actions={
          planTiers.length > 0 ? (
            <Badge variant="primary" className="font-mono uppercase">
              {planTiers.join(' · ')}
            </Badge>
          ) : null
        }
      />

      <div className="mb-6 gap-4 sm:grid-cols-2 xl:grid-cols-4 grid grid-cols-1">
        <StatCard
          label="Licensed seats"
          value={seats.total > 0 ? `${seats.used} / ${seats.total}` : '—'}
          icon={Users}
          accent="blue"
        />
        <StatCard
          label="Departments"
          value={`${departmentCount} active`}
          icon={Layers}
          accent="violet"
        />
        <StatCard
          label="SSO & SCIM"
          value={
            ssoCount > 0
              ? `${ssoCount} configured`
              : 'Not configured'
          }
          icon={Shield}
          accent="green"
        />
        <StatCard
          label="Platform storage"
          value={formatBytes(overview.data?.storageBytes ?? 0)}
          icon={CreditCard}
          accent="amber"
        />
      </div>

      {rows.length === 0 ? (
        <Panel>
          <EmptyState
            icon={<Building2 />}
            title="No organisations"
            description="Organisations group workspaces under one contract, with their own departments, SSO and audit trail. Create one through the enterprise API to get started."
          />
        </Panel>
      ) : (
        rows.map((organization) => (
          <OrganizationPanel key={organization.id} organization={organization} />
        ))
      )}
    </Page>
  );
}

function OrganizationPanel({
  organization,
}: {
  organization: AdminOrganization;
}) {
  const { create, remove } = useDepartmentMutations();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const subscription = organization.subscriptions[0];

  const submit = async () => {
    if (!name.trim()) return;
    await create.mutateAsync({
      organizationId: organization.id,
      name: name.trim(),
      code: code.trim() || undefined,
    });
    setName('');
    setCode('');
    setIsAddOpen(false);
  };

  return (
    <Panel
      className="mb-6"
      title={organization.name}
      subtitle={
        subscription
          ? `${organization.domain} · ${subscription.planTier}, ${subscription.seatsUsed}/${subscription.seatsTotal} seats`
          : organization.domain
      }
      actions={
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" leadingIcon={<Plus />}>
              Add department
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a department to {organization.name}</DialogTitle>
            </DialogHeader>

            <div className="gap-4 flex flex-col">
              <div className="space-y-1.5">
                <Label htmlFor={`dept-name-${organization.id}`}>Name</Label>
                <Input
                  id={`dept-name-${organization.id}`}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Customer success"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`dept-code-${organization.id}`}>
                  Code <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id={`dept-code-${organization.id}`}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="CS"
                  className="font-mono"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="ghost"
                onClick={() => setIsAddOpen(false)}
                disabled={create.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={() => void submit()}
                disabled={!name.trim() || create.isPending}
              >
                {create.isPending ? 'Adding…' : 'Add department'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      }
    >
      {organization.departments.length === 0 ? (
        <EmptyState
          size="sm"
          icon={<Layers />}
          title="No departments"
          description="Departments group this organisation's people for reporting and provisioning."
        />
      ) : (
        <ul className="gap-4 md:grid-cols-3 grid grid-cols-1">
          {organization.departments.map((department) => (
            <li key={department.id}>
              <Card className="group gap-2 p-4 flex-row items-center justify-between bg-background">
                <div className="min-w-0">
                  <h3 className="text-sm font-medium truncate text-foreground">
                    {department.name}
                  </h3>
                  {department.code ? (
                    <p className="text-xs font-mono text-muted-foreground">
                      {department.code}
                    </p>
                  ) : null}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${department.name}`}
                  disabled={remove.isPending}
                  onClick={() =>
                    remove.mutate({
                      organizationId: organization.id,
                      departmentId: department.id,
                    })
                  }
                  className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
