import { http } from '@org/api-client';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Page,
  PageHeader,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@org/ui';
import { Building2, Check, Copy, Key, RefreshCw, Save, Shield } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  useOrganization,
  useOrganizations,
  useSSOMutations,
} from './use-enterprise.js';

const PROTOCOLS = [
  { value: 'SAML', label: 'SAML 2.0 (Okta, Entra ID, Ping)' },
  { value: 'OIDC', label: 'OpenID Connect (OIDC)' },
];

/**
 * Where the IdP posts SCIM requests.
 *
 * Read off the axios instance rather than hard-coded, so the value the operator
 * pastes into Okta is the API this console is actually talking to — the old
 * screen displayed `https://api.onetab.ai/...` on every deployment.
 */
function scimBaseEndpoint(): string {
  const base = (
    http.defaults.baseURL ?? `${window.location.origin}/api/v1`
  ).replace(/\/$/, '');
  return `${base}/enterprise/scim/v2`;
}

export function SSOConfigView() {
  const organizations = useOrganizations();
  const [organizationId, setOrganizationId] = useState<string>();

  // Default to the first organisation once the list arrives.
  const rows = organizations.data ?? [];
  const activeId = organizationId ?? rows[0]?.id;

  if (organizations.isLoading) {
    return (
      <Page>
        <LoadingState label="Loading organisations…" />
      </Page>
    );
  }

  if (organizations.isError) {
    return (
      <Page>
        <ErrorState
          title="Could not load organisations"
          description="The enterprise directory is unavailable. Check that the API is reachable and that this account is a platform operator."
        />
      </Page>
    );
  }

  if (rows.length === 0) {
    return (
      <Page>
        <PageHeader
          title="Single sign-on"
          description="Configure SAML 2.0 or OIDC identity providers and automated provisioning."
          icon={<Shield />}
          accent="green"
        />
        <Panel>
          <EmptyState
            icon={<Building2 />}
            title="No organisations"
            description="Single sign-on is configured per organisation. Create one through the enterprise API before binding an identity provider."
          />
        </Panel>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        title="Single sign-on"
        description="Configure SAML 2.0 or OIDC identity providers and automated provisioning."
        icon={<Shield />}
        accent="green"
        actions={
          <Select value={activeId} onValueChange={setOrganizationId}>
            <SelectTrigger className="w-64" aria-label="Organisation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {rows.map((organization) => (
                <SelectItem key={organization.id} value={organization.id}>
                  {organization.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {/*
        Keyed by organisation so switching tenants remounts the form: the inputs
        seed from the loaded config, and a shared instance would keep showing the
        previous organisation's issuer until it was edited.
      */}
      <SSOForm key={activeId} organizationId={activeId as string} />
    </Page>
  );
}

function SSOForm({ organizationId }: { organizationId: string }) {
  const query = useOrganization(organizationId);
  const { save, rotateScimToken } = useSSOMutations(organizationId);

  const config = query.data?.ssoConfigs[0];

  const [providerType, setProviderType] = useState('SAML');
  const [idpEntityId, setIdpEntityId] = useState('');
  const [ssoUrl, setSsoUrl] = useState('');
  const [certificate, setCertificate] = useState('');
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  /*
   * Seeds the form from the server exactly once per loaded config. Binding the
   * inputs straight to `config` would make them read-only in practice, and
   * re-seeding on every render of a refetch would discard whatever the operator
   * had half-typed.
   */
  const seededFor = useRef<string | null>(null);
  useEffect(() => {
    if (!config || seededFor.current === config.id) return;
    seededFor.current = config.id;
    setProviderType(config.providerType);
    setIdpEntityId(config.idpEntityId ?? '');
    setSsoUrl(config.ssoUrl ?? '');
    setCertificate(config.certificate ?? '');
  }, [config]);

  const copyToken = async () => {
    if (!config?.scimToken) return;
    await navigator.clipboard.writeText(config.scimToken);
    setCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  if (query.isLoading) return <LoadingState label="Loading configuration…" />;

  if (query.isError) {
    return (
      <ErrorState
        title="Could not load this organisation"
        description="Its identity configuration is unavailable."
      />
    );
  }

  return (
    <form
      id="sso-form"
      className="gap-6 md:grid-cols-2 grid grid-cols-1"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate({
          providerType,
          idpEntityId: idpEntityId.trim() || undefined,
          ssoUrl: ssoUrl.trim() || undefined,
          certificate: certificate.trim() || undefined,
        });
      }}
    >
      <Panel
        title={
          <span className="gap-2 flex items-center">
            <Shield className="size-4 text-success" aria-hidden />
            Identity provider
          </span>
        }
        actions={
          <Button type="submit" size="sm" leadingIcon={<Save />} disabled={save.isPending}>
            {save.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        }
      >
        <div className="gap-4 flex flex-col">
          <div className="space-y-1.5">
            <Label htmlFor="sso-protocol">Protocol</Label>
            <Select value={providerType} onValueChange={setProviderType}>
              <SelectTrigger id="sso-protocol" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROTOCOLS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sso-issuer">IdP entity ID / issuer</Label>
            <Input
              id="sso-issuer"
              value={idpEntityId}
              onChange={(event) => setIdpEntityId(event.target.value)}
              placeholder="https://idp.example.com/exk123456"
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sso-url">Single sign-on URL</Label>
            <Input
              id="sso-url"
              value={ssoUrl}
              onChange={(event) => setSsoUrl(event.target.value)}
              placeholder="https://idp.example.com/app/onetab/sso/saml"
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sso-certificate">Signing certificate</Label>
            <Textarea
              id="sso-certificate"
              value={certificate}
              onChange={(event) => setCertificate(event.target.value)}
              placeholder="-----BEGIN CERTIFICATE-----"
              rows={5}
              className="font-mono text-xs"
            />
          </div>

          {save.isError ? (
            <p role="alert" className="text-xs text-destructive">
              The configuration could not be saved.
            </p>
          ) : null}
          {save.isSuccess ? (
            <p aria-live="polite" className="text-xs text-success">
              Configuration saved.
            </p>
          ) : null}
        </div>
      </Panel>

      <Panel
        title={
          <span className="gap-2 flex items-center">
            <Key className="size-4 text-accent-violet" aria-hidden />
            SCIM 2.0 provisioning
          </span>
        }
      >
        <div className="gap-4 flex flex-col">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Automate user onboarding and offboarding directly from Okta, Entra
            ID or JumpCloud via SCIM 2.0 endpoints.
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="scim-endpoint">SCIM base endpoint</Label>
            <Input
              id="scim-endpoint"
              readOnly
              value={scimBaseEndpoint()}
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scim-token">SCIM bearer token</Label>
            {config?.scimToken ? (
              <div className="gap-2 flex items-center">
                <Input
                  id="scim-token"
                  readOnly
                  value={config.scimToken}
                  className="font-mono text-accent-violet"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => void copyToken()}
                  aria-label="Copy SCIM bearer token"
                >
                  {copied ? <Check className="text-success" /> : <Copy />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => rotateScimToken.mutate()}
                  disabled={rotateScimToken.isPending}
                  aria-label="Rotate SCIM bearer token"
                >
                  <RefreshCw />
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                A token is issued when this organisation's identity provider is
                first saved.
              </p>
            )}
            {/* The copy result is announced, not only shown on the icon. */}
            <p aria-live="polite" className="sr-only">
              {copied ? 'Token copied to clipboard' : ''}
            </p>
          </div>
        </div>
      </Panel>
    </form>
  );
}
