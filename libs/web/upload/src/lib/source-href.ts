import type { UploadContext, UploadContextType } from '@org/types';

/**
 * App-relative path to a file's origin, or `null` when it cannot be linked
 * (a bare workspace upload, a group-DM room with no slug, a deleted source).
 *
 * One place so the Files hub and the details panel deep-link identically, and
 * no route string is hard-coded at a call site.
 */
export function uploadSourceHref(
  workspaceSlug: string | undefined,
  context: Pick<UploadContext, 'type' | 'id' | 'slug' | 'parentId'> | null,
): string | null {
  if (!workspaceSlug || !context) return null;
  const { type, id, slug, parentId } = context;
  const w = `/w/${workspaceSlug}`;

  switch (type as UploadContextType) {
    case 'CHANNEL':
      return slug ? `${w}/c/${slug}` : null;
    case 'PROJECT':
      return id ? `${w}/tasks/${id}` : null;
    case 'DIRECT':
      if (!id) return null;
      return id.startsWith('!') || id.startsWith('#')
        ? `${w}/dms?room=${encodeURIComponent(id)}`
        : `${w}/dms/${id}`;
    case 'AGENT':
      return id ? `${w}/agents/${id}/chat` : null;
    case 'APP':
      return id ? `${w}/apps/${id}/chat` : null;
    case 'DOCUMENT':
      return id ? `${w}/docs/${id}` : null;
    case 'ISSUE':
      return parentId && id
        ? `${w}/tasks/${parentId}?card=${id}`
        : parentId
          ? `${w}/tasks/${parentId}`
          : null;
    default:
      return null;
  }
}
