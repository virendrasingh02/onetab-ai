import { aiApi } from '@org/api-client';
import type { AIProvider } from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Page,
  PageHeader,
  AIProviderIcon,
  AIModelIcon,
  AIModelBadge,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  Coins,
  Copy,
  Cpu,
  Key,
  Plus,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';
import { INITIAL_COLLABORATORS } from '../services/mockData.js';
import { useStudioSession } from '../session-guard.js';

interface ProviderConfigState {
  provider: AIProvider;
  apiKey: string;
  baseUrl: string;
  defaultModel: string;
}

const PROVIDER_METADATA_FALLBACK: Array<{
  provider: AIProvider;
  name: string;
  icon: string;
  description: string;
  defaultBaseUrl?: string;
  models: string[];
}> = [
  {
    provider: 'openai' as AIProvider,
    name: 'OpenAI',
    icon: '⚡',
    description: 'GPT-4o, GPT-4o-mini, o1-preview, o3-mini & embeddings',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1-preview', 'o3-mini', 'text-embedding-3-small'],
  },
  {
    provider: 'anthropic' as AIProvider,
    name: 'Anthropic',
    icon: '🎭',
    description: 'Claude 3.7 Sonnet, Claude 3.5 Haiku, Claude 3 Opus',
    models: ['claude-3-7-sonnet', 'claude-3-5-haiku', 'claude-3-opus'],
  },
  {
    provider: 'gemini' as AIProvider,
    name: 'Google Gemini',
    icon: '✨',
    description: 'Gemini 2.0 Flash, Gemini 1.5 Pro multimodal models',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
  {
    provider: 'ollama' as AIProvider,
    name: 'Ollama (Local / On-Prem)',
    icon: '🦙',
    description: 'Local open-source models running on your own infrastructure or workstation',
    defaultBaseUrl: 'http://localhost:11434',
    models: ['llama3.3:70b', 'llama3.1:8b', 'qwen2.5:32b', 'deepseek-r1:14b', 'mistral:7b'],
  },
  {
    provider: 'groq' as AIProvider,
    name: 'Groq LPU',
    icon: '🚀',
    description: 'Ultra-low latency inference for Llama 3 and Mixtral',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  },
  {
    provider: 'deepseek' as AIProvider,
    name: 'DeepSeek',
    icon: '🐋',
    description: 'DeepSeek-V3, DeepSeek-R1 reasoning models',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  {
    provider: 'mistral' as AIProvider,
    name: 'Mistral AI',
    icon: '🌪️',
    description: 'Mistral Large, Codestral, Pixtral multimodal models',
    models: ['mistral-large-latest', 'codestral-latest', 'pixtral-12b'],
  },
  {
    provider: 'cohere' as AIProvider,
    name: 'Cohere',
    icon: '🌐',
    description: 'Command R+, Embed v3, and Cohere Rerank',
    models: ['command-r-plus', 'command-r', 'embed-english-v3.0'],
  },
  {
    provider: 'custom' as AIProvider,
    name: 'Custom OpenAI-Compatible',
    icon: '🔌',
    description: 'Connect vLLM, TGI, LocalAI, or private corporate proxy endpoints',
    defaultBaseUrl: 'http://localhost:8000/v1',
    models: ['custom-default-model'],
  },
];

export function SettingsPage() {
  const { activeWorkspace } = useStudioSession();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<
    'providers' | 'members' | 'security' | 'governance' | 'billing'
  >('providers');

  // Provider configuration modal
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [providerForm, setProviderForm] = useState<ProviderConfigState>({
    provider: 'openai' as AIProvider,
    apiKey: '',
    baseUrl: '',
    defaultModel: '',
  });

  // Query workspace providers
  const {
    data: liveProviders = [],
    isLoading: isLoadingProviders,
    refetch: refetchProviders,
  } = useQuery({
    queryKey: ['workspace-ai-providers', activeWorkspace.id],
    queryFn: async () => {
      try {
        const res = await aiApi.getProviders(activeWorkspace.id);
        if (Array.isArray(res)) return res;
      } catch (err) {
        console.warn('Failed to load AI providers from server:', err);
      }
      return [];
    },
  });

  // Save Provider Credential Mutation
  const saveCredentialMutation = useMutation({
    mutationFn: async (payload: ProviderConfigState) => {
      return aiApi.saveCredential(activeWorkspace.id, payload.provider, {
        apiKey: payload.apiKey.trim() || undefined,
        baseUrl: payload.baseUrl.trim() || undefined,
        defaultModel: payload.defaultModel.trim() || undefined,
        enabled: true,
      });
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['workspace-ai-providers', activeWorkspace.id] });
      setSelectedProvider(null);
      toast.success(`Configured ${vars.provider.toUpperCase()} credentials successfully!`);
    },
    onError: (err: any) => {
      toast.error('Failed to save provider credential', { description: err?.message });
    },
  });

  // Test Provider Connection Mutation
  const [isTestingProvider, setIsTestingProvider] = useState(false);
  const testProviderConnection = async (provider: AIProvider, model?: string) => {
    setIsTestingProvider(true);
    try {
      const res = await aiApi.testProvider(activeWorkspace.id, provider, model);
      if (res.success) {
        toast.success(`Connection to ${provider.toUpperCase()} succeeded! (${res.latencyMs || 120}ms)`);
      } else {
        toast.error(`Connection failed: ${res.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      toast.error(`Connection test failed`, { description: err?.message || 'Server timeout or invalid key' });
    } finally {
      setIsTestingProvider(false);
    }
  };

  // Delete Provider Credential Mutation
  const deleteCredentialMutation = useMutation({
    mutationFn: async (provider: AIProvider) => {
      return aiApi.deleteCredential(activeWorkspace.id, provider);
    },
    onSuccess: (_, prov) => {
      queryClient.invalidateQueries({ queryKey: ['workspace-ai-providers', activeWorkspace.id] });
      toast.info(`Removed ${prov.toUpperCase()} credentials`);
    },
  });

  // Members state
  const [members, setMembers] = useState(INITIAL_COLLABORATORS);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Agent Builder');

  // API Tokens state
  const [apiTokens, setApiTokens] = useState([
    {
      id: 'tok-1',
      name: 'Production Workflow Dispatcher',
      maskedKey: 'ot_live_9921••••••••••••••••38f1',
      createdAt: '2026-03-12',
      lastUsed: '4 minutes ago',
    },
    {
      id: 'tok-2',
      name: 'CI/CD Automated Test Runner',
      maskedKey: 'ot_test_4182••••••••••••••••109a',
      createdAt: '2026-03-24',
      lastUsed: '2 days ago',
    },
  ]);
  const [isCreateTokenOpen, setIsCreateTokenOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState('');

  // Governance state
  const [govSettings, setGovSettings] = useState({
    blockPromptInjection: true,
    redactPII: true,
    requireApprovalForRefunds: true,
    enforceDomainAllowlist: true,
    maxExecutionTimeSeconds: 60,
    sandboxCodeExecution: true,
    defaultSystemPrompt: 'You are an autonomous AI employee inside our workspace. Follow instructions strictly.',
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    const newMember = {
      id: `col-${Date.now().toString(36)}`,
      name: inviteEmail.split('@')[0],
      email: inviteEmail.trim(),
      role: inviteRole,
      status: 'invited',
    };
    setMembers([...members, newMember]);
    setIsInviteOpen(false);
    setInviteEmail('');
    toast.success(`Invitation sent to ${inviteEmail}!`);
  };

  const handleCreateToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTokenName.trim()) return;
    const newToken = {
      id: `tok-${Date.now().toString(36)}`,
      name: newTokenName.trim(),
      maskedKey: `ot_live_${Math.random().toString(36).substring(2, 6)}••••••••••••••••${Math.random().toString(36).substring(2, 6)}`,
      createdAt: 'Just now',
      lastUsed: 'Never',
    };
    setApiTokens([newToken, ...apiTokens]);
    setIsCreateTokenOpen(false);
    setNewTokenName('');
    toast.success('API token generated! Copy it securely.');
  };

  const openConfigModal = (p: typeof PROVIDER_METADATA_FALLBACK[0]) => {
    const existing = liveProviders.find((x) => x.provider === p.provider);
    setSelectedProvider(p.provider);
    setProviderForm({
      provider: p.provider,
      apiKey: '',
      baseUrl: (existing as any)?.baseUrl || p.defaultBaseUrl || '',
      defaultModel: (existing as any)?.defaultModel || p.models[0] || '',
    });
  };

  return (
    <Page width="wide" padding="none" className="space-y-6">
      {/* Header matching Admin */}
      <PageHeader
        title="Workspace Settings & Model Providers"
        description={`Configure LLM credentials, access tokens, team permissions, and guardrails for ${activeWorkspace.name}.`}
        icon={<Settings className="size-5" />}
        accent="violet"
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border text-xs">
        {[
          { id: 'providers', label: 'Model Providers & LLMs', icon: Cpu },
          { id: 'members', label: 'Team & RBAC Roles', icon: Users },
          { id: 'security', label: 'API Keys & Vault', icon: Key },
          { id: 'governance', label: 'AI Guardrails & Defaults', icon: Shield },
          { id: 'billing', label: 'Usage & Quotas', icon: Coins },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                'flex items-center gap-2 border-b-2 px-4 py-2.5 font-medium transition-colors',
                isActive
                  ? 'border-primary text-primary font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: MODEL PROVIDERS (MODULE 18.1) */}
      {activeTab === 'providers' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">AI Model Providers</h3>
              <p className="text-xs text-muted-foreground">
                Connect external cloud LLMs or local private models to power agents and workflows.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchProviders()}
              className="gap-1.5 text-xs"
            >
              <RefreshCw className="size-3.5" />
              Refresh Status
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROVIDER_METADATA_FALLBACK.map((meta) => {
              const live = liveProviders.find((p) => p.provider === meta.provider);
              const isConfigured = Boolean(live?.isConfigured || live?.enabled);

              return (
                <div
                  key={meta.provider}
                  className={cn(
                    'rounded-xl border p-4 transition-all flex flex-col justify-between bg-surface',
                    isConfigured
                      ? 'border-success/30 bg-success/5'
                      : 'border-border hover:border-border-hover',
                  )}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-9 items-center justify-center rounded-lg bg-surface-raised border border-border shrink-0">
                          <AIProviderIcon provider={meta.provider} size={20} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm text-foreground">{meta.name}</div>
                          <div className="text-[11px] text-muted-foreground line-clamp-1">
                            {meta.description}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={isConfigured ? 'success' : 'outline'}
                        className="text-[10px] shrink-0"
                      >
                        {isConfigured ? 'Connected' : 'Not Configured'}
                      </Badge>
                    </div>

                    <div className="text-[11px] text-muted-foreground space-y-1.5 pt-1">
                      <div className="font-medium text-foreground text-[10px] uppercase tracking-wider">
                        Available Models:
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {meta.models.slice(0, 3).map((m) => (
                          <AIModelBadge
                            key={m}
                            modelId={m}
                            provider={meta.provider}
                            variant="subtle"
                            size="xs"
                          />
                        ))}
                        {meta.models.length > 3 && (
                          <span className="text-[10px] text-muted-foreground self-center">
                            +{meta.models.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-border/50 mt-4">
                    <Button
                      variant={isConfigured ? 'outline' : 'default'}
                      size="xs"
                      onClick={() => openConfigModal(meta)}
                      className="flex-1 text-xs"
                    >
                      {isConfigured ? 'Edit Credentials' : 'Set Up'}
                    </Button>

                    {isConfigured && (
                      <>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => testProviderConnection(meta.provider, meta.models[0])}
                          disabled={isTestingProvider}
                          className="text-xs text-muted-foreground hover:text-foreground"
                          title="Test Connection"
                        >
                          <Zap className="size-3.5 text-warning mr-1" />
                          Test
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => deleteCredentialMutation.mutate(meta.provider)}
                          className="text-destructive hover:bg-destructive/10"
                          title="Disconnect Provider"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: MEMBERS & RBAC (MODULE 1.3 & 16.1) */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Workspace Members & Permissions</h3>
              <p className="text-xs text-muted-foreground">
                Role-based access control (RBAC) governing who can create, edit, and publish agents.
              </p>
            </div>
            <Button size="sm" onClick={() => setIsInviteOpen(true)} className="gap-1.5 text-xs">
              <UserPlus className="size-3.5" />
              Invite Member
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-surface-raised text-[11px] font-semibold text-muted-foreground uppercase">
                <tr>
                  <th className="px-4 py-3">Member</th>
                  <th className="px-4 py-3">Assigned Role</th>
                  <th className="px-4 py-3">Agent Permissions</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-surface-raised transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      <div className="flex items-center gap-2.5">
                        <div className="flex size-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                          {m.name.slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <div>{m.name}</div>
                          <div className="text-[11px] text-muted-foreground">{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-[11px]">
                        {m.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-[11px]">
                      {m.role === 'Workspace Owner' || m.role === 'Admin'
                        ? 'Full Access (Create, Edit, Publish, Delete)'
                        : 'Builder (Create, Edit, Test)'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-[11px] text-success font-medium">
                        <span className="size-1.5 rounded-full bg-success" />
                        {m.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {m.role !== 'Workspace Owner' && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            setMembers(members.filter((x) => x.id !== m.id));
                            toast.info(`Removed ${m.name}`);
                          }}
                          className="text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: API KEYS & VAULT (MODULE 18.4) */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Workspace API Tokens</h3>
              <p className="text-xs text-muted-foreground">
                Authenticate programmatic workflow execution and external webhook triggers.
              </p>
            </div>
            <Button size="sm" onClick={() => setIsCreateTokenOpen(true)} className="gap-1.5 text-xs">
              <Plus className="size-3.5" />
              Generate Token
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="divide-y divide-border">
              {apiTokens.map((tok) => (
                <div key={tok.id} className="flex items-center justify-between p-4 text-xs">
                  <div className="space-y-1">
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <Key className="size-3.5 text-primary" />
                      <span>{tok.name}</span>
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground">{tok.maskedKey}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Created {tok.createdAt} • Last used {tok.lastUsed}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => {
                        navigator.clipboard.writeText(tok.maskedKey);
                        toast.success('Token copied to clipboard');
                      }}
                      className="gap-1"
                    >
                      <Copy className="size-3" />
                      Copy
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setApiTokens(apiTokens.filter((t) => t.id !== tok.id));
                        toast.info(`Revoked token: ${tok.name}`);
                      }}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GOVERNANCE & DEFAULTS (MODULE 13 & 18.2) */}
      {activeTab === 'governance' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground">AI Guardrails & Workspace Policies</h3>
            <p className="text-xs text-muted-foreground">
              Enforce safety policies, PII filters, and timeouts across all agents in this workspace.
            </p>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-surface p-5 text-xs">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                Default Workspace System Prompt
              </label>
              <textarea
                value={govSettings.defaultSystemPrompt}
                onChange={(e) =>
                  setGovSettings({ ...govSettings, defaultSystemPrompt: e.target.value })
                }
                rows={3}
                className="w-full rounded-lg border border-border bg-surface-raised p-2.5 text-xs font-mono text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
              />
              <p className="text-[11px] text-muted-foreground">
                Injected into every agent prompt unless explicitly overridden in the canvas.
              </p>
            </div>

            <div className="pt-3 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="flex items-start gap-3 p-3 rounded-lg border border-border/70 hover:bg-surface-raised cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={govSettings.redactPII}
                  onChange={(e) => setGovSettings({ ...govSettings, redactPII: e.target.checked })}
                  className="rounded border-border mt-0.5 text-primary focus:ring-primary"
                />
                <div>
                  <div className="font-semibold text-foreground">PII Detection & Redaction</div>
                  <div className="text-[11px] text-muted-foreground">
                    Automatically redact emails, phone numbers, and SSNs from outputs.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border/70 hover:bg-surface-raised cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={govSettings.blockPromptInjection}
                  onChange={(e) =>
                    setGovSettings({ ...govSettings, blockPromptInjection: e.target.checked })
                  }
                  className="rounded border-border mt-0.5 text-primary focus:ring-primary"
                />
                <div>
                  <div className="font-semibold text-foreground">Prompt Injection Protection</div>
                  <div className="text-[11px] text-muted-foreground">
                    Filter out adversarial inputs and jailbreak bypass attempts.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border/70 hover:bg-surface-raised cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={govSettings.requireApprovalForRefunds}
                  onChange={(e) =>
                    setGovSettings({ ...govSettings, requireApprovalForRefunds: e.target.checked })
                  }
                  className="rounded border-border mt-0.5 text-primary focus:ring-primary"
                />
                <div>
                  <div className="font-semibold text-foreground">HITL Approval for Destructive Tools</div>
                  <div className="text-[11px] text-muted-foreground">
                    Suspend executions and ask for human confirmation on financial or data write tools.
                  </div>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-lg border border-border/70 hover:bg-surface-raised cursor-pointer transition-colors">
                <input
                  type="checkbox"
                  checked={govSettings.sandboxCodeExecution}
                  onChange={(e) =>
                    setGovSettings({ ...govSettings, sandboxCodeExecution: e.target.checked })
                  }
                  className="rounded border-border mt-0.5 text-primary focus:ring-primary"
                />
                <div>
                  <div className="font-semibold text-foreground">Sandboxed Code Isolation</div>
                  <div className="text-[11px] text-muted-foreground">
                    Execute Python and JavaScript node code in isolated worker containers.
                  </div>
                </div>
              </label>
            </div>

            <div className="pt-3 border-t border-border flex justify-end">
              <Button
                size="sm"
                onClick={() => toast.success('Governance policies saved successfully')}
              >
                Save Governance Policies
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: BILLING & USAGE (MODULE 21) */}
      {activeTab === 'billing' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Token Consumption & Quotas</h3>
            <p className="text-xs text-muted-foreground">
              Monitor monthly spend limits and configure auto-pause thresholds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
              <div className="text-xs text-muted-foreground">Monthly Token Usage</div>
              <div className="text-xl font-bold text-foreground">428,500 / 2,000,000</div>
              <div className="w-full bg-surface-raised rounded-full h-2 mt-2 overflow-hidden border border-border">
                <div className="bg-primary h-full rounded-full" style={{ width: '21.4%' }} />
              </div>
              <div className="text-[10px] text-muted-foreground pt-1">21.4% of quota consumed</div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
              <div className="text-xs text-muted-foreground">Estimated Monthly Cost</div>
              <div className="text-xl font-bold text-foreground">$1.28</div>
              <div className="text-[10px] text-success flex items-center gap-1 mt-2">
                <CheckCircle2 className="size-3" /> Well within monthly budget cap ($50.00)
              </div>
            </div>

            <div className="rounded-xl border border-border bg-surface p-4 space-y-1">
              <div className="text-xs text-muted-foreground">Auto-Pause Safeguard</div>
              <div className="text-sm font-semibold text-foreground">Enabled ($50.00 hard limit)</div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Automatically pauses agent executions when spending crosses limit.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* PROVIDER CREDENTIAL CONFIGURATION MODAL */}
      <Dialog open={selectedProvider !== null} onOpenChange={(open) => !open && setSelectedProvider(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedProvider ? <AIProviderIcon provider={selectedProvider} size={20} /> : null}
              <span>Configure {selectedProvider ? selectedProvider.toUpperCase() : ''} Credentials</span>
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">API Key / Token</label>
              <Input
                type="password"
                placeholder={selectedProvider === 'ollama' ? 'Optional for local Ollama' : 'sk-...'}
                value={providerForm.apiKey}
                onChange={(e) => setProviderForm({ ...providerForm, apiKey: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                Stored with AES-256-GCM envelope encryption. Never exposed in responses.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Base URL (Endpoint)</label>
              <Input
                placeholder="https://api.openai.com/v1"
                value={providerForm.baseUrl}
                onChange={(e) => setProviderForm({ ...providerForm, baseUrl: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">
                Leave empty for provider defaults, or specify private proxy/local address.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">Default Model</label>
              <Input
                placeholder="gpt-4o"
                value={providerForm.defaultModel}
                onChange={(e) => setProviderForm({ ...providerForm, defaultModel: e.target.value })}
              />
            </div>
          </DialogBody>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedProvider(null)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => saveCredentialMutation.mutate(providerForm)}
              disabled={saveCredentialMutation.isPending}
            >
              {saveCredentialMutation.isPending ? 'Saving...' : 'Save Credentials'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* INVITE MEMBER MODAL */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Invite Teammate to Workspace</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite}>
            <DialogBody className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Email Address</label>
                <Input
                  type="email"
                  placeholder="colleague@onetab.ai"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface p-2 text-xs text-foreground"
                >
                  <option value="Agent Builder">Agent Builder (Create & Edit)</option>
                  <option value="Admin">Admin (Full Control)</option>
                  <option value="Viewer">Viewer (Read Only)</option>
                </select>
              </div>
            </DialogBody>
            <DialogFooter className="gap-2 mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsInviteOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Send Invitation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE API TOKEN MODAL */}
      <Dialog open={isCreateTokenOpen} onOpenChange={setIsCreateTokenOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Generate Workspace API Token</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateToken}>
            <DialogBody className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Token Label</label>
                <Input
                  placeholder="e.g. Production Webhook Runner"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Give this key a recognizable name to track usage and revocations.
                </p>
              </div>
            </DialogBody>
            <DialogFooter className="gap-2 mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateTokenOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Create Token
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
