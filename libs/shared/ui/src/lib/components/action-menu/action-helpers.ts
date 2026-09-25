import { toast } from 'sonner';

/** Absolute URL for an in-app path (`/w/acme/c/general` → `https://…/w/acme/c/general`). */
export function entityUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Clipboard write with the confirmation every "Copy …" action shows. Throws
 * when the browser refuses (insecure context, denied permission) so the action
 * runner reports the failure instead of a false "Copied".
 */
export async function copyToClipboard(text: string, what = 'Link'): Promise<void> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    throw new Error('Clipboard is not available here');
  }
  await navigator.clipboard.writeText(text);
  toast.success(`${what} copied`);
}
