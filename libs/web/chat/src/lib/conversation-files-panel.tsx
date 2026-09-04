import { attachmentToMediaItem, useMediaPreview } from '@org/media-preview';
import type { Attachment } from '@org/types';
import {
  Button,
  EmptyState,
  ScrollArea,
  SkeletonList,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@org/ui';
import { formatBytes } from '@org/utils';
import { FiledFilesSection, type UploadTarget } from '@org/web-upload';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Download,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  MessageSquare,
  MessageSquareOff,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRoom } from './use-chat.js';

export interface ConversationFilesPanelProps {
  /** Where files uploaded here are filed — DIRECT / AGENT / APP with its id. */
  context: UploadTarget;
  /** The Matrix room whose timeline supplies the "Shared in chat" section. */
  roomId: string | null;
  workspaceId: string | undefined;
  /** True when Matrix is configured for this deployment. */
  enabled: boolean;
  /** Current user id, so "you" is marked on their own uploads. */
  currentUserId?: string;
}

/**
 * A conversation's Files & Media tab — shared by 1:1 DMs, group DMs, agent
 * chats and app chats.
 *
 * Two sources, one panel:
 *  - **Filed files** — real `Upload` rows tagged with this conversation
 *    (`<FiledFilesSection>`): upload, details, rename, move, versions, delete.
 *  - **Shared in chat** — Matrix attachments scraped from the room timeline.
 *    Preview and download only; they live in the chat, not our object store.
 */
export function ConversationFilesPanel({
  context,
  roomId,
  workspaceId,
  enabled,
  currentUserId,
}: ConversationFilesPanelProps) {
  const navigate = useNavigate();
  const { slug } = useCurrentWorkspace();
  const { openPreview } = useMediaPreview();

  const room = useRoom(roomId ?? undefined);
  const [filter, setFilter] = useState<'all' | 'files' | 'media'>('all');

  const chatAttachments = useMemo(
    () =>
      room.messages
        .filter((message) => message.attachment && !message.isRedacted)
        .map((message) => {
          const file = message.attachment as Attachment;
          return {
            id: message.id,
            senderName: message.senderName,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            url: file.url,
            thumbnailUrl: file.thumbnailUrl,
            attachment: file,
          };
        })
        .reverse(),
    [room.messages],
  );

  const mediaFiles = useMemo(
    () => chatAttachments.filter((f) => f.mimeType.startsWith('image/')),
    [chatAttachments],
  );
  const documentFiles = useMemo(
    () => chatAttachments.filter((f) => !f.mimeType.startsWith('image/')),
    [chatAttachments],
  );

  const isResolving = !roomId || room.isLoading;

  return (
    <ScrollArea
      className="min-h-0 flex-1"
      contentClassName="px-4 sm:px-6 py-4 space-y-6"
    >
      {/* Filed files — real Upload rows for this conversation. */}
      <FiledFilesSection
        workspaceId={workspaceId}
        workspaceSlug={slug}
        currentUserId={currentUserId}
        target={context}
        uploadLabel="Add files to this conversation"
        emptyDescription="Upload a file to keep it with this conversation, or share one in the chat."
        onNavigateSource={(href) => navigate(href)}
      />

      {/* Shared in chat — Matrix timeline attachments. */}
      {!enabled ? (
        <EmptyState
          size="lg"
          icon={<MessageSquareOff />}
          title="Chat is not configured"
          description="Files shared in this conversation will appear here once messaging is turned on."
        />
      ) : chatAttachments.length > 0 || !isResolving ? (
        <div className="space-y-4 border-t border-border/60 pt-4">
          <div className="gap-1.5 flex flex-wrap items-center">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Shared in chat
            </span>
            <Button
              size="sm"
              variant={filter === 'all' ? 'primary' : 'outline'}
              onClick={() => setFilter('all')}
              className="h-6 text-xs px-2"
            >
              All ({chatAttachments.length})
            </Button>
            <Button
              size="sm"
              variant={filter === 'files' ? 'primary' : 'outline'}
              onClick={() => setFilter('files')}
              className="h-6 text-xs px-2 gap-1"
            >
              <FileText className="size-3" />
              {documentFiles.length}
            </Button>
            <Button
              size="sm"
              variant={filter === 'media' ? 'primary' : 'outline'}
              onClick={() => setFilter('media')}
              className="h-6 text-xs px-2 gap-1"
            >
              <ImageIcon className="size-3" />
              {mediaFiles.length}
            </Button>
          </div>

          {(filter === 'all' || filter === 'media') && mediaFiles.length > 0 ? (
            <div className="gap-3 sm:grid-cols-4 grid grid-cols-2">
              {mediaFiles.map((file, index) => (
                <button
                  key={file.id}
                  type="button"
                  aria-label={`Preview ${file.name}`}
                  onClick={() =>
                    openPreview(
                      mediaFiles.map((f) =>
                        attachmentToMediaItem(f.attachment, 'image', f.id),
                      ),
                      index,
                    )
                  }
                  className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                >
                  <img
                    src={file.thumbnailUrl ?? file.url}
                    alt={file.name}
                    className="size-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          ) : null}

          {(filter === 'all' || filter === 'files') &&
          documentFiles.length > 0 ? (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
              {documentFiles.map((file) => (
                <li
                  key={file.id}
                  className="gap-3 px-4 py-3 flex items-center transition-colors hover:bg-surface-raised"
                >
                  <FileText className="size-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate text-foreground">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {file.size ? `${formatBytes(file.size)} · ` : ''}Shared by{' '}
                      {file.senderName}
                    </p>
                  </div>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    onClick={() =>
                      window.open(file.url, '_blank', 'noopener,noreferrer')
                    }
                    title="Open file"
                  >
                    <Download className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}

          {chatAttachments.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nothing shared in the chat yet.
            </p>
          ) : null}
        </div>
      ) : (
        <SkeletonList rows={3} />
      )}
    </ScrollArea>
  );
}

export interface ConversationTabsShellProps
  extends Omit<ConversationFilesPanelProps, 'context'> {
  filesContext: UploadTarget;
  /** The Messages tab content — normally a `<ChatPanel>`. */
  children: ReactNode;
}

/**
 * Wraps a conversation surface (agent chat, app chat, group DM) in the same
 * Messages / Files & Media tab strip a 1:1 DM has, so every conversation in the
 * app carries a place to keep files.
 */
export function ConversationTabsShell({
  filesContext,
  roomId,
  workspaceId,
  enabled,
  currentUserId,
  children,
}: ConversationTabsShellProps) {
  const [tab, setTab] = useState('chat');

  return (
    <Tabs
      value={tab}
      onValueChange={setTab}
      className="min-h-0 flex flex-1 flex-col"
    >
      <div className="px-3 sm:px-6 py-1 gap-1 flex items-center border-b border-border bg-background">
        <TabsList className="scrollbar-none overflow-x-auto">
          <TabsTrigger value="chat" className="gap-1.5">
            <MessageSquare className="size-4 inline" /> Messages
          </TabsTrigger>
          <TabsTrigger value="files-media" className="gap-1.5">
            <FolderOpen className="size-4 inline" /> Files &amp; Media
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent
        value="chat"
        className="min-h-0 flex flex-1 flex-col overflow-hidden"
      >
        {children}
      </TabsContent>

      <TabsContent value="files-media" className="min-h-0 flex flex-1 flex-col">
        <ConversationFilesPanel
          context={filesContext}
          roomId={roomId}
          workspaceId={workspaceId}
          enabled={enabled}
          currentUserId={currentUserId}
        />
      </TabsContent>
    </Tabs>
  );
}
