import type { ChannelSummary, WorkspaceSummary } from '@org/types';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@org/ui';
import { Bookmark, Check, Hash, Link2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { sendToBackground, type CapturedPage } from '../lib/messaging.js';

interface SaveTabProps {
  page: CapturedPage | null;
}

/** Remembers the last destination, so repeat saves are one click. */
const LAST_TARGET_KEY = 'onetab.lastTarget';

interface LastTarget {
  workspaceId: string;
  channelId: string;
}

/**
 * Saves the current page to a channel as a pin.
 *
 * Pins are the existing "keep this for the team" primitive — the same rows the
 * channel's pin list renders — so a page captured here shows up in the web app
 * with no new concept and no new table.
 */
export function SaveTab({ page }: SaveTabProps) {
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[] | null>(null);
  const [channels, setChannels] = useState<ChannelSummary[] | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string>('');
  const [channelId, setChannelId] = useState<string>('');
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Workspaces, plus whatever destination was used last.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const [list, stored] = await Promise.all([
        sendToBackground<WorkspaceSummary[]>({ type: 'workspaces:list' }),
        chrome.storage.local.get(LAST_TARGET_KEY),
      ]);
      if (cancelled) return;

      if (!list.ok) {
        setError(list.error);
        setWorkspaces([]);
        return;
      }

      setWorkspaces(list.data);
      const last = stored[LAST_TARGET_KEY] as LastTarget | undefined;
      const preferred =
        last && list.data.some((w) => w.id === last.workspaceId)
          ? last.workspaceId
          : list.data[0]?.id;

      if (preferred) setWorkspaceId(preferred);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Channels follow the selected workspace.
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    setChannels(null);

    void (async () => {
      const [list, stored] = await Promise.all([
        sendToBackground<ChannelSummary[]>({
          type: 'channels:list',
          workspaceId,
        }),
        chrome.storage.local.get(LAST_TARGET_KEY),
      ]);
      if (cancelled) return;

      if (!list.ok) {
        setError(list.error);
        setChannels([]);
        return;
      }

      // Only channels the user has actually joined can take a pin.
      const joined = list.data.filter((channel) => channel.membership !== null);
      setChannels(joined);

      const last = stored[LAST_TARGET_KEY] as LastTarget | undefined;
      const preferred =
        last?.workspaceId === workspaceId &&
        joined.some((c) => c.id === last.channelId)
          ? last.channelId
          : joined[0]?.id;

      setChannelId(preferred ?? '');
    })();

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  async function save() {
    if (!page || !workspaceId || !channelId || pending) return;

    setPending(true);
    setError(null);

    const response = await sendToBackground<{ id: string }>({
      type: 'capture:save',
      workspaceId,
      channelId,
      page,
      note: note.trim() || undefined,
    });

    if (response.ok) {
      setSaved(true);
      setNote('');
      await chrome.storage.local.set({
        [LAST_TARGET_KEY]: { workspaceId, channelId } satisfies LastTarget,
      });
      // The confirmation is transient; the popup usually closes before it
      // clears, but it must reset if the user stays and saves another page.
      setTimeout(() => setSaved(false), 2500);
    } else {
      setError(response.error);
    }
    setPending(false);
  }

  if (!page) {
    return (
      <p className="px-2.5 py-3 text-xs rounded-[8px] border border-[#27272A] bg-[#16171A] text-[#71717A]">
        This page cannot be saved. Open a normal web page and try again.
      </p>
    );
  }

  return (
    <div className="gap-2.5 flex flex-col">
      <div className="p-2.5 rounded-[8px] border border-[#27272A] bg-[#16171A]">
        <p
          className="text-xs font-medium truncate text-[#FAFAFA]"
          title={page.title}
        >
          {page.title}
        </p>
        <p className="mt-0.5 gap-1 flex items-center truncate text-[11px] text-[#71717A]">
          <Link2 className="size-3 shrink-0" aria-hidden />
          <span className="truncate">{page.url}</span>
        </p>
      </div>

      <div className="gap-2 grid grid-cols-2">
        <Select
          value={workspaceId}
          onValueChange={setWorkspaceId}
          disabled={!workspaces?.length}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue placeholder="Workspace" />
          </SelectTrigger>
          <SelectContent>
            {(workspaces ?? []).map((workspace) => (
              <SelectItem key={workspace.id} value={workspace.id}>
                {workspace.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={channelId}
          onValueChange={setChannelId}
          disabled={!channels?.length}
        >
          <SelectTrigger size="sm" className="w-full">
            <SelectValue
              placeholder={channels === null ? 'Loading…' : 'Channel'}
            />
          </SelectTrigger>
          <SelectContent>
            {(channels ?? []).map((channel) => (
              <SelectItem key={channel.id} value={channel.id}>
                <span className="gap-1 flex items-center">
                  <Hash className="size-3 text-[#71717A]" aria-hidden />
                  {channel.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {channels?.length === 0 ? (
        <p className="text-[11px] text-[#71717A]">
          You have not joined a channel in this workspace yet.
        </p>
      ) : null}

      <Textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Add a note (optional)"
        rows={2}
        maxLength={500}
        className="min-h-[52px]"
      />

      {error ? (
        <p className="px-2.5 py-2 text-xs rounded-[8px] border border-[#E5484D]/30 bg-[#E5484D]/10 text-[#E5484D]">
          {error}
        </p>
      ) : null}

      <Button
        size="sm"
        onClick={() => void save()}
        loading={pending}
        disabled={!channelId}
        variant={saved ? 'secondary' : 'primary'}
        leadingIcon={
          saved ? (
            <Check className="size-3.5 text-[#30A46C]" />
          ) : (
            <Bookmark className="size-3.5" />
          )
        }
      >
        {saved ? 'Saved to channel' : 'Save page'}
      </Button>
    </div>
  );
}
