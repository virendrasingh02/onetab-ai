import {
  agentStudioApi,
  integrationsApi,
  invitationApi,
  queryKeys,
  workspaceApi,
} from '@org/api-client';
import { useCurrentUser } from '@org/auth';
import { Button } from '@org/ui';
import { useCurrentWorkspace, useWorkspaceStore } from '@org/web-workspace';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DISMISSED_KEY = 'home.setupChecklistDismissed';

interface SetupStep {
  id: string;
  title: string;
  hint: string;
  done: boolean;
  cta: string;
  onClick: () => void;
}

/**
 * First-run guide on Home: invite people, add a photo, connect an app, build an
 * agent — each ticked off from what the workspace has really done. Hidden once
 * every step is done or the member dismisses it (kept with their workspace
 * preferences, so it stays dismissed on every device).
 */
export function WorkspaceSetupChecklist() {
  const { workspace, workspaceId, slug } = useCurrentWorkspace();
  const user = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setInviteMembersOpen = useWorkspaceStore((s) => s.setInviteMembersOpen);
  const enabled = Boolean(workspaceId);

  const prefsKey = queryKeys.workspaces.memberPreferences(workspaceId ?? '');
  const prefs = useQuery({
    queryKey: prefsKey,
    queryFn: () => workspaceApi.getMemberPreferences(workspaceId as string),
    enabled,
    staleTime: 60_000,
  });
  const invitations = useQuery({
    queryKey: ['home-setup', 'invitations', workspaceId],
    queryFn: () => invitationApi.list(workspaceId as string),
    enabled,
    staleTime: 60_000,
    retry: false,
  });
  const integrations = useQuery({
    queryKey: queryKeys.integrations.list(workspaceId ?? ''),
    queryFn: () => integrationsApi.list(workspaceId as string),
    enabled,
    staleTime: 15_000,
  });
  const agents = useQuery({
    queryKey: queryKeys.agentStudio.list(workspaceId ?? ''),
    queryFn: () => agentStudioApi.list(workspaceId as string),
    enabled,
    staleTime: 60_000,
  });

  const dismiss = useMutation({
    mutationFn: () =>
      workspaceApi.saveMemberPreferences(workspaceId as string, {
        [DISMISSED_KEY]: true,
      }),
    onMutate: () => {
      const previous = queryClient.getQueryData<Record<string, unknown>>(prefsKey);
      queryClient.setQueryData(prefsKey, { ...(previous ?? {}), [DISMISSED_KEY]: true });
      return { previous };
    },
    onError: (_err, _v, ctx) => {
      queryClient.setQueryData(prefsKey, ctx?.previous);
    },
  });

  // Wait for every source so a step never flips from "to do" to "done" on screen.
  if (!workspace || prefs.isLoading || invitations.isLoading || integrations.isLoading || agents.isLoading) {
    return null;
  }
  if (prefs.data?.[DISMISSED_KEY] === true) return null;

  const steps: SetupStep[] = [
    {
      id: 'invite',
      title: 'Invite your team',
      hint: 'Work happens with people — bring them in.',
      done: workspace.memberCount > 1 || (invitations.data?.length ?? 0) > 0,
      cta: 'Invite people',
      onClick: () => setInviteMembersOpen(true),
    },
    {
      id: 'photo',
      title: 'Add a profile photo',
      hint: 'Help teammates recognise you.',
      done: Boolean(user?.avatarUrl),
      cta: 'Edit profile',
      onClick: () => navigate(`/w/${slug}/settings/profile`),
    },
    {
      id: 'apps',
      title: 'Connect an app',
      hint: 'Bring in your calendar, docs or code.',
      done: (integrations.data ?? []).some((i) => i.status === 'CONNECTED'),
      cta: 'Browse apps',
      onClick: () => navigate(`/w/${slug}/marketplace?tab=apps`),
    },
    {
      id: 'agent',
      title: 'Build your first agent',
      hint: 'Describe a chore — Studio plans an agent for it.',
      done: (agents.data ?? []).some((a) => a.isMine),
      cta: 'Open Studio',
      onClick: () => navigate(`/w/${slug}/ai`),
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;
  const nextId = steps.find((s) => !s.done)?.id;

  return (
    <section
      aria-labelledby="home-setup-heading"
      className="@container w-full rounded-2xl border border-border bg-surface p-4 text-left"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="home-setup-heading" className="text-sm font-semibold text-foreground">
          Set up {workspace.name}
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {doneCount} of {steps.length} done
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss setup guide"
            onClick={() => dismiss.mutate()}
            className="text-muted-foreground"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
      <ol className="mt-3 grid gap-2 @md:grid-cols-2">
        {steps.map((step, i) => (
          <li
            key={step.id}
            className={`flex flex-col justify-between gap-2 rounded-xl border p-3 ${
              step.id === nextId ? 'border-foreground/30 bg-selected' : 'border-border/60'
            }`}
          >
            <div className="flex min-w-0 items-start gap-2">
              {step.done ? (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
              ) : (
                <span
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-semibold text-muted-foreground"
                  aria-hidden
                >
                  {i + 1}
                </span>
              )}
              <div className="min-w-0">
                <div
                  className={`text-xs font-semibold ${step.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}
                >
                  {step.title}
                  <span className="sr-only">{step.done ? ' — done' : ''}</span>
                </div>
                <p className="text-[11px] text-muted-foreground">{step.hint}</p>
              </div>
            </div>
            {!step.done && (
              <Button
                size="xs"
                variant={step.id === nextId ? 'primary' : 'outline'}
                onClick={step.onClick}
                className="self-start"
              >
                {step.cta} <ArrowRight className="size-3" />
              </Button>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
