import { useState } from 'react';
import { Shield, Key, Save, Copy, Check } from 'lucide-react';

export function SSOConfigView() {
  const [providerType, setProviderType] = useState('SAML');
  const [idpEntityId, setIdpEntityId] = useState('https://idp.okta.com/exk123456');
  const [ssoUrl, setSsoUrl] = useState('https://idp.okta.com/app/onetab/sso/saml');
  const [scimToken] = useState('scim_live_98a7b6c5d4e3f210');
  const [copied, setCopied] = useState(false);

  const handleCopyToken = () => {
    navigator.clipboard.writeText(scimToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-400" /> Enterprise Single Sign-On (SSO) & SCIM
          </h1>
          <p className="text-sm text-slate-400">Configure SAML 2.0, OIDC identity providers, and automated user provisioning</p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm shadow">
          <Save className="w-4 h-4" /> Save SSO Settings
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* SSO Settings */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col gap-4">
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" /> Identity Provider Configuration
          </h3>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">SSO Protocol</label>
            <select
              value={providerType}
              onChange={(e) => setProviderType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white focus:outline-none"
            >
              <option value="SAML">SAML 2.0 (Okta, Azure AD, Ping)</option>
              <option value="OIDC">OpenID Connect (OIDC)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">IdP Entity ID / Issuer</label>
            <input
              type="text"
              value={idpEntityId}
              onChange={(e) => setIdpEntityId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">SSO Single Sign-On URL</label>
            <input
              type="text"
              value={ssoUrl}
              onChange={(e) => setSsoUrl(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* SCIM 2.0 Provisioning */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 flex flex-col gap-4">
          <h3 className="font-bold text-slate-100 text-sm flex items-center gap-2">
            <Key className="w-4 h-4 text-purple-400" /> SCIM 2.0 User Provisioning
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Automate user onboarding and offboarding directly from Okta, Entra ID, or JumpCloud via SCIM 2.0 endpoints.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">SCIM Base Endpoint</label>
            <input
              type="text"
              readOnly
              value="https://api.onetab.ai/api/v1/enterprise/scim/v2"
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-300 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1">SCIM Bearer Token</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={scimToken}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-purple-400 font-mono"
              />
              <button
                onClick={handleCopyToken}
                className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 transition"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
