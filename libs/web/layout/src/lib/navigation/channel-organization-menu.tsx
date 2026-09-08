import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
} from '@org/ui';
import { cn } from '@org/utils';
import { ArrowDownUp, ArrowDownWideNarrow, ArrowUpNarrowWide, FolderTree } from 'lucide-react';
import { useCallback } from 'react';
import {
  CHANNEL_SORT_MODES,
  DEFAULT_CHANNEL_SORT,
  type ChannelSortMode,
} from './sidebar-sections.js';
import { useSidebarStore } from './sidebar-store.js';

export interface ChannelOrganizationMenuProps {
  workspaceId: string;
  /** Opens the smart-sections manager dialog. */
  onManageSections: () => void;
}

/**
 * The "sort & organise" control in the Channels section header (brief §1.2).
 *
 * Sort choice is per user *and* per workspace — it writes to
 * `channelSort[workspaceId]` in the sidebar store, which rides the existing
 * `SidebarPreference` server sync, so it follows the user across devices and
 * never changes the order anyone else sees.
 */
export function ChannelOrganizationMenu({
  workspaceId,
  onManageSections,
}: ChannelOrganizationMenuProps) {
  const sort =
    useSidebarStore((s) => s.channelSort[workspaceId]) ?? DEFAULT_CHANNEL_SORT;
  const setChannelSort = useSidebarStore((s) => s.setChannelSort);

  const activeMode = CHANNEL_SORT_MODES.find((m) => m.value === sort.mode);
  const directionMatters =
    sort.mode !== 'manual' && activeMode?.asc && activeMode?.desc;

  const handleMode = useCallback(
    (value: string) => setChannelSort(workspaceId, value as ChannelSortMode),
    [setChannelSort, workspaceId],
  );

  return (
    <DropdownMenu>
      <Hint label="Sort & organize channels">
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Sort and organize channels"
            className={cn(
              'size-5 p-0 inline-flex items-center justify-center rounded-md text-muted-foreground',
              'opacity-0 transition-opacity duration-150 hover:bg-accent hover:text-foreground',
              'group-focus-within/section:opacity-100 group-hover/section:opacity-100 focus-visible:opacity-100',
              // Keep it visible whenever a non-default sort is active.
              sort.mode !== 'default' && 'opacity-100 text-foreground',
            )}
          >
            <ArrowDownUp className="size-3.5" />
          </button>
        </DropdownMenuTrigger>
      </Hint>

      <DropdownMenuContent align="end" side="bottom" className="w-60">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
          Sort channels by
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={sort.mode} onValueChange={handleMode}>
          {CHANNEL_SORT_MODES.map((mode) => (
            <DropdownMenuRadioItem
              key={mode.value}
              value={mode.value}
              className="text-xs"
            >
              {mode.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {directionMatters && activeMode ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Direction
            </DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={sort.direction}
              onValueChange={(value) =>
                setChannelSort(
                  workspaceId,
                  sort.mode,
                  value as 'asc' | 'desc',
                )
              }
            >
              <DropdownMenuRadioItem value="asc" className="gap-2 text-xs">
                <ArrowUpNarrowWide className="size-3.5" />
                {activeMode.asc}
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="desc" className="gap-2 text-xs">
                <ArrowDownWideNarrow className="size-3.5" />
                {activeMode.desc}
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </>
        ) : null}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={onManageSections}
          className="gap-2 text-xs"
        >
          <FolderTree className="size-3.5" />
          Manage sections…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
