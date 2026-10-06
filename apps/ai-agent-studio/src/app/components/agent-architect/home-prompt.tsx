import { agentStudioApi } from '@org/api-client';
import { Badge, Button, Textarea } from '@org/ui';
import { useQuery } from '@tanstack/react-query';
import { Lightbulb, Sparkles, Wand2 } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { PROMPT_SUGGESTIONS } from '../../data/prompt-templates.js';

/** Ideas that only make sense with what this workspace has connected (brief §30). */
function connectedIdeas(apps: string[]): Array<{ why: string; prompt: string }> {
  const has = (p: string) => apps.includes(p);
  const label = (p: string) => ({ GMAIL: 'Gmail', SLACK: 'Slack', GITHUB: 'GitHub', NOTION: 'Notion', LINEAR: 'Linear', GOOGLE_CALENDAR: 'Google Calendar', HUBSPOT: 'HubSpot', SALESFORCE: 'Salesforce' })[p] ?? p;
  const ideas: Array<{ why: string; prompt: string }> = [];
  if (has('GMAIL') && has('SLACK')) ideas.push({ why: 'You have Gmail and Slack connected.', prompt: 'Check my Gmail every morning, find important emails, summarise them and send the summary to Slack.' });
  else if (has('GMAIL')) ideas.push({ why: 'You have Gmail connected.', prompt: 'Every morning, summarise my unread important emails and create tasks for anything that needs a reply.' });
  if (has('GITHUB')) ideas.push({ why: 'You have GitHub connected.', prompt: 'Every weekday at 9 AM, summarise open pull requests that need review and post it in #engineering.' });
  if (has('GOOGLE_CALENDAR')) ideas.push({ why: 'You have Google Calendar connected.', prompt: 'Every morning, prepare a brief for each of today’s meetings with context from our docs.' });
  if (has('HUBSPOT') || has('SALESFORCE')) {
    const crm = has('HUBSPOT') ? 'HUBSPOT' : 'SALESFORCE';
    ideas.push({ why: `You have ${label(crm)} connected.`, prompt: `Check new ${label(crm)} leads every weekday at 9 AM, score them and draft follow-ups for my approval.` });
  }
  if (!ideas.length) ideas.push({ why: 'Works with what every workspace has.', prompt: 'Prepare my daily work report every weekday evening from my tasks and meetings.' });
  return ideas.slice(0, 3);
}

/** The Studio home's large prompt: describe an agent, land on the plan. */
export function HomePrompt({ workspaceId }: { workspaceId: string }) {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const { data: catalog } = useQuery({
    queryKey: ['agent-studio-catalog', workspaceId],
    queryFn: () => agentStudioApi.catalog(workspaceId),
    staleTime: 5 * 60_000,
  });
  const ideas = useMemo(
    () => connectedIdeas((catalog?.apps ?? []).filter((a) => a.status === 'CONNECTED').map((a) => a.provider)),
    [catalog],
  );

  const go = (text: string) => navigate(`/create?prompt=${encodeURIComponent(text.trim())}&go=1`);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (prompt.trim().length >= 3) go(prompt);
  };

  return (
    <section aria-labelledby="home-create-heading" className="grid gap-4 rounded-xl border border-border bg-surface p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-0.5">
          <Badge variant="primary" className="gap-1">
            <Sparkles className="size-3" aria-hidden /> Create with one prompt
          </Badge>
          <h2 id="home-create-heading" className="text-base font-semibold text-foreground">
            What do you want your agent to do?
          </h2>
        </div>
        <label htmlFor="home-prompt" className="sr-only">Describe the agent</label>
        <Textarea
          id="home-prompt"
          rows={3}
          value={prompt}
          maxLength={4_000}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && prompt.trim().length >= 3) go(prompt);
          }}
          placeholder={`e.g. “${PROMPT_SUGGESTIONS[0]}”`}
          className="resize-none text-sm"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" disabled={prompt.trim().length < 3} className="gap-1.5">
            <Wand2 className="size-4" /> Create agent
          </Button>
          {PROMPT_SUGGESTIONS.slice(1, 4).map((s) => (
            <Button key={s} type="button" variant="ghost" size="xs" onClick={() => setPrompt(s)}>
              {s}
            </Button>
          ))}
        </div>
      </form>
      <div className="space-y-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Lightbulb className="size-3.5" aria-hidden /> Suggestions
        </h3>
        <ul className="space-y-1.5">
          {ideas.map((idea) => (
            <li key={idea.prompt}>
              <button
                type="button"
                onClick={() => go(idea.prompt)}
                className="w-full rounded-lg border border-border p-2.5 text-left transition-colors hover:border-border-strong hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <span className="block text-[11px] text-muted-foreground">{idea.why} Want this?</span>
                <span className="block text-xs font-medium text-foreground">{idea.prompt}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
