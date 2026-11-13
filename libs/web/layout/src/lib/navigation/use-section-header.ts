import { usePromptDialog, type EntityAction } from '@org/ui';
import {
  ArrowDown,
  ArrowUp,
  FolderInput,
  FolderPlus,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useCallback, useMemo, type ReactNode } from 'react';
import {
  normalizeSectionLabel,
  useSidebarStore,
  type SectionItemKind,
} from './sidebar-store.js';
import type { SidebarSectionDef } from './sidebar-sections.js';

/*
 * Slack-style custom sidebar sections.
 *
 * The built-in sections (Channels, Direct Messages, Projects…) never change
 * name or place. People add their own sections and file channels and DMs into
 * them; removing an item from a section — or deleting the section — sends it
 * straight back to where it came from. Everything lives in the sidebar store,
 * which `useSidebarSync` saves to `PUT /users/me/sidebar`.
 */

const NEW_SECTION_PROMPT = {
  title: 'Create a section',
  label: 'Section name',
  placeholder: 'e.g. Clients, Launch, Watching',
} as const;

const HOME_LABEL: Record<SectionItemKind, string> = {
  channel: 'Channels',
  dm: 'Direct Messages',
};

/** The custom (manual) sections of a workspace, in sidebar order. */
export function useManualSections(
  workspaceId: string | undefined,
): SidebarSectionDef[] {
  const defs = useSidebarStore((s) =>
    workspaceId ? s.sectionDefs[workspaceId] : undefined,
  );
  return useMemo(
    () =>
      (defs ?? [])
        .filter((d) => d.kind === 'manual')
        .sort((a, b) => a.order - b.order),
    [defs],
  );
}

/**
 * The "Move to section" submenu for one channel or DM row: every custom
 * section (checked where it lives now), "Move back to Channels / Direct
 * Messages", and "New section…" which names a section and moves the item in.
 *
 * Render the returned `dialog` next to the row — it is the name prompt.
 */
export function useMoveToSection({
  workspaceId,
  kind,
  itemId,
  itemLabel,
}: {
  workspaceId: string | undefined;
  kind: SectionItemKind;
  itemId: string;
  /** How the item reads in the prompt, e.g. `#general` or `Amara`. */
  itemLabel: string;
}): { action: EntityAction; dialog: ReactNode } {
  const prompts = usePromptDialog();
  const sections = useManualSections(workspaceId);
  const assignToSection = useSidebarStore((s) => s.assignToSection);
  const removeFromSection = useSidebarStore((s) => s.removeFromSection);
  const createManualSection = useSidebarStore((s) => s.createManualSection);

  const key = kind === 'dm' ? 'dmIds' : 'channelIds';
  const current = sections.find((s) => (s[key] ?? []).includes(itemId));

  const action: EntityAction = {
    id: 'move-to-section',
    group: 'organize',
    label: 'Move to section',
    icon: FolderInput,
    hidden: !workspaceId,
    children: [
      ...sections.map((section): EntityAction => ({
        id: `section-${section.id}`,
        group: 'sections',
        label: section.label,
        checked: section.id === current?.id,
        run: () =>
          workspaceId &&
          section.id !== current?.id &&
          assignToSection(workspaceId, section.id, kind, itemId),
      })),
      {
        id: 'section-home',
        group: 'sections-home',
        label: `Move back to ${HOME_LABEL[kind]}`,
        icon: Undo2,
        hidden: !current,
        run: () =>
          workspaceId &&
          current &&
          removeFromSection(workspaceId, current.id, kind, itemId),
      },
      {
        id: 'section-new',
        group: 'sections-new',
        label: 'New section…',
        icon: FolderPlus,
        run: async () => {
          if (!workspaceId) return;
          const name = await prompts.promptText({
            ...NEW_SECTION_PROMPT,
            description: `${itemLabel} moves into the new section. Only you see your sections.`,
            confirmLabel: 'Create and move',
          });
          const clean = normalizeSectionLabel(name ?? '');
          if (!clean) return;
          createManualSection(
            workspaceId,
            clean,
            kind === 'dm' ? { dmIds: [itemId] } : { channelIds: [itemId] },
          );
        },
      },
    ],
  };

  return { action, dialog: prompts.dialog };
}

/**
 * "Create a section" for a built-in section's header (Channels, Direct
 * Messages). Render the returned `dialog` alongside.
 */
export function useCreateSection(workspaceId: string | undefined): {
  action: EntityAction;
  dialog: ReactNode;
} {
  const prompts = usePromptDialog();
  const createManualSection = useSidebarStore((s) => s.createManualSection);

  const run = useCallback(async () => {
    if (!workspaceId) return;
    const name = await prompts.promptText({
      ...NEW_SECTION_PROMPT,
      description:
        'Group channels and direct messages your way, then use “Move to section” on any of them. Only you see your sections.',
      confirmLabel: 'Create section',
    });
    const clean = normalizeSectionLabel(name ?? '');
    if (clean) createManualSection(workspaceId, clean);
  }, [prompts, createManualSection, workspaceId]);

  return {
    action: {
      id: 'section-create',
      group: 'section-create',
      label: 'Create a section…',
      icon: FolderPlus,
      hidden: !workspaceId,
      run,
    },
    dialog: prompts.dialog,
  };
}

/**
 * Header menu for a custom section ("Rename section" is added by `Section`
 * itself): move up/down among the custom
 * sections, and delete. Deleting returns its channels to Channels and its DMs
 * to Direct Messages.
 */
export function customSectionMenu({
  def,
  index,
  total,
  onShift,
  onDelete,
  extra = [],
}: {
  def: SidebarSectionDef;
  index: number;
  total: number;
  onShift: (direction: -1 | 1) => void;
  onDelete: () => void;
  /** e.g. "Edit rule…" for smart sections. */
  extra?: EntityAction[];
}): EntityAction[] {
  return [
    ...extra,
    {
      id: 'section-move-up',
      group: 'section-order',
      label: 'Move section up',
      icon: ArrowUp,
      disabled: index === 0,
      run: () => onShift(-1),
    },
    {
      id: 'section-move-down',
      group: 'section-order',
      label: 'Move section down',
      icon: ArrowDown,
      disabled: index >= total - 1,
      run: () => onShift(1),
    },
    {
      id: 'section-delete',
      group: 'section-delete',
      label: 'Delete section',
      icon: Trash2,
      destructive: true,
      confirm: {
        title: `Delete “${def.label}”?`,
        description:
          def.kind === 'manual'
            ? 'Its channels go back to Channels and its direct messages to Direct Messages. Only your sidebar changes.'
            : 'The rule is removed. Channels stay where they are.',
        confirmLabel: 'Delete section',
        destructive: true,
      },
      run: onDelete,
    },
  ];
}
