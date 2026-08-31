import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  CheckCircle2,
  Code2,
  Globe,
  Key,
  Play,
  ShieldCheck,
} from 'lucide-react';
import { useState } from 'react';
import type { IntegrationAuthType, IntegrationCustomApiConfig } from '@org/types';
import { useIntegrationMutations } from './use-integrations.js';

interface CustomApiModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  existingConfig?: Partial<IntegrationCustomApiConfig>;
}

export function CustomApiModal({
  workspaceId,
  isOpen,
  onClose,
  existingConfig,
}: CustomApiModalProps) {
  const [baseUrl, setBaseUrl] = useState(existingConfig?.baseUrl || '');
  const [authType, setAuthType] = useState<IntegrationAuthType>(
    existingConfig?.authType || 'BEARER',
  );
  const [bearerToken, setBearerToken] = useState(existingConfig?.bearerToken || '');
  const [apiKey, setApiKey] = useState(existingConfig?.apiKey || '');
  const [apiKeyHeader, setApiKeyHeader] = useState(
    existingConfig?.apiKeyHeader || 'X-API-Key',
  );
  const [basicUsername, setBasicUsername] = useState(
    existingConfig?.basicUsername || '',
  );
  const [basicPassword, setBasicPassword] = useState(
    existingConfig?.basicPassword || '',
  );
  const [timeoutMs] = useState(existingConfig?.timeoutMs ?? 15000);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);

  const { connect, testCustomApi } = useIntegrationMutations(workspaceId);

  const handleTest = async () => {
    if (!baseUrl.trim()) {
      toast.error('Base URL is required to test.');
      return;
    }

    try {
      const config: IntegrationCustomApiConfig = {
        baseUrl: baseUrl.trim(),
        authType,
        bearerToken: bearerToken || undefined,
        apiKey: apiKey || undefined,
        apiKeyHeader: apiKeyHeader || undefined,
        basicUsername: basicUsername || undefined,
        basicPassword: basicPassword || undefined,
        timeoutMs,
      };

      const result = await testCustomApi.mutateAsync(config as any);
      setTestResult(result);
      if (result.success) {
        toast.success('Custom API reachable!');
      } else {
        toast.error(`Test failed: ${result.message}`);
      }
    } catch (err: any) {
      toast.error(err?.message || 'Connection test failed.');
      setTestResult({
        success: false,
        message: err?.message || 'Connection failed',
      });
    }
  };

  const handleSave = async () => {
    if (!baseUrl.trim()) {
      toast.error('Base URL is required.');
      return;
    }

    try {
      const config: IntegrationCustomApiConfig = {
        baseUrl: baseUrl.trim(),
        authType,
        bearerToken: bearerToken || undefined,
        apiKey: apiKey || undefined,
        apiKeyHeader: apiKeyHeader || undefined,
        basicUsername: basicUsername || undefined,
        basicPassword: basicPassword || undefined,
        timeoutMs,
      };

      await connect.mutateAsync({
        provider: 'CUSTOM_API',
        scopeType: 'WORKSPACE',
        config: config as any,
      });

      toast.success('Custom API integration saved successfully!');
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save Custom API integration.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl p-0 flex flex-col overflow-hidden bg-background border-border">
        <DialogHeader className="px-6 py-4 border-b border-border bg-surface flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-accent-teal-soft flex items-center justify-center text-accent-teal">
              <Code2 className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Custom API Connector
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Connect external REST APIs with built-in SSRF protection & encrypted auth.
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Base URL */}
          <div>
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Globe className="size-3.5 text-muted-foreground" /> Base URL
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                setTestResult(null);
              }}
              placeholder="https://api.example.com/v1"
              className="w-full mt-1.5 px-3 py-2 text-xs rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
            />
            <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
              <ShieldCheck className="size-3 text-success" />
              Private IP ranges and internal metadata endpoints are automatically blocked.
            </p>
          </div>

          {/* Authentication Type */}
          <div>
            <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Key className="size-3.5 text-muted-foreground" /> Authentication Method
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1.5">
              {(
                [
                  { type: 'BEARER', label: 'Bearer Token' },
                  { type: 'API_KEY_HEADER', label: 'API Key (Header)' },
                  { type: 'BASIC', label: 'HTTP Basic' },
                  { type: 'NONE', label: 'No Auth' },
                ] as const
              ).map((method) => (
                <button
                  key={method.type}
                  type="button"
                  onClick={() => setAuthType(method.type)}
                  className={cn(
                    'p-2 text-xs rounded-lg border text-left transition-all',
                    authType === method.type
                      ? 'border-primary bg-primary/10 text-primary font-semibold'
                      : 'border-border bg-surface text-muted-foreground hover:text-foreground',
                  )}
                >
                  {method.label}
                </button>
              ))}
            </div>
          </div>

          {/* Auth Credentials Inputs */}
          {authType === 'BEARER' && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Bearer Token</label>
              <input
                type="password"
                value={bearerToken}
                onChange={(e) => setBearerToken(e.target.value)}
                placeholder="Bearer secret token..."
                className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              />
            </div>
          )}

          {authType === 'API_KEY_HEADER' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Header Name</label>
                <input
                  type="text"
                  value={apiKeyHeader}
                  onChange={(e) => setApiKeyHeader(e.target.value)}
                  placeholder="X-API-Key"
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">API Key Value</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Secret API key..."
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>
            </div>
          )}

          {authType === 'BASIC' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Username</label>
                <input
                  type="text"
                  value={basicUsername}
                  onChange={(e) => setBasicUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <input
                  type="password"
                  value={basicPassword}
                  onChange={(e) => setBasicPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full mt-1 px-3 py-1.5 text-xs rounded-lg border border-border bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                />
              </div>
            </div>
          )}

          {/* Test Status Output */}
          {testResult && (
            <div
              className={cn(
                'p-3.5 rounded-xl border text-xs space-y-1',
                testResult.success
                  ? 'bg-success/10 border-success/30 text-success-text'
                  : 'bg-destructive/10 border-destructive/30 text-destructive-text',
              )}
            >
              <div className="font-semibold flex items-center gap-1.5">
                {testResult.success ? (
                  <CheckCircle2 className="size-4" />
                ) : (
                  <ShieldCheck className="size-4" />
                )}
                {testResult.message}
              </div>
              {testResult.details?.durationMs && (
                <p className="text-[11px] opacity-80">
                  Response latency: {testResult.details.durationMs}ms
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-border bg-surface flex items-center justify-between">
          <Button
            size="sm"
            variant="outline"
            onClick={handleTest}
            disabled={testCustomApi.isPending || !baseUrl}
            className="h-8 text-xs gap-1.5"
          >
            <Play className={cn('size-3.5', testCustomApi.isPending && 'animate-spin')} />
            {testCustomApi.isPending ? 'Testing...' : 'Test Connection'}
          </Button>

          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose} className="h-8 text-xs">
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={connect.isPending || !baseUrl}
              className="h-8 text-xs bg-primary text-primary-foreground font-semibold"
            >
              {connect.isPending ? 'Saving...' : 'Save & Connect'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
