import Constants from 'expo-constants';

interface Extra {
  variant?: string;
  apiUrl?: string;
  webUrl?: string;
  eas?: { projectId?: string };
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

/** Public build-time configuration, from app.config.ts `extra`. */
export const appConfig = {
  variant: extra.variant ?? 'development',
  apiUrl: extra.apiUrl ?? 'http://localhost:3000/api/v1',
  webUrl: (extra.webUrl ?? 'http://localhost:4200').replace(/\/+$/, ''),
  easProjectId: extra.eas?.projectId ?? Constants.easConfig?.projectId ?? null,
};

/** A link into the web app for the areas that stay web-only (checkout, OAuth connects). */
export function webLink(
  workspaceSlug: string | null | undefined,
  path = '',
): string {
  const base = workspaceSlug
    ? `${appConfig.webUrl}/w/${workspaceSlug}`
    : appConfig.webUrl;
  return path ? `${base}/${path.replace(/^\/+/, '')}` : base;
}
