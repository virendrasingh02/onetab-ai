import { agentApiKeysApi } from '@org/api-client';
import { AppSelect, Button, Card, Field, SegmentedControl } from '@org/ui';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from '../../../router.js';
import { SnippetBlock } from './parts.js';
import { buildSnippets } from './snippets.js';
import { apiBase } from './use-deployment.js';

type Lang = 'curl' | 'node' | 'python';

const LANGS: Array<{ value: Lang; label: string }> = [
  { value: 'curl', label: 'cURL' },
  { value: 'node', label: 'Node' },
  { value: 'python', label: 'Python' },
];

const LANGUAGE = {
  curl: 'bash',
  node: 'javascript',
  python: 'python',
} as const;

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="gap-3 flex">
      <span
        aria-hidden
        className="size-5 font-bold flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-2xs text-primary"
      >
        {n}
      </span>
      <div className="min-w-0 space-y-2 flex-1">
        <div className="text-xs font-semibold text-foreground">{title}</div>
        {children}
      </div>
    </li>
  );
}

/**
 * How a key is used, with a call built from one of the workspace's real agents.
 * `apiKey` is the key just created, if any: it fills the cURL call so it can be
 * tried as is. Node and Python read it from the environment, as servers should.
 */
export function ApiKeyQuickstart({
  workspaceId,
  agentId,
  apiKey,
}: {
  workspaceId: string;
  agentId?: string;
  apiKey?: string;
}) {
  const navigate = useNavigate();
  const [lang, setLang] = useState<Lang>('curl');
  const [pickedAgentId, setPickedAgentId] = useState(agentId ?? '');

  const agentsQuery = useQuery({
    queryKey: ['agent-api-keys', workspaceId, 'deployed-agents'],
    queryFn: () => agentApiKeysApi.deployedAgents(workspaceId),
    enabled: !!workspaceId,
  });
  const agents = agentsQuery.data ?? [];
  const selectedId = agents.some((a) => a.id === pickedAgentId)
    ? pickedAgentId
    : (agents[0]?.id ?? agentId ?? 'AGENT_ID');

  const snippets = buildSnippets({
    apiBase: apiBase(),
    agentId: selectedId,
    publicKey: '',
  });
  const code =
    apiKey && lang === 'curl'
      ? snippets.curl.replace('YOUR_AGENT_API_KEY', apiKey)
      : snippets[lang];

  return (
    <Card className="space-y-4 p-4 shadow-2xs">
      <h4 className="text-sm font-semibold text-foreground">Use a key</h4>
      <ol className="space-y-4">
        <Step n={1} title="Create a key and copy it">
          <p className="text-xs text-muted-foreground">
            It is shown once. Only a hash is stored, so a lost key has to be
            replaced.
          </p>
        </Step>
        <Step n={2} title="Keep it on your server">
          <p className="text-xs text-muted-foreground">
            Store it as{' '}
            <code className="text-foreground">ONETAB_AGENT_KEY</code>. Never put
            it in a website or app: those use the agent’s public key, from its
            Deployment tab.
          </p>
        </Step>
        <Step n={3} title="Call an agent">
          {agents.length > 0 ? (
            <Field label="Agent">
              <AppSelect
                value={selectedId}
                onValueChange={setPickedAgentId}
                options={agents.map((a) => ({ value: a.id, label: a.name }))}
              />
            </Field>
          ) : agentsQuery.isSuccess ? (
            <p className="text-xs text-muted-foreground">
              No agent is deployed yet, so a key has nothing to run. Deploy one
              from its Deployment tab first.
            </p>
          ) : null}
          <SegmentedControl
            aria-label="Language"
            size="sm"
            value={lang}
            onChange={(v) => setLang(v as Lang)}
            options={LANGS}
          />
          <SnippetBlock
            title="POST /agents/:agentId/execute"
            code={code}
            language={LANGUAGE[lang]}
          />
          <p className="text-xs text-muted-foreground">
            The response holds <code className="text-foreground">status</code>,{' '}
            <code className="text-foreground">output</code> and{' '}
            <code className="text-foreground">runId</code>. A run that needs a
            person ends in{' '}
            <code className="text-foreground">WAITING_FOR_APPROVAL</code>.
          </p>
        </Step>
      </ol>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs self-start"
        onClick={() => navigate('/developer')}
      >
        Try a key in the Developer Hub <ArrowRight className="size-3.5" />
      </Button>
    </Card>
  );
}
