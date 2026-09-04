import type { AppSelectGroup } from '@org/ui';
import { useMemo } from 'react';
import { useUploadDestinations } from './use-upload.js';
import type { UploadTarget } from './use-upload.js';

/** `"WORKSPACE"` or `"<TYPE>:<id>"` — the value an `<AppSelect>` option carries. */
export const WORKSPACE_DESTINATION = 'WORKSPACE';

export function destinationValue(target: UploadTarget | null | undefined): string {
  if (!target || target.type === 'WORKSPACE') return WORKSPACE_DESTINATION;
  return `${target.type}:${target.id ?? ''}`;
}

export function parseDestinationValue(value: string): UploadTarget {
  if (value === WORKSPACE_DESTINATION) return { type: 'WORKSPACE' };
  const [type, ...rest] = value.split(':');
  return { type: type as UploadTarget['type'], id: rest.join(':') };
}

/**
 * The grouped option list for the "Upload files" / "Move file" destination
 * picker — one source of truth for both the hub dialog and the details panel.
 */
export function useDestinationOptions(workspaceId: string | undefined) {
  const destinations = useUploadDestinations(workspaceId);

  const groups = useMemo<AppSelectGroup[]>(() => {
    const d = destinations.data;
    const out: AppSelectGroup[] = [
      {
        label: 'General',
        options: [
          { value: WORKSPACE_DESTINATION, label: 'Workspace (everyone)' },
        ],
      },
    ];
    if (d?.channels.length) {
      out.push({
        label: 'Channels',
        options: d.channels.map((c) => ({
          value: `CHANNEL:${c.id}`,
          label: `#${c.slug ?? c.name}`,
        })),
      });
    }
    if (d?.projects.length) {
      out.push({
        label: 'Projects',
        options: d.projects.map((p) => ({
          value: `PROJECT:${p.id}`,
          label: p.name,
        })),
      });
    }
    if (d?.people.length) {
      out.push({
        label: 'Direct messages',
        options: d.people.map((p) => ({
          value: `DIRECT:${p.id}`,
          label: p.name,
        })),
      });
    }
    if (d?.agents.length) {
      out.push({
        label: 'Agents',
        options: d.agents.map((a) => ({ value: `AGENT:${a.id}`, label: a.name })),
      });
    }
    if (d?.apps.length) {
      out.push({
        label: 'Apps',
        options: d.apps.map((a) => ({ value: `APP:${a.id}`, label: a.name })),
      });
    }
    return out;
  }, [destinations.data]);

  return { groups, isLoading: destinations.isLoading };
}
