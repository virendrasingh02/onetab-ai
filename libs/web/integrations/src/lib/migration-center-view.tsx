import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Page,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@org/ui';
import {
  ArrowRight,
  Layers,
  Play,
  RefreshCw,
  Search,
  UploadCloud,
} from 'lucide-react';
import { MigrationWizardDialog } from './migration-wizard-dialog.js';
import { useIntegrations } from './use-integrations.js';
import {
  useCreateMigrationSession,
  useMigrationCapabilities,
  useMigrationsList,
} from './use-migrations.js';
import { useWorkspaceId } from './use-workspace-id.js';

interface MigrationCenterViewProps {
  embedded?: boolean;
}

export function MigrationCenterView({ embedded = false }: MigrationCenterViewProps) {
  const workspaceId = useWorkspaceId() || '';
  const [wizardOpen, setWizardOpen] = useState(false);
  const [activeMigrationId, setActiveMigrationId] = useState<string | undefined>();

  // Fetch connected integrations to identify Slack
  const { data: integrations, refetch: refetchIntegrations } = useIntegrations(workspaceId);
  const slackIntegration = integrations?.find(
    (i) => i.provider === 'SLACK' && i.status === 'CONNECTED',
  );

  // Fetch migrations history
  const { data: migrations, refetch: refetchMigrations } = useMigrationsList(workspaceId);
  const latestMigration = migrations?.[0];

  // Fetch Slack capabilities
  const { data: capabilities, refetch: refetchCapabilities } = useMigrationCapabilities(
    workspaceId,
    slackIntegration?.id,
  );

  const createSessionMutation = useCreateMigrationSession(workspaceId);

  const handleOpenWizard = async (migrationId?: string) => {
    if (migrationId) {
      setActiveMigrationId(migrationId);
      setWizardOpen(true);
    } else {
      // Create a new session or reuse existing latest pending/ready session
      const existing = migrations?.find(
        (m) => m.status === 'PENDING' || m.status === 'READY' || m.status === 'IN_PROGRESS',
      );
      if (existing) {
        setActiveMigrationId(existing.id);
        setWizardOpen(true);
      } else {
        try {
          const newSession = await createSessionMutation.mutateAsync('SLACK_API');
          setActiveMigrationId(newSession.id);
          setWizardOpen(true);
        } catch (err: any) {
          toast.error(`Failed to initiate migration session: ${err.message}`);
        }
      }
    }
  };

  const handleConnectSlack = () => {
    // Standard OAuth popup or redirect using existing backend OAuth flow
    window.open(
      `/api/v1/workspaces/${workspaceId}/integrations/slack/connect?migration=true`,
      'ConnectSlack',
      'width=600,height=700',
    );

    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'INTEGRATION_CONNECTED') {
        window.removeEventListener('message', handleMessage);
        toast.success('Slack workspace connected successfully');
        refetchIntegrations();
        refetchCapabilities();
      }
    };
    window.addEventListener('message', handleMessage);
  };

  const currentStatus = (() => {
    if (!slackIntegration) return 'NOT_CONNECTED';
    if (!latestMigration) return 'READY';
    return latestMigration.status;
  })();

  const content = (
    <div className="space-y-8">
      {/* Overview Status Banner Card */}
      <Card className="p-6 border-border/80 relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="size-14 rounded-2xl bg-[#4A154B] flex items-center justify-center shrink-0 text-white font-bold text-2xl shadow-md">
              #
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Migration Center
                </span>
                <Badge
                  variant={
                    currentStatus === 'COMPLETED'
                      ? 'success'
                      : currentStatus === 'IN_PROGRESS'
                        ? 'primary'
                        : currentStatus === 'READY'
                          ? 'outline'
                          : 'neutral'
                  }
                  className="font-mono text-[10px]"
                >
                  {currentStatus.replace('_', ' ')}
                </Badge>
              </div>
              <h2 className="text-xl font-bold text-foreground">
                Slack → OneTab Enterprise Migration
              </h2>
              <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
                Seamlessly transfer your public & private channels, conversation history, user identities, and attachments from Slack into your OneTab workspace with complete hierarchy preservation.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!slackIntegration ? (
              <Button onClick={handleConnectSlack} leadingIcon={<UploadCloud className="size-4" />}>
                Connect Slack
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenWizard(latestMigration?.id)}
                  leadingIcon={<Search className="size-3.5" />}
                >
                  Readiness & Scope
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleOpenWizard(latestMigration?.id)}
                  leadingIcon={<Play className="size-3.5" />}
                >
                  Open Migration Wizard
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Source & Destination Details Bar */}
        <div className="mt-6 pt-5 border-t border-border/60 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-muted-foreground block text-[11px]">Source</span>
            <span className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
              <span className="size-2 rounded-full bg-[#E01E5A]" />
              {slackIntegration?.displayName || 'Slack Workspace'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Destination</span>
            <span className="font-semibold text-foreground flex items-center gap-1.5 mt-0.5">
              <span className="size-2 rounded-full bg-emerald-500" />
              Current Workspace
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Connection Health</span>
            <span className="font-semibold text-emerald-500 flex items-center gap-1 mt-0.5">
              {slackIntegration ? 'Active & Authorized' : 'Awaiting Connection'}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground block text-[11px]">Latest Verification</span>
            <span className="text-muted-foreground mt-0.5 block">
              {latestMigration?.completedAt ? new Date(latestMigration.completedAt).toLocaleDateString() : 'Pending'}
            </span>
          </div>
        </div>
      </Card>

      {/* Migration Capabilities Matrix */}
      {capabilities && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Slack Workspace Capabilities & Permission Inspection
              </h3>
              <p className="text-xs text-muted-foreground">
                Real-time API capabilities verified for {capabilities.workspace.name}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchCapabilities()}
              leadingIcon={<RefreshCw className="size-3.5" />}
            >
              Refresh Capabilities
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {Object.values(capabilities.capabilities).map((cap) => (
              <Card key={cap.key} className="p-4 flex items-start justify-between gap-3 text-xs">
                <div>
                  <span className="font-semibold text-foreground block">{cap.name}</span>
                  <span className="text-[11px] text-muted-foreground mt-1 line-clamp-2 block leading-relaxed">
                    {cap.description}
                  </span>
                </div>
                <Badge
                  variant={
                    cap.status === 'available'
                      ? 'success'
                      : cap.status === 'permission_required'
                        ? 'warning'
                        : 'neutral'
                  }
                  className="capitalize shrink-0 text-[10px]"
                >
                  {cap.status.replace('_', ' ')}
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Past Migration Sessions & Reports */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Migration History & Reports
            </h3>
            <p className="text-xs text-muted-foreground">
              Track past and active migration runs with complete validation reconciliation
            </p>
          </div>
        </div>

        <Card className="p-0 overflow-hidden border-border/80">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Migration Session</TableHead>
                <TableHead>Source Provider</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Started</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {migrations && migrations.length > 0 ? (
                migrations.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium text-foreground text-xs">
                      <div className="flex items-center gap-2">
                        <Layers className="size-4 text-accent-primary" />
                        <div>
                          <span>{m.sourceWorkspaceName || 'Slack Workspace'}</span>
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            {m.id}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge variant="outline">{m.sourceProvider}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <Badge
                        variant={
                          m.status === 'COMPLETED'
                            ? 'success'
                            : m.status === 'IN_PROGRESS'
                              ? 'primary'
                              : m.status === 'FAILED'
                                ? 'destructive'
                                : 'neutral'
                        }
                        className="text-[10px]"
                      >
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(m.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenWizard(m.id)}
                        trailingIcon={<ArrowRight className="size-3.5" />}
                      >
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-xs text-muted-foreground">
                    No migration sessions initiated yet. Connect Slack above to run your readiness check.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Migration Wizard Modal */}
      <MigrationWizardDialog
        open={wizardOpen}
        onOpenChange={(open) => {
          setWizardOpen(open);
          if (!open) refetchMigrations();
        }}
        workspaceId={workspaceId}
        migrationId={activeMigrationId}
        connectedSlackAccount={
          slackIntegration
            ? {
                teamName: slackIntegration.displayName || 'Slack Team',
                teamId: slackIntegration.providerAccountId || 'team_1',
                userName: 'Workspace Admin',
              }
            : null
        }
        onConnectSlack={handleConnectSlack}
      />
    </div>
  );

  if (embedded) return content;

  return (
    <Page>
      <PageHeader
        title="Slack Migration Center"
        description="Migrate channels, conversation history, user identities, and attachments from Slack into your OneTab workspace."
        icon={<UploadCloud />}
        accent="violet"
      />
      {content}
    </Page>
  );
}
