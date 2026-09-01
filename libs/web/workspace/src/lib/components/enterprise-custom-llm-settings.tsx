import { useState, useEffect } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Input,
  PlanBadge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  toast,
} from '@org/ui';
import { billingApi, queryKeys } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Cpu,
  Crown,
  Eye,
  EyeOff,
  Play,
  RefreshCw,
} from 'lucide-react';
import { usePlanEntitlements } from '../hooks/use-plan-entitlements.js';

export interface EnterpriseCustomLLMSettingsProps {
  workspaceId: string;
}

export function EnterpriseCustomLLMSettings({ workspaceId }: EnterpriseCustomLLMSettingsProps) {
  const queryClient = useQueryClient();
  const { hasFeature } = usePlanEntitlements(workspaceId);
  const isEnterprise = hasFeature('custom_llm');

  const [provider, setProvider] = useState<'custom' | 'azure_openai' | 'vllm' | 'ollama_remote' | 'openai_compatible'>('custom');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [modelIdentifier, setModelIdentifier] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [temperature, setTemperature] = useState<number>(0.7);
  const [maxTokens, setMaxTokens] = useState<number>(4096);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [isPrivateNetwork, setIsPrivateNetwork] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);

  // Test state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    message: string;
    error?: string;
  } | null>(null);

  const { data: config } = useQuery({
    queryKey: queryKeys.billing.customLLM(workspaceId),
    queryFn: () => billingApi.getCustomLLM(workspaceId),
    enabled: !!workspaceId && isEnterprise,
  });

  useEffect(() => {
    if (config) {
      setProvider(config.provider || 'custom');
      setEndpointUrl(config.endpointUrl || '');
      setModelIdentifier(config.modelIdentifier || '');
      setTemperature(config.temperature ?? 0.7);
      setMaxTokens(config.maxTokens ?? 4096);
      setSystemPrompt(config.systemPrompt || '');
      setIsPrivateNetwork(config.isPrivateNetwork ?? false);
      setIsEnabled(config.isEnabled ?? true);
    }
  }, [config]);

  const saveMutation = useMutation({
    mutationFn: () =>
      billingApi.saveCustomLLM(workspaceId, {
        provider,
        endpointUrl,
        modelIdentifier,
        apiKey: apiKey.trim() || undefined,
        temperature,
        maxTokens,
        systemPrompt,
        isPrivateNetwork,
        isEnabled,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.billing.customLLM(workspaceId) });
      toast.success('Custom LLM Configuration Saved: Enterprise model settings and credentials updated.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to Save Configuration');
    },
  });

  const handleTestConnection = async () => {
    if (!endpointUrl || !modelIdentifier) {
      toast.error('Missing Required Fields: Please enter both an Endpoint URL and a Model Identifier.');
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await billingApi.testCustomLLM(workspaceId, {
        endpointUrl,
        modelIdentifier,
        apiKey: apiKey.trim() || undefined,
        provider,
      });
      setTestResult(res);
      if (res.success) {
        toast.success(`Connection Successful: Endpoint verified in ${res.latencyMs}ms.`);
      } else {
        toast.error(res.error || res.message || 'Connection test failed');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        latencyMs: 0,
        message: err.message || 'Connection failed',
        error: err.message,
      });
    } finally {
      setIsTesting(false);
    }
  };

  if (!isEnterprise) {
    return (
      <Card className="border-amber-500/20 bg-gradient-to-br from-amber-500/5 via-card to-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="size-5 text-amber-500" />
              <CardTitle className="text-base font-bold">Enterprise Custom LLM Integration</CardTitle>
            </div>
            <PlanBadge plan="enterprise" size="sm" variant="gradient" />
          </div>
          <CardDescription className="text-xs">
            Connect private self-hosted models, vLLM clusters, Azure OpenAI, or custom private VPC inference endpoints.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-muted/50 p-4 text-xs space-y-2">
            <p className="font-medium text-foreground">Custom LLM Capabilities Include:</p>
            <ul className="space-y-1.5 text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-amber-500" />
                <span>Zero-retention private inference through your own endpoints</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-amber-500" />
                <span>Support for custom fine-tuned weights, vLLM, Ollama, and Azure OpenAI</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-amber-500" />
                <span>Encrypted credential storage with server-side proxy isolation</span>
              </li>
            </ul>
          </div>
        </CardContent>
        <CardFooter>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              window.location.hash = '#billing';
            }}
            className="text-xs"
          >
            Upgrade to Enterprise
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Cpu className="size-5 text-primary" />
            <h3 className="text-base font-bold text-foreground">Enterprise Custom LLM Provider</h3>
          </div>
          <PlanBadge plan="enterprise" size="sm" variant="gradient" />
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Configure a dedicated private model endpoint for this workspace. All AI chats and automations will route through your private infrastructure.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Provider Type */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Provider Protocol</label>
          <Select value={provider} onValueChange={(val: any) => setProvider(val)}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="custom" className="text-xs">OpenAI Compatible (Generic / vLLM / LocalAI)</SelectItem>
              <SelectItem value="vllm" className="text-xs">vLLM Inference Server</SelectItem>
              <SelectItem value="azure_openai" className="text-xs">Azure OpenAI Service</SelectItem>
              <SelectItem value="ollama_remote" className="text-xs">Ollama Remote Host</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Endpoint URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Inference Endpoint Base URL</label>
          <Input
            value={endpointUrl}
            onChange={(e) => setEndpointUrl(e.target.value)}
            placeholder="https://vllm.internal.yourorg.com/v1"
            className="text-xs h-9"
          />
        </div>

        {/* Model Identifier */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Model Identifier</label>
          <Input
            value={modelIdentifier}
            onChange={(e) => setModelIdentifier(e.target.value)}
            placeholder="e.g. meta-llama/Llama-3.3-70B-Instruct"
            className="text-xs h-9"
          />
        </div>

        {/* API Key */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">
            API Secret / Bearer Token {config?.hasApiKey ? '(Key configured)' : ''}
          </label>
          <div className="relative">
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.maskedApiKey || 'Enter API Key if required'}
              className="text-xs h-9 pr-8"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
            </button>
          </div>
        </div>

        {/* Temperature */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Default Temperature ({temperature})</label>
          <Input
            type="number"
            step="0.1"
            min="0"
            max="2"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.7)}
            className="text-xs h-9"
          />
        </div>

        {/* Max Tokens */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-foreground">Max Generation Tokens</label>
          <Input
            type="number"
            step="512"
            min="256"
            max="131072"
            value={maxTokens}
            onChange={(e) => setMaxTokens(parseInt(e.target.value, 10) || 4096)}
            className="text-xs h-9"
          />
        </div>
      </div>

      {/* System Prompt Override */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-foreground">Organization System Prompt / Guardrail (Optional)</label>
        <Input
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are an enterprise AI assistant tuned for internal enterprise documentation and operations."
          className="text-xs h-9"
        />
      </div>

      {/* Toggles */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-surface-muted/30">
        <div className="space-y-0.5">
          <div className="text-xs font-semibold text-foreground">Enable Custom LLM Routing</div>
          <p className="text-[11px] text-muted-foreground">
            When enabled, workspace requests will prioritize this custom endpoint.
          </p>
        </div>
        <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
      </div>

      {/* Connection Test Box */}
      {testResult ? (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            testResult.success
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-destructive" />
            )}
            <span>{testResult.message}</span>
          </div>
          {testResult.latencyMs > 0 ? (
            <Badge variant="neutral" className="text-[10px]">
              {testResult.latencyMs}ms
            </Badge>
          ) : null}
        </div>
      ) : null}

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-border">
        <Button
          variant="outline"
          size="sm"
          onClick={handleTestConnection}
          disabled={isTesting}
          className="text-xs"
        >
          {isTesting ? (
            <>
              <RefreshCw className="size-3.5 mr-1.5 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Play className="size-3.5 mr-1.5 fill-current" />
              Test Connection
            </>
          )}
        </Button>

        <Button
          variant="primary"
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="text-xs font-semibold px-4"
        >
          {saveMutation.isPending ? 'Saving...' : 'Save Configuration'}
        </Button>
      </div>
    </div>
  );
}
