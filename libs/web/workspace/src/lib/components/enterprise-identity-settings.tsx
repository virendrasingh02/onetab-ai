import { useState, useEffect } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  PlanBadge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from '@org/ui';
import { enterpriseIdentityApi, queryKeys } from '@org/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Crown,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Play,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react';
import { usePlanEntitlements } from '../hooks/use-plan-entitlements.js';
import type {
  SaveSSOConfigInput,
  SSOConnectionTestResult,
  WorkspaceRole,
} from '@org/types';

export interface EnterpriseIdentitySettingsPanelProps {
  workspace: {
    id: string;
    slug: string;
    name: string;
  };
  isOwner: boolean;
  isAdmin: boolean;
}

export function EnterpriseIdentitySettingsPanel({
  workspace,
}: EnterpriseIdentitySettingsPanelProps) {
  const queryClient = useQueryClient();
  const { hasFeature } = usePlanEntitlements(workspace.id);
  const isEnterprise = hasFeature('sso_saml');

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.mie.ai';
  const spEntityId = `${origin}/api/v1/auth/sso/saml/metadata`;
  const acsUrl = `${origin}/api/v1/auth/sso/saml/acs`;
  const oidcRedirectUri = `${origin}/api/v1/auth/sso/oidc/callback`;
  const scimBaseUrl = `${origin}/api/v1/scim/v2`;

  // Main Form States
  const [providerType, setProviderType] = useState<'SAML' | 'OIDC'>('SAML');
  const [idpEntityId, setIdpEntityId] = useState('');
  const [ssoUrl, setSsoUrl] = useState('');
  const [certificate, setCertificate] = useState('');
  const [allowIdpInitiated, setAllowIdpInitiated] = useState(false);
  const [forceAuthn, setForceAuthn] = useState(false);

  const [oidcIssuer, setOidcIssuer] = useState('');
  const [oidcClientId, setOidcClientId] = useState('');
  const [oidcClientSecret, setOidcClientSecret] = useState('');
  const [showOidcSecret, setShowOidcSecret] = useState(false);
  const [oidcScopes, setOidcScopes] = useState('openid profile email');

  // Policy & Enforcement
  const [enforceSso, setEnforceSso] = useState(false);
  const [allowPasswordFallbackForAdmins, setAllowPasswordFallbackForAdmins] = useState(true);

  // SCIM State
  const [scimEnabled, setScimEnabled] = useState(false);
  const [activeTab, setActiveTab] = useState<'sso' | 'domains' | 'scim' | 'mappings' | 'guides'>('sso');

  // Dialog & Modal States
  const [newScimTokenModal, setNewScimTokenModal] = useState<string | null>(null);
  const [newRecoveryCodeModal, setNewRecoveryCodeModal] = useState<string | null>(null);
  const [newDomainInput, setNewDomainInput] = useState('');
  const [addMappingModalOpen, setAddMappingModalOpen] = useState(false);
  const [newMappingGroupName, setNewMappingGroupName] = useState('');
  const [newMappingRole, setNewMappingRole] = useState<'MEMBER' | 'ADMIN' | 'GUEST'>('MEMBER');

  // Test state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<SSOConnectionTestResult | null>(null);

  // Queries
  const { data: config } = useQuery({
    queryKey: queryKeys.workspaces.enterpriseIdentity(workspace.id),
    queryFn: () => enterpriseIdentityApi.getConfig(workspace.id),
    enabled: !!workspace.id && isEnterprise,
  });

  const {
    data: groupMappings = [],
    refetch: refetchMappings,
  } = useQuery({
    queryKey: queryKeys.workspaces.enterpriseGroupMappings(workspace.id),
    queryFn: () => enterpriseIdentityApi.listGroupRoleMappings(workspace.id),
    enabled: !!workspace.id && isEnterprise,
  });

  useEffect(() => {
    if (config) {
      setProviderType(config.providerType || 'SAML');
      setIdpEntityId(config.idpEntityId || '');
      setSsoUrl(config.ssoUrl || '');
      setCertificate(config.certificate || '');
      setAllowIdpInitiated(config.allowIdpInitiated ?? false);
      setForceAuthn(config.forceAuthn ?? false);

      setOidcIssuer(config.oidcIssuer || '');
      setOidcClientId(config.oidcClientId || '');
      setOidcScopes(Array.isArray(config.oidcScopes) ? config.oidcScopes.join(' ') : 'openid profile email');

      setEnforceSso(config.enforceSso ?? false);
      setAllowPasswordFallbackForAdmins(config.allowPasswordFallbackForAdmins ?? true);
      setScimEnabled(config.scimEnabled ?? false);
    }
  }, [config]);

  // Mutations
  const saveMutation = useMutation({
    mutationFn: () => {
      const parsedScopes = oidcScopes
        .split(' ')
        .map((s) => s.trim())
        .filter(Boolean);

      const payload: SaveSSOConfigInput = {
        providerType,
        idpEntityId: providerType === 'SAML' ? idpEntityId.trim() : undefined,
        ssoUrl: providerType === 'SAML' ? ssoUrl.trim() : undefined,
        certificate: providerType === 'SAML' ? certificate.trim() : undefined,
        allowIdpInitiated: providerType === 'SAML' ? allowIdpInitiated : undefined,
        forceAuthn: providerType === 'SAML' ? forceAuthn : undefined,

        oidcIssuer: providerType === 'OIDC' ? oidcIssuer.trim() : undefined,
        oidcClientId: providerType === 'OIDC' ? oidcClientId.trim() : undefined,
        oidcClientSecret: providerType === 'OIDC' && oidcClientSecret.trim() ? oidcClientSecret.trim() : undefined,
        oidcScopes: providerType === 'OIDC' ? parsedScopes : undefined,

        enforceSso,
        allowPasswordFallbackForAdmins,
      };
      return enterpriseIdentityApi.saveConfig(workspace.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.enterpriseIdentity(workspace.id) });
      toast.success('SSO & Provisioning configuration updated successfully.');
      setOidcClientSecret(''); // Clear out plaintext secret from state once saved
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save enterprise configuration');
    },
  });

  const testConnectionMutation = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await enterpriseIdentityApi.testConnection(workspace.id);
      setTestResult(res);
      if (res.success) {
        toast.success(`Connection Test Passed: ${res.message}`);
      } else {
        toast.error(`Connection Test Failed: ${res.message}`);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Connection failed',
        timestamp: new Date().toISOString() as any,
      });
      toast.error(err.message || 'Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const verifyDomainMutation = useMutation({
    mutationFn: (domain: string) => enterpriseIdentityApi.verifyDomain(workspace.id, domain),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.enterpriseIdentity(workspace.id) });
      if (data.verified) {
        toast.success(`Domain ${data.domain} successfully verified!`);
        setNewDomainInput('');
      } else {
        toast.error(`DNS check failed for ${data.domain}. Could not find valid TXT record matching ${data.txtRecordValue}`);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Domain verification failed');
    },
  });

  const rotateScimTokenMutation = useMutation({
    mutationFn: () => enterpriseIdentityApi.rotateScimToken(workspace.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.enterpriseIdentity(workspace.id) });
      setNewScimTokenModal(data.rawToken);
      toast.success('New SCIM 2.0 Bearer Token generated.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to rotate SCIM token');
    },
  });

  const generateRecoveryCodeMutation = useMutation({
    mutationFn: () => enterpriseIdentityApi.generateRecoveryCode(workspace.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.enterpriseIdentity(workspace.id) });
      setNewRecoveryCodeModal(data.recoveryCode);
      toast.success('Emergency break-glass recovery code generated.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to generate emergency recovery code');
    },
  });

  const saveMappingMutation = useMutation({
    mutationFn: () =>
      enterpriseIdentityApi.saveGroupRoleMapping(workspace.id, {
        groupName: newMappingGroupName.trim(),
        targetRole: newMappingRole as WorkspaceRole,
      }),
    onSuccess: () => {
      refetchMappings();
      setAddMappingModalOpen(false);
      setNewMappingGroupName('');
      toast.success('Group-to-role mapping saved.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save group role mapping');
    },
  });

  const deleteMappingMutation = useMutation({
    mutationFn: (mappingId: string) => enterpriseIdentityApi.deleteGroupRoleMapping(workspace.id, mappingId),
    onSuccess: () => {
      refetchMappings();
      toast.success('Mapping deleted.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to delete mapping');
    },
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard`);
  };

  // ----------------------------------------------------
  // Upgrade state if not entitled to SSO
  // ----------------------------------------------------
  if (!isEnterprise) {
    return (
      <Card className="border-indigo-500/20 bg-gradient-to-br from-indigo-500/5 via-card to-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Crown className="size-5 text-indigo-500" />
              <CardTitle className="text-base font-bold">Enterprise SSO & Automated SCIM Provisioning</CardTitle>
            </div>
            <PlanBadge plan="enterprise" size="sm" variant="gradient" />
          </div>
          <CardDescription className="text-xs text-muted-foreground">
            Centralize enterprise authentication, directory sync, automated role-based provisioning, and domain enforcement.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-border bg-surface-muted/50 p-4 text-xs space-y-3">
            <p className="font-semibold text-foreground">Enterprise Identity Features Include:</p>
            <ul className="space-y-2 text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-indigo-500 shrink-0" />
                <span><strong>SAML 2.0 & OpenID Connect:</strong> Pre-built integrations with Microsoft Entra ID (Azure AD), Okta, Google Workspace, and Ping Identity.</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-indigo-500 shrink-0" />
                <span><strong>SCIM 2.0 Directory Sync:</strong> Automated employee onboarding, immediate deprovisioning on departure, and role synchronization.</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-indigo-500 shrink-0" />
                <span><strong>Domain Verification & Enforced SSO:</strong> Enforce enterprise single sign-on across corporate email domains with emergency break-glass protection.</span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-3.5 text-indigo-500 shrink-0" />
                <span><strong>Security & Isolation:</strong> Cryptographic verification, tenant-isolated data, AES-256-GCM secret encryption, and audit logs.</span>
              </li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between">
          <p className="text-[11px] text-muted-foreground">Available on Enterprise and Max tier plans.</p>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              window.location.hash = '#billing';
            }}
            className="text-xs font-semibold"
          >
            Upgrade to Enterprise
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-card">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <h2 className="text-base font-bold text-foreground">Enterprise Identity & Provisioning</h2>
            <Badge variant={config?.isActive ? 'success' : 'neutral'} className="text-[10px]">
              {config?.isActive ? 'ACTIVE' : 'NOT CONFIGURED'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Configure SAML 2.0 / OIDC Single Sign-On, SCIM 2.0 automated user provisioning, and domain enforcement for {workspace.name}.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={testConnectionMutation}
            disabled={isTesting || (!ssoUrl && !oidcIssuer)}
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
            className="text-xs font-semibold"
          >
            {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Connection Test Feedback Banner */}
      {testResult && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between ${
            testResult.success
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {testResult.success ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="size-4 shrink-0 text-destructive" />
            )}
            <div>
              <div className="font-semibold">{testResult.success ? 'Identity Provider Connection OK' : 'Connection Error'}</div>
              <div className="text-[11px] opacity-90">{testResult.message}</div>
            </div>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {new Date(testResult.timestamp).toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="w-full">
        <TabsList className="grid grid-cols-5 w-full bg-surface-muted/50 p-1">
          <TabsTrigger value="sso" className="text-xs">SSO Configuration</TabsTrigger>
          <TabsTrigger value="domains" className="text-xs">Domain Verification</TabsTrigger>
          <TabsTrigger value="scim" className="text-xs">SCIM 2.0 Provisioning</TabsTrigger>
          <TabsTrigger value="mappings" className="text-xs">Role Mappings</TabsTrigger>
          <TabsTrigger value="guides" className="text-xs">Setup Guides</TabsTrigger>
        </TabsList>

        {/* ----------------- TAB 1: SSO CONFIGURATION ----------------- */}
        <TabsContent value="sso" className="space-y-6 pt-4">
          {/* Service Provider (SP) Metadata Box */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Service Provider (Mie AI) Endpoints</CardTitle>
              <CardDescription className="text-xs">
                Provide these metadata URLs to your Identity Provider (Microsoft Entra ID, Okta, Google Workspace).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">SP Entity ID / Audience URI</label>
                  <div className="flex items-center gap-1.5">
                    <Input readOnly value={spEntityId} className="text-xs font-mono h-8 bg-surface-muted/50" />
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(spEntityId, 'SP Entity ID')} className="h-8 px-2.5">
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">SAML ACS (Assertion Consumer Service) URL</label>
                  <div className="flex items-center gap-1.5">
                    <Input readOnly value={acsUrl} className="text-xs font-mono h-8 bg-surface-muted/50" />
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(acsUrl, 'ACS URL')} className="h-8 px-2.5">
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">OIDC Redirect / Callback URI</label>
                  <div className="flex items-center gap-1.5">
                    <Input readOnly value={oidcRedirectUri} className="text-xs font-mono h-8 bg-surface-muted/50" />
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(oidcRedirectUri, 'OIDC Redirect URI')} className="h-8 px-2.5">
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">SAML SP Metadata XML</label>
                  <div className="flex items-center gap-1.5">
                    <Input readOnly value={spEntityId} className="text-xs font-mono h-8 bg-surface-muted/50" />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(spEntityId, '_blank')}
                      className="h-8 px-2.5"
                    >
                      <ExternalLink className="size-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Identity Provider Setup */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Identity Provider Details</CardTitle>
                  <CardDescription className="text-xs">
                    Configure your corporate authentication protocol and credentials.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground">Protocol:</span>
                  <div className="inline-flex rounded-lg border border-border p-0.5 bg-surface-muted/50">
                    <button
                      type="button"
                      onClick={() => setProviderType('SAML')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        providerType === 'SAML'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      SAML 2.0
                    </button>
                    <button
                      type="button"
                      onClick={() => setProviderType('OIDC')}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                        providerType === 'OIDC'
                          ? 'bg-background text-foreground shadow-sm'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      OpenID Connect (OIDC)
                    </button>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {providerType === 'SAML' ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">IdP Entity ID (Issuer)</label>
                      <Input
                        value={idpEntityId}
                        onChange={(e) => setIdpEntityId(e.target.value)}
                        placeholder="https://sts.windows.net/xxxx/ or https://okta.com/xxx"
                        className="text-xs h-9 font-mono"
                      />
                      <p className="text-[11px] text-muted-foreground">The unique URI identifying your Identity Provider.</p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">IdP Single Sign-On URL (SSO Endpoint)</label>
                      <Input
                        value={ssoUrl}
                        onChange={(e) => setSsoUrl(e.target.value)}
                        placeholder="https://login.microsoftonline.com/.../saml2 or https://dev.okta.com/app/.../sso/saml"
                        className="text-xs h-9 font-mono"
                      />
                      <p className="text-[11px] text-muted-foreground">Where Mie AI redirects users to sign in with your IdP.</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">X.509 Public Certificate (PEM format)</label>
                    <Textarea
                      value={certificate}
                      onChange={(e) => setCertificate(e.target.value)}
                      placeholder="-----BEGIN CERTIFICATE-----&#10;MIID...&#10;-----END CERTIFICATE-----"
                      rows={4}
                      className="text-xs font-mono"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Public certificate used to cryptographically verify SAML response signatures and integrity.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-muted/30">
                      <div className="space-y-0.5 pr-2">
                        <div className="text-xs font-medium text-foreground">Allow IdP-Initiated SSO</div>
                        <div className="text-[10px] text-muted-foreground">Allows users to sign in directly from their IdP dashboard.</div>
                      </div>
                      <Switch checked={allowIdpInitiated} onCheckedChange={setAllowIdpInitiated} />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-muted/30">
                      <div className="space-y-0.5 pr-2">
                        <div className="text-xs font-medium text-foreground">Force Authentication</div>
                        <div className="text-[10px] text-muted-foreground">Forces the IdP to re-prompt users for credentials every session.</div>
                      </div>
                      <Switch checked={forceAuthn} onCheckedChange={setForceAuthn} />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">OpenID Connect Issuer URL</label>
                      <Input
                        value={oidcIssuer}
                        onChange={(e) => setOidcIssuer(e.target.value)}
                        placeholder="https://login.microsoftonline.com/{tenant}/v2.0 or https://{domain}.okta.com"
                        className="text-xs h-9 font-mono"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Must support OIDC Discovery at <code>/.well-known/openid-configuration</code>.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Client ID</label>
                      <Input
                        value={oidcClientId}
                        onChange={(e) => setOidcClientId(e.target.value)}
                        placeholder="OAuth 2.0 / OIDC Client ID"
                        className="text-xs h-9 font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Client Secret</label>
                      <div className="relative">
                        <Input
                          type={showOidcSecret ? 'text' : 'password'}
                          value={oidcClientSecret}
                          onChange={(e) => setOidcClientSecret(e.target.value)}
                          placeholder="••••••••••••••••"
                          className="text-xs h-9 font-mono pr-9"
                        />
                        <button
                          type="button"
                          onClick={() => setShowOidcSecret(!showOidcSecret)}
                          className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                        >
                          {showOidcSecret ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        Encrypted with AES-256-GCM. Leave blank if unchanged.
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">OIDC Scopes</label>
                      <Input
                        value={oidcScopes}
                        onChange={(e) => setOidcScopes(e.target.value)}
                        placeholder="openid profile email groups"
                        className="text-xs h-9 font-mono"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        Space-separated scopes required for identity and claims.
                      </p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* SSO Enforcement & Admin Lockout Protection */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">SSO Enforcement & Break-Glass Recovery</CardTitle>
              <CardDescription className="text-xs">
                Configure mandatory SSO policies and lockout protections for organization administrators.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-surface-muted/30">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldAlert className="size-4 text-amber-500" />
                    Enforce SSO for Verified Domains
                  </div>
                  <p className="text-[11px] text-muted-foreground max-w-lg">
                    When active, users whose email belongs to a verified domain must sign in with SSO. Regular password logins are rejected.
                  </p>
                </div>
                <Switch checked={enforceSso} onCheckedChange={setEnforceSso} />
              </div>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-surface-muted/30">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-foreground">
                    Allow Password Fallback for Workspace Admins & Owners
                  </div>
                  <p className="text-[11px] text-muted-foreground max-w-lg">
                    Recommended. Ensures administrators can still access the workspace using their existing credentials if the Identity Provider experiences an outage.
                  </p>
                </div>
                <Switch checked={allowPasswordFallbackForAdmins} onCheckedChange={setAllowPasswordFallbackForAdmins} />
              </div>

              {/* Emergency Break-Glass Key Generator */}
              <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <KeyRound className="size-4 text-amber-500" />
                    <span className="text-xs font-semibold text-foreground">Emergency Break-Glass Recovery Key</span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateRecoveryCodeMutation.mutate()}
                    disabled={generateRecoveryCodeMutation.isPending}
                    className="text-xs border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  >
                    {generateRecoveryCodeMutation.isPending ? 'Generating...' : 'Generate New Recovery Key'}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  A high-entropy one-time recovery key used to bypass SSO enforcement via <code>/auth/sso/recovery</code> in critical IdP failure scenarios.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------- TAB 2: DOMAIN VERIFICATION ----------------- */}
        <TabsContent value="domains" className="space-y-6 pt-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Corporate Email Domains</CardTitle>
              <CardDescription className="text-xs">
                Verify ownership of your email domains via DNS TXT records to enable domain-directed SSO and strict SSO enforcement.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  value={newDomainInput}
                  onChange={(e) => setNewDomainInput(e.target.value)}
                  placeholder="e.g. acme-corp.com"
                  className="text-xs h-9 max-w-sm"
                />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (!newDomainInput.trim()) {
                      toast.error('Please enter a valid domain name');
                      return;
                    }
                    verifyDomainMutation.mutate(newDomainInput.trim().toLowerCase());
                  }}
                  disabled={verifyDomainMutation.isPending}
                  className="text-xs"
                >
                  {verifyDomainMutation.isPending ? 'Checking DNS...' : 'Verify Domain'}
                </Button>
              </div>

              {/* TXT Instructions */}
              <div className="p-3.5 rounded-lg border border-border bg-surface-muted/40 text-xs space-y-1.5">
                <div className="font-semibold text-foreground flex items-center gap-1.5">
                  <Globe className="size-3.5 text-primary" />
                  DNS TXT Verification Instructions:
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Create a TXT record on your domain apex (<code>@</code>) or host:
                </p>
                <div className="flex items-center gap-2 p-2 rounded bg-surface border border-border font-mono text-[11px]">
                  <span>Record Type: <strong>TXT</strong></span>
                  <span className="text-muted-foreground">|</span>
                  <span>Value: <strong>mie-ai-verification={config?.domainVerificationToken || 'generated-per-org'}</strong></span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      copyToClipboard(`mie-ai-verification=${config?.domainVerificationToken || ''}`, 'DNS TXT Record')
                    }
                    className="ml-auto h-6 text-[10px] px-2"
                  >
                    <Copy className="size-3 mr-1" /> Copy
                  </Button>
                </div>
              </div>

              {/* Verified Domains List */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">Configured Domains</label>
                {config?.verifiedDomains && config.verifiedDomains.length > 0 ? (
                  <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                    {config.verifiedDomains.map((domain: string) => (
                      <div key={domain} className="flex items-center justify-between p-3 text-xs bg-card">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="size-4 text-emerald-500" />
                          <span className="font-medium text-foreground">{domain}</span>
                          <Badge variant="success" className="text-[10px]">VERIFIED</Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          Verified on {config.domainVerifiedAt ? new Date(config.domainVerifiedAt).toLocaleDateString() : 'Active'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground p-4 text-center border border-dashed rounded-lg">
                    No domains verified yet. Add your domain above to enable domain-matched SSO.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------- TAB 3: SCIM 2.0 PROVISIONING ----------------- */}
        <TabsContent value="scim" className="space-y-6 pt-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">SCIM 2.0 Directory Provisioning</CardTitle>
                  <CardDescription className="text-xs">
                    Automate employee lifecycle management (create, update, suspend, role assignment) directly from your IdP.
                  </CardDescription>
                </div>
                <Switch checked={scimEnabled} onCheckedChange={setScimEnabled} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">SCIM 2.0 Base URL (Tenant URL)</label>
                  <div className="flex items-center gap-1.5">
                    <Input readOnly value={scimBaseUrl} className="font-mono text-xs h-9 bg-surface-muted/50" />
                    <Button variant="outline" size="sm" onClick={() => copyToClipboard(scimBaseUrl, 'SCIM Base URL')} className="h-9 px-3">
                      <Copy className="size-3.5" />
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Paste this into your IdP's SCIM / Provisioning Tenant URL field.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">SCIM Bearer Token</label>
                  <div className="flex items-center gap-1.5">
                    <Input
                      readOnly
                      value={config?.scimTokenPrefix ? `${config.scimTokenPrefix}••••••••••••••••••••••••••••` : 'No active token'}
                      className="font-mono text-xs h-9 bg-surface-muted/50"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => rotateScimTokenMutation.mutate()}
                      disabled={rotateScimTokenMutation.isPending}
                      className="h-9 px-3 shrink-0 text-xs"
                    >
                      <RefreshCw className="size-3.5 mr-1.5" />
                      Rotate Token
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Tokens are hashed with SHA-256 at rest. Generating a new token revokes the previous token immediately.
                  </p>
                </div>
              </div>

              {/* Sync Status Box */}
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-surface-muted/30 text-xs">
                <div className="flex items-center gap-2.5">
                  <Users className="size-4 text-primary" />
                  <div>
                    <div className="font-medium text-foreground">Automated Deprovisioning Policy</div>
                    <div className="text-[11px] text-muted-foreground">
                      Users deactivated in IdP are suspended in Mie AI, revoking active sessions while preserving historical documents and audit records.
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] font-medium text-foreground">Last Sync</div>
                  <div className="text-[10px] text-muted-foreground">
                    {config?.scimLastSyncAt ? new Date(config.scimLastSyncAt).toLocaleString() : 'Never'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------- TAB 4: GROUP ROLE MAPPINGS ----------------- */}
        <TabsContent value="mappings" className="space-y-6 pt-4">
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">IdP Group to Workspace Role Mappings</CardTitle>
                  <CardDescription className="text-xs">
                    Map corporate security groups pushed through SCIM or SAML claims to Mie AI workspace roles.
                  </CardDescription>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setAddMappingModalOpen(true)}
                  className="text-xs"
                >
                  <Plus className="size-3.5 mr-1.5" />
                  Add Group Mapping
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {groupMappings.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs">IdP Group Name</TableHead>
                      <TableHead className="text-xs">Assigned Workspace Role</TableHead>
                      <TableHead className="text-xs text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groupMappings.map((mapping) => (
                      <TableRow key={mapping.id}>
                        <TableCell className="text-xs font-medium font-mono">{mapping.groupName}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={mapping.targetRole === 'ADMIN' ? 'primary' : 'neutral'} className="text-[10px]">
                            {mapping.targetRole}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteMappingMutation.mutate(mapping.id)}
                            className="h-7 px-2 text-destructive hover:bg-destructive/10 border-destructive/30"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center p-6 border border-dashed rounded-lg text-xs text-muted-foreground space-y-2">
                  <Users className="size-8 mx-auto text-muted-foreground/50" />
                  <p>No group role mappings configured.</p>
                  <p className="text-[11px]">
                    By default, provisioned users receive the <strong>MEMBER</strong> role. Add a mapping to automatically promote groups (e.g. <code>Engineers-Leads</code>) to <strong>ADMIN</strong>.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ----------------- TAB 5: SETUP GUIDES ----------------- */}
        <TabsContent value="guides" className="space-y-4 pt-4">
          <Accordion type="single" collapsible className="w-full space-y-2">
            <AccordionItem value="entra" className="border border-border rounded-xl px-4 bg-card">
              <AccordionTrigger className="text-xs font-semibold hover:no-underline">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-blue-500" />
                  Microsoft Entra ID (Azure AD) Integration Guide
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-3 pt-2">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>In Microsoft Entra admin center, navigate to <strong>Identity &gt; Applications &gt; Enterprise applications</strong>.</li>
                  <li>Click <strong>New application &gt; Create your own application</strong>. Name it &quot;Mie AI&quot; and select &quot;Integrate any other application you don&apos;t find in the gallery&quot;.</li>
                  <li>Under <strong>Single sign-on</strong>, select <strong>SAML</strong>.</li>
                  <li>In <strong>Basic SAML Configuration</strong>:
                    <ul className="list-disc pl-5 mt-1 space-y-1 font-mono text-[11px]">
                      <li>Identifier (Entity ID): <code>{spEntityId}</code></li>
                      <li>Reply URL (Assertion Consumer Service URL): <code>{acsUrl}</code></li>
                      <li>Sign on URL: <code>{origin}/auth/login</code></li>
                    </ul>
                  </li>
                  <li>In <strong>Attributes &amp; Claims</strong>, ensure <code>emailaddress</code>, <code>givenname</code>, and <code>surname</code> are present. Add group claim if using group-to-role mappings.</li>
                  <li>Download <strong>Certificate (Base64)</strong> and copy the <strong>Login URL</strong> &amp; <strong>Microsoft Entra Identifier</strong> into Mie AI.</li>
                  <li>To configure SCIM: under <strong>Provisioning</strong>, select <strong>Automatic</strong>. Paste Tenant URL: <code>{scimBaseUrl}</code> and the Secret Token generated in Mie AI.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="okta" className="border border-border rounded-xl px-4 bg-card">
              <AccordionTrigger className="text-xs font-semibold hover:no-underline">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-sky-500" />
                  Okta SAML 2.0 &amp; SCIM Setup Guide
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-3 pt-2">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>In Okta Admin Console, navigate to <strong>Applications &gt; Applications &gt; Create App Integration</strong>.</li>
                  <li>Select <strong>SAML 2.0</strong> and click Next.</li>
                  <li>In <strong>SAML Settings</strong>:
                    <ul className="list-disc pl-5 mt-1 space-y-1 font-mono text-[11px]">
                      <li>Single sign-on URL: <code>{acsUrl}</code></li>
                      <li>Audience URI (SP Entity ID): <code>{spEntityId}</code></li>
                      <li>Name ID format: <code>EmailAddress</code></li>
                    </ul>
                  </li>
                  <li>Under Attribute Statements, configure <code>email</code>: <code>user.email</code>, <code>firstName</code>: <code>user.firstName</code>, <code>lastName</code>: <code>user.lastName</code>.</li>
                  <li>Copy Okta <strong>Identity Provider Single Sign-On URL</strong>, <strong>Identity Provider Issuer</strong>, and download the <strong>X.509 Certificate</strong> into Mie AI.</li>
                  <li>For SCIM: Enable SCIM in the App integration, paste <code>{scimBaseUrl}</code> and your bearer token under <strong>Provisioning &gt; Integration</strong>.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="google" className="border border-border rounded-xl px-4 bg-card">
              <AccordionTrigger className="text-xs font-semibold hover:no-underline">
                <div className="flex items-center gap-2">
                  <div className="size-2 rounded-full bg-red-500" />
                  Google Workspace Custom SAML App Guide
                </div>
              </AccordionTrigger>
              <AccordionContent className="text-xs text-muted-foreground space-y-3 pt-2">
                <ol className="list-decimal pl-5 space-y-2">
                  <li>In Google Admin console, go to <strong>Apps &gt; Web and mobile apps</strong>.</li>
                  <li>Click <strong>Add app &gt; Add custom SAML app</strong>. Name it &quot;Mie AI&quot;.</li>
                  <li>Copy Google&apos;s <strong>SSO URL</strong>, <strong>Entity ID</strong>, and download the certificate.</li>
                  <li>In Service provider details:
                    <ul className="list-disc pl-5 mt-1 space-y-1 font-mono text-[11px]">
                      <li>ACS URL: <code>{acsUrl}</code></li>
                      <li>Entity ID: <code>{spEntityId}</code></li>
                      <li>Name ID format: <code>EMAIL</code></li>
                    </ul>
                  </li>
                  <li>Map Google attributes <code>Primary email</code> to <code>email</code>, <code>First name</code> to <code>firstName</code>, and <code>Last name</code> to <code>lastName</code>.</li>
                  <li>Grant user access to the app under <strong>User access</strong>.</li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </TabsContent>
      </Tabs>

      {/* Modal: SCIM Token Generated */}
      <Dialog open={!!newScimTokenModal} onOpenChange={() => setNewScimTokenModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <KeyRound className="size-4 text-emerald-500" />
              New SCIM 2.0 Bearer Token
            </DialogTitle>
            <DialogDescription className="text-xs">
              Copy this token now. It is hashed with SHA-256 and will never be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 bg-surface-muted border border-border rounded-lg font-mono text-xs break-all select-all">
            {newScimTokenModal}
          </div>
          <DialogFooter className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(newScimTokenModal || '', 'SCIM Bearer Token')}
              className="text-xs"
            >
              <Copy className="size-3.5 mr-1.5" /> Copy Token
            </Button>
            <Button variant="primary" size="sm" onClick={() => setNewScimTokenModal(null)} className="text-xs">
              I have saved this token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Recovery Code Generated */}
      <Dialog open={!!newRecoveryCodeModal} onOpenChange={() => setNewRecoveryCodeModal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-amber-500">
              <ShieldAlert className="size-4" />
              Emergency Break-Glass Recovery Key
            </DialogTitle>
            <DialogDescription className="text-xs">
              Store this 32-character key in your secure enterprise password vault (e.g. 1Password, Bitwarden).
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg font-mono text-sm tracking-wider text-center select-all font-bold">
            {newRecoveryCodeModal}
          </div>
          <p className="text-[11px] text-muted-foreground">
            In the event of an identity provider outage, admins can access the platform at <code>/auth/sso/recovery</code> with this key.
          </p>
          <DialogFooter className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(newRecoveryCodeModal || '', 'Recovery Key')}
              className="text-xs"
            >
              <Copy className="size-3.5 mr-1.5" /> Copy Key
            </Button>
            <Button variant="primary" size="sm" onClick={() => setNewRecoveryCodeModal(null)} className="text-xs">
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Add Group Mapping */}
      <Dialog open={addMappingModalOpen} onOpenChange={setAddMappingModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Add Group-to-Role Mapping</DialogTitle>
            <DialogDescription className="text-xs">
              Users belonging to this IdP security group will automatically receive this workspace role upon sync.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">IdP Security Group Name</label>
              <Input
                value={newMappingGroupName}
                onChange={(e) => setNewMappingGroupName(e.target.value)}
                placeholder="e.g. Mie-Engineers or Azure-Admins"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-foreground">Workspace Role</label>
              <Select value={newMappingRole} onValueChange={(val: any) => setNewMappingRole(val)}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MEMBER">Member (Standard Access)</SelectItem>
                  <SelectItem value="ADMIN">Admin (Full Workspace Management)</SelectItem>
                  <SelectItem value="GUEST">Guest (Restricted Channel Access)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddMappingModalOpen(false)} className="text-xs">
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (!newMappingGroupName.trim()) {
                  toast.error('Group name is required');
                  return;
                }
                saveMappingMutation.mutate();
              }}
              disabled={saveMappingMutation.isPending}
              className="text-xs"
            >
              {saveMappingMutation.isPending ? 'Saving...' : 'Add Mapping'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
