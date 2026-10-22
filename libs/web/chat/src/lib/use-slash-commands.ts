import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from '@org/ui';
import { useAuthStore, useCurrentUser } from '@org/auth';
import {
  channelApi,
  queryKeys,
  remindersApi,
  userApi,
  workToolsApi,
} from '@org/api-client';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  ChannelRole,
  PresenceStatus,
  TaskPriority,
  TaskStatus,
  toPlatformUserId,
  type ComposerContext,
  type ComposerMentionMeta,
} from '@org/types';
import type { SlashCommand } from '@org/chat-ui';
import { parseReminder } from './slash-remind-parse.js';

export interface SlashCommandInvocation {
  /** Without the slash, e.g. `remind`. */
  name: string;
  args: string;
  mentions: ComposerMentionMeta[];
}

interface Options {
  context?: ComposerContext;
  /** Matrix room the composer posts into — the reminder's "where". */
  roomId?: string | null;
  /** The commands the `/` menu offered, for `/help`. */
  slashCommands: SlashCommand[];
  /** Starts or joins this conversation's huddle; unset when huddles are off. */
  startHuddle?: () => void;
  /** Posts a plain message to this conversation (used by `/here`, `/channel`). */
  sendText: (body: string) => unknown;
  canMentionGroups: boolean;
}

const failure = (err: unknown, fallback: string) =>
  err instanceof Error && err.message ? err.message : fallback;

/** Removes `@Name` chips/text for the given people so the rest reads as the title. */
function stripMentions(args: string, mentions: ComposerMentionMeta[]): string {
  let out = args;
  for (const m of mentions) {
    if (m.displayName) out = out.split(`@${m.displayName}`).join(' ');
  }
  // A mention whose display name didn't match the text still leads the line.
  if (mentions.length && out === args) out = out.replace(/^\s*@\S+/, ' ');
  return out.replace(/\s+/g, ' ').trim();
}

/**
 * Executes the composer's slash commands against the real APIs. The returned
 * function resolves `true` when it handled the command (so nothing is posted to
 * the conversation) and `false` for anything it does not own — those fall back
 * to the composer's own behaviour (agent/app actions are sent as messages).
 */
export function useSlashCommands({
  context,
  roomId,
  slashCommands,
  startHuddle,
  sendText,
  canMentionGroups,
}: Options) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentUser = useCurrentUser();
  const setUser = useAuthStore((s) => s.setUser);
  const { slug, workspaceId: currentWorkspaceId } = useCurrentWorkspace();
  const workspaceId = context?.workspaceId ?? currentWorkspaceId;
  const channelId = context?.channelId;

  return useCallback(
    async ({ name, args, mentions }: SlashCommandInvocation): Promise<boolean> => {
      const people = mentions.filter((m) => m.kind === 'user');

      switch (name) {
        case 'help': {
          const lines = slashCommands
            .filter((c) => !c.source)
            .map((c) => c.name)
            .join(', ');
          toast.info(`Commands: ${lines}`);
          return true;
        }

        case 'here':
        case 'channel': {
          if (!canMentionGroups) {
            toast.error(`You can't notify the whole conversation here.`);
            return true;
          }
          await sendText(`@${name}${args ? ` ${args}` : ''}`);
          return true;
        }

        case 'huddle': {
          if (!startHuddle) {
            toast.error('Huddles are not available in this conversation.');
            return true;
          }
          startHuddle();
          return true;
        }

        case 'away': {
          const goingAway = currentUser?.presence !== PresenceStatus.AWAY;
          try {
            const updated = await userApi.updateStatus({
              presence: goingAway ? PresenceStatus.AWAY : PresenceStatus.ONLINE,
            });
            setUser(updated);
            toast.success(goingAway ? 'You are now away' : 'You are back online');
          } catch (err) {
            toast.error(failure(err, 'Could not update your status.'));
          }
          return true;
        }

        case 'topic': {
          if (!workspaceId || !channelId) {
            toast.error('Topics can only be set in a channel.');
            return true;
          }
          try {
            await channelApi.update(workspaceId, channelId, {
              topic: args.trim() || null,
            });
            void queryClient.invalidateQueries({
              queryKey: queryKeys.channels.all(workspaceId),
            });
            toast.success(args.trim() ? 'Channel topic updated' : 'Channel topic cleared');
          } catch (err) {
            toast.error(failure(err, 'Could not set the topic.'));
          }
          return true;
        }

        case 'invite': {
          if (!workspaceId || !channelId) {
            toast.error('You can only invite people to a channel.');
            return true;
          }
          if (people.length === 0) {
            toast.error('Mention who to add, e.g. /invite @person');
            return true;
          }
          try {
            await channelApi.addMembers(workspaceId, channelId, {
              userIds: people.map((p) => toPlatformUserId(p.id)),
              role: ChannelRole.MEMBER,
            });
            void queryClient.invalidateQueries({
              queryKey: queryKeys.channels.members(workspaceId, channelId),
            });
            toast.success(
              people.length === 1
                ? `Added ${people[0].displayName ?? 'them'} to the channel`
                : `Added ${people.length} people to the channel`,
            );
          } catch (err) {
            toast.error(failure(err, 'Could not add them to the channel.'));
          }
          return true;
        }

        case 'dm': {
          const peer = people[0];
          if (!peer || !slug) {
            toast.error('Mention who to message, e.g. /dm @person');
            return true;
          }
          navigate(`/w/${slug}/dms/${toPlatformUserId(peer.id)}`);
          return true;
        }

        case 'task':
        case 'assign': {
          if (!workspaceId) {
            toast.error('Open a workspace to create tasks.');
            return true;
          }
          const assignee = name === 'assign' ? people[0] : undefined;
          if (name === 'assign' && !assignee) {
            toast.error('Mention who to assign it to, e.g. /assign @person fix login');
            return true;
          }
          const title = stripMentions(args, assignee ? [assignee] : []);
          if (!title) {
            toast.error(
              name === 'assign'
                ? 'Add a task title after the name.'
                : 'Add a title, e.g. /task Write release notes',
            );
            return true;
          }
          try {
            await workToolsApi.createTask(workspaceId, {
              title: title.slice(0, 200),
              status: TaskStatus.TODO,
              priority: TaskPriority.MEDIUM,
              assigneeId: assignee ? toPlatformUserId(assignee.id) : undefined,
            });
            toast.success(
              assignee
                ? `Task assigned to ${assignee.displayName ?? 'them'}`
                : 'Task created',
            );
          } catch (err) {
            toast.error(failure(err, 'Could not create the task.'));
          }
          return true;
        }

        case 'remind': {
          if (!workspaceId) {
            toast.error('Open a workspace to set reminders.');
            return true;
          }
          const parsed = parseReminder(args);
          if (!parsed) {
            toast.error(
              'Say when, e.g. /remind me to call Bob in 30 minutes, or tomorrow at 9am',
            );
            return true;
          }
          if (parsed.who !== 'me') {
            toast.error('Reminders can only be set for yourself for now.');
            return true;
          }
          if (!parsed.what) {
            toast.error('Say what to remind you about.');
            return true;
          }
          const here = window.location.pathname.replace(/^\/w\/[^/]+\/?/, '');
          try {
            await remindersApi.create(workspaceId, {
              roomId: roomId ?? `workspace-${workspaceId}`,
              eventId: `remind-${Date.now()}`,
              remindAt: parsed.remindAt.toISOString(),
              deepLink: here || 'home',
              snippet: parsed.what.slice(0, 280),
            });
            toast.success(
              `Reminder set for ${parsed.remindAt.toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}`,
            );
          } catch (err) {
            toast.error(failure(err, 'Could not set the reminder.'));
          }
          return true;
        }

        case 'search': {
          if (!slug) return false;
          const q = args.trim();
          navigate(`/w/${slug}/search${q ? `?q=${encodeURIComponent(q)}` : ''}`);
          return true;
        }

        case 'settings': {
          if (!slug) return false;
          navigate(`/w/${slug}/settings/profile`);
          return true;
        }

        default:
          return false;
      }
    },
    [
      slashCommands,
      canMentionGroups,
      sendText,
      startHuddle,
      currentUser?.presence,
      setUser,
      workspaceId,
      channelId,
      queryClient,
      slug,
      navigate,
      roomId,
    ],
  );
}
