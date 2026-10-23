/**
 * Where the public Terms, Privacy, Docs and Support pages live. They are hosted
 * outside this app, so each comes from a `VITE_*` var in `apps/web/.env.local`;
 * a link that is not configured is not rendered (no dead `#terms` anchors).
 */
export interface LegalLinks {
  terms?: string;
  privacy?: string;
  docs?: string;
  support?: string;
}

function readEnv(name: string): string | undefined {
  try {
    // `import.meta.env` is Vite-only; read it structurally so Node type-checks pass.
    const env = (import.meta as unknown as { env?: Record<string, unknown> }).env;
    const value = env?.[name];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
  } catch {
    return undefined;
  }
}

export const LEGAL_LINKS: LegalLinks = {
  terms: readEnv('VITE_TERMS_URL'),
  privacy: readEnv('VITE_PRIVACY_URL'),
  docs: readEnv('VITE_DOCS_URL'),
  support: readEnv('VITE_SUPPORT_URL'),
};
