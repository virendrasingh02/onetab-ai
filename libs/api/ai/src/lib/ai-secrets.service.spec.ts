import { describe, expect, it, vi } from 'vitest';
import { AISecretsService } from './ai-secrets.service.js';

function build(stored: Record<string, string>) {
  const prisma = {
    aISecret: {
      findUnique: vi.fn(async ({ where }: { where: { workspaceId_key: { key: string } } }) => {
        const value = stored[where.workspaceId_key.key];
        return value === undefined ? null : { encryptedValue: value };
      }),
    },
  };
  const encryption = { decrypt: (v: string) => `dec(${v})` };
  return new AISecretsService(prisma as never, encryption as never);
}

describe('AISecretsService.resolveSecretRefs', () => {
  it('fills references case-insensitively and leaves other braces alone', async () => {
    const service = build({ API_KEY: 'x' });
    await expect(service.resolveSecretRefs('ws', 'Bearer {{ secrets.api_key }} {{input}}')).resolves.toBe(
      'Bearer dec(x) {{input}}',
    );
  });

  it('returns text without references untouched', async () => {
    await expect(build({}).resolveSecretRefs('ws', 'plain')).resolves.toBe('plain');
  });

  it('throws on an unknown secret instead of sending an empty credential', async () => {
    await expect(build({}).resolveSecretRefs('ws', '{{secrets.MISSING}}')).rejects.toThrow(/MISSING/);
  });
});
