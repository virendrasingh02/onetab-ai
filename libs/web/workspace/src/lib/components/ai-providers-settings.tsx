import { aiApi } from '@org/api-client';
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@org/ui';
import { cn } from '@org/utils';
import type {
  AIModelMetadata,
  AIProvider,
  AIProviderMetadata,
  AIProviderStatus,
  ProviderConnectionTestResult,
  SaveProviderCredentialInput,
} from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Cpu,
  Eye,
  EyeOff,
  Globe,
  Key,
  Lock,
  Play,
  RefreshCw,
  Server,
  ShieldCheck,
  Sparkles,
  Trash2,
  Zap,
} from 'lucide-react';
import React, { useState } from 'react';

export interface AIProvidersSettingsProps {
  workspaceId: string;
}

const PROVIDER_ICONS: Record<AIProvider, React.ElementType> = {
  nvidia: Cpu,
  openai: Sparkles,
  anthropic: Bot,
  gemini: Globe,
  deepseek: Zap,
  groq: Activity,
  mistral: ShieldCheck,
  xai: Sparkles,
  together: Server,
  openrouter: Globe,
  cohere: Key,
  ollama: Server,
};

export function AIProvidersSettings({ workspaceId }: AIProvidersSettingsProps) {
  const queryClient = useQueryClient();

  const [selectedProvider, setSelectedProvider] = useState<AIProviderMetadata | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Form states for configure dialog
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [baseUrlInput, setBaseUrlInput] = useState('');
  const [defaultModelInput, setDefaultModelInput] = useState('');
  const [isEnabledInput, setIsEnabledInput] = useState(true);

  // Test connection state
  const [testResult, setTestResult] = useState<ProviderConnectionTestResult | null>(null);
  const [testingProviderId, setTestingProviderId] = useState<string | null>(null);

  // Fetch all providers
  const { data: providers = [], isLoading, refetch } = useQuery({
    queryKey: ['ai-providers', workspaceId],
    queryFn: () => aiApi.getProviders(workspaceId),
    staleTime: 10_000,
  });

  // Save credential mutation
  const saveMutation = useMutation({
    mutationFn: (input: { provider: AIProvider; data: SaveProviderCredentialInput }) =>
      aiApi.saveCredential(workspaceId, input.provider, input.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-providers', workspaceId] });
      setIsConfigOpen(false);
      setApiKeyInput('');
      setTestResult(null);
    },
  });

  // Delete credential mutation
  const deleteMutation = useMutation({
    mutationFn: (provider: AIProvider) =>
      aiApi.deleteCredential(workspaceId, provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-providers', workspaceId] });
      setIsDeleteOpen(false);
      setIsConfigOpen(false);
      setTestResult(null);
    },
  });

  // Test connection mutation
  const testMutation = useMutation({
    mutationFn: (provider: AIProvider) =>
      aiApi.testProvider(workspaceId, provider),
    onSuccess: (res) => {
      setTestResult(res);
      queryClient.invalidateQueries({ queryKey: ['ai-providers', workspaceId] });
    },
  });

  // Update model settings mutation
  const modelSettingMutation = useMutation({
    mutationFn: (input: { modelId: string; enabled?: boolean; isDefault?: boolean }) =>
      aiApi.updateModelSetting(workspaceId, input.modelId, {
        enabled: input.enabled,
        isDefault: input.isDefault,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-providers', workspaceId] });
    },
  });

  const handleOpenConfigure = (provider: AIProviderMetadata) => {
    setSelectedProvider(provider);
    setApiKeyInput('');
    setShowApiKey(false);
    setBaseUrlInput(provider.baseUrl || '');
    setDefaultModelInput(provider.defaultModel || '');
    setIsEnabledInput(provider.enabled ?? true);
    setTestResult(null);
    setIsConfigOpen(true);
  };

  const handleOpenDelete = (provider: AIProviderMetadata) => {
    setSelectedProvider(provider);
    setIsDeleteOpen(true);
  };

  const handleSave = () => {
    if (!selectedProvider) return;
    saveMutation.mutate({
      provider: selectedProvider.id,
      data: {
        ...(apiKeyInput.trim() ? { apiKey: apiKeyInput.trim() } : {}),
        baseUrl: baseUrlInput.trim() || undefined,
        defaultModel: defaultModelInput.trim() || undefined,
        enabled: isEnabledInput,
      },
    });
  };

  const handleTestCardConnection = async (provider: AIProvider) => {
    setTestingProviderId(provider);
    try {
      const res = await aiApi.testProvider(workspaceId, provider);
      setTestResult(res);
      refetch();
    } catch {
      // Handled by query refetch
    } finally {
      setTestingProviderId(null);
    }
  };

  const renderStatusBadge = (status: AIProviderStatus, isTesting: boolean) => {
    if (isTesting) {
      return (
        <Badge variant="neutral" className="gap-1.5 bg-sky-500/10 text-sky-600 border-sky-500/20">
          <RefreshCw className="size-3 animate-spin" />
          <span>Testing...</span>
        </Badge>
      );
    }

    switch (status) {
      case 'CONNECTED':
        return (
          <Badge variant="neutral" className="gap-1.5 bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
            <CheckCircle2 className="size-3" />
            <span>Connected</span>
          </Badge>
        );
      case 'AUTH_ERROR':
        return (
          <Badge variant="neutral" className="gap-1.5 bg-rose-500/10 text-rose-600 border-rose-500/20 font-medium">
            <AlertCircle className="size-3" />
            <span>Auth Error</span>
          </Badge>
        );
      case 'RATE_LIMITED':
        return (
          <Badge variant="neutral" className="gap-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20 font-medium">
            <AlertTriangle className="size-3" />
            <span>Rate Limited</span>
          </Badge>
        );
      case 'UNAVAILABLE':
        return (
          <Badge variant="neutral" className="gap-1.5 bg-amber-500/10 text-amber-600 border-amber-500/20 font-medium">
            <AlertTriangle className="size-3" />
            <span>Unavailable</span>
          </Badge>
        );
      case 'DISABLED':
        return (
          <Badge variant="neutral" className="gap-1.5 bg-muted text-muted-foreground font-medium">
            <span>Disabled</span>
          </Badge>
        );
      case 'NOT_CONFIGURED':
      default:
        return (
          <Badge variant="neutral" className="gap-1.5 bg-muted/60 text-muted-foreground font-medium">
            <span className="size-1.5 rounded-full bg-muted-foreground/60" />
            <span>Not Configured</span>
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="size-6 animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Loading AI providers and credentials...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>AI Providers & API Keys</span>
            <Badge variant="neutral" className="bg-primary/10 text-primary border-primary/20 text-[10px] font-semibold">
              Multi-Provider
            </Badge>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Manage provider credentials, API endpoints, and model capabilities for this workspace. Keys are encrypted at rest and never exposed to the browser.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="h-8 text-xs gap-1.5 shrink-0"
        >
          <RefreshCw className="size-3.5" />
          <span>Refresh Status</span>
        </Button>
      </div>

      {/* Security Guarantee Banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-border/80 bg-surface-inset/50 text-xs">
        <ShieldCheck className="size-4 text-emerald-500 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <span className="font-semibold text-foreground">Zero-Trust Credential Security</span>
          <p className="text-[11px] text-muted-foreground">
            All API keys are encrypted on the backend using AES-256-GCM before being stored. Plaintext credentials are never returned over the network, stored in Redux, or placed in browser storage.
          </p>
        </div>
      </div>

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {providers.map((provider) => {
          const Icon = PROVIDER_ICONS[provider.id] || Cpu;
          const isTesting = testingProviderId === provider.id;
          const isDefault = provider.id === 'nvidia';

          return (
            <div
              key={provider.id}
              className={cn(
                'relative flex flex-col justify-between rounded-2xl border bg-surface-inset p-5 transition-all shadow-2xs hover:shadow-xs',
                provider.configured
                  ? 'border-border'
                  : 'border-dashed border-border/70 bg-surface-inset/40'
              )}
            >
              {/* Card Top */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex size-10 items-center justify-center rounded-xl bg-surface border border-border/80 shadow-2xs">
                      <Icon className="size-5 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">{provider.name}</h3>
                        {isDefault && (
                          <Badge variant="neutral" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-semibold px-1.5 py-0">
                            Default
                          </Badge>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground line-clamp-1">
                        {provider.description || `${provider.name} AI model provider`}
                      </p>
                    </div>
                  </div>

                  {renderStatusBadge(provider.status, isTesting)}
                </div>

                {/* Credential Status & Key Info */}
                <div className="rounded-xl border border-border/50 bg-surface/50 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Key className="size-3 text-muted-foreground/80" />
                      Credential:
                    </span>
                    <span className="font-mono text-[11px] font-medium text-foreground">
                      {provider.maskedKey || (provider.configured ? 'Configured via Environment' : 'None')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Default Model:</span>
                    <span className="text-[11px] font-medium text-foreground truncate max-w-[180px]">
                      {provider.defaultModel}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-border/30">
                    <span className="text-[11px] text-muted-foreground">Available Models:</span>
                    <span className="text-[11px] font-semibold text-primary">
                      {provider.models.length} {provider.models.length === 1 ? 'model' : 'models'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-border/40">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenConfigure(provider)}
                    className="h-8 text-xs px-3"
                  >
                    Configure
                  </Button>

                  {provider.configured && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleTestCardConnection(provider.id)}
                      disabled={isTesting}
                      className="h-8 text-xs px-2.5 gap-1 text-muted-foreground hover:text-foreground"
                    >
                      {isTesting ? (
                        <RefreshCw className="size-3 animate-spin" />
                      ) : (
                        <Play className="size-3" />
                      )}
                      <span>Test</span>
                    </Button>
                  )}
                </div>

                {provider.maskedKey && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenDelete(provider)}
                    className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                    title="Remove API Key"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Model Catalog & Management Section */}
      <div className="space-y-4 pt-6 border-t border-border/60">
        <div>
          <h2 className="text-base font-bold text-foreground">Model Catalog & Defaults</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enable or disable individual models for this workspace or select your default engine.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-surface-inset divide-y divide-border/40 overflow-hidden">
          {providers.flatMap((p) => p.models).map((model: AIModelMetadata) => {
            const capabilities = Array.isArray(model.capabilities)
              ? model.capabilities
              : Object.entries(model.capabilities)
                  .filter(([, v]) => Boolean(v))
                  .map(([k]) => k);

            return (
              <div
                key={model.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-surface/50 transition-colors"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-foreground">{model.name}</span>
                    <Badge variant="neutral" className="text-[10px] uppercase font-mono px-1.5 py-0">
                      {model.provider}
                    </Badge>
                    {model.default && (
                      <Badge variant="neutral" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-semibold px-1.5 py-0">
                        Default
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground truncate">
                    {model.model}
                  </p>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="inline-flex items-center text-[9.5px] font-medium px-1.5 py-0.5 rounded-md bg-surface border border-border/60 text-muted-foreground"
                      >
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {!model.default && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        modelSettingMutation.mutate({
                          modelId: model.id,
                          isDefault: true,
                        })
                      }
                      className="h-7 text-[11px] text-muted-foreground hover:text-foreground px-2"
                    >
                      Set as Default
                    </Button>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      {model.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                    <Switch
                      checked={model.enabled}
                      onCheckedChange={(checked) =>
                        modelSettingMutation.mutate({
                          modelId: model.id,
                          enabled: checked,
                        })
                      }
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Configure Provider Dialog */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Key className="size-4 text-primary" />
              <span>Configure {selectedProvider?.name}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Provide your API credentials and endpoints. Credentials are encrypted securely at rest.
            </DialogDescription>
          </DialogHeader>

          {selectedProvider && (
            <div className="space-y-4 py-2">
              {/* Stored Key Indicator */}
              {selectedProvider.maskedKey ? (
                <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface-inset text-xs">
                  <div className="flex items-center gap-2">
                    <Lock className="size-3.5 text-emerald-500" />
                    <div>
                      <span className="font-semibold text-foreground block">Active Stored Key</span>
                      <span className="font-mono text-muted-foreground">{selectedProvider.maskedKey}</span>
                    </div>
                  </div>
                  <Badge variant="neutral" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    Encrypted
                  </Badge>
                </div>
              ) : null}

              {/* API Key Input */}
              {selectedProvider.requiresApiKey && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">
                    {selectedProvider.maskedKey ? 'Update API Key' : 'Enter API Key'}
                  </label>
                  <div className="relative">
                    <Input
                      type={showApiKey ? 'text' : 'password'}
                      placeholder={selectedProvider.maskedKey ? 'Leave blank to keep existing key' : 'Paste your API key'}
                      value={apiKeyInput}
                      onChange={(e) => setApiKeyInput(e.target.value)}
                      className="h-9 text-xs font-mono pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    For security, newly entered keys are only visible while typing and cannot be read once saved.
                  </p>
                </div>
              )}

              {/* Base URL Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Base URL (Optional)
                </label>
                <Input
                  type="url"
                  placeholder={selectedProvider.baseUrl || 'https://...'}
                  value={baseUrlInput}
                  onChange={(e) => setBaseUrlInput(e.target.value)}
                  className="h-9 text-xs font-mono"
                />
                <p className="text-[11px] text-muted-foreground">
                  Custom endpoint URL or proxy for enterprise NIM / self-hosted gateway.
                </p>
              </div>

              {/* Default Model Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Default Model
                </label>
                <Select value={defaultModelInput} onValueChange={setDefaultModelInput}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select default model" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProvider.models.map((m) => (
                      <SelectItem key={m.model} value={m.model} className="text-xs font-mono">
                        {m.name} ({m.model})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Enable / Disable Switch */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-surface-inset">
                <div>
                  <h4 className="text-xs font-semibold text-foreground">Enable Provider</h4>
                  <p className="text-[11px] text-muted-foreground">
                    Allow workspace chats, agents, and automations to invoke this provider
                  </p>
                </div>
                <Switch checked={isEnabledInput} onCheckedChange={setIsEnabledInput} />
              </div>

              {/* Live Test Connection in Dialog */}
              <div className="pt-2 border-t border-border/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground">Connection Health</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => testMutation.mutate(selectedProvider.id)}
                    disabled={testMutation.isPending}
                    className="h-7 text-xs gap-1.5"
                  >
                    {testMutation.isPending ? (
                      <RefreshCw className="size-3 animate-spin" />
                    ) : (
                      <Play className="size-3" />
                    )}
                    <span>Test Connection</span>
                  </Button>
                </div>

                {testResult && (
                  <div
                    className={cn(
                      'p-3 rounded-xl border text-xs space-y-1',
                      testResult.status === 'CONNECTED'
                        ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
                        : 'border-rose-500/20 bg-rose-500/5 text-rose-700 dark:text-rose-300'
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-semibold">
                      {testResult.status === 'CONNECTED' ? (
                        <Check className="size-3.5" />
                      ) : (
                        <AlertCircle className="size-3.5" />
                      )}
                      <span>
                        {testResult.status === 'CONNECTED'
                          ? 'Connection Successful'
                          : 'Connection Failed'}
                      </span>
                    </div>
                    <p className="text-[11px]">{testResult.detail}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <div className="flex items-center justify-between w-full">
              {selectedProvider?.maskedKey ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsConfigOpen(false);
                    setIsDeleteOpen(true);
                  }}
                  className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="size-3.5 mr-1" />
                  <span>Remove Key</span>
                </Button>
              ) : (
                <div />
              )}

              <div className="flex items-center gap-2">
                <DialogClose asChild>
                  <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="h-8 text-xs"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Key Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-destructive flex items-center gap-2">
              <AlertTriangle className="size-4" />
              <span>Remove {selectedProvider?.name} API Key?</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Removing this credential will disable any workspace models or agents relying on this key. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs">
                Cancel
              </Button>
            </DialogClose>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => selectedProvider && deleteMutation.mutate(selectedProvider.id)}
              disabled={deleteMutation.isPending}
              className="h-8 text-xs"
            >
              {deleteMutation.isPending ? 'Removing...' : 'Remove Credential'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
