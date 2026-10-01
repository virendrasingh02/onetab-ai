import { channelApi, queryKeys, workToolsApi } from '@org/api-client';
import { AppSelect } from '@org/ui';
import { useQuery } from '@tanstack/react-query';

/** Radix Select items cannot have an empty value, so "none" is a sentinel. */
const NONE = '__none__';

interface PickerProps {
  workspaceId: string | undefined;
  value: string | undefined;
  onChange: (value: string) => void;
  id?: string;
  placeholder?: string;
  'aria-label'?: string;
  /** Offer an explicit "none" choice (for optional params). */
  allowNone?: string;
}

/** Channels the viewer belongs to — the only ones an agent may watch or post in. */
export function ChannelPicker({ workspaceId, value, onChange, by = 'id', ...props }: PickerProps & { by?: 'id' | 'slug' }) {
  const channels = useQuery({
    queryKey: queryKeys.channels.list(workspaceId ?? '', false),
    queryFn: () => channelApi.list(workspaceId as string, false),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
  const options = (channels.data ?? [])
    .filter((c) => c.membership)
    .map((c) => ({ value: by === 'id' ? c.id : c.slug, label: `#${c.slug || c.name}`, description: c.topic ?? undefined }));
  return (
    <AppSelect
      id={props.id}
      aria-label={props['aria-label']}
      value={value || (props.allowNone ? NONE : undefined)}
      onValueChange={(v) => onChange(v === NONE ? '' : v)}
      options={props.allowNone ? [{ value: NONE, label: props.allowNone }, ...options] : options}
      placeholder={props.placeholder ?? 'Choose a channel you’re in'}
      searchable
      loading={channels.isLoading}
      emptyText="You aren’t in any channels yet."
    />
  );
}

export function ProjectPicker({ workspaceId, value, onChange, ...props }: PickerProps) {
  const projects = useQuery({
    queryKey: queryKeys.workTools.projects(workspaceId ?? ''),
    queryFn: () => workToolsApi.projects(workspaceId as string),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
  const options = (projects.data ?? []).map((p) => ({ value: p.id, label: p.name, description: String(p.status ?? '').toLowerCase() || undefined }));
  return (
    <AppSelect
      id={props.id}
      aria-label={props['aria-label']}
      value={value || (props.allowNone ? NONE : undefined)}
      onValueChange={(v) => onChange(v === NONE ? '' : v)}
      options={props.allowNone ? [{ value: NONE, label: props.allowNone }, ...options] : options}
      placeholder={props.placeholder ?? 'Choose a project'}
      searchable
      loading={projects.isLoading}
      emptyText="No projects yet."
    />
  );
}

export function DocPicker({ workspaceId, value, onChange, ...props }: PickerProps) {
  const docs = useQuery({
    queryKey: queryKeys.workTools.documents(workspaceId ?? ''),
    queryFn: () => workToolsApi.documents(workspaceId as string),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
  const options = (docs.data ?? []).map((d) => ({ value: d.id, label: d.title || 'Untitled' }));
  return (
    <AppSelect
      id={props.id}
      aria-label={props['aria-label']}
      value={value || (props.allowNone ? NONE : undefined)}
      onValueChange={(v) => onChange(v === NONE ? '' : v)}
      options={props.allowNone ? [{ value: NONE, label: props.allowNone }, ...options] : options}
      placeholder={props.placeholder ?? 'Choose a doc'}
      searchable
      loading={docs.isLoading}
      emptyText="No docs yet."
    />
  );
}
