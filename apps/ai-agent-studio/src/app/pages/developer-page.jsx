import { useState } from 'react';
import { Badge, Button, Card, CodeBlock, Page, PageHeader, toast } from '@org/ui';
import { cn } from '@org/utils';
import {
  Code2,
  Globe,
  Play,
  Terminal,
  Zap,
} from 'lucide-react';
import { useStudioSession } from '../session-guard.js';

export function DeveloperPage() {
  const { activeWorkspace } = useStudioSession();
  const [selectedLang, setSelectedLang] = useState('curl');
  const [testPayload, setTestPayload] = useState('{\n  "query": "How do I setup SAML SSO?",\n  "stream": true\n}');
  const [testResponse, setTestResponse] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const snippets = {
    curl: `curl -X POST "https://api.onetab.ai/v1/agents/agent-support-pro/run" \\
  -H "Authorization: Bearer ot_live_secret_key" \\
  -H "Content-Type: application/json" \\
  -d '${testPayload.replace(/\n\s*/g, '')}'`,

    javascript: `import { OneTabAgentClient } from '@onetab/agent-sdk';

const client = new OneTabAgentClient({
  apiKey: process.env.ONETAB_API_KEY,
  workspaceId: '${activeWorkspace.id}',
});

const execution = await client.agents.run('agent-support-pro', {
  input: {
    query: 'How do I setup SAML SSO?',
  },
  stream: true,
});

for await (const chunk of execution.stream()) {
  process.stdout.write(chunk.delta);
}`,

    python: `from onetab_agents import AgentClient

client = AgentClient(
    api_key="ot_live_secret_key",
    workspace_id="${activeWorkspace.id}"
)

response = client.agents.run(
    agent_id="agent-support-pro",
    input={"query": "How do I setup SAML SSO?"},
    stream=True
)

for event in response.iter_events():
    print(event.text, end="", flush=True)`,
  };

  const handleRunTest = async () => {
    setIsRunning(true);
    setTestResponse(null);
    await new Promise((r) => setTimeout(r, 600));
    try {
      const parsed = JSON.parse(testPayload);
      setTestResponse({
        statusCode: 200,
        status: 'SUCCESS',
        executionId: `exec-${Math.floor(1000 + Math.random() * 9000)}`,
        latencyMs: 380,
        data: {
          agentId: 'agent-support-pro',
          role: 'Tier-1 Support Specialist',
          output: `[Simulated API Response]\nSuccessfully processed prompt: "${parsed.query || 'Test message'}"\nRelevant knowledge retrieved: SAML SSO Documentation (Score: 0.94).`,
          tokens: { input: 120, output: 280, total: 400 },
        },
      });
      toast.success('API test request returned 200 OK');
    } catch {
      setTestResponse({
        statusCode: 400,
        error: 'Invalid JSON payload in test body',
      });
      toast.error('Invalid JSON payload');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <Page width="wide" padding="none" className="space-y-6">
      {/* Header matching Admin */}
      <PageHeader
        title="Developer Hub & API Sandbox"
        description="Integrate autonomous workflows and published agents into external applications, CI/CD pipelines, and microservices."
        icon={<Code2 className="size-5" />}
        accent="blue"
        actions={
          <Badge variant="outline" className="text-xs font-mono">
            v1 REST & SDK
          </Badge>
        }
      />

      {/* Quick Specs Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 shadow-2xs hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">REST API Base URL</span>
            <Globe className="size-4 text-primary" />
          </div>
          <div className="mt-2 font-mono text-xs font-bold text-foreground">
            https://api.onetab.ai/v1
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Bearer token authenticated</p>
        </Card>

        <Card className="p-4 shadow-2xs hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Workspace ID</span>
            <Terminal className="size-4 text-primary" />
          </div>
          <div className="mt-2 font-mono text-xs font-bold text-foreground truncate">
            {activeWorkspace.id}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Include in X-Workspace-Id header</p>
        </Card>

        <Card className="p-4 shadow-2xs hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Rate Limits</span>
            <Zap className="size-4 text-success" />
          </div>
          <div className="mt-2 text-xs font-bold text-foreground">
            600 req/min • 50 concurrent
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Enterprise burst tier</p>
        </Card>
      </div>

      {/* Interactive Sandbox & Code Snippets */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Code Snippets */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Execution Code Snippet</h3>
            <div className="flex items-center rounded-lg border border-border bg-surface p-0.5 text-xs">
              {['curl', 'javascript', 'python'].map((lang) => (
                <button
                  key={lang}
                  onClick={() => setSelectedLang(lang)}
                  className={cn(
                    'rounded px-2.5 py-1 capitalize font-medium transition-colors',
                    selectedLang === lang
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          <CodeBlock
            code={snippets[selectedLang]}
            language={selectedLang === 'node' ? 'javascript' : selectedLang}
            showLineNumbers={false}
          />
        </div>

        {/* Right: Interactive Sandbox Runner */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Interactive Request Sandbox</h3>
              <p className="text-xs text-muted-foreground">Test API payload dispatching with mock responses</p>
            </div>
            <Button
              size="sm"
              onClick={handleRunTest}
              loading={isRunning}
              className="gap-1.5 text-xs font-semibold"
            >
              <Play className="size-3.5" />
              Send Request
            </Button>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">Request Body (JSON)</label>
            <textarea
              rows={4}
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface p-2.5 font-mono text-xs text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
            />
          </div>

          {testResponse && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase">
                <span>Response Body</span>
                <span className={cn('font-bold', testResponse.statusCode === 200 ? 'text-success' : 'text-destructive')}>
                  HTTP {testResponse.statusCode} {testResponse.latencyMs ? `(${testResponse.latencyMs}ms)` : ''}
                </span>
              </div>
              <CodeBlock
                variant="compact"
                language="json"
                code={JSON.stringify(testResponse, null, 2)}
              />
            </div>
          )}
        </div>
      </div>
    </Page>
  );
}
