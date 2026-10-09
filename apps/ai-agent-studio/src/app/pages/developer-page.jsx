import React, { useState, useEffect } from 'react';
import { Badge, Button, Card, CodeBlock, Page, PageHeader, toast } from '@org/ui';
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
import { agentsApi, publicAgentApi, queryKeys } from '@org/api-client';
import { useNavigate } from 'react-router-dom';
import { useStudioSession } from '../session-guard.js';

export function DeveloperPage() {
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  const workspaceId = activeWorkspace?.id ?? '';

  const [selectedLang, setSelectedLang] = useState('curl');
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [testPayload, setTestPayload] = useState('{\n  "input": "Buy a 16-inch M3 Max MacBook Pro with 64GB RAM and 1TB SSD",\n  "stream": false\n}');
  const [testResponse, setTestResponse] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  // Load real workspace agents
  const agentsQuery = useQuery({
    queryKey: queryKeys.agents.list(workspaceId),
    queryFn: () => agentsApi.list(workspaceId),
    enabled: !!workspaceId,
  });

  const agents = agentsQuery.data ?? [];

  useEffect(() => {
    if (agents.length > 0 && !selectedAgentId) {
      setSelectedAgentId(agents[0].id);
    }
  }, [agents, selectedAgentId]);

  const selectedAgent = agents.find((a) => a.id === selectedAgentId) || agents[0];
  const currentAgentId = selectedAgent?.id || 'agent-universal-pro';
  const platformUrl = window.location.origin;

  const snippets = {
    curl: `curl -X POST "${platformUrl}/api/v1/agents/${currentAgentId}/execute" \\
  -H "Authorization: Bearer \${ONETAB_ACCESS_TOKEN}" \\
  -H "x-api-key: ${apiKeyInput || 'ot_live_secret_key'}" \\
  -H "Content-Type: application/json" \\
  -d '${testPayload.replace(/\n\s*/g, '')}'`,

    javascript: `import { publicAgentApi } from '@org/api-client';

// Execute the universal published agent
const execution = await publicAgentApi.executeHeadless('${currentAgentId}', {
  input: 'Buy a 16-inch M3 Max MacBook Pro with 64GB RAM and 1TB SSD',
  context: {
    workspaceId: '${workspaceId}',
  },
}, process.env.ONETAB_AGENT_KEY);

console.log('Status:', execution.status);
console.log('Result:', execution.result);
if (execution.status === 'WAITING_FOR_APPROVAL') {
  console.log('Action requires approval. Run ID:', execution.runId);
}`,

    python: `import requests
import os

url = "${platformUrl}/api/v1/agents/${currentAgentId}/execute"
headers = {
    "Content-Type": "application/json",
    "x-api-key": os.getenv("ONETAB_AGENT_KEY", "${apiKeyInput || 'ot_live_secret_key'}")
}
payload = {
    "input": "Buy a 16-inch M3 Max MacBook Pro with 64GB RAM and 1TB SSD",
    "context": {
        "workspaceId": "${workspaceId}"
    }
}

response = requests.post(url, json=payload, headers=headers)
data = response.json()
print("Run Status:", data.get("status"))
print("Result:", data.get("result"))`,
  };

  const handleRunTest = async () => {
    setIsRunning(true);
    setTestResponse(null);
    const startTime = Date.now();
    try {
      const parsed = JSON.parse(testPayload);
      const inputStr = typeof parsed.input === 'string' ? parsed.input : (parsed.query || JSON.stringify(parsed));

      const run = await publicAgentApi.executeHeadless(
        currentAgentId,
        {
          input: inputStr,
          context: parsed.context || {},
        },
        apiKeyInput || undefined,
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
          output: run.result,
          error: run.error,
          tools: run.tools || [],
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
    <Page width="wide" padding="none" className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Developer Hub & Universal API Sandbox"
        description="Integrate autonomous workflows and published agents into external applications, CI/CD pipelines, and microservices."
        icon={<Code2 className="size-5" />}
        accent="blue"
        actions={
          <div className="flex items-center gap-2">
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
      />

      {/* Quick Specs Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4 shadow-2xs hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">REST API Endpoint</span>
            <Globe className="size-4 text-primary" />
          </div>
          <div className="mt-2 font-mono text-xs font-bold text-foreground">
            {platformUrl}/api/v1
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">x-api-key or Bearer JWT authenticated</p>
        </Card>

        <Card className="p-4 shadow-2xs hover:border-primary/40 transition-colors">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Active Workspace</span>
            <Terminal className="size-4 text-primary" />
          </div>
          <div className="mt-2 font-mono text-xs font-bold text-foreground truncate">
            {workspaceId || 'Default Workspace'}
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Workspace isolated sandbox</p>
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

      {/* Target Agent Selector */}
      <Card className="p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Bot className="size-5" />
          </div>
          <div>
            <span className="text-xs font-bold text-foreground">Target Agent</span>
            <p className="text-[11px] text-muted-foreground">Select an agent from your workspace to test</p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedAgentId}
            onChange={(e) => setSelectedAgentId(e.target.value)}
            className="rounded-lg border border-border bg-card p-2 text-xs text-foreground font-semibold min-w-[240px] focus:outline-hidden focus:ring-1 focus:ring-primary"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.role || 'Agent'})
              </option>
            ))}
          </select>

          {selectedAgent && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(`/agents/${selectedAgent.id}?tab=deploy`)}
              className="text-xs gap-1 text-primary shrink-0"
            >
              Open Deploy Center
              <ExternalLink className="size-3" />
            </Button>
          )}
        </div>
      </Card>

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
                      ? 'bg-card text-foreground shadow-2xs font-bold'
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
              <h3 className="text-sm font-semibold text-foreground">Live Execution Sandbox</h3>
              <p className="text-xs text-muted-foreground">Execute real requests against the universal agent runtime</p>
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
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">Optional API Key</label>
            <input
              type="text"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Leave blank to use current browser session credentials"
              className="mt-1 w-full rounded-lg border border-border bg-surface p-2 text-xs font-mono text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-muted-foreground uppercase">Request Body (JSON)</label>
            <textarea
              rows={4}
              value={testPayload}
              onChange={(e) => setTestPayload(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-surface p-2.5 font-mono text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>

          {testResponse && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase">
                <span>Response Body</span>
                <span
                  className={cn(
                    'font-bold',
                    testResponse.statusCode === 200 ? 'text-success' : 'text-destructive',
                  )}
                >
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
