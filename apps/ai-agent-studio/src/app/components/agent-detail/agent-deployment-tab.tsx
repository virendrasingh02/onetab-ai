import React, { useState, useMemo, useEffect } from 'react';
import {
  Badge,
  Button,
  Card,
  CodeBlock,
  confirm,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  toast,
} from '@org/ui';
import {
  agentDeploymentsApi,
  publicAgentApi,
  queryKeys,
  http,
} from '@org/api-client';
import { cn } from '@org/utils';
import * as TypesModule from '@org/types';
import type {
  AgentDeploymentView,
  AgentDeploymentWebhookView,
  AgentApiKeyView,
  AgentDeploymentAnalyticsSummary,
  AgentWidgetConfig,
  AgentSecurityConfig,
} from '@org/types';

const DEFAULT_WIDGET_CONFIG: AgentWidgetConfig =
  (TypesModule as any).DEFAULT_WIDGET_CONFIG ||
  (TypesModule as any).DEFAULT_AGENT_WIDGET_CONFIG || {
    title: 'OneTab AI Assistant',
    subtitle: 'Universal AI Agent',
    primaryColor: '#2563eb',
    theme: 'system',
    position: 'bottom-right',
    welcomeMessage: 'Hello! How can I assist you today?',
    suggestedPrompts: [
      'Compare product specifications',
      'Check inventory and pricing',
      'Create an order request',
    ],
    showAvatar: true,
    showHeader: true,
    showFeedback: true,
    allowAttachments: true,
    enableSpeech: false,
  };

const DEFAULT_SECURITY_CONFIG: AgentSecurityConfig =
  (TypesModule as any).DEFAULT_SECURITY_CONFIG || {
    allowedOrigins: ['*'],
    rateLimitPerMinute: 60,
    rateLimitPerMin: 60,
    requireAuthentication: false,
    requireAuth: false,
    sensitiveActionsRequireApproval: true,
    allowedTools: [],
  };
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useStudioSession } from '../../session-guard.js';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  Brain,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  Flame,
  Globe,
  History,
  KeyRound,
  Layers,
  Laptop,
  Maximize2,
  MessageSquare,
  Minus,
  Palette,
  Play,
  Plug,
  Plus,
  RefreshCw,
  Rocket,
  RotateCcw,
  Send,
  Server,
  Settings,
  Shield,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tag,
  Terminal,
  Trash2,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import { AgentAvatar } from '../../data/agent-metadata.js';

interface AgentDeploymentTabProps {
  agent: {
    id: string;
    name: string;
    role?: string;
    description?: string;
    icon?: string;
    color?: string;
    model?: string;
    temperature?: number;
    systemInstructions?: string;
    systemPrompt?: string;
    welcomeMessage?: string;
    tools?: unknown[];
    configuration?: Record<string, unknown>;
  };
}

type SubTab = 'overview' | 'targets' | 'widget-studio' | 'webhooks' | 'api-keys' | 'versions';
type TargetId =
  | 'widget'
  | 'inline'
  | 'iframe'
  | 'web-component'
  | 'react'
  | 'rest'
  | 'headless'
  | 'webhooks'
  | 'desktop';

const PRESET_COLORS = [
  { name: 'Sky Blue', hex: '#2563eb' },
  { name: 'Violet', hex: '#7c3aed' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Rose', hex: '#e11d48' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Dark Slate', hex: '#0f172a' },
];

export function AgentDeploymentTab({ agent }: AgentDeploymentTabProps) {
  const { activeWorkspace } = useStudioSession();
  const queryClient = useQueryClient();
  const workspaceId = activeWorkspace?.id ?? '';

  const [activeSubTab, setActiveSubTab] = useState<SubTab>('overview');
  const [activeTarget, setActiveTarget] = useState<TargetId>('widget');
  const [codeLang, setCodeLang] = useState<'curl' | 'node' | 'python'>('curl');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Dialogs
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const [publishTag, setPublishTag] = useState('v1.0.0');
  const [publishEnv, setPublishEnv] = useState<'DEVELOPMENT' | 'STAGING' | 'PRODUCTION'>('PRODUCTION');
  const [publishSummary, setPublishSummary] = useState('Production deployment release');

  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false);
  const [selectedRollbackVersion, setSelectedRollbackVersion] = useState<string>('');

  const [createWebhookOpen, setCreateWebhookOpen] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<string[]>([
    'agent.run.completed',
    'agent.run.failed',
    'agent.approval.requested',
  ]);

  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [keyName, setKeyName] = useState('Production API Client');
  const [newlyCreatedKeySecret, setNewlyCreatedKeySecret] = useState<string | null>(null);

  // Widget Customizer state
  const [widgetPreviewDevice, setWidgetPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [localWidgetConfig, setLocalWidgetConfig] = useState<AgentWidgetConfig>(DEFAULT_WIDGET_CONFIG);
  const [localSecurityConfig, setLocalSecurityConfig] = useState<AgentSecurityConfig>(DEFAULT_SECURITY_CONFIG);
  const [promptInput, setPromptInput] = useState('');

  // Interactive Live Chat Test state
  const [chatMessages, setChatMessages] = useState<
    Array<{ id: string; role: 'user' | 'assistant'; text: string; tools?: unknown[]; approvalNeeded?: boolean }>
  >([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatSending, setIsChatSending] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // 1. Fetch Deployments
  const deploymentsQuery = useQuery({
    queryKey: queryKeys.agents.deployments(workspaceId, agent.id),
    queryFn: () => agentDeploymentsApi.list(workspaceId, agent.id),
    enabled: !!workspaceId && !!agent.id,
  });

  const activeDeployment: AgentDeploymentView | undefined = useMemo(() => {
    const list = deploymentsQuery.data ?? [];
    return list.find((d) => d.status === 'ACTIVE') ?? list[0];
  }, [deploymentsQuery.data]);

  // Sync widget config when deployment loads
  useEffect(() => {
    if (activeDeployment?.widgetConfig) {
      setLocalWidgetConfig({
        ...DEFAULT_WIDGET_CONFIG,
        ...activeDeployment.widgetConfig,
      });
    }
    if (activeDeployment?.securityConfig) {
      setLocalSecurityConfig({
        ...DEFAULT_SECURITY_CONFIG,
        ...activeDeployment.securityConfig,
      });
    }
  }, [activeDeployment]);

  // 2. Fetch Analytics
  const analyticsQuery = useQuery({
    queryKey: queryKeys.agents.deploymentAnalytics(workspaceId, agent.id, activeDeployment?.id ?? ''),
    queryFn: () => agentDeploymentsApi.getAnalytics(workspaceId, agent.id, activeDeployment!.id),
    enabled: !!workspaceId && !!agent.id && !!activeDeployment?.id,
  });

  // 3. Fetch Webhooks
  const webhooksQuery = useQuery({
    queryKey: queryKeys.agents.deploymentWebhooks(workspaceId, agent.id, activeDeployment?.id ?? ''),
    queryFn: () => agentDeploymentsApi.listWebhooks(workspaceId, agent.id, activeDeployment!.id),
    enabled: !!workspaceId && !!agent.id && !!activeDeployment?.id,
  });

  // 4. Fetch API Keys
  const apiKeysQuery = useQuery({
    queryKey: queryKeys.agents.apiKeys(workspaceId, agent.id),
    queryFn: () => agentDeploymentsApi.listApiKeys(workspaceId, agent.id),
    enabled: !!workspaceId && !!agent.id,
  });

  // Mutations
  const createDeploymentMutation = useMutation({
    mutationFn: () =>
      agentDeploymentsApi.create(workspaceId, agent.id, {
        name: `${agent.name} Production Deployment`,
        environment: 'PRODUCTION',
        target: 'CHAT_WIDGET',
        widgetConfig: DEFAULT_WIDGET_CONFIG,
        securityConfig: DEFAULT_SECURITY_CONFIG,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.deployments(workspaceId, agent.id) });
      toast.success('Agent deployment initialized successfully');
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to initialize deployment');
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data: { widgetConfig?: AgentWidgetConfig; securityConfig?: AgentSecurityConfig }) => {
      if (!activeDeployment) throw new Error('No deployment found');
      return agentDeploymentsApi.update(workspaceId, agent.id, activeDeployment.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.deployments(workspaceId, agent.id) });
      toast.success('Widget and security configuration saved');
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to save configuration');
    },
  });

  const publishMutation = useMutation({
    mutationFn: () => {
      if (!activeDeployment) throw new Error('No deployment found');
      return agentDeploymentsApi.publish(workspaceId, agent.id, activeDeployment.id, {
        versionTag: publishTag,
        environment: publishEnv,
        changeSummary: publishSummary,
      });
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.deployments(workspaceId, agent.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.versions(workspaceId, agent.id) });
      setPublishDialogOpen(false);
      toast.success(`Published ${updated.publishedVersionTag || publishTag} to ${updated.environment}!`);
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to publish agent version');
    },
  });

  const rollbackMutation = useMutation({
    mutationFn: (targetVersionTag: string) => {
      if (!activeDeployment) throw new Error('No deployment found');
      return agentDeploymentsApi.rollback(workspaceId, agent.id, activeDeployment.id, {
        targetVersionTag,
        reason: 'Restored from Deployment Center',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.deployments(workspaceId, agent.id) });
      setRollbackDialogOpen(false);
      toast.success(`Successfully rolled back to version ${selectedRollbackVersion}`);
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Rollback failed');
    },
  });

  const toggleSuspendMutation = useMutation({
    mutationFn: () => {
      if (!activeDeployment) throw new Error('No deployment found');
      if (activeDeployment.status === 'SUSPENDED') {
        return agentDeploymentsApi.resume(workspaceId, agent.id, activeDeployment.id);
      } else {
        return agentDeploymentsApi.suspend(workspaceId, agent.id, activeDeployment.id);
      }
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.deployments(workspaceId, agent.id) });
      toast.success(
        updated.status === 'SUSPENDED' ? 'Deployment suspended' : 'Deployment activated',
      );
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Status update failed');
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: () => {
      if (!activeDeployment) throw new Error('No deployment found');
      return agentDeploymentsApi.createWebhook(workspaceId, agent.id, activeDeployment.id, {
        url: webhookUrl,
        secret: webhookSecret || undefined,
        events: webhookEvents,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.agents.deploymentWebhooks(workspaceId, agent.id, activeDeployment?.id ?? ''),
      });
      setCreateWebhookOpen(false);
      setWebhookUrl('');
      setWebhookSecret('');
      toast.success('Webhook endpoint registered');
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to register webhook');
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: (webhookId: string) => {
      if (!activeDeployment) throw new Error('No deployment found');
      return agentDeploymentsApi.deleteWebhook(workspaceId, agent.id, activeDeployment.id, webhookId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.agents.deploymentWebhooks(workspaceId, agent.id, activeDeployment?.id ?? ''),
      });
      toast.success('Webhook removed');
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to delete webhook');
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: (webhookId: string) => {
      if (!activeDeployment) throw new Error('No deployment found');
      return agentDeploymentsApi.testWebhook(workspaceId, agent.id, activeDeployment.id, webhookId, {
        event: 'agent.run.completed',
        mockPayload: {
          agentId: agent.id,
          agentName: agent.name,
          status: 'COMPLETED',
          result: 'Test execution webhook verification dispatch',
        },
      });
    },
    onSuccess: (delivery) => {
      if (delivery.success) {
        toast.success(`Webhook delivered successfully (HTTP ${delivery.statusCode})`);
      } else {
        toast.error(`Webhook delivery responded with HTTP ${delivery.statusCode || 'Error'}`);
      }
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Test webhook dispatch failed');
    },
  });

  const createApiKeyMutation = useMutation({
    mutationFn: () =>
      agentDeploymentsApi.createApiKey(workspaceId, agent.id, {
        name: keyName,
        scopes: ['execute', 'read'],
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.apiKeys(workspaceId, agent.id) });
      setNewlyCreatedKeySecret(res.fullKey);
      toast.success('API Key generated successfully');
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to generate API Key');
    },
  });

  const revokeApiKeyMutation = useMutation({
    mutationFn: (keyId: string) => agentDeploymentsApi.revokeApiKey(workspaceId, agent.id, keyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.apiKeys(workspaceId, agent.id) });
      toast.success('API key revoked');
    },
    onError: (err: unknown) => {
      toast.error((err as Error)?.message || 'Failed to revoke API key');
    },
  });

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
    toast.success('Copied to clipboard');
  };

  // Base platform URL
  const platformUrl = window.location.origin;
  const publicKey = activeDeployment?.publicKey || 'ot_pub_placeholder';
  const publishedVersion = activeDeployment?.publishedVersionTag || 'Draft (Unpublished)';
  const environment = activeDeployment?.environment || 'PRODUCTION';

  // Live Chat Preview Handlers
  const handleSendLiveChatMessage = async (overrideText?: string) => {
    const textToSend = overrideText || chatInput;
    if (!textToSend.trim() || isChatSending) return;

    const userMsg = { id: `user-${Date.now()}`, role: 'user' as const, text: textToSend };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsChatSending(true);

    try {
      let sessId = activeSessionId;
      if (!sessId && activeDeployment) {
        const initRes = await publicAgentApi.initSession({
          agentId: agent.id,
          publicKey: activeDeployment.publicKey,
          metadata: { preview: true },
        });
        sessId = initRes.session.id;
        setActiveSessionId(sessId);
      }

      let resData;
      if (sessId) {
        const sendRes = await publicAgentApi.sendMessage(sessId, {
          message: textToSend,
        });
        resData = sendRes.run;
      } else {
        // Fallback to headless execute
        resData = await publicAgentApi.executeHeadless(agent.id, {
          input: textToSend,
        });
      }

      setChatMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          text: resData.result || 'Task completed successfully.',
          tools: resData.tools,
          approvalNeeded: resData.status === 'WAITING_FOR_APPROVAL',
        },
      ]);
    } catch (err: unknown) {
      setChatMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          text: `Error: ${(err as Error)?.message || 'Execution error encountered'}`,
        },
      ]);
    } finally {
      setIsChatSending(false);
    }
  };

  if (deploymentsQuery.isLoading) {
    return <LoadingState label="Loading deployment configuration…" />;
  }

  if (deploymentsQuery.isError) {
    return (
      <ErrorState
        title="Could not load deployments"
        description={(deploymentsQuery.error as Error)?.message || ''}
        onRetry={() => deploymentsQuery.refetch()}
      />
    );
  }

  // If no deployment exists yet
  if (!activeDeployment) {
    return (
      <div className="flex-1 p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[460px] text-center">
        <div className="size-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <Rocket className="size-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Deploy {agent.name}</h2>
        <p className="text-sm text-muted-foreground max-w-md mt-2 mb-6">
          Publish once, deploy anywhere. Provision a production deployment to enable floating widgets,
          inline website embeds, Web Components, React hooks, REST APIs, and outbound webhooks.
        </p>
        <Button
          onClick={() => createDeploymentMutation.mutate()}
          loading={createDeploymentMutation.isPending}
          className="gap-2 font-semibold"
        >
          <Sparkles className="size-4" />
          Initialize Universal Deployment
        </Button>
      </div>
    );
  }

  const analytics: AgentDeploymentAnalyticsSummary = analyticsQuery.data ?? {
    totalRuns: 0,
    successfulRuns: 0,
    failedRuns: 0,
    waitingApprovalRuns: 0,
    averageLatencyMs: 0,
    totalTokens: 0,
    activeSessions: 0,
    webhookDeliveries: 0,
  };

  // Generated code snippets for the targets
  const widgetScriptTag = `<script\n  src="${platformUrl}/api/v1/deployments/sdk/agent-widget.js"\n  data-agent-id="${agent.id}"\n  data-public-key="${publicKey}"\n  async\n></script>`;

  const inlineEmbedSnippet = `<!-- Place this anywhere in your HTML body -->\n<div\n  id="onetab-agent-container"\n  data-agent-id="${agent.id}"\n  data-public-key="${publicKey}"\n  data-mode="inline"\n  style="width: 100%; height: 600px; border-radius: 12px; overflow: hidden;"\n></div>\n<script\n  src="${platformUrl}/api/v1/deployments/sdk/agent-widget.js"\n  async\n></script>`;

  const iframeSnippet = `<iframe\n  src="${platformUrl}/api/v1/deployments/sdk/agent-embed.html?agentId=${agent.id}&publicKey=${publicKey}"\n  width="100%"\n  height="650"\n  frameborder="0"\n  style="border: 1px solid #e2e8f0; border-radius: 12px; box-shadow: 0 4px 16px rgba(0,0,0,0.06);"\n  allow="clipboard-write"\n></iframe>`;

  const webComponentSnippet = `<!-- Import SDK module -->\n<script type="module" src="${platformUrl}/api/v1/deployments/sdk/agent-widget.js"></script>\n\n<!-- Use standard Web Component -->\n<onetab-agent\n  agent-id="${agent.id}"\n  public-key="${publicKey}"\n  theme="${localWidgetConfig.theme}"\n  position="${localWidgetConfig.position}"\n></onetab-agent>`;

  const reactSnippet = `import React from 'react';\nimport { useEffect } from 'react';\n\nexport function AgentSupportWidget() {\n  useEffect(() => {\n    const script = document.createElement('script');\n    script.src = '${platformUrl}/api/v1/deployments/sdk/agent-widget.js';\n    script.setAttribute('data-agent-id', '${agent.id}');\n    script.setAttribute('data-public-key', '${publicKey}');\n    script.async = true;\n    document.body.appendChild(script);\n\n    return () => {\n      document.body.removeChild(script);\n    };\n  }, []);\n\n  return null; // Widget renders as an isolated floating launcher via Shadow DOM\n}`;

  const restCurlSnippet = `curl -X POST "${platformUrl}/api/v1/agents/${agent.id}/execute" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: YOUR_AGENT_API_KEY" \\
  -d '{
    "input": "Buy a 16-inch M3 Max MacBook Pro with 64GB RAM and 1TB SSD",
    "context": {
      "channel": "enterprise-procurement",
      "requester": "sarah.connor@example.com"
    }
  }'`;

  const restNodeSnippet = `// Node.js (fetch)
const response = await fetch('${platformUrl}/api/v1/agents/${agent.id}/execute', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ONETAB_AGENT_KEY,
  },
  body: JSON.stringify({
    input: 'Buy a 16-inch M3 Max MacBook Pro with 64GB RAM and 1TB SSD',
    context: {
      budgetMax: 4000,
      currency: 'USD',
    },
  }),
});

const result = await response.json();
console.log('Agent status:', result.status);
console.log('Output:', result.result);
if (result.status === 'WAITING_FOR_APPROVAL') {
  console.log('Action requires manager approval. Run ID:', result.runId);
}`;

  const restPythonSnippet = `# Python (requests)
import requests
import os

url = "${platformUrl}/api/v1/agents/${agent.id}/execute"
headers = {
    "Content-Type": "application/json",
    "x-api-key": os.getenv("ONETAB_AGENT_KEY")
}
payload = {
    "input": "Buy a 16-inch M3 Max MacBook Pro with 64GB RAM and 1TB SSD",
    "context": {
        "budgetMax": 4000,
        "currency": "USD"
    }
}

res = requests.post(url, json=payload, headers=headers)
data = res.json()
print("Status:", data.get("status"))
print("Result:", data.get("result"))`;

  const headlessSnippet = `// Server-to-server headless worker invocation
// No chat UI or browser is required.
import { publicAgentApi } from '@org/api-client';

async function processOrderJob(order) {
  const run = await publicAgentApi.executeHeadless('${agent.id}', {
    input: \`Evaluate procurement eligibility for order \${order.id}\`,
    context: {
      orderId: order.id,
      amount: order.total,
    },
  }, process.env.ONETAB_API_KEY);

  if (run.status === 'COMPLETED') {
    return { approved: true, response: run.result };
  } else if (run.status === 'WAITING_FOR_APPROVAL') {
    return { approved: false, runId: run.runId, approvalPending: true };
  }
}`;

  const desktopSnippet = `// Electron Desktop Bridge Integration
// Invoke the published agent from any desktop window or background process:
const response = await window.onetabDesktop.agent.execute({
  agentId: '${agent.id}',
  input: 'Check inventory for Apple M3 Pro 36GB memory stock',
  apiKey: 'YOUR_API_KEY', // optional if signed into desktop app
});

console.log('Desktop agent result:', response.result);`;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background overflow-y-auto">
      {/* Top Banner / Deployment Status Bar */}
      <div className="border-b border-border bg-card/60 backdrop-blur-xs px-6 py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <AgentAvatar
              icon={agent.icon}
              color={agent.color || 'blue'}
              name={agent.name}
              className="size-11 rounded-xl shadow-xs"
            />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-foreground">{agent.name}</h1>
                <Badge
                  variant={
                    activeDeployment.status === 'ACTIVE'
                      ? 'success'
                      : activeDeployment.status === 'SUSPENDED'
                        ? 'destructive'
                        : 'outline'
                  }
                  className="text-[10px] uppercase font-mono tracking-wider font-semibold"
                >
                  {activeDeployment.status}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono text-primary bg-primary/5">
                  {environment}
                </Badge>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {publishedVersion}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                {agent.description || agent.role || 'Autonomous production-ready agent'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => toggleSuspendMutation.mutate()}
              loading={toggleSuspendMutation.isPending}
              className="text-xs gap-1.5"
            >
              {activeDeployment.status === 'SUSPENDED' ? (
                <>
                  <CheckCircle2 className="size-3.5 text-success" />
                  Activate Deployment
                </>
              ) : (
                <>
                  <Minus className="size-3.5 text-amber-500" />
                  Suspend
                </>
              )}
            </Button>

            <Button
              size="sm"
              onClick={() => {
                setPublishTag(`v1.${(activeDeployment.publishedVersion ? parseInt(activeDeployment.publishedVersion) : 0) + 1}.0`);
                setPublishDialogOpen(true);
              }}
              className="text-xs gap-1.5 font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Rocket className="size-3.5" />
              Publish Version
            </Button>
          </div>
        </div>

        {/* Sub-Navigation Tabs */}
        <div className="flex items-center gap-1 border-t border-border/60 mt-4 pt-2 -mb-2 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview & Health', icon: Activity },
            { id: 'targets', label: 'Deployment Targets', icon: Globe },
            { id: 'widget-studio', label: 'Widget Studio & Preview', icon: Palette },
            { id: 'webhooks', label: 'Webhooks & Events', icon: Zap },
            { id: 'api-keys', label: 'API Keys & Access', icon: KeyRound },
            { id: 'versions', label: 'Version Snapshots', icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as SubTab)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                <Icon className="size-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* SUBTAB 1: OVERVIEW */}
        {activeSubTab === 'overview' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="p-3.5 shadow-2xs">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <Play className="size-3 text-primary" /> Total Runs
                </span>
                <div className="text-xl font-bold font-mono text-foreground mt-1.5">
                  {analytics.totalRuns.toLocaleString()}
                </div>
              </Card>

              <Card className="p-3.5 shadow-2xs">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3 text-success" /> Success Rate
                </span>
                <div className="text-xl font-bold font-mono text-success mt-1.5">
                  {analytics.totalRuns > 0
                    ? `${Math.round((analytics.successfulRuns / analytics.totalRuns) * 100)}%`
                    : '100%'}
                </div>
              </Card>

              <Card className="p-3.5 shadow-2xs">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <Shield className="size-3 text-amber-500" /> Pending Approvals
                </span>
                <div className="text-xl font-bold font-mono text-amber-500 mt-1.5">
                  {analytics.waitingApprovalRuns}
                </div>
              </Card>

              <Card className="p-3.5 shadow-2xs">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <Zap className="size-3 text-primary" /> Avg Latency
                </span>
                <div className="text-xl font-bold font-mono text-foreground mt-1.5">
                  {analytics.averageLatencyMs}ms
                </div>
              </Card>

              <Card className="p-3.5 shadow-2xs">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <Flame className="size-3 text-indigo-500" /> Tokens Used
                </span>
                <div className="text-xl font-bold font-mono text-foreground mt-1.5">
                  {analytics.totalTokens.toLocaleString()}
                </div>
              </Card>

              <Card className="p-3.5 shadow-2xs">
                <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
                  <Server className="size-3 text-emerald-500" /> Webhook Events
                </span>
                <div className="text-xl font-bold font-mono text-foreground mt-1.5">
                  {analytics.webhookDeliveries}
                </div>
              </Card>
            </div>

            {/* Published Snapshot & Engine Integrity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <Card className="p-5 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        <ShieldCheck className="size-4 text-primary" />
                        Current Published Configuration Snapshot
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Immutable contract deployed across all channels and external integrations.
                      </p>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {activeDeployment.publishedVersionTag || 'Snapshot Active'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <div className="text-muted-foreground text-[10px] font-semibold uppercase">AI Model</div>
                      <div className="font-mono font-bold text-foreground mt-0.5">
                        {agent.model || 'gpt-4o'}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <div className="text-muted-foreground text-[10px] font-semibold uppercase">Temperature</div>
                      <div className="font-mono font-bold text-foreground mt-0.5">
                        {agent.temperature ?? 0.4}
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <div className="text-muted-foreground text-[10px] font-semibold uppercase">Connected Tools</div>
                      <div className="font-mono font-bold text-foreground mt-0.5">
                        {Array.isArray(agent.tools) ? agent.tools.length : 0} Tools Enabled
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <div className="text-muted-foreground text-[10px] font-semibold uppercase">Human Approvals</div>
                      <div className="font-mono font-bold text-foreground mt-0.5">
                        Required for high-impact actions
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <div className="text-muted-foreground text-[10px] font-semibold uppercase">Streaming</div>
                      <div className="font-mono font-bold text-success mt-0.5">SSE Enabled</div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <div className="text-muted-foreground text-[10px] font-semibold uppercase">Rate Limit</div>
                      <div className="font-mono font-bold text-foreground mt-0.5">
                        {localSecurityConfig.rateLimitPerMin} req/min
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs font-semibold text-muted-foreground mb-1">
                      System Instructions Preview
                    </div>
                    <div className="p-3 rounded-lg bg-muted/30 border border-border/60 text-xs font-mono text-foreground line-clamp-3">
                      {agent.systemInstructions ||
                        agent.systemPrompt ||
                        'You are a specialized autonomous AI agent. Follow workflow rules and verify tool calls.'}
                    </div>
                  </div>
                </Card>

                {/* Quick Deploy Highlights */}
                <Card className="p-5 shadow-2xs space-y-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Globe className="size-4 text-primary" /> Universal Deployment Readiness
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    This agent is compiled into a universal bundle and is immediately ready across all 9
                    deployment surfaces with zero reconfiguration.
                  </p>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                    {[
                      { name: 'Website Widget', status: 'Ready' },
                      { name: 'Web Component', status: 'Ready' },
                      { name: 'REST API', status: 'Ready' },
                      { name: 'Desktop App', status: 'Ready' },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 rounded-lg border border-border bg-card flex items-center justify-between"
                      >
                        <span className="text-xs font-medium text-foreground">{item.name}</span>
                        <Badge variant="success" className="text-[9px] px-1.5 py-0">
                          {item.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              {/* Quick Actions & Security Status */}
              <div className="space-y-4">
                <Card className="p-5 shadow-2xs space-y-4">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Zap className="size-4 text-amber-500" /> Quick Actions
                  </h3>

                  <div className="flex flex-col gap-2">
                    <Button
                      variant="outline"
                      className="justify-start gap-2 text-xs h-9"
                      onClick={() => setActiveSubTab('targets')}
                    >
                      <Globe className="size-3.5 text-primary" />
                      Get Installation Snippet
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start gap-2 text-xs h-9"
                      onClick={() => setActiveSubTab('widget-studio')}
                    >
                      <Palette className="size-3.5 text-purple-500" />
                      Customize Widget Theme
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start gap-2 text-xs h-9"
                      onClick={() => {
                        setKeyName(`${agent.name} API Key`);
                        setCreateKeyOpen(true);
                      }}
                    >
                      <KeyRound className="size-3.5 text-amber-500" />
                      Generate New API Key
                    </Button>
                    <Button
                      variant="outline"
                      className="justify-start gap-2 text-xs h-9"
                      onClick={() => setActiveSubTab('webhooks')}
                    >
                      <Server className="size-3.5 text-emerald-500" />
                      Configure Outbound Webhooks
                    </Button>
                  </div>
                </Card>

                <Card className="p-5 shadow-2xs space-y-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Shield className="size-4 text-success" /> Security & Origin Policy
                  </h3>
                  <div className="text-xs space-y-2 text-muted-foreground">
                    <div className="flex justify-between items-center py-1 border-b border-border/50">
                      <span>CORS Isolation</span>
                      <Badge variant="outline" className="text-[10px] text-success">
                        Restricted Origins
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center py-1 border-b border-border/50">
                      <span>Public Key</span>
                      <span className="font-mono text-[11px] text-foreground font-semibold">
                        {publicKey.slice(0, 14)}…
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span>Approval Guard</span>
                      <span className="text-foreground font-semibold">Active</span>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 2: DEPLOYMENT TARGETS */}
        {activeSubTab === 'targets' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Sidebar list of targets */}
            <div className="space-y-1">
              {[
                { id: 'widget', label: 'Floating Chat Widget', icon: MessageSquare, badge: 'Popular' },
                { id: 'inline', label: 'Inline Page Widget', icon: Layers },
                { id: 'iframe', label: 'Iframe Embed', icon: Maximize2 },
                { id: 'web-component', label: 'Web Component', icon: Code2, badge: 'Standard' },
                { id: 'react', label: 'React Integration', icon: Sparkles },
                { id: 'rest', label: 'REST API & SDK', icon: Terminal, badge: 'API' },
                { id: 'headless', label: 'Headless Execution', icon: Server },
                { id: 'webhooks', label: 'Webhooks & Events', icon: Zap },
                { id: 'desktop', label: 'Desktop & Platform', icon: Laptop },
              ].map((item) => {
                const Icon = item.icon;
                const isSelected = activeTarget === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTarget(item.id as TargetId)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all text-left',
                      isSelected
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'hover:bg-muted text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <Icon className="size-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </div>
                    {item.badge && (
                      <Badge
                        variant={isSelected ? 'outline' : 'secondary'}
                        className={cn(
                          'text-[9px] px-1.5 py-0 uppercase',
                          isSelected && 'border-primary-foreground/30 text-primary-foreground',
                        )}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Target Details & Generated Snippets */}
            <div className="md:col-span-3 space-y-4">
              {activeTarget === 'widget' && (
                <Card className="p-6 shadow-2xs space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Website Floating Chat Widget</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Add a customizable, floating AI assistant button to any website. Zero build tools or
                      dependencies required. Isolated with Shadow DOM to prevent CSS leaks.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">HTML Embed Snippet</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(widgetScriptTag, 'widget-tag')}
                        className="text-xs gap-1.5 h-7"
                      >
                        {copiedKey === 'widget-tag' ? (
                          <Check className="size-3 text-success" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        Copy Code
                      </Button>
                    </div>
                    <CodeBlock code={widgetScriptTag} language="html" showLineNumbers={false} />
                  </div>

                  <div className="rounded-xl border border-border/80 bg-muted/20 p-4 space-y-2 text-xs">
                    <h4 className="font-bold text-foreground flex items-center gap-1.5">
                      <CheckCircle2 className="size-4 text-success" /> Installation Instructions
                    </h4>
                    <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                      <li>Copy the script tag above.</li>
                      <li>Paste it right before the closing <code className="text-foreground">&lt;/body&gt;</code> tag of your website.</li>
                      <li>The widget will automatically initialize, securely authenticate with your public key, and display your configured branding.</li>
                    </ol>
                  </div>
                </Card>
              )}

              {activeTarget === 'inline' && (
                <Card className="p-6 shadow-2xs space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Inline Website Widget</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Render the AI assistant directly inside a dedicated container on your web page (e.g. inside a support portal, dashboard panel, or help page).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">Inline Embed Snippet</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(inlineEmbedSnippet, 'inline-tag')}
                        className="text-xs gap-1.5 h-7"
                      >
                        {copiedKey === 'inline-tag' ? (
                          <Check className="size-3 text-success" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        Copy Code
                      </Button>
                    </div>
                    <CodeBlock code={inlineEmbedSnippet} language="html" showLineNumbers={false} />
                  </div>
                </Card>
              )}

              {activeTarget === 'iframe' && (
                <Card className="p-6 shadow-2xs space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Iframe Embed</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ideal for strict CMS environments (WordPress, Notion, Wix, Squarespace) or internal portals that prohibit custom script tags.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">Iframe HTML Tag</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(iframeSnippet, 'iframe-tag')}
                        className="text-xs gap-1.5 h-7"
                      >
                        {copiedKey === 'iframe-tag' ? (
                          <Check className="size-3 text-success" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        Copy Code
                      </Button>
                    </div>
                    <CodeBlock code={iframeSnippet} language="html" showLineNumbers={false} />
                  </div>
                </Card>
              )}

              {activeTarget === 'web-component' && (
                <Card className="p-6 shadow-2xs space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Standard Web Component (&lt;onetab-agent&gt;)</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Seamlessly integrates into modern frameworks like Vue, Angular, Svelte, or vanilla HTML via W3C Custom Elements.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">Web Component Code</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(webComponentSnippet, 'wc-tag')}
                        className="text-xs gap-1.5 h-7"
                      >
                        {copiedKey === 'wc-tag' ? (
                          <Check className="size-3 text-success" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        Copy Code
                      </Button>
                    </div>
                    <CodeBlock code={webComponentSnippet} language="html" showLineNumbers={false} />
                  </div>
                </Card>
              )}

              {activeTarget === 'react' && (
                <Card className="p-6 shadow-2xs space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">React Integration</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Drop-in React component example managing lifecycle, dynamic attributes, and cleanup.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">React Component (JSX/TSX)</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(reactSnippet, 'react-tag')}
                        className="text-xs gap-1.5 h-7"
                      >
                        {copiedKey === 'react-tag' ? (
                          <Check className="size-3 text-success" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        Copy Code
                      </Button>
                    </div>
                    <CodeBlock code={reactSnippet} language="javascript" showLineNumbers={false} />
                  </div>
                </Card>
              )}

              {activeTarget === 'rest' && (
                <Card className="p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-bold text-foreground">REST API Execution</h3>
                      <p className="text-xs text-muted-foreground mt-1">
                        Trigger published agents synchronously or with streaming responses from any backend language.
                      </p>
                    </div>

                    <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
                      {(['curl', 'node', 'python'] as const).map((lang) => (
                        <button
                          key={lang}
                          onClick={() => setCodeLang(lang)}
                          className={cn(
                            'px-2.5 py-1 rounded font-medium transition-colors uppercase text-[11px]',
                            codeLang === lang
                              ? 'bg-card text-foreground shadow-2xs font-bold'
                              : 'text-muted-foreground hover:text-foreground',
                          )}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-xs text-muted-foreground">
                        POST /api/v1/agents/{agent.id}/execute
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          const code =
                            codeLang === 'curl'
                              ? restCurlSnippet
                              : codeLang === 'node'
                                ? restNodeSnippet
                                : restPythonSnippet;
                          copyToClipboard(code, 'rest-tag');
                        }}
                        className="text-xs gap-1.5 h-7"
                      >
                        {copiedKey === 'rest-tag' ? (
                          <Check className="size-3 text-success" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        Copy Code
                      </Button>
                    </div>
                    <CodeBlock
                      code={
                        codeLang === 'curl'
                          ? restCurlSnippet
                          : codeLang === 'node'
                            ? restNodeSnippet
                            : restPythonSnippet
                      }
                      language={codeLang === 'curl' ? 'bash' : codeLang === 'node' ? 'javascript' : 'python'}
                      showLineNumbers={false}
                    />
                  </div>
                </Card>
              )}

              {activeTarget === 'headless' && (
                <Card className="p-6 shadow-2xs space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Headless Agent Orchestration</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Execute tasks in batch workers, queues, cron jobs, or serverless functions without any chat UI.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">Backend Worker Snippet</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(headlessSnippet, 'headless-tag')}
                        className="text-xs gap-1.5 h-7"
                      >
                        {copiedKey === 'headless-tag' ? (
                          <Check className="size-3 text-success" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        Copy Code
                      </Button>
                    </div>
                    <CodeBlock code={headlessSnippet} language="javascript" showLineNumbers={false} />
                  </div>
                </Card>
              )}

              {activeTarget === 'webhooks' && (
                <Card className="p-6 shadow-2xs space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Webhooks & Event Dispatches</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Receive signed HTTP POST webhooks whenever the agent starts, completes, pauses for approval,
                      or fails. Every request is cryptographically signed with HMAC-SHA256 headers.
                    </p>
                  </div>

                  <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 text-xs">
                    <div className="font-semibold text-foreground">Signature Verification Headers</div>
                    <div className="font-mono text-muted-foreground space-y-1">
                      <div>x-onetab-signature: sha256=abcdef...</div>
                      <div>x-onetab-timestamp: 1775820000000</div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setActiveSubTab('webhooks')}
                      className="mt-2 text-xs gap-1.5"
                    >
                      Manage Registered Webhooks
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </div>
                </Card>
              )}

              {activeTarget === 'desktop' && (
                <Card className="p-6 shadow-2xs space-y-4">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Electron Desktop Integration</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      Call the published agent natively inside the Electron desktop application using the secured
                      IPC bridge (<code className="text-foreground">window.onetabDesktop.agent.execute</code>).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">Desktop IPC Renderer Snippet</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(desktopSnippet, 'desktop-tag')}
                        className="text-xs gap-1.5 h-7"
                      >
                        {copiedKey === 'desktop-tag' ? (
                          <Check className="size-3 text-success" />
                        ) : (
                          <Copy className="size-3" />
                        )}
                        Copy Code
                      </Button>
                    </div>
                    <CodeBlock code={desktopSnippet} language="javascript" showLineNumbers={false} />
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* SUBTAB 3: WIDGET STUDIO & LIVE PREVIEW */}
        {activeSubTab === 'widget-studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Visual Customizer Controls */}
            <div className="lg:col-span-5 space-y-5">
              <Card className="p-5 shadow-2xs space-y-5">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Palette className="size-4 text-primary" /> Widget Appearance & Behavior
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Customize branding, greeting, suggestions, and position.
                    </p>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => updateConfigMutation.mutate({ widgetConfig: localWidgetConfig })}
                    loading={updateConfigMutation.isPending}
                    className="text-xs font-semibold"
                  >
                    Save Changes
                  </Button>
                </div>

                {/* Primary Brand Color */}
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-2">
                    Primary Brand Color
                  </label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => setLocalWidgetConfig((prev) => ({ ...prev, primaryColor: c.hex }))}
                        className={cn(
                          'size-7 rounded-full border-2 transition-transform',
                          localWidgetConfig.primaryColor === c.hex
                            ? 'scale-110 border-foreground shadow-xs'
                            : 'border-transparent hover:scale-105',
                        )}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      />
                    ))}
                    <div className="flex items-center gap-1.5 ml-2">
                      <Input
                        value={localWidgetConfig.primaryColor}
                        onChange={(e) =>
                          setLocalWidgetConfig((prev) => ({ ...prev, primaryColor: e.target.value }))
                        }
                        className="h-7 w-24 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Theme & Position */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="font-semibold text-foreground block mb-1.5">Theme</label>
                    <select
                      value={localWidgetConfig.theme}
                      onChange={(e) =>
                        setLocalWidgetConfig((prev) => ({
                          ...prev,
                          theme: e.target.value as 'system' | 'light' | 'dark',
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-card p-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="system">System (Auto)</option>
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-semibold text-foreground block mb-1.5">Position</label>
                    <select
                      value={localWidgetConfig.position}
                      onChange={(e) =>
                        setLocalWidgetConfig((prev) => ({
                          ...prev,
                          position: e.target.value as 'bottom-right' | 'bottom-left',
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-card p-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                    >
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                    </select>
                  </div>
                </div>

                {/* Title & Subtitle */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Widget Title</label>
                    <Input
                      value={localWidgetConfig.title}
                      onChange={(e) =>
                        setLocalWidgetConfig((prev) => ({ ...prev, title: e.target.value }))
                      }
                      placeholder={agent.name}
                      className="h-8 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">Subtitle</label>
                    <Input
                      value={localWidgetConfig.subtitle}
                      onChange={(e) =>
                        setLocalWidgetConfig((prev) => ({ ...prev, subtitle: e.target.value }))
                      }
                      placeholder="Powered by OneTab AI"
                      className="h-8 text-xs"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-foreground block mb-1">
                      Welcome Greeting Message
                    </label>
                    <textarea
                      rows={2}
                      value={localWidgetConfig.welcomeMessage}
                      onChange={(e) =>
                        setLocalWidgetConfig((prev) => ({ ...prev, welcomeMessage: e.target.value }))
                      }
                      className="w-full rounded-lg border border-border bg-card p-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
                      placeholder="Hi there! How can I help you today?"
                    />
                  </div>
                </div>

                {/* Suggested Starter Prompts */}
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    Starter Prompt Chips
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {localWidgetConfig.suggestedPrompts.map((prompt, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-muted text-foreground border border-border/60"
                      >
                        {prompt}
                        <button
                          type="button"
                          onClick={() =>
                            setLocalWidgetConfig((prev) => ({
                              ...prev,
                              suggestedPrompts: prev.suggestedPrompts.filter((_, i) => i !== index),
                            }))
                          }
                          className="hover:text-destructive"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={promptInput}
                      onChange={(e) => setPromptInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && promptInput.trim()) {
                          e.preventDefault();
                          setLocalWidgetConfig((prev) => ({
                            ...prev,
                            suggestedPrompts: [...prev.suggestedPrompts, promptInput.trim()],
                          }));
                          setPromptInput('');
                        }
                      }}
                      placeholder="Add suggested prompt (e.g. Compare pricing)..."
                      className="h-8 text-xs flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => {
                        if (promptInput.trim()) {
                          setLocalWidgetConfig((prev) => ({
                            ...prev,
                            suggestedPrompts: [...prev.suggestedPrompts, promptInput.trim()],
                          }));
                          setPromptInput('');
                        }
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                {/* Feature Toggles */}
                <div className="space-y-2 border-t border-border pt-4">
                  <div className="text-xs font-semibold text-foreground mb-2">Features & Capabilities</div>
                  {[
                    { key: 'showAvatar', label: 'Display Agent Avatar' },
                    { key: 'showHeader', label: 'Display Header Bar' },
                    { key: 'showFeedback', label: 'Enable User Feedback Thumbs' },
                    { key: 'allowAttachments', label: 'Allow File Attachments' },
                    { key: 'enableSpeech', label: 'Voice Input / Dictation' },
                  ].map((feat) => (
                    <label
                      key={feat.key}
                      className="flex items-center justify-between py-1 text-xs text-foreground cursor-pointer"
                    >
                      <span>{feat.label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(localWidgetConfig[feat.key as keyof AgentWidgetConfig])}
                        onChange={(e) =>
                          setLocalWidgetConfig((prev) => ({
                            ...prev,
                            [feat.key]: e.target.checked,
                          }))
                        }
                        className="rounded border-border text-primary focus:ring-primary"
                      />
                    </label>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right Column: Live Interactive Sandbox Preview */}
            <div className="lg:col-span-7 flex flex-col items-center">
              {/* Preview Viewport Switcher */}
              <div className="flex items-center gap-2 mb-3 bg-muted/50 p-1 rounded-xl border border-border">
                <button
                  onClick={() => setWidgetPreviewDevice('desktop')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    widgetPreviewDevice === 'desktop'
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Laptop className="size-3.5" /> Desktop View
                </button>
                <button
                  onClick={() => setWidgetPreviewDevice('mobile')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    widgetPreviewDevice === 'mobile'
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Smartphone className="size-3.5" /> Mobile View
                </button>
              </div>

              {/* Mock Device Container */}
              <div
                className={cn(
                  'rounded-2xl border-2 border-border bg-card shadow-xl overflow-hidden flex flex-col transition-all duration-300',
                  widgetPreviewDevice === 'desktop' ? 'w-[420px] h-[640px]' : 'w-[360px] h-[640px]',
                )}
                style={{
                  fontFamily: localWidgetConfig.fontFamily || 'inherit',
                }}
              >
                {/* Simulated Widget Header */}
                {localWidgetConfig.showHeader && (
                  <div
                    className="p-4 flex items-center justify-between text-white transition-colors"
                    style={{ backgroundColor: localWidgetConfig.primaryColor }}
                  >
                    <div className="flex items-center gap-2.5">
                      {localWidgetConfig.showAvatar && (
                        <div className="size-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs backdrop-blur-xs">
                          {agent.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-bold leading-tight">{localWidgetConfig.title || agent.name}</div>
                        <div className="text-[10px] text-white/80 leading-tight">
                          {localWidgetConfig.subtitle || 'Active & Ready'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 text-white/80">
                      <button
                        onClick={() => setChatMessages([])}
                        title="Clear conversation"
                        className="p-1 hover:text-white"
                      >
                        <RefreshCw className="size-3.5" />
                      </button>
                      <button title="Close widget" className="p-1 hover:text-white">
                        <Minus className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Simulated Chat Messages Area */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-muted/15 text-xs">
                  {/* Greeting */}
                  <div className="flex items-start gap-2">
                    <div
                      className="size-6 rounded-full text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                      style={{ backgroundColor: localWidgetConfig.primaryColor }}
                    >
                      {agent.name.charAt(0)}
                    </div>
                    <div className="bg-card border border-border/80 rounded-2xl rounded-tl-xs p-3 shadow-2xs max-w-[85%] text-foreground space-y-2">
                      <p>{localWidgetConfig.welcomeMessage || 'Hello! How may I assist you today?'}</p>

                      {/* Suggested Chips */}
                      {localWidgetConfig.suggestedPrompts?.length > 0 && chatMessages.length === 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {localWidgetConfig.suggestedPrompts.map((p, i) => (
                            <button
                              key={i}
                              onClick={() => handleSendLiveChatMessage(p)}
                              className="text-[10px] px-2 py-1 rounded-full bg-muted hover:bg-primary/10 hover:text-primary transition-colors text-left"
                            >
                              {p}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Rendered Live Chat Messages */}
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={cn(
                        'flex items-start gap-2',
                        msg.role === 'user' ? 'justify-end' : 'justify-start',
                      )}
                    >
                      {msg.role === 'assistant' && (
                        <div
                          className="size-6 rounded-full text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5"
                          style={{ backgroundColor: localWidgetConfig.primaryColor }}
                        >
                          {agent.name.charAt(0)}
                        </div>
                      )}

                      <div
                        className={cn(
                          'p-3 rounded-2xl shadow-2xs max-w-[85%] space-y-1.5',
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground rounded-tr-xs'
                            : 'bg-card border border-border/80 text-foreground rounded-tl-xs',
                        )}
                      >
                        <p className="whitespace-pre-wrap">{msg.text}</p>

                        {/* Approval banner card if required */}
                        {msg.approvalNeeded && (
                          <div className="p-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[11px] space-y-1.5">
                            <div className="font-bold flex items-center gap-1">
                              <AlertCircle className="size-3.5" /> Action Requires Approval
                            </div>
                            <p className="text-[10px]">
                              A critical step requires confirmation before proceeding.
                            </p>
                            <div className="flex gap-1.5 pt-1">
                              <Button
                                size="sm"
                                className="h-6 text-[10px] px-2 bg-success hover:bg-success/90 text-white"
                                onClick={() => {
                                  toast.success('Approval granted');
                                  setChatMessages((prev) => [
                                    ...prev,
                                    {
                                      id: `appr-${Date.now()}`,
                                      role: 'assistant',
                                      text: 'Approval confirmed. Proceeding with execution...',
                                    },
                                  ]);
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] px-2 text-destructive border-destructive/30"
                                onClick={() => {
                                  toast.info('Action declined');
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {isChatSending && (
                    <div className="flex items-center gap-2 text-muted-foreground text-xs italic">
                      <div
                        className="size-5 rounded-full text-white flex items-center justify-center text-[9px] font-bold shrink-0 animate-pulse"
                        style={{ backgroundColor: localWidgetConfig.primaryColor }}
                      >
                        {agent.name.charAt(0)}
                      </div>
                      <span className="flex items-center gap-1">
                        Thinking
                        <span className="animate-bounce">.</span>
                        <span className="animate-bounce delay-100">.</span>
                        <span className="animate-bounce delay-200">.</span>
                      </span>
                    </div>
                  )}
                </div>

                {/* Simulated Input Bar */}
                <div className="p-3 border-t border-border bg-card flex items-center gap-2">
                  <Input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSendLiveChatMessage();
                      }
                    }}
                    placeholder="Ask a question or enter task..."
                    className="h-8 text-xs flex-1 bg-muted/40"
                    disabled={isChatSending}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSendLiveChatMessage()}
                    disabled={!chatInput.trim() || isChatSending}
                    className="h-8 w-8 p-0 shrink-0 text-white"
                    style={{ backgroundColor: localWidgetConfig.primaryColor }}
                  >
                    <Send className="size-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SUBTAB 4: WEBHOOKS */}
        {activeSubTab === 'webhooks' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Outbound Event Webhooks</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Send real-time JSON webhooks to your servers when the agent executes tasks or requires human decisions.
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setCreateWebhookOpen(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus className="size-3.5" />
                Add Webhook Endpoint
              </Button>
            </div>

            {(webhooksQuery.data ?? []).length === 0 ? (
              <EmptyState
                icon={<Server className="size-8 text-muted-foreground" />}
                title="No webhooks registered"
                description="Add an HTTPS endpoint to receive run completions, tool traces, and approval events."
                action={
                  <Button size="sm" onClick={() => setCreateWebhookOpen(true)} className="gap-1.5 text-xs">
                    <Plus className="size-3.5" /> Add First Webhook
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {webhooksQuery.data?.map((wh) => (
                  <Card key={wh.id} className="p-4 shadow-2xs space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                          <Server className="size-4" />
                        </div>
                        <div>
                          <div className="font-mono text-xs font-bold text-foreground">{wh.url}</div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={wh.isActive ? 'success' : 'outline'} className="text-[10px]">
                              {wh.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              Created {new Date(wh.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testWebhookMutation.mutate(wh.id)}
                          loading={testWebhookMutation.isPending}
                          className="text-xs gap-1.5"
                        >
                          <Zap className="size-3 text-amber-500" />
                          Send Test Event
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            const ok = await confirm({
                              title: 'Delete Webhook?',
                              description: 'External notifications to this endpoint will stop immediately.',
                              destructive: true,
                            });
                            if (ok) deleteWebhookMutation.mutate(wh.id);
                          }}
                          className="text-xs text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/50">
                      <span className="text-[10px] font-semibold text-muted-foreground uppercase mr-1">
                        Subscribed Events:
                      </span>
                      {wh.events.map((ev) => (
                        <Badge key={ev} variant="secondary" className="font-mono text-[10px]">
                          {ev}
                        </Badge>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 5: API KEYS */}
        {activeSubTab === 'api-keys' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Agent API Keys</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Privileged API keys used for server-to-server REST calls and automated pipelines.
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setCreateKeyOpen(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus className="size-3.5" />
                Generate New Key
              </Button>
            </div>

            {newlyCreatedKeySecret && (
              <div className="p-4 rounded-xl border border-success/40 bg-success/10 space-y-2">
                <div className="text-xs font-bold text-success flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" /> API Key Created Successfully
                </div>
                <p className="text-xs text-foreground">
                  Please copy your secret key now. For security purposes, it will never be displayed again.
                </p>
                <div className="flex items-center gap-2">
                  <Input value={newlyCreatedKeySecret} readOnly className="font-mono text-xs bg-card" />
                  <Button
                    size="sm"
                    onClick={() => copyToClipboard(newlyCreatedKeySecret, 'new-secret')}
                    className="text-xs gap-1.5 shrink-0"
                  >
                    <Copy className="size-3.5" /> Copy Secret
                  </Button>
                </div>
              </div>
            )}

            {(apiKeysQuery.data ?? []).length === 0 ? (
              <EmptyState
                icon={<KeyRound className="size-8 text-muted-foreground" />}
                title="No API keys generated"
                description="Generate an API key to execute this agent through REST APIs or CI/CD pipelines."
                action={
                  <Button size="sm" onClick={() => setCreateKeyOpen(true)} className="gap-1.5 text-xs">
                    <Plus className="size-3.5" /> Generate First Key
                  </Button>
                }
              />
            ) : (
              <div className="space-y-3">
                {apiKeysQuery.data?.map((k) => (
                  <Card key={k.id} className="p-4 shadow-2xs flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{k.name}</span>
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {k.keyPrefix}••••••••
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Created {new Date(k.createdAt).toLocaleDateString()}
                        {k.lastUsedAt && ` • Last used ${new Date(k.lastUsedAt).toLocaleString()}`}
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        const ok = await confirm({
                          title: 'Revoke API Key?',
                          description: 'Any external systems using this key will be denied immediately.',
                          destructive: true,
                        });
                        if (ok) revokeApiKeyMutation.mutate(k.id);
                      }}
                      className="text-xs text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" /> Revoke Key
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* SUBTAB 6: VERSIONS */}
        {activeSubTab === 'versions' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">Version Snapshots & Rollback</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Track immutable versions published across environments and safely restore anytime.
                </p>
              </div>

              <Button
                size="sm"
                onClick={() => setPublishDialogOpen(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Rocket className="size-3.5" />
                Publish New Version
              </Button>
            </div>

            <div className="space-y-3">
              {(deploymentsQuery.data ?? []).map((dep) => (
                <Card key={dep.id} className="p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {dep.publishedVersionTag || `v${dep.publishedVersion || '1.0'}`}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {dep.environment}
                        </Badge>
                        <Badge
                          variant={dep.status === 'ACTIVE' ? 'success' : 'outline'}
                          className="text-[10px]"
                        >
                          {dep.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {dep.name} • Updated {new Date(dep.updatedAt).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRollbackVersion(dep.publishedVersionTag || `v${dep.publishedVersion || '1.0'}`);
                          setRollbackDialogOpen(true);
                        }}
                        className="text-xs gap-1.5"
                      >
                        <RotateCcw className="size-3.5" />
                        Rollback to this Version
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Publish Version Dialog */}
      <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="size-5 text-primary" /> Publish Agent Version
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-foreground block mb-1">Version Tag</label>
              <Input
                value={publishTag}
                onChange={(e) => setPublishTag(e.target.value)}
                placeholder="v1.0.0"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-foreground block mb-1">Target Environment</label>
              <select
                value={publishEnv}
                onChange={(e) =>
                  setPublishEnv(e.target.value as 'DEVELOPMENT' | 'STAGING' | 'PRODUCTION')
                }
                className="w-full rounded-lg border border-border bg-card p-2 text-xs text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              >
                <option value="PRODUCTION">Production</option>
                <option value="STAGING">Staging</option>
                <option value="DEVELOPMENT">Development</option>
              </select>
            </div>

            <div>
              <label className="font-semibold text-foreground block mb-1">Change Summary</label>
              <Input
                value={publishSummary}
                onChange={(e) => setPublishSummary(e.target.value)}
                placeholder="e.g. Added inventory pricing connector and approval safeguards"
                className="h-8 text-xs"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPublishDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => publishMutation.mutate()}
              loading={publishMutation.isPending}
              className="gap-1.5 font-semibold"
            >
              <Check className="size-3.5" /> Publish Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rollback Confirmation Dialog */}
      <Dialog open={rollbackDialogOpen} onOpenChange={setRollbackDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <RotateCcw className="size-5" /> Rollback to {selectedRollbackVersion}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-3 text-xs">
            <p className="text-foreground">
              Are you sure you want to revert active production deployments to snapshot{' '}
              <strong className="font-mono text-primary">{selectedRollbackVersion}</strong>?
            </p>
            <p className="text-muted-foreground">
              All live widgets, Web Components, and REST APIs will immediately run using this snapshot's instructions and tool configuration.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setRollbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => rollbackMutation.mutate(selectedRollbackVersion)}
              loading={rollbackMutation.isPending}
              className="gap-1.5 font-semibold"
            >
              Confirm Rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Webhook Dialog */}
      <Dialog open={createWebhookOpen} onOpenChange={setCreateWebhookOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Server className="size-5 text-primary" /> Register Webhook Endpoint
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-foreground block mb-1">Target Endpoint URL</label>
              <Input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://api.yourdomain.com/webhooks/agent"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div>
              <label className="font-semibold text-foreground block mb-1">
                HMAC Secret (Optional)
              </label>
              <Input
                value={webhookSecret}
                onChange={(e) => setWebhookSecret(e.target.value)}
                placeholder="Secret key for signature verification"
                className="h-8 text-xs font-mono"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCreateWebhookOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createWebhookMutation.mutate()}
              loading={createWebhookMutation.isPending}
              disabled={!webhookUrl.trim()}
              className="gap-1.5 font-semibold"
            >
              Register Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add API Key Dialog */}
      <Dialog open={createKeyOpen} onOpenChange={setCreateKeyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="size-5 text-primary" /> Generate API Key
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4 text-xs">
            <div>
              <label className="font-semibold text-foreground block mb-1">Key Description / Name</label>
              <Input
                value={keyName}
                onChange={(e) => setKeyName(e.target.value)}
                placeholder="e.g. Production Mobile App"
                className="h-8 text-xs"
              />
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCreateKeyOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createApiKeyMutation.mutate()}
              loading={createApiKeyMutation.isPending}
              disabled={!keyName.trim()}
              className="gap-1.5 font-semibold"
            >
              Generate Key
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
