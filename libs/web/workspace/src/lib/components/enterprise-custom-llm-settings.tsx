import { useState, useEffect } from 'react';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  Input,
  PlanBadge,
  SettingsCard,
  SettingsRow,
  SettingsSectionHeader,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  toast,
  Field,
} from '@org/ui';
import { billingApi, queryKeys } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Eye,
  EyeOff,
  Play,
  RefreshCw,
} from 'lucide-react';
import { usePlanEntitlements } from '../hooks/use-plan-entitlements.js';

export interface EnterpriseCustomLLMSettingsProps {
  workspaceId: string;
}

export function EnterpriseCustomLLMSettings({
  workspaceId,
}: EnterpriseCustomLLMSettingsProps) {
  const queryClient = useQueryClient();
  const { hasFeature } = usePlanEntitlements(workspaceId);
  const isEnterprise = hasFeature('custom_llm');

  const [provider, setProvider] = useState<
    'custom' | 'azure_openai' | 'vllm' | 'ollama_remote' | 'openai_compatible'
  >('custom');
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
      queryClient.invalidateQueries({
        queryKey: queryKeys.billing.customLLM(workspaceId),
      });
      toast.success(
        'Custom LLM Configuration Saved: Enterprise model settings and credentials updated.',
      );
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to Save Configuration');
    },
  });

  const handleTestConnection = async () => {
    if (!endpointUrl || !modelIdentifier) {
      toast.error(
        'Missing Required Fields: Please enter both an Endpoint URL and a Model Identifier.',
      );
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
        toast.success(
          `Connection Successful: Endpoint verified in ${res.latencyMs}ms.`,
        );
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
      <div className="space-y-8">
        <SettingsSectionHeader
          title="Enterprise Custom LLM Provider"
          badge={<PlanBadge plan="enterprise" size="sm" variant="gradient" />}
          description="Connect private self-hosted models, vLLM clusters, Azure OpenAI, or custom private VPC inference endpoints."
        />
        <Card className="rounded-xl border-warning/20 bg-gradient-to-br from-warning/5 via-card to-card">
          <CardContent className="pt-5 space-y-4">
            <div className="p-4 text-xs space-y-2 rounded-xl border border-border bg-surface-muted/50">
              <p className="font-medium text-foreground">
                Custom LLM Capabilities Include:
              </p>
              <ul className="space-y-1.5 text-muted-foreground">
                <li className="gap-2 flex items-center">
                  <Check className="size-3.5 text-warning-text" />
                  <span>
                    Zero-retention private inference through your own endpoints
                  </span>
                </li>
                <li className="gap-2 flex items-center">
                  <Check className="size-3.5 text-warning-text" />
                  <span>
                    Support for custom fine-tuned weights, vLLM, Ollama, and
                    Azure OpenAI
                  </span>
                </li>
                <li className="gap-2 flex items-center">
                  <Check className="size-3.5 text-warning-text" />
                  <span>
                    Encrypted credential storage with server-side proxy
                    isolation
                  </span>
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
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <SettingsSectionHeader
        title="Enterprise Custom LLM Provider"
        badge={<PlanBadge plan="enterprise" size="sm" variant="gradient" />}
        description="Configure a dedicated private model endpoint for this workspace. All AI chats and automations will route through your private infrastructure."
      />

      <SettingsCard>
        <div className="md:grid-cols-2 gap-4 grid grid-cols-1">
          {/* Provider Type */}
          <Field label="Provider Protocol" htmlFor="custom-llm-provider">
            <Select
              value={provider}
              onValueChange={(val: any) => setProvider(val)}
            >
              <SelectTrigger id="custom-llm-provider" className="w-full">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom" className="text-xs">
                  OpenAI Compatible (Generic / vLLM / LocalAI)
                </SelectItem>
                <SelectItem value="vllm" className="text-xs">
                  vLLM Inference Server
                </SelectItem>
                <SelectItem value="azure_openai" className="text-xs">
                  Azure OpenAI Service
                </SelectItem>
                <SelectItem value="ollama_remote" className="text-xs">
                  Ollama Remote Host
                </SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {/* Endpoint URL */}
          <Field label="Inference Endpoint Base URL">
            <Input
              value={endpointUrl}
              onChange={(e) => setEndpointUrl(e.target.value)}
              placeholder="https://vllm.internal.yourorg.com/v1"
            />
          </Field>

          {/* Model Identifier */}
          <Field label="Model Identifier">
            <Input
              value={modelIdentifier}
              onChange={(e) => setModelIdentifier(e.target.value)}
              placeholder="e.g. meta-llama/Llama-3.3-70B-Instruct"
            />
          </Field>

          {/* API Key */}
          <Field
            label="API Secret / Bearer Token"
            labelAside={
              config?.hasApiKey ? (
                <span className="text-meta text-success-text">
                  Key configured
                </span>
              ) : null
            }
          >
            <Input
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={config?.maskedApiKey || 'Enter API Key if required'}
              trailingSlot={
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
                  className="flex items-center text-subtle transition-colors hover:text-foreground"
                >
                  {showApiKey ? (
                    <EyeOff className="size-3.5" />
                  ) : (
                    <Eye className="size-3.5" />
                  )}
                </button>
              }
            />
          </Field>

          {/* Temperature */}
          <Field label={<>Default Temperature ({temperature})</>}>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="2"
              value={temperature}
              onChange={(e) =>
                setTemperature(parseFloat(e.target.value) || 0.7)
              }
            />
          </Field>

          {/* Max Tokens */}
          <Field label="Max Generation Tokens">
            <Input
              type="number"
              step="512"
              min="256"
              max="131072"
              value={maxTokens}
              onChange={(e) =>
                setMaxTokens(parseInt(e.target.value, 10) || 4096)
              }
            />
          </Field>
        </div>

        {/* System Prompt Override */}
        <Field label="Organization System Prompt / Guardrail" optional>
          <Input
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are an enterprise AI assistant tuned for internal enterprise documentation and operations."
          />
        </Field>

        {/* Toggles */}
        <SettingsCard divided className="shadow-none">
          <SettingsRow
            title="Enable Custom LLM Routing"
            description="When enabled, workspace requests will prioritize this custom endpoint."
          >
            <Switch
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
              aria-label="Enable Custom LLM Routing"
            />
          </SettingsRow>
        </SettingsCard>

        {/* Connection Test Box */}
        {testResult ? (
          <div
            className={`p-3.5 text-xs flex items-center justify-between rounded-xl border ${
              testResult.success
                ? 'border-success/30 bg-success/10 text-success-text'
                : 'border-destructive/30 bg-destructive/10 text-destructive'
            }`}
          >
            <div className="gap-2 flex items-center">
              {testResult.success ? (
                <CheckCircle2 className="size-4 shrink-0 text-success-text" />
              ) : (
                <AlertCircle className="size-4 shrink-0 text-destructive" />
              )}
              <span>{testResult.message}</span>
            </div>
            {testResult.latencyMs > 0 ? (
              <Badge variant="neutral" className="text-2xs">
                {testResult.latencyMs}ms
              </Badge>
            ) : null}
          </div>
        ) : null}

        {/* Action Footer */}
        <div className="gap-3 pt-2 flex items-center justify-between border-t border-border">
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
      </SettingsCard>
    </div>
  );
}
