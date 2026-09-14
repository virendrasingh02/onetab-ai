import { workspaceApi } from '@org/api-client';
import {
  DEFAULT_WORKSPACE_POLICY,
  PolicySubjectRole,
  WorkspaceRole,
  hasWorkspaceRole,
  type WorkspacePolicy,
} from '@org/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SkeletonList,
} from '@org/ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Users, Lock, Bot, AppWindow } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  SettingsCard,
  SettingsRow,
  SettingsSectionHeader,
} from './settings-primitives.js';

export interface WorkspacePermissionsSettingsProps {
  workspaceId: string | undefined;
  workspaceRole?: WorkspaceRole;
}

const POLICY_OPTIONS: { value: PolicySubjectRole; label: string }[] = [
  { value: PolicySubjectRole.MEMBERS, label: 'Everyone (Members & Admins)' },
  { value: PolicySubjectRole.ADMINS, label: 'Admins & Owner only' },
  { value: PolicySubjectRole.OWNER_ONLY, label: 'Owner only' },
];

export function WorkspacePermissionsSettings({
  workspaceId,
  workspaceRole,
}: WorkspacePermissionsSettingsProps) {
  const queryClient = useQueryClient();
  const isAdmin =
    workspaceRole && hasWorkspaceRole(workspaceRole, WorkspaceRole.ADMIN);

  const { data: policies, isLoading } = useQuery({
    queryKey: ['workspace-policies', workspaceId],
    queryFn: () => workspaceApi.getPolicies(workspaceId as string),
    enabled: !!workspaceId,
  });

  const [form, setForm] = useState<WorkspacePolicy>(DEFAULT_WORKSPACE_POLICY);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (policies) {
      setForm(policies);
    }
  }, [policies]);

  const saveMutation = useMutation({
    mutationFn: (updated: Partial<WorkspacePolicy>) =>
      workspaceApi.savePolicies(workspaceId as string, updated),
    onSuccess: (saved) => {
      setForm(saved);
      queryClient.setQueryData(['workspace-policies', workspaceId], saved);
      setSuccessMessage('Workspace permissions updated successfully.');
      setTimeout(() => setSuccessMessage(null), 3500);
    },
  });

  const updateField = (key: keyof WorkspacePolicy, value: PolicySubjectRole) => {
    const next = { ...form, [key]: value };
    setForm(next);
    saveMutation.mutate(next);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SettingsSectionHeader
          title="Permissions & Policies"
          description="Manage who has permission to invite, create channels, add apps, and manage resources."
        />
        <SkeletonList rows={6} withAvatar={false} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SettingsSectionHeader
        title="Permissions & Policies"
        description="Configure workspace-wide role requirements for key actions. Only Workspace Admins and Owners can adjust these policies."
      />

      {successMessage ? (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-xs text-success-text">
          <CheckCircle2 className="size-4 shrink-0 text-success-text" />
          <span>{successMessage}</span>
        </div>
      ) : null}

      {/* Membership & Invitations */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Users className="size-4 text-primary" />
          Membership & Invitations
        </h3>
        <SettingsCard divided>
          <SettingsRow
            title="Who can invite new members"
            description="Control whether regular members can send workspace invitations or generate invite links."
          >
            <Select
              disabled={!isAdmin || saveMutation.isPending}
              value={form.whoCanInvite}
              onValueChange={(val) => updateField('whoCanInvite', val as PolicySubjectRole)}
            >
              <SelectTrigger className="h-8 text-xs w-[220px] bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* Channels & Messaging */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Lock className="size-4 text-primary" />
          Channels & Rooms
        </h3>
        <SettingsCard divided>
          <SettingsRow
            title="Who can create public channels"
            description="Public channels can be viewed and joined by all members of the workspace."
          >
            <Select
              disabled={!isAdmin || saveMutation.isPending}
              value={form.whoCanCreateChannels}
              onValueChange={(val) =>
                updateField('whoCanCreateChannels', val as PolicySubjectRole)
              }
            >
              <SelectTrigger className="h-8 text-xs w-[220px] bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow
            title="Who can create private channels"
            description="Private channels require an explicit invitation to join."
          >
            <Select
              disabled={!isAdmin || saveMutation.isPending}
              value={form.whoCanCreatePrivateChannels}
              onValueChange={(val) =>
                updateField('whoCanCreatePrivateChannels', val as PolicySubjectRole)
              }
            >
              <SelectTrigger className="h-8 text-xs w-[220px] bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* AI Agents & Coworkers */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bot className="size-4 text-primary" />
          AI Agents & Coworkers
        </h3>
        <SettingsCard divided>
          <SettingsRow
            title="Who can create AI Agents"
            description="Custom AI agents with specialized instructions, tools, and knowledge bases."
          >
            <Select
              disabled={!isAdmin || saveMutation.isPending}
              value={form.whoCanCreateAgents}
              onValueChange={(val) =>
                updateField('whoCanCreateAgents', val as PolicySubjectRole)
              }
            >
              <SelectTrigger className="h-8 text-xs w-[220px] bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow
            title="Who can create AI Coworkers"
            description="Autonomous coworker personas assigned to collaborate in channels and tasks."
          >
            <Select
              disabled={!isAdmin || saveMutation.isPending}
              value={form.whoCanCreateCoworkers}
              onValueChange={(val) =>
                updateField('whoCanCreateCoworkers', val as PolicySubjectRole)
              }
            >
              <SelectTrigger className="h-8 text-xs w-[220px] bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
        </SettingsCard>
      </div>

      {/* Apps, Integrations, Meetings & Files */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <AppWindow className="size-4 text-primary" />
          Apps, Integrations & Media
        </h3>
        <SettingsCard divided>
          <SettingsRow
            title="Who can install Marketplace apps"
            description="Add third-party integrations, bots, and slash commands to the workspace."
          >
            <Select
              disabled={!isAdmin || saveMutation.isPending}
              value={form.whoCanInstallApps}
              onValueChange={(val) =>
                updateField('whoCanInstallApps', val as PolicySubjectRole)
              }
            >
              <SelectTrigger className="h-8 text-xs w-[220px] bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow
            title="Who can manage external integrations"
            description="Configure webhooks, API tokens, and sync integrations across services."
          >
            <Select
              disabled={!isAdmin || saveMutation.isPending}
              value={form.whoCanManageIntegrations}
              onValueChange={(val) =>
                updateField('whoCanManageIntegrations', val as PolicySubjectRole)
              }
            >
              <SelectTrigger className="h-8 text-xs w-[220px] bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow
            title="Who can start meetings & huddles"
            description="Initiate audio and video huddles within channels and DMs."
          >
            <Select
              disabled={!isAdmin || saveMutation.isPending}
              value={form.whoCanCreateMeetings}
              onValueChange={(val) =>
                updateField('whoCanCreateMeetings', val as PolicySubjectRole)
              }
            >
              <SelectTrigger className="h-8 text-xs w-[220px] bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>

          <SettingsRow
            title="Who can manage files"
            description="Manage uploaded files, media attachments, and shared workspace assets."
          >
            <Select
              disabled={!isAdmin || saveMutation.isPending}
              value={form.whoCanManageFiles}
              onValueChange={(val) =>
                updateField('whoCanManageFiles', val as PolicySubjectRole)
              }
            >
              <SelectTrigger className="h-8 text-xs w-[220px] bg-surface">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {POLICY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingsRow>
        </SettingsCard>
      </div>
    </div>
  );
}
