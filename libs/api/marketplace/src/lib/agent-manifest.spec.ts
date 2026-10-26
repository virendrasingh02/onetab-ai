import { describe, expect, it } from 'vitest';
import {
  canUseInstall,
  compareSemver,
  evaluateAgentPackage,
  newPermissions,
  parseAccess,
  validateConfig,
  validateExternalUrl,
} from './agent-manifest';

const blueprint = {
  name: 'Helper',
  systemPrompt: 'You help.',
  provider: 'ollama',
  model: 'llama3',
  tools: ['search_docs'],
};

const pkg = (manifest: object = {}, bp: object = blueprint) =>
  evaluateAgentPackage(JSON.stringify(manifest), JSON.stringify({ blueprint: bp }));

describe('evaluateAgentPackage', () => {
  it('accepts a minimal package and derives a non-sensitive permission set', () => {
    const result = pkg({ capabilities: ['search_docs'] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.permissions.some((p) => p.sensitive)).toBe(false);
    expect(result.permissions.map((p) => p.id)).toContain('tool:search_docs');
  });

  it('marks destructive / outbound tools, external services, connectors and code nodes as sensitive', () => {
    const result = pkg(
      {
        capabilities: ['delete_task', 'http_request'],
        security: { externalServices: ['https://api.example.com/v1'] },
        dependencies: { connectors: ['github'] },
      },
      { ...blueprint, graphJson: JSON.stringify({ nodes: [{ type: 'code' }, { type: 'agent' }] }) },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const sensitive = result.permissions.filter((p) => p.sensitive).map((p) => p.id);
    expect(sensitive).toEqual(
      expect.arrayContaining(['tool:delete_task', 'tool:http_request', 'network:api.example.com', 'connector:github', 'code:graph-nodes']),
    );
  });

  it('rejects an invalid manifest with typed issues', () => {
    const result = pkg({ configSchema: [{ key: '9bad', label: 'x', type: 'text' }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].code).toBe('INVALID_MANIFEST');
  });

  it('rejects a blueprint with no model or an oversized prompt', () => {
    expect(pkg({}, { ...blueprint, model: '' }).ok).toBe(false);
    expect(pkg({}, { ...blueprint, systemPrompt: 'x'.repeat(60_000) }).ok).toBe(false);
  });

  it('rejects unsafe tool ids, malformed graphs and duplicate config keys', () => {
    expect(pkg({ capabilities: ['../../etc/passwd'] }).ok).toBe(false);
    expect(pkg({}, { ...blueprint, graphJson: '{not json' }).ok).toBe(false);
    const dup = pkg({
      configSchema: [
        { key: 'a', label: 'A', type: 'text' },
        { key: 'a', label: 'B', type: 'text' },
      ],
    });
    expect(dup.ok).toBe(false);
  });

  it('flags a package that needs a newer platform as INCOMPATIBLE', () => {
    const result = pkg({ minPlatformVersion: '9.0.0' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0].code).toBe('INCOMPATIBLE');
  });

  it('rejects SSRF-prone external service URLs', () => {
    for (const url of ['http://api.example.com', 'https://localhost/x', 'https://169.254.169.254/latest', 'https://10.0.0.5', 'https://user:pw@example.com']) {
      const result = pkg({ security: { externalServices: [url] } });
      expect(result.ok, url).toBe(false);
    }
  });

  it('treats unparseable manifest JSON as an empty manifest rather than crashing', () => {
    expect(evaluateAgentPackage('{oops', '{}').ok).toBe(true);
  });
});

describe('validateExternalUrl', () => {
  it('accepts public https hosts only', () => {
    expect(validateExternalUrl('https://api.example.com')).toBeNull();
    expect(validateExternalUrl('https://[::1]/')).not.toBeNull();
    expect(validateExternalUrl('https://intranet')).not.toBeNull();
    expect(validateExternalUrl('not a url')).not.toBeNull();
  });
});

describe('validateConfig', () => {
  const fields = [
    { key: 'apiKey', label: 'API key', type: 'secret' as const, required: true },
    { key: 'region', label: 'Region', type: 'select' as const, required: false, options: ['eu', 'us'] },
    { key: 'endpoint', label: 'Endpoint', type: 'url' as const, required: false },
  ];

  it('separates secrets from plain values', () => {
    const r = validateConfig(fields, { apiKey: 's3cret', region: 'eu' });
    expect(r.errors).toEqual({});
    expect(r.secrets).toEqual({ apiKey: 's3cret' });
    expect(r.plain).toEqual({ region: 'eu' });
  });

  it('reports missing required, unknown, bad select and unsafe url values', () => {
    const r = validateConfig(fields, { region: 'mars', endpoint: 'http://x.com', extra: 1 });
    expect(Object.keys(r.errors).sort()).toEqual(['apiKey', 'endpoint', 'extra', 'region']);
  });
});

describe('versions and permissions', () => {
  it('compares semver', () => {
    expect(compareSemver('1.2.0', '1.10.0')).toBe(-1);
    expect(compareSemver('2.0.0', '2.0.0')).toBe(0);
    expect(compareSemver('3.0.0', '2.9.9')).toBe(1);
  });

  it('diffs newly requested permissions against what was granted', () => {
    const next = [
      { id: 'tool:a', kind: 'tool' as const, label: '', description: '', sensitive: false },
      { id: 'tool:b', kind: 'tool' as const, label: '', description: '', sensitive: true },
    ];
    expect(newPermissions(['tool:a'], next).map((p) => p.id)).toEqual(['tool:b']);
  });
});

describe('install access', () => {
  it('defaults to everyone and honours restricted lists and roles', () => {
    expect(canUseInstall(parseAccess(undefined), { id: 'u1' })).toBe(true);
    const restricted = parseAccess(JSON.stringify({ mode: 'RESTRICTED', userIds: ['u1'], roles: ['ADMIN'] }));
    expect(canUseInstall(restricted, { id: 'u1' })).toBe(true);
    expect(canUseInstall(restricted, { id: 'u2' })).toBe(false);
    expect(canUseInstall(restricted, { id: 'u3', role: 'ADMIN' })).toBe(true);
    expect(canUseInstall(restricted, { id: 'u4', isManager: true })).toBe(true);
  });
});
