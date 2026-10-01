import type { StudioAgentDetail } from '@org/types';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Textarea,
} from '@org/ui';
import { formatMs, RunDetailPanel, useAIRun } from '@org/web-ai';
import { FlaskConical, RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useStudioMutations } from './use-studio.js';

/** A realistic event for a test of an event-triggered agent. */
export function sampleEvent(agent: StudioAgentDetail): Record<string, unknown> | null {
  const trigger = agent.profile?.trigger ?? agent.trigger;
  if (trigger.kind !== 'event') return null;
  switch (trigger.event) {
    case 'channel.message':
      return {
        channelId: trigger.filter?.channelId ?? '',
        channelName: 'client-acme',
        senderName: 'Jordan (Acme)',
        text: 'Hi team — checkout is failing for our EU customers since this morning. Can someone look at it today? It is blocking our launch.',
      };
    case 'meeting.ended':
      return { meetingId: '', title: 'Weekly sync', startAt: new Date().toISOString() };
    case 'document.created':
    case 'document.updated':
      return { documentId: '', title: 'Q4 launch plan' };
    case 'project.created':
    case 'project.updated':
      return { projectId: trigger.filter?.projectId ?? '', name: 'Website relaunch', status: 'ON_HOLD', previousStatus: 'ACTIVE' };
    default:
      return {
        taskId: '',
        title: 'Fix payment webhook retries',
        identifier: 'EX-12',
        projectId: trigger.filter?.projectId ?? null,
        dueDate: new Date(Date.now() - 86_400_000).toISOString(),
      };
  }
}

/**
 * Test mode: the plan runs for real reads — tasks, meetings, docs, the model —
 * but every change (a doc, a task, a message, a notification) is simulated
 * and approvals pass on their own. Nothing in the workspace changes.
 */
export function TestRunDialog({
  workspaceId,
  slug,
  agent,
  open,
  onOpenChange,
}: {
  workspaceId: string | undefined;
  slug: string | undefined;
  agent: StudioAgentDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { run } = useStudioMutations(workspaceId);
  const eventSample = useMemo(() => sampleEvent(agent), [agent]);
  const [text, setText] = useState('');
  const [eventText, setEventText] = useState(() => (eventSample ? JSON.stringify(eventSample, null, 2) : ''));
  const [eventError, setEventError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const result = useAIRun(workspaceId, runId);

  useEffect(() => {
    if (!open) setRunId(null);
  }, [open]);

  const start = () => {
    let event: Record<string, unknown> | undefined;
    if (eventSample) {
      try {
        event = JSON.parse(eventText || '{}');
        setEventError(null);
      } catch {
        setEventError('The sample event isn’t valid JSON.');
        return;
      }
    }
    run.mutate({ id: agent.id, mode: 'test', text: text.trim() || undefined, event }, { onSuccess: (started) => setRunId(started.runId) });
  };

  const data = result.data;
  const steps = data?.steps ?? [];
  const planned = agent.profile?.steps.length ?? agent.stepCount;
  const summary = data
    ? {
        ran: steps.filter((s) => s.status === 'SUCCESS').length,
        simulated: steps.filter((s) => s.status === 'SKIPPED').length,
        failed: steps.filter((s) => s.status === 'FAILED').length,
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Test {agent.name}</DialogTitle>
          <DialogDescription>
            Reads your real data and calls the model, but simulates every change and approval — nothing in the workspace changes.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {!runId ? (
            <>
              <Field label="Sample request" optional hint="What someone might ask it — available to its steps as {{input.text}}.">
                <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Focus on the checkout project" />
              </Field>
              {eventSample ? (
                <Field label="Sample event" hint="The event the agent reacts to. Edit it to try other cases." error={eventError ?? undefined}>
                  <Textarea rows={8} className="font-mono text-xs" value={eventText} onChange={(e) => setEventText(e.target.value)} />
                </Field>
              ) : null}
            </>
          ) : (
            <div className="space-y-4">
              {summary ? (
                <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
                  <Stat label="Planned steps" value={planned} />
                  <Stat label="Ran" value={summary.ran} />
                  <Stat label="Simulated" value={summary.simulated} />
                  <Stat label="Failed" value={summary.failed} tone={summary.failed ? 'bad' : undefined} />
                </div>
              ) : null}
              {data && data.status !== 'RUNNING' ? (
                <p className="text-xs text-muted-foreground">
                  Took {formatMs(data.latencyMs)} and {data.tokensUsed.toLocaleString()} tokens.{' '}
                  {summary?.failed ? 'Open a failed step to see why, fix the plan, then test again.' : 'Check the result reads the way you want before switching it on.'}
                </p>
              ) : null}
              <RunDetailPanel
                workspaceId={workspaceId}
                slug={slug}
                runId={runId}
                graph={{ nodes: agent.nodes, edges: agent.edges }}
              />
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          {runId ? (
            <Button variant="outline" leadingIcon={<RotateCcw />} onClick={() => setRunId(null)}>
              Test again
            </Button>
          ) : (
            <Button leadingIcon={<FlaskConical />} loading={run.isPending} onClick={start}>
              Run test
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'bad' }) {
  return (
    <div className="rounded-lg border border-border bg-surface-inset p-2">
      <p className={tone === 'bad' ? 'text-lg font-semibold text-destructive' : 'text-lg font-semibold text-foreground'}>{value}</p>
      <p className="text-muted-foreground">{label}</p>
    </div>
  );
}
