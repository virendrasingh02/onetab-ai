import {
  Button,
  Input,
  Label,
  Page,
  PageHeader,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { Check, Copy, Key, Save, Shield } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const PROTOCOLS = [
  { value: 'SAML', label: 'SAML 2.0 (Okta, Entra ID, Ping)' },
  { value: 'OIDC', label: 'OpenID Connect (OIDC)' },
];

export function SSOConfigView() {
  const [providerType, setProviderType] = useState('SAML');
  const [idpEntityId, setIdpEntityId] = useState(
    'https://idp.okta.com/exk123456',
  );
  const [ssoUrl, setSsoUrl] = useState(
    'https://idp.okta.com/app/onetab/sso/saml',
  );
  const [scimToken] = useState('scim_live_98a7b6c5d4e3f210');
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleCopyToken = async () => {
    await navigator.clipboard.writeText(scimToken);
    setCopied(true);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Page>
      <PageHeader
        title="Single sign-on"
        description="Configure SAML 2.0 or OIDC identity providers and automated provisioning."
        icon={<Shield />}
        accent="green"
        actions={
          <Button form="sso-form" type="submit" leadingIcon={<Save />}>
            Save settings
          </Button>
        }
      />

      <form
        id="sso-form"
        className="gap-6 md:grid-cols-2 grid grid-cols-1"
        onSubmit={(event) => event.preventDefault()}
      >
        <Panel
          title={
            <span className="gap-2 flex items-center">
              <Shield className="size-4 text-success" aria-hidden />
              Identity provider
            </span>
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
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sso-url">Single sign-on URL</Label>
              <Input
                id="sso-url"
                value={ssoUrl}
                onChange={(event) => setSsoUrl(event.target.value)}
                className="font-mono"
              />
            </div>
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
                value="https://api.onetab.ai/api/v1/enterprise/scim/v2"
                className="font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="scim-token">SCIM bearer token</Label>
              <div className="gap-2 flex items-center">
                <Input
                  id="scim-token"
                  readOnly
                  value={scimToken}
                  className="font-mono text-accent-violet"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleCopyToken}
                  aria-label="Copy SCIM bearer token"
                >
                  {copied ? <Check className="text-success" /> : <Copy />}
                </Button>
              </div>
              {/* The copy result is announced, not only shown on the icon. */}
              <p aria-live="polite" className="sr-only">
                {copied ? 'Token copied to clipboard' : ''}
              </p>
            </div>
          </div>
        </Panel>
      </form>
    </Page>
  );
}
