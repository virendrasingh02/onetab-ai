import React, { useState, useEffect } from 'react';
import {
  Badge,
  Button,
  Card,
  CodeBlock,
  toast,
  Label,
  Textarea,
  Input,
  AppSelect,
  SegmentedControl,
} from '@org/ui';
import { StudioPage } from '../components/studio-page.js';
import { buildSnippets } from '../components/agent-detail/deployment/snippets.js';
import { apiBase } from '../components/agent-detail/deployment/use-deployment.js';
import { cn } from '@org/utils';
import {
  Code2,
  Globe,
  Play,
  Terminal,
  Zap,
  Rocket,
  ArrowRight,
  Bot,
  ExternalLink,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { agentApiKeysApi, publicAgentApi } from '@org/api-client';
import { useNavigate } from '../router.js';
import { useStudioSession } from '../session-guard.js';

export function DeveloperPage() {
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  const workspaceId = activeWorkspace?.id ?? '';

  const [selectedLang, setSelectedLang] = useState('curl');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [testPayload, setTestPayload] = useState(
    '{\n  "prompt": "Summarise the open support tickets"\n}',
  );
  const [testResponse, setTestResponse] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  // Only deployed agents: an API key can't run anything else.
  const agentsQuery = useQuery({
    queryKey: ['agent-api-keys', workspaceId, 'deployed-agents'],
    queryFn: () => agentApiKeysApi.deployedAgents(workspaceId),
    enabled: !!workspaceId,
  });

  const agents = agentsQuery.data ?? [];

  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  const selectedAgent =
    agents.find((a) => a.id === selectedAgentId) || agents[0];
  const currentAgentId = selectedAgent?.id || 'AGENT_ID';
  const restSnippets = buildSnippets({
    apiBase: apiBase(),
    agentId: currentAgentId,
    publicKey: '',
  });
  const snippets = {
    curl: restSnippets.curl,
    javascript: restSnippets.node,
    python: restSnippets.python,
  };

  const handleRunTest = async () => {
    setIsRunning(true);
    setTestResponse(null);
    const startTime = Date.now();
    try {
      const parsed = JSON.parse(testPayload);
      const prompt =
        parsed.prompt ||
        parsed.message ||
        (typeof parsed.input === 'string'
          ? parsed.input
          : JSON.stringify(parsed));

      const run = await publicAgentApi.executeHeadless(
        currentAgentId,
        {
          prompt,
          context: parsed.context || {},
        },
        apiKeyInput.trim(),
      );

      const latencyMs = Date.now() - startTime;
      setTestResponse({
        statusCode: 200,
        status: run.status,
        executionId: run.runId,
        latencyMs,
        data: {
          agentId: currentAgentId,
          agentName: selectedAgent?.name || currentAgentId,
          output: run.output,
          tools: run.toolExecutions,
        },
      });
      toast.success(`Agent executed (${run.status}) in ${latencyMs}ms`);
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      setTestResponse({
        statusCode: err?.status || 500,
        error: err?.message || 'Agent execution failed',
        latencyMs,
      });
      toast.error(err?.message || 'Execution error');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <StudioPage
      icon={<Code2 />}
      title="Developer Hub"
      description="Call published agents and workflows from your own apps, pipelines and services."
      actions={
        <div className="gap-2 flex items-center">
          <Badge variant="outline" className="text-xs font-mono">
            v1 REST & Universal SDK
          </Badge>
          {selectedAgent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/agents/${selectedAgent.id}?tab=deploy`)}
              className="text-xs gap-1.5 font-semibold"
            >
              <Rocket className="size-3.5 text-primary" />
              Go to Deployment Center
              <ArrowRight className="size-3" />
            </Button>
          )}
        </div>
      }
    >
      {/* Quick Specs Cards */}
      <div className="gap-4 sm:grid-cols-3 grid grid-cols-1">
        <Card className="p-4 shadow-2xs transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">REST API Endpoint</span>
            <Globe className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-xs font-bold font-mono text-foreground">
            {apiBase()}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            API key in x-api-key or a Bearer header
          </p>
        </Card>

        <Card className="p-4 shadow-2xs transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Workspace</span>
            <Terminal className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-xs font-bold truncate font-mono text-foreground">
            {workspaceId || 'Default Workspace'}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Workspace isolated sandbox
          </p>
        </Card>

        <Card className="p-4 shadow-2xs transition-colors hover:border-primary/40">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Rate Limits</span>
            <Zap className="size-4 text-success" />
          </div>
          <div className="mt-2 text-xs font-bold text-foreground">
            30 runs per minute
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Per caller, on the execute endpoint
          </p>
        </Card>
      </div>

      {/* Target Agent Selector */}
      <Card className="p-4 shadow-2xs sm:flex-row sm:items-center gap-4 flex flex-col justify-between">
        <div className="gap-3 flex items-center">
          <div className="size-9 flex shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Bot className="size-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-foreground">
              Target Agent
            </span>
            <p className="text-xs text-muted-foreground">
              {agentsQuery.isSuccess && agents.length === 0
                ? 'No agent is deployed yet. Deploy one from its Deployment tab to call it here.'
                : 'Only deployed agents can be called with an API key'}
            </p>
          </div>
        </div>

        <div className="gap-3 sm:w-auto flex w-full items-center">
          <AppSelect
            value={selectedAgentId}
            onValueChange={setSelectedAgentId}
            aria-label="Agent"
            className="min-w-[240px]"
            options={agents.map((agent) => ({
              value: agent.id,
              label: agent.name,
            }))}
          />

          {selectedAgent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/agents/${selectedAgent.id}?tab=deploy`)}
              className="text-xs gap-1 shrink-0 text-primary"
            >
              Open Deploy Center
              <ExternalLink className="size-3" />
            </Button>
          )}
        </div>
      </Card>

      {/* Interactive Sandbox & Code Snippets */}
      <div className="gap-6 lg:grid-cols-2 grid grid-cols-1">
        {/* Left: Code Snippets */}
        <div className="p-5 shadow-2xs space-y-4 rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              Execution Code Snippet
            </h3>
            <SegmentedControl
              aria-label="Language"
              size="sm"
              value={selectedLang}
              onChange={setSelectedLang}
              options={[
                { value: 'curl', label: 'cURL' },
                { value: 'javascript', label: 'JavaScript' },
                { value: 'python', label: 'Python' },
              ]}
            />
          </div>

          <CodeBlock
            code={snippets[selectedLang]}
            language={selectedLang === 'node' ? 'javascript' : selectedLang}
            showLineNumbers={false}
          />
        </div>

        {/* Right: Interactive Sandbox Runner */}
        <div className="p-5 shadow-2xs space-y-4 rounded-xl border border-border bg-surface">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Live Execution Sandbox
              </h3>
              <p className="text-xs text-muted-foreground">
                Execute real requests against the universal agent runtime
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleRunTest}
              loading={isRunning}
              disabled={!apiKeyInput.trim() || !selectedAgent}
              className="gap-1.5 text-xs font-semibold"
            >
              <Play className="size-3.5" />
              Send Request
            </Button>
          </div>

          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase">
              API Key
            </Label>
            <Input
              type="password"
              autoComplete="off"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="ot_live_…"
              className="mt-1 text-xs font-mono"
            />
            <Button
              type="button"
              variant="link"
              size="xs"
              className="mt-1 p-0 text-xs h-auto"
              onClick={() => navigate('/settings?tab=api-keys')}
            >
              Create or manage keys
            </Button>
          </div>

          <div>
            <Label className="text-xs font-semibold text-muted-foreground uppercase">
              Request Body (JSON)
            </Label>
            <Textarea
              rows={4}
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              className="mt-1 text-xs font-mono"
            />
          </div>

          {testResponse && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold flex items-center justify-between text-muted-foreground uppercase">
                <span>Response Body</span>
                <span
                  className={cn(
                    'font-bold',
                    testResponse.statusCode === 200
                      ? 'text-success'
                      : 'text-destructive',
                  )}
                >
                  HTTP {testResponse.statusCode}{' '}
                  {testResponse.latencyMs
                    ? `(${testResponse.latencyMs}ms)`
                    : ''}
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
    </StudioPage>
  );
}
