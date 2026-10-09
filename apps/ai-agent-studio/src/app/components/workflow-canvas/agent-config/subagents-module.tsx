import { AppSelect, Badge, Button, confirm, Input } from '@org/ui';
import { cn } from '@org/utils';
import { MAX_AGENT_RUN_LIMITS, DEFAULT_AGENT_RUN_LIMITS } from '@org/types';
import { Activity, ArrowRight, Bot, Network, Plus, Settings2, Unlink } from 'lucide-react';
import { useState } from 'react';
import { CATALOG_NODES } from '../node-library.js';
import { DELEGATION_MODES, isSlotHost, slotConnectionError, type DelegationMode } from '../agent-slots.js';
import { labelOf } from './agent-module-model.js';
import { IssueList, NumberSetting, SectionEmpty, SettingField, SettingSection, StatGrid, fieldDomId } from './config-primitives.js';
import type { ModuleEditorProps } from './module-drawer.js';

/** Common multi-agent patterns, and the delegation mode that runs each. */
const PATTERNS: Record<DelegationMode, string> = {
  router: 'Supervisor · Router · Capability matching — the lead’s model picks who does what, and can use several in one turn.',
  sequential: 'Pipeline · Planner → executor · Researcher → writer — each member works in order on the previous result.',
  parallel: 'Fan-out · Specialists side by side — every member works at once, then the lead merges their answers.',
  review_loop: 'Generator → validator · Critic — the workers go in order, then the reviewer (role or name with “review”, “critic” or “QA”, else the last member) checks it all.',
};

const AGENT_CARDS = CATALOG_NODES.filter((n) => ['SUB_AGENT', 'AGENT', 'AGENT_COORDINATOR'].includes(n.type));

export function SubAgentsModule({ view, agent, nodes, edges, issues, readOnly, setConfig, setLimits, actions, jumpTo }: ModuleEditorProps) {
  const team = view.subAgents;
  const members = team.members;
  const [newType, setNewType] = useState('SUB_AGENT');
  const [existing, setExisting] = useState('');

  // Agents on the canvas that could join this team (the same rule a drag uses).
  const candidates = nodes.filter(
    (n) => isSlotHost(n.type) && n.id !== agent.id && !members.some((m) => m.nodeId === n.id) && !slotConnectionError({ source: agent.id, sourceHandle: 'agents', target: n.id, targetHandle: null }, nodes, edges),
  );
  const unplug = async (nodeId: string, label: string) => {
    const ok = await confirm({ title: `Remove ${label} from the team?`, description: 'The agent stays on the canvas, it just stops reporting to this one. Undo with Ctrl+Z.', confirmLabel: 'Remove' });
    if (ok) actions.detach(nodeId, 'agents');
  };
  const reviewer = (() => {
    if (team.delegation !== 'review_loop' || members.length === 0) return null;
    return members.find((m) => /review|critic|qa\b|quality/i.test(`${m.role} ${m.label}`)) ?? members[members.length - 1];
  })();

  return (
    <>
      <SettingSection id="overview" title="Overview" description="A team: this agent leads; its sub-agents can have their own prompt, model, knowledge, tools and teams.">
        <StatGrid
          items={[
            { label: 'Specialists', value: members.length },
            { label: 'Delegation', value: DELEGATION_MODES.find((m) => m.value === team.delegation)?.label },
            { label: 'Reports to', value: team.isSupervised ? 'A supervisor' : 'Nobody (lead)' },
          ]}
        />
        <IssueList issues={issues} onJump={jumpTo} empty={members.length ? 'Every team member is set up.' : undefined} />
      </SettingSection>

      <SettingSection id="members" title="Team" issues={issues.filter((i) => i.section === 'members')}>
        {members.length === 0 ? (
          <SectionEmpty icon={Network} title="Works alone">
            Add specialists this agent can hand work to.
          </SectionEmpty>
        ) : (
          <ol className="space-y-1.5">
            {members.map((m, i) => (
              <li key={m.nodeId} id={fieldDomId(`node-${m.nodeId}`)} className={cn('space-y-2 rounded-lg border bg-surface-raised/40 p-2.5 scroll-mt-16', reviewer?.nodeId === m.nodeId ? 'border-primary/50' : 'border-border')}>
                <div className="flex items-center gap-2">
                  {team.delegation === 'sequential' || team.delegation === 'review_loop' ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[10px] font-semibold text-primary-text">{i + 1}</span>
                  ) : (
                    <Bot className="size-4 shrink-0 text-primary" />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      <span className="truncate">{m.label}</span>
                      {reviewer?.nodeId === m.nodeId && <Badge variant="primary" className="h-4 px-1 text-[9px]">Reviewer</Badge>}
                    </span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {m.model ? `${m.model.inherited ? 'Inherits ' : ''}${m.model.model}` : 'No model'} · {m.hasPrompt ? 'has instructions' : 'no instructions'} · {m.toolCount} tools
                      {m.memberCount ? ` · leads ${m.memberCount}` : ''}
                    </span>
                  </span>
                  <Button type="button" variant="ghost" size="xs" onClick={() => actions.selectNode(m.nodeId)} aria-label={`Configure ${m.label}`}>
                    <Settings2 className="size-3.5" />
                    Configure
                  </Button>
                  {!readOnly && (
                    <Button type="button" variant="ghost" size="icon-xs" onClick={() => void unplug(m.nodeId, m.label)} aria-label={`Remove ${m.label} from the team`}>
                      <Unlink className="size-3.5" />
                    </Button>
                  )}
                </div>
                <Input
                  inputSize="sm"
                  value={m.role}
                  disabled={readOnly}
                  placeholder="Role, e.g. Researcher — the lead sees this when delegating"
                  aria-label={`${m.label} role`}
                  onChange={(e) => setConfig(m.nodeId, { role: e.target.value || undefined })}
                  className="text-xs"
                />
              </li>
            ))}
          </ol>
        )}
        {!readOnly && (
          <div className="space-y-1.5 rounded-lg border border-dashed border-border p-2.5">
            <div className="flex gap-1.5">
              <AppSelect size="sm" value={newType} aria-label="Kind of agent to add" options={AGENT_CARDS.map((c) => ({ value: c.type, label: c.label, description: c.subtitle }))} onValueChange={setNewType} className="flex-1" />
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const card = AGENT_CARDS.find((c) => c.type === newType);
                  if (card) actions.attach(card, 'agents');
                }}
              >
                <Plus className="size-3.5" />
                New
              </Button>
            </div>
            {candidates.length > 0 && (
              <div className="flex gap-1.5">
                <AppSelect size="sm" value={existing} placeholder="Add an agent already on the canvas…" aria-label="Existing agent to add" options={candidates.map((c) => ({ value: c.id, label: labelOf(c) }))} onValueChange={setExisting} className="flex-1" />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!existing}
                  onClick={() => {
                    actions.connect(existing, 'agents');
                    setExisting('');
                  }}
                >
                  Add
                </Button>
              </div>
            )}
          </div>
        )}
      </SettingSection>

      <SettingSection id="delegation" title="Delegation" description="How this agent uses its team at run time.">
        <div role="radiogroup" aria-label="Delegation pattern" className="space-y-1.5">
          {DELEGATION_MODES.map((mode) => {
            const selected = team.delegation === mode.value;
            return (
              <button
                key={mode.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={readOnly}
                onClick={() => setConfig(view.agentId, { delegation: mode.value })}
                className={cn(
                  'w-full rounded-lg border px-3 py-2 text-left transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
                  selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-surface-raised',
                )}
              >
                <span className="flex items-center gap-2 text-xs font-semibold text-foreground">
                  <span className={cn('size-3 rounded-full border-2', selected ? 'border-primary bg-primary' : 'border-muted-foreground/40')} aria-hidden />
                  {mode.label}
                </span>
                <span className="mt-0.5 block pl-5 text-[11px] leading-relaxed text-muted-foreground">{PATTERNS[mode.value]}</span>
              </button>
            );
          })}
        </div>
        {members.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 rounded-lg bg-surface-inset px-2.5 py-2 text-[11px] text-foreground" aria-label="Execution order">
            <span className="font-medium">{view.agentLabel}</span>
            <ArrowRight className="size-3 text-muted-foreground" />
            {team.delegation === 'parallel' || team.delegation === 'router' ? (
              <span>{team.delegation === 'router' ? 'chooses from ' : 'all at once: '}{members.map((m) => m.label).join(', ')}</span>
            ) : (
              members.map((m, i) => (
                <span key={m.nodeId} className="inline-flex items-center gap-1">
                  {i > 0 && <ArrowRight className="size-3 text-muted-foreground" />}
                  {m.label}
                </span>
              ))
            )}
            <ArrowRight className="size-3 text-muted-foreground" />
            <span className="font-medium">answer</span>
          </div>
        )}
      </SettingSection>

      <SettingSection id="limits" title="Limits" description="Ceilings for the whole run — every agent and sub-agent shares them.">
        <NumberSetting
          field="maxDelegations"
          label="Delegations per run"
          value={(team.limits.maxDelegations !== DEFAULT_AGENT_RUN_LIMITS.maxDelegations ? team.limits.maxDelegations : undefined)}
          min={1}
          max={MAX_AGENT_RUN_LIMITS.maxDelegations}
          placeholder={`Default (${DEFAULT_AGENT_RUN_LIMITS.maxDelegations})`}
          onChange={(v) => setLimits({ maxDelegations: v === undefined ? undefined : Math.round(v) })}
        />
        <NumberSetting
          field="maxSteps"
          label="Steps per run"
          value={team.limits.maxSteps !== DEFAULT_AGENT_RUN_LIMITS.maxSteps ? team.limits.maxSteps : undefined}
          min={1}
          max={MAX_AGENT_RUN_LIMITS.maxSteps}
          placeholder={`Default (${DEFAULT_AGENT_RUN_LIMITS.maxSteps})`}
          onChange={(v) => setLimits({ maxSteps: v === undefined ? undefined : Math.round(v) })}
        />
        <NumberSetting
          field="maxDurationMs"
          label="Time limit"
          suffix="min"
          value={team.limits.maxDurationMs !== DEFAULT_AGENT_RUN_LIMITS.maxDurationMs ? Math.round(team.limits.maxDurationMs / 60_000) : undefined}
          min={1}
          max={MAX_AGENT_RUN_LIMITS.maxDurationMs / 60_000}
          placeholder={`Default (${DEFAULT_AGENT_RUN_LIMITS.maxDurationMs / 60_000})`}
          onChange={(v) => setLimits({ maxDurationMs: v === undefined ? undefined : Math.round(v * 60_000) })}
        />
        <NumberSetting
          field="maxTokens"
          label="Token budget"
          value={team.limits.maxTokens}
          min={1_000}
          max={MAX_AGENT_RUN_LIMITS.maxTokens}
          step={1_000}
          placeholder="No run-level cap (credits still apply)"
          onChange={(v) => setLimits({ maxTokens: v === undefined ? undefined : Math.round(v) })}
        />
      </SettingSection>

      <SettingSection id="testing" title="Testing" description="Runs the whole agent with its team in the run console: every delegation, member result and message is shown live.">
        <Button type="button" size="sm" onClick={actions.runAgentTest}>
          <Activity className="size-3.5" />
          Open run console
        </Button>
        <SettingField label="Who would be involved">
          <ul className="space-y-0.5 text-[11px] text-muted-foreground">
            <li className="font-medium text-foreground">{view.agentLabel} (lead)</li>
            {members.map((m) => (
              <li key={m.nodeId} className="pl-3">↳ {m.label}{m.memberCount ? ` (+${m.memberCount} of its own)` : ''}</li>
            ))}
          </ul>
        </SettingField>
      </SettingSection>
    </>
  );
}
