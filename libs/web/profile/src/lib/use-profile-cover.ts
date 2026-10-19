import { resolveMediaUrl, userApi } from '@org/api-client';
import { useAuthStore, useCurrentUser } from '@org/auth';
import { toast } from '@org/ui';
import { useMutation } from '@tanstack/react-query';

/**
 * The signed-in user's profile cover, saved through `POST/DELETE
 * /users/me/cover` the moment it changes (not held in a form draft), so every
 * surface — settings, profile page, hover cards — shows the same banner.
 *
 * `coverSrc` is loadable by `<img>`/CSS; `cropSource` is only set for a data
 * URL, because the cropper draws onto a canvas and an API-hosted image from
 * another origin would taint it.
 */
export function useProfileCover() {
  const user = useCurrentUser();
  const setUser = useAuthStore((state) => state.setUser);

  const applyCoverUrl = (coverUrl: string | null) => {
    const current = useAuthStore.getState().user;
    if (current) setUser({ ...current, coverUrl });
  };

  const upload = useMutation({
    mutationFn: async (croppedDataUrl: string) => {
      const blob = await (await fetch(croppedDataUrl)).blob();
      return userApi.uploadCover(blob);
    },
    onSuccess: ({ coverUrl }) => {
      applyCoverUrl(coverUrl);
      toast.success('Cover updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update cover');
    },
  });

  const remove = useMutation({
    mutationFn: () => userApi.removeCover(),
    onSuccess: () => {
      applyCoverUrl(null);
      toast.success('Cover removed');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to remove cover');
    },
  });

  const coverUrl = user?.coverUrl ?? null;

  return {
    coverUrl,
    coverSrc: resolveMediaUrl(coverUrl) ?? null,
    cropSource: coverUrl?.startsWith('data:') ? coverUrl : null,
    // Failures are already toasted above.
    uploadCover: (croppedDataUrl: string) =>
      upload.mutateAsync(croppedDataUrl).catch(() => undefined),
    removeCover: () => remove.mutateAsync().catch(() => undefined),
    isSaving: upload.isPending || remove.isPending,
  };
}
