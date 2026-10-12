import { aiApi } from '@org/api-client';
import type { AIProvider } from '@org/types';
import {
  Badge,
  Button,
  confirm,
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
  AIModelBadge,
  toast,
  Label,
  ResponsiveTabs,
} from '@org/ui';
import { cn } from '@org/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Coins,
  Cpu,
  Key,
  RefreshCw,
  Settings,
  Trash2,
  Users,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { ApiKeysManager } from '../components/agent-detail/deployment/api-keys-manager.js';
import { useAiModels } from '../components/workflow-canvas/agent-config/use-agent-config-data.js';
import { MembersTab } from './settings/members-tab.js';
import { UsageTab } from './settings/usage-tab.js';
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

  const [activeTab, setActiveTab] = useState<'providers' | 'members' | 'api-keys' | 'usage'>('providers');

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
    refetch: refetchProviders,
    isError: providersFailed,
    error: providersError,
  } = useQuery({
    queryKey: ['workspace-ai-providers', activeWorkspace.id],
    queryFn: () => aiApi.getProviders(activeWorkspace.id),
  });
  const modelsQuery = useAiModels();

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
      if (res.status === 'CONNECTED') {
        toast.success(`Connection to ${provider.toUpperCase()} succeeded!${res.latencyMs != null ? ` (${res.latencyMs}ms)` : ''}`);
      } else {
        toast.error(`Connection failed: ${res.detail || res.status}`);
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

  const openConfigModal = (p: typeof PROVIDER_METADATA_FALLBACK[0]) => {
    const existing = liveProviders.find((x) => x.id === p.provider);
    setSelectedProvider(p.provider);
    setProviderForm({
      provider: p.provider,
      apiKey: '',
      baseUrl: existing?.baseUrl || p.defaultBaseUrl || '',
      defaultModel: existing?.defaultModel || p.models[0] || '',
    });
  };

  return (
    <Page width="wide" padding="none" className="space-y-6">
      {/* Header matching Admin */}
      <PageHeader
        title="Workspace Settings & Model Providers"
        description={`Model provider credentials, the team, agent API keys and usage for ${activeWorkspace.name}.`}
        icon={<Settings className="size-5" />}
        accent="violet"
      />

      {/* Tabs */}
      <ResponsiveTabs
        variant="underline"
        value={activeTab}
        onValueChange={(tab) => setActiveTab(tab as any)}
        items={[
          { value: 'providers', label: 'Model Providers & LLMs', icon: <Cpu className="size-4" /> },
          { value: 'members', label: 'Team & roles', icon: <Users className="size-4" /> },
          { value: 'api-keys', label: 'API keys', icon: <Key className="size-4" /> },
          { value: 'usage', label: 'Usage & credits', icon: <Coins className="size-4" /> },
        ]}
      />

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

          {providersFailed ? (
            <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
              Couldn’t read this workspace’s providers: {providersError instanceof Error ? providersError.message : 'unknown error'}. The cards below may not show what is
              really connected.
            </p>
          ) : null}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PROVIDER_METADATA_FALLBACK.map((meta) => {
              const live = liveProviders.find((p) => p.id === meta.provider);
              const isConfigured = Boolean(live?.configured);

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
                        Models in this workspace
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {(() => {
                          const listed = (modelsQuery.data ?? []).filter((m) => m.provider === meta.provider && m.enabled !== false);
                          if (listed.length === 0) {
                            return (
                              <span className="text-[10px] text-muted-foreground">
                                {isConfigured ? 'None listed yet.' : 'Appear once the provider is connected.'}
                              </span>
                            );
                          }
                          return (
                            <>
                              {listed.slice(0, 3).map((m) => (
                                <AIModelBadge key={m.id} modelId={m.model} provider={meta.provider} variant="subtle" size="xs" />
                              ))}
                              {listed.length > 3 && <span className="self-center text-[10px] text-muted-foreground">+{listed.length - 3} more</span>}
                            </>
                          );
                        })()}
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
                          onClick={async () => {
                            const ok = await confirm({
                              title: `Disconnect ${meta.name}?`,
                              description: 'Agents using its models stop working until it is connected again. The saved key is deleted.',
                              confirmLabel: 'Disconnect',
                              destructive: true,
                            });
                            if (ok) deleteCredentialMutation.mutate(meta.provider);
                          }}
                          className="text-destructive hover:bg-destructive/10"
                          aria-label={`Disconnect ${meta.name}`}
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

      {activeTab === 'members' && <MembersTab />}

      {activeTab === 'api-keys' && (
        <ApiKeysManager
          workspaceId={activeWorkspace.id}
          title="Agent API keys"
          description="Keys that let your own backend, CI or scheduled jobs run published agents. They belong to the workspace; the secret is shown once when you create it."
        />
      )}

      {activeTab === 'usage' && <UsageTab />}

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
              <Label className="font-semibold text-foreground">API Key / Token</Label>
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
              <Label className="font-semibold text-foreground">Base URL (Endpoint)</Label>
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
              <Label className="font-semibold text-foreground">Default Model</Label>
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

    </Page>
  );
}
