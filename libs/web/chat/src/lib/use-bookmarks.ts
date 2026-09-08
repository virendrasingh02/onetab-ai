import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookmarksApi, queryKeys } from '@org/api-client';
import type { BookmarkDto, CreateBookmarkInput } from '@org/types';

export function useBookmarks(
  workspaceId: string | undefined,
  targetType?: string,
) {
  return useQuery<BookmarkDto[]>({
    queryKey: workspaceId
      ? queryKeys.bookmarks.list(workspaceId, targetType)
      : ['bookmarks', 'none'],
    queryFn: () =>
      workspaceId
        ? bookmarksApi.list(workspaceId, targetType)
        : Promise.resolve([]),
    enabled: Boolean(workspaceId),
  });
}

export function useBookmarkMutations(workspaceId: string | undefined) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    if (workspaceId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.bookmarks.all(workspaceId),
      });
    }
  };

  const addBookmarkMutation = useMutation({
    mutationFn: (input: CreateBookmarkInput) => {
      if (!workspaceId) throw new Error('Workspace required');
      return bookmarksApi.create(workspaceId, input);
    },
    onSuccess: invalidate,
  });

  const removeBookmarkMutation = useMutation({
    mutationFn: (bookmarkId: string) => {
      if (!workspaceId) throw new Error('Workspace required');
      return bookmarksApi.delete(workspaceId, bookmarkId);
    },
    onSuccess: invalidate,
  });

  const removeByTargetMutation = useMutation({
    mutationFn: ({
      targetType,
      targetId,
    }: {
      targetType: string;
      targetId: string;
    }) => {
      if (!workspaceId) throw new Error('Workspace required');
      return bookmarksApi.deleteByTarget(workspaceId, targetType, targetId);
    },
    onSuccess: invalidate,
  });

  return {
    addBookmark: addBookmarkMutation.mutateAsync,
    removeBookmark: removeBookmarkMutation.mutateAsync,
    removeByTarget: removeByTargetMutation.mutateAsync,
    isAdding: addBookmarkMutation.isPending,
    isRemoving: removeBookmarkMutation.isPending,
  };
}
