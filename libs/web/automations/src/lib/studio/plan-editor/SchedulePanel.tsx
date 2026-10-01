import {
  AGENT_EVENTS,
  describeCronExpression,
  type AgentBlueprintTrigger,
  type AgentEventName,
  type AgentTriggerKind,
} from '@org/types';
import { AppSelect, Field, Input, SegmentedControl } from '@org/ui';
import { getSystemTimezone, isValidCron, listTimezones, nextCronRun } from '@org/utils';
import { CalendarClock, Hand, Zap } from 'lucide-react';
import { useMemo } from 'react';
import { ChannelPicker, ProjectPicker } from './pickers.js';

type Cadence = 'weekdays' | 'daily' | 'weekly' | 'monthly' | 'month-end' | 'hourly' | 'custom';

const CADENCES: ReadonlyArray<{ value: Cadence; label: string }> = [
  { value: 'weekdays', label: 'Every weekday' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Once a week' },
  { value: 'monthly', label: 'Once a month' },
  { value: 'month-end', label: 'At month-end' },
  { value: 'hourly', label: 'Every hour' },
  { value: 'custom', label: 'Custom (cron)' },
];

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface ScheduleForm {
  cadence: Cadence;
  time: string;
  weekday: number;
  day: number;
}

/** Reads the common cron shapes back into the form; anything else is "custom". */
export function cronToForm(cron: string | undefined): ScheduleForm {
  const fallback: ScheduleForm = { cadence: 'weekdays', time: '09:00', weekday: 1, day: 1 };
  if (!cron) return fallback;
  const [min, hour, dom, month, dow] = cron.trim().split(/\s+/);
  const time = /^\d+$/.test(min ?? '') && /^\d+$/.test(hour ?? '') ? `${hour!.padStart(2, '0')}:${min!.padStart(2, '0')}` : '09:00';
  if (month !== '*') return { ...fallback, cadence: 'custom', time };
  if (/^\d+$/.test(min ?? '') && hour === '*' && dom === '*' && dow === '*') return { ...fallback, cadence: 'hourly', time: `00:${min!.padStart(2, '0')}` };
  if (!/^\d+$/.test(min ?? '') || !/^\d+$/.test(hour ?? '')) return { ...fallback, cadence: 'custom' };
  if (dom === 'L' && dow === '*') return { ...fallback, cadence: 'month-end', time };
  if (/^\d+$/.test(dom ?? '') && dow === '*') return { ...fallback, cadence: 'monthly', time, day: Number(dom) };
  if (dom !== '*') return { ...fallback, cadence: 'custom', time };
  if (dow === '*') return { ...fallback, cadence: 'daily', time };
  if (dow === '1-5') return { ...fallback, cadence: 'weekdays', time };
  if (/^\d$/.test(dow ?? '')) return { ...fallback, cadence: 'weekly', time, weekday: Number(dow) };
  return { ...fallback, cadence: 'custom', time };
}

export function formToCron(form: ScheduleForm): string {
  const [h, m] = form.time.split(':').map((n) => Number(n) || 0);
  switch (form.cadence) {
    case 'hourly':
      return `${m} * * * *`;
    case 'daily':
      return `${m} ${h} * * *`;
    case 'weekly':
      return `${m} ${h} * * ${form.weekday}`;
    case 'monthly':
      return `${m} ${h} ${form.day} * *`;
    case 'month-end':
      return `${m} ${h} L * *`;
    default:
      return `${m} ${h} * * 1-5`;
  }
}

/**
 * When an agent runs: when you ask it, on a schedule (in plain words, read in
 * a time zone), or when something happens in the workspace — with the next
 * few runs shown so "6 PM" is never a surprise.
 */
export function SchedulePanel({
  workspaceId,
  trigger,
  onChange,
}: {
  workspaceId: string | undefined;
  trigger: AgentBlueprintTrigger;
  onChange: (next: AgentBlueprintTrigger) => void;
}) {
  const form = cronToForm(trigger.cron);
  const timezone = trigger.timezone || getSystemTimezone();
  const zones = useMemo(() => listTimezones().map((z) => ({ value: z, label: z.replace(/_/g, ' ') })), []);
  const cronValid = trigger.kind !== 'schedule' || isValidCron(trigger.cron);
  const upcoming = useMemo(() => {
    if (trigger.kind !== 'schedule' || !trigger.cron || !isValidCron(trigger.cron)) return [];
    const runs: Date[] = [];
    let from = new Date();
    for (let i = 0; i < 3; i++) {
      const next = nextCronRun(trigger.cron, from, timezone);
      if (!next) break;
      runs.push(next);
      from = next;
    }
    return runs;
  }, [trigger.kind, trigger.cron, timezone]);
  const event = AGENT_EVENTS.find((e) => e.value === trigger.event);

  const setKind = (kind: AgentTriggerKind) => {
    if (kind === 'schedule') onChange({ kind, cron: trigger.cron && isValidCron(trigger.cron) ? trigger.cron : '0 9 * * 1-5', timezone });
    else if (kind === 'event') onChange({ kind, event: trigger.event ?? 'task.created', ...(trigger.filter ? { filter: trigger.filter } : {}) });
    else onChange({ kind });
  };
  const setForm = (patch: Partial<ScheduleForm>) => onChange({ ...trigger, cron: formToCron({ ...form, ...patch }) });

  return (
    <div className="space-y-4">
      <SegmentedControl
        aria-label="When the agent runs"
        options={[
          { value: 'manual', label: 'When I ask' },
          { value: 'schedule', label: 'On a schedule' },
          { value: 'event', label: 'When something happens' },
        ]}
        value={trigger.kind}
        onChange={setKind}
      />

      {trigger.kind === 'manual' ? (
        <p className="flex items-start gap-2 text-sm text-muted-foreground">
          <Hand className="mt-0.5 size-4 shrink-0" aria-hidden />
          It runs when you press Run or ask it in the agent’s chat. Nothing runs by itself.
        </p>
      ) : null}

      {trigger.kind === 'schedule' ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="How often">
              <AppSelect
                value={form.cadence}
                onValueChange={(v) => (v === 'custom' ? onChange({ ...trigger, cron: trigger.cron ?? formToCron(form) }) : setForm({ cadence: v as Cadence }))}
                options={CADENCES.map((c) => ({ value: c.value, label: c.label }))}
              />
            </Field>
            {form.cadence === 'weekly' ? (
              <Field label="On">
                <AppSelect
                  value={String(form.weekday)}
                  onValueChange={(v) => setForm({ weekday: Number(v) })}
                  options={WEEKDAYS.map((d, i) => ({ value: String(i), label: d }))}
                />
              </Field>
            ) : null}
            {form.cadence === 'monthly' ? (
              <Field label="On day">
                <Input type="number" min={1} max={28} value={form.day} onChange={(e) => setForm({ day: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })} />
              </Field>
            ) : null}
            {form.cadence !== 'hourly' && form.cadence !== 'custom' ? (
              <Field label="At">
                <Input type="time" value={form.time} onChange={(e) => e.target.value && setForm({ time: e.target.value })} />
              </Field>
            ) : null}
          </div>
          {form.cadence === 'custom' ? (
            <Field
              label="Cron expression"
              hint="Minute hour day month weekday — “0 18 * * 1-5” is 6 PM on weekdays; “L” in the day means the last day of the month."
              error={cronValid ? undefined : 'That isn’t a valid five-part schedule.'}
            >
              <Input className="font-mono" value={trigger.cron ?? ''} onChange={(e) => onChange({ ...trigger, cron: e.target.value })} />
            </Field>
          ) : null}
          <Field label="Time zone" hint="The schedule is read in this zone — “6 PM” means 6 PM there.">
            <AppSelect value={timezone} onValueChange={(v) => onChange({ ...trigger, timezone: v })} options={zones} searchable />
          </Field>
          {cronValid ? (
            <div className="flex items-start gap-2 rounded-lg bg-surface-inset p-3 text-xs">
              <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div>
                <p className="font-medium text-foreground">{describeCronExpression(trigger.cron)}</p>
                {upcoming.length ? (
                  <p className="mt-0.5 text-muted-foreground">
                    Next:{' '}
                    {upcoming
                      .map((d) => d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: timezone }))
                      .join(' · ')}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {trigger.kind === 'event' ? (
        <div className="space-y-3">
          <Field label="When">
            <AppSelect
              value={trigger.event ?? 'task.created'}
              onValueChange={(v) => onChange({ kind: 'event', event: v as AgentEventName })}
              options={AGENT_EVENTS.map((e) => ({ value: e.value, label: e.label }))}
            />
          </Field>
          {event?.filter === 'channel' ? (
            <Field label="Which channel" required hint="Only channels you belong to. Messages from bots are ignored, so the agent never reacts to itself.">
              <ChannelPicker
                workspaceId={workspaceId}
                value={trigger.filter?.channelId}
                onChange={(channelId) => onChange({ ...trigger, filter: { ...trigger.filter, channelId } })}
              />
            </Field>
          ) : trigger.event?.startsWith('task.') || trigger.event === 'meeting.ended' || trigger.event === 'project.updated' ? (
            <Field label="Only in project" optional>
              <ProjectPicker
                workspaceId={workspaceId}
                value={trigger.filter?.projectId}
                allowNone="Any project"
                onChange={(projectId) => onChange({ ...trigger, filter: { ...trigger.filter, projectId: projectId || undefined } })}
              />
            </Field>
          ) : null}
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <Zap className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            The event’s details are available to every step as {'{{event.…}}'}.
          </p>
        </div>
      ) : null}
    </div>
  );
}
