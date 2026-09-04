import { attachmentToMediaItem, useMediaPreview } from '@org/media-preview';
import type { Attachment } from '@org/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ScrollArea,
  SkeletonList,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  usePromptDialog,
} from '@org/ui';
import { formatBytes } from '@org/utils';
import {
  FileDropzone,
  UploadList,
  useUploadMediaAdapter,
  useUploadMutations,
  useUploads,
  type UploadListItem,
  type UploadTarget,
} from '@org/web-upload';
import {
  Download,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  MessageSquare,
  MessageSquareOff,
  Plus,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
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
 *  - **Filed files** — real `Upload` rows tagged with this conversation. These
 *    are uploaded from the button here (not posted as a message) and can be
 *    deleted from here.
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
  const uploads = useUploads(workspaceId, context);
  const { remove, download } = useUploadMutations(workspaceId);
  const { toMediaItem } = useUploadMediaAdapter(workspaceId);
  const { openPreview } = useMediaPreview();
  const prompts = usePromptDialog();
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const room = useRoom(roomId ?? undefined);
  const [filter, setFilter] = useState<'all' | 'files' | 'media'>('all');

  const filedItems: UploadListItem[] = useMemo(
    () =>
      (uploads.data ?? []).map((file) => ({
        id: file.id,
        filename: file.filename,
        mimeType: file.mimeType,
        size: file.size,
        createdAt: file.createdAt,
        uploader: file.uploader,
        manageable: true,
      })),
    [uploads.data],
  );

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

  const confirmDelete = async (item: UploadListItem) => {
    const confirmed = await prompts.confirmAction({
      title: `Delete “${item.filename}”?`,
      description:
        'The file is removed for everyone in this conversation. This cannot be undone.',
      confirmLabel: 'Delete file',
      destructive: true,
    });
    if (confirmed) remove.mutate(item.id);
  };

  const isResolving = !roomId || room.isLoading;
  const nothingAtAll =
    !uploads.isLoading &&
    filedItems.length === 0 &&
    chatAttachments.length === 0;

  return (
    <ScrollArea
      className="min-h-0 flex-1"
      contentClassName="px-4 sm:px-6 py-4 space-y-6"
    >
      <div className="gap-3 pb-3 flex flex-wrap items-center justify-between border-b border-border/60">
        <div className="gap-1.5 flex flex-wrap items-center">
          <Button
            size="sm"
            variant={filter === 'all' ? 'primary' : 'outline'}
            onClick={() => setFilter('all')}
            className="h-7 text-xs px-2.5"
          >
            All ({filedItems.length + chatAttachments.length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'files' ? 'primary' : 'outline'}
            onClick={() => setFilter('files')}
            className="h-7 text-xs px-2.5 gap-1.5"
          >
            <FileText className="size-3.5" />
            <span>Documents ({documentFiles.length})</span>
          </Button>
          <Button
            size="sm"
            variant={filter === 'media' ? 'primary' : 'outline'}
            onClick={() => setFilter('media')}
            className="h-7 text-xs px-2.5 gap-1.5"
          >
            <ImageIcon className="size-3.5" />
            <span>Media ({mediaFiles.length})</span>
          </Button>
        </div>

        <Button
          size="sm"
          onClick={() => setIsUploadOpen(true)}
          disabled={!workspaceId}
          className="h-7 text-xs gap-1.5"
          leadingIcon={<Plus className="size-3.5" />}
        >
          Upload
        </Button>
      </div>

      {/* Filed files — real Upload rows for this conversation. */}
      {uploads.isLoading ? (
        <SkeletonList rows={3} withAvatar />
      ) : filedItems.length > 0 ? (
        <div className="space-y-2">
          <h4 className="text-xs font-bold tracking-wider gap-1.5 flex items-center text-muted-foreground uppercase">
            <FolderOpen className="size-3.5 text-primary" />
            <span>Files ({filedItems.length})</span>
          </h4>
          <UploadList
            items={filedItems}
            currentUserId={currentUserId}
            downloadingId={
              download.isPending ? (download.variables?.id ?? null) : null
            }
            deletingId={remove.isPending ? (remove.variables ?? null) : null}
            onPreview={(_item, index) =>
              openPreview((uploads.data ?? []).map(toMediaItem), index)
            }
            onDownload={(item) =>
              download.mutate({ id: item.id, filename: item.filename })
            }
            onDelete={confirmDelete}
          />
        </div>
      ) : null}

      {/* Shared in chat — Matrix timeline attachments. */}
      {!enabled ? (
        <EmptyState
          size="lg"
          icon={<MessageSquareOff />}
          title="Chat is not configured"
          description="Files shared in this conversation will appear here once messaging is turned on."
        />
      ) : isResolving && chatAttachments.length === 0 ? (
        <SkeletonList rows={3} />
      ) : nothingAtAll ? (
        <EmptyState
          icon={<FolderOpen />}
          title="No files yet"
          description="Upload a file to keep it with this conversation, or share one in the chat."
        />
      ) : null}

      {(filter === 'all' || filter === 'media') && mediaFiles.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-xs font-bold tracking-wider gap-1.5 flex items-center text-muted-foreground uppercase">
            <ImageIcon className="size-3.5 text-accent-amber" />
            <span>Shared in chat · Media ({mediaFiles.length})</span>
          </h4>

          <div className="gap-3 sm:grid-cols-4 grid grid-cols-2">
            {mediaFiles.map((file, index) => (
              <button
                key={file.id}
                type="button"
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
                <div className="inset-0 bg-black/50 p-2 text-white absolute flex items-end opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="font-medium truncate text-[11px]">
                    {file.name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {(filter === 'all' || filter === 'files') && documentFiles.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-xs font-bold tracking-wider gap-1.5 flex items-center text-muted-foreground uppercase">
            <FileText className="size-3.5 text-accent-violet" />
            <span>Shared in chat · Documents ({documentFiles.length})</span>
          </h4>

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
        </div>
      ) : null}

      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent className="sm:max-w-md text-xs">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold">
              Upload files
            </DialogTitle>
          </DialogHeader>
          <FileDropzone
            workspaceId={workspaceId}
            target={context}
            label="Add files to this conversation"
            onUploaded={() => uploads.refetch()}
          />
        </DialogContent>
      </Dialog>

      {prompts.dialog}
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
