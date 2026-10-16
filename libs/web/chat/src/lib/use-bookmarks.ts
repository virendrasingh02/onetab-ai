import { useCallback, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bookmarksApi, queryKeys } from '@org/api-client';
import type { BookmarkDto, CreateBookmarkInput } from '@org/types';
import { toast, type EntityAction } from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import { Bookmark } from 'lucide-react';

/**
 * Every bookmark the reader has in a workspace. One cache entry for the whole
 * list (filtered client-side) so a save from any surface — chat, a task, a
 * doc — shows up everywhere without a second fetch.
 */
export function useBookmarks(
  workspaceId: string | undefined,
  targetType?: string,
) {
  return useQuery<BookmarkDto[], Error, BookmarkDto[]>({
    queryKey: workspaceId
      ? queryKeys.bookmarks.list(workspaceId)
      : ['bookmarks', 'none'],
    queryFn: () =>
      workspaceId ? bookmarksApi.list(workspaceId) : Promise.resolve([]),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
    select: targetType
      ? (rows) => rows.filter((row) => row.targetType === targetType)
      : undefined,
  });
}

function bookmarkKey(targetType: string, targetId: string): string {
  return `${targetType}:${targetId}`;
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

/**
 * Save / unsave any object — optimistic in the shared bookmarks cache, written
 * through the API, rolled back with a toast if the server refuses.
 */
export function useBookmarkToggle(workspaceId: string | undefined) {
  const queryClient = useQueryClient();
  const { data: bookmarks = [] } = useBookmarks(workspaceId);

  const saved = useMemo(
    () => new Set(bookmarks.map((b) => bookmarkKey(b.targetType, b.targetId))),
    [bookmarks],
  );

  const isBookmarked = useCallback(
    (targetType: string, targetId: string) =>
      saved.has(bookmarkKey(targetType, targetId)),
    [saved],
  );

  const toggle = useCallback(
    async (input: CreateBookmarkInput, currentlySaved?: boolean): Promise<boolean> => {
      if (!workspaceId) return false;
      const listKey = queryKeys.bookmarks.list(workspaceId);
      const wasSaved =
        currentlySaved ??
        (queryClient.getQueryData<BookmarkDto[]>(listKey) ?? []).some(
          (b) => b.targetType === input.targetType && b.targetId === input.targetId,
        );

      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<BookmarkDto[]>(listKey);
      const now = new Date().toISOString();
      queryClient.setQueryData<BookmarkDto[]>(listKey, (rows = []) =>
        wasSaved
          ? rows.filter(
              (b) =>
                !(b.targetType === input.targetType && b.targetId === input.targetId),
            )
          : [
              {
                id: `optimistic:${bookmarkKey(input.targetType, input.targetId)}`,
                workspaceId,
                userId: '',
                targetType: input.targetType,
                targetId: input.targetId,
                title: input.title,
                snippet: input.snippet ?? null,
                tags: input.tags ?? [],
                metadata: input.metadata ?? {},
                createdAt: now,
                updatedAt: now,
              },
              ...rows,
            ],
      );

      try {
        if (wasSaved) {
          await bookmarksApi.deleteByTarget(
            workspaceId,
            input.targetType,
            input.targetId,
          );
        } else {
          await bookmarksApi.create(workspaceId, input);
        }
        return true;
      } catch {
        queryClient.setQueryData(listKey, previous);
        toast.error(wasSaved ? 'Could not remove the saved item.' : 'Could not save it.');
        return false;
      } finally {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.bookmarks.all(workspaceId),
        });
      }
    },
    [queryClient, workspaceId],
  );

  return { isBookmarked, toggle };
}

export interface SaveForLaterTarget {
  /** `task` | `doc` | `file` | … — the Saved page's tabs key off this. */
  type: string;
  id: string;
  title: string;
  snippet?: string | null;
  /** App path (`/w/<slug>/…`) or workspace-relative path that reopens it. */
  href?: string;
}

/** Stored workspace-relative, so a renamed workspace slug keeps links working. */
function workspaceRelative(href: string | undefined): string | undefined {
  if (!href) return undefined;
  return /^\/w\/[^/]+\/(.+)$/.exec(href)?.[1] ?? href.replace(/^\//, '');
}

/**
 * "Save for later" for any object, in the current workspace — a ready-made
 * menu entry plus the raw state, so every surface saves the same way and the
 * Saved page lists it.
 */
export function useSaveForLater() {
  const { workspaceId } = useCurrentWorkspace();
  const { isBookmarked, toggle } = useBookmarkToggle(workspaceId);

  const toggleSaved = useCallback(
    (target: SaveForLaterTarget) => {
      const saved = isBookmarked(target.type, target.id);
      void toggle(
        {
          targetType: target.type,
          targetId: target.id,
          title: (target.title || 'Untitled').slice(0, 500),
          snippet: target.snippet ? target.snippet.slice(0, 4000) : null,
          tags: [],
          metadata: { href: workspaceRelative(target.href) },
        },
        saved,
      ).then((ok) => {
        if (ok) toast.success(saved ? 'Removed from saved' : 'Saved for later');
      });
    },
    [isBookmarked, toggle],
  );

  const saveAction = useCallback(
    (target: SaveForLaterTarget, group = 'organize'): EntityAction => {
      const saved = isBookmarked(target.type, target.id);
      return {
        id: 'save-for-later',
        group,
        label: saved ? 'Remove from saved' : 'Save for later',
        icon: Bookmark,
        hidden: !workspaceId,
        run: () => toggleSaved(target),
      };
    },
    [isBookmarked, toggleSaved, workspaceId],
  );

  return { isSaved: isBookmarked, toggleSaved, saveAction };
}
