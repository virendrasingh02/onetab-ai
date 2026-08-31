import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  SearchInput,
  Spinner,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ArrowLeft,
  Inbox,
  Mail,
  RefreshCw,
  Reply,
  Send,
} from 'lucide-react';
import { useState } from 'react';
import type { IntegrationMessage } from '@org/types';
import {
  useIntegrationMessages,
  useIntegrationMutations,
  useIntegrationThread,
} from './use-integrations.js';

interface GmailInboxModalProps {
  workspaceId: string;
  integrationId: string;
  accountEmail?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function GmailInboxModal({
  workspaceId,
  integrationId,
  accountEmail,
  isOpen,
  onClose,
}: GmailInboxModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMessage, setSelectedMessage] = useState<IntegrationMessage | null>(null);
  const [isComposing, setIsComposing] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const messagesQuery = useIntegrationMessages(workspaceId, integrationId, {
    q: searchQuery || undefined,
  });

  const threadQuery = useIntegrationThread(
    workspaceId,
    integrationId,
    selectedMessage?.threadId,
  );

  const { sync, sendMessage, replyMessage, modifyLabels } = useIntegrationMutations(workspaceId);

  const handleSync = async () => {
    try {
      await sync.mutateAsync(integrationId);
      toast.success('Gmail sync triggered');
      messagesQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Sync failed');
    }
  };

  const handleSend = async () => {
    if (!composeTo || !composeSubject) {
      toast.error('Recipient and Subject are required.');
      return;
    }

    try {
      await sendMessage.mutateAsync({
        integrationId,
        input: {
          to: [composeTo],
          subject: composeSubject,
          bodyText: composeBody,
        },
      });
      toast.success('Email sent successfully!');
      setIsComposing(false);
      setComposeTo('');
      setComposeSubject('');
      setComposeBody('');
      messagesQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send email.');
    }
  };

  const handleReply = async () => {
    if (!selectedMessage || !replyBody.trim()) {
      toast.error('Reply content cannot be empty.');
      return;
    }

    try {
      await replyMessage.mutateAsync({
        integrationId,
        input: {
          threadId: selectedMessage.threadId || selectedMessage.id,
          inReplyToMessageId: selectedMessage.id,
          to: [selectedMessage.from.email],
          subject: selectedMessage.subject.startsWith('Re:')
            ? selectedMessage.subject
            : `Re: ${selectedMessage.subject}`,
          bodyText: replyBody,
        },
      });
      toast.success('Reply sent successfully!');
      setIsReplying(false);
      setReplyBody('');
      threadQuery.refetch();
      messagesQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to send reply.');
    }
  };

  const toggleReadStatus = async (msg: IntegrationMessage) => {
    try {
      await modifyLabels.mutateAsync({
        integrationId,
        messageId: msg.id,
        input: msg.isRead
          ? { addLabelIds: ['UNREAD'] }
          : { removeLabelIds: ['UNREAD'] },
      });
      messagesQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update read status.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 flex flex-col overflow-hidden bg-background border-border">
        {/* Top Header */}
        <DialogHeader className="px-6 py-3 border-b border-border bg-surface flex flex-row items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-destructive/10 flex items-center justify-center text-destructive-text">
              <Mail className="size-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                Gmail Inbox
                <Badge variant="success" className="text-[10px] px-1.5 py-0">
                  Connected
                </Badge>
              </DialogTitle>
              <p className="text-xs text-muted-foreground">{accountEmail || 'Google Account'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSync}
              disabled={sync.isPending}
              className="h-8 text-xs gap-1.5"
            >
              <RefreshCw className={cn('size-3.5', sync.isPending && 'animate-spin')} />
              {sync.isPending ? 'Syncing...' : 'Sync Now'}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setIsComposing(true);
                setSelectedMessage(null);
              }}
              className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground"
            >
              <Send className="size-3.5" />
              Compose Email
            </Button>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 flex min-h-0">
          {/* Left Column: Email List */}
          <div
            className={cn(
              'w-full md:w-2/5 border-r border-border flex flex-col bg-surface/50 min-h-0',
              (selectedMessage || isComposing) && 'hidden md:flex',
            )}
          >
            <div className="p-3 border-b border-border">
              <SearchInput
                value={searchQuery}
                onValueChange={setSearchQuery}
                placeholder="Search messages..."
                className="h-8 text-xs"
              />
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {messagesQuery.isLoading ? (
                <div className="p-8 flex items-center justify-center">
                  <Spinner className="size-6" />
                </div>
              ) : (messagesQuery.data?.messages ?? []).length === 0 ? (
                <div className="p-8">
                  <EmptyState
                    icon={<Inbox className="size-8 text-muted-foreground" />}
                    title="No messages found"
                    description="Click Sync Now to fetch your latest emails from Gmail."
                  />
                </div>
              ) : (
                (messagesQuery.data?.messages ?? []).map((msg) => {
                  const isSelected = selectedMessage?.id === msg.id;
                  return (
                    <button
                      key={msg.id}
                      type="button"
                      onClick={() => {
                        setSelectedMessage(msg);
                        setIsComposing(false);
                      }}
                      className={cn(
                        'w-full text-left p-3.5 transition-colors hover:bg-accent/50 flex flex-col gap-1',
                        isSelected && 'bg-accent/80 border-l-2 border-primary',
                        !msg.isRead && 'font-semibold bg-primary/5',
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs truncate text-foreground font-medium">
                          {msg.from.name || msg.from.email}
                        </span>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(msg.date).toLocaleDateString(undefined, {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                      <div className="text-xs text-foreground truncate">{msg.subject}</div>
                      <div className="text-[11px] text-muted-foreground line-clamp-1">
                        {msg.snippet}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: View / Compose Area */}
          <div className="flex-1 flex flex-col min-h-0 bg-background overflow-y-auto">
            {isComposing ? (
              <div className="p-6 flex flex-col gap-4 h-full">
                <div className="flex items-center justify-between pb-3 border-b border-border">
                  <h3 className="text-sm font-semibold">New Message</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsComposing(false)}
                    className="h-7 text-xs"
                  >
                    Cancel
                  </Button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">To:</label>
                    <input
                      type="email"
                      value={composeTo}
                      onChange={(e) => setComposeTo(e.target.value)}
                      placeholder="recipient@example.com"
                      className="w-full mt-1 px-3 py-1.5 text-xs rounded-md border border-border bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Subject:</label>
                    <input
                      type="text"
                      value={composeSubject}
                      onChange={(e) => setComposeSubject(e.target.value)}
                      placeholder="Subject line"
                      className="w-full mt-1 px-3 py-1.5 text-xs rounded-md border border-border bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Message:</label>
                    <textarea
                      rows={12}
                      value={composeBody}
                      onChange={(e) => setComposeBody(e.target.value)}
                      placeholder="Write your email here..."
                      className="w-full mt-1 p-3 text-xs rounded-md border border-border bg-surface text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none font-sans"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button
                    size="sm"
                    onClick={handleSend}
                    disabled={sendMessage.isPending}
                    className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground"
                  >
                    <Send className="size-3.5" />
                    {sendMessage.isPending ? 'Sending...' : 'Send Message'}
                  </Button>
                </div>
              </div>
            ) : selectedMessage ? (
              <div className="p-6 flex flex-col gap-4">
                {/* Mobile back button */}
                <div className="md:hidden flex items-center mb-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedMessage(null)}
                    className="gap-1 h-7 text-xs"
                  >
                    <ArrowLeft className="size-3.5" /> Back to list
                  </Button>
                </div>

                <div className="flex items-start justify-between gap-4 pb-4 border-b border-border">
                  <div>
                    <h2 className="text-lg font-bold text-foreground">{selectedMessage.subject}</h2>
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {selectedMessage.from.name || selectedMessage.from.email}
                      </span>
                      <span>&lt;{selectedMessage.from.email}&gt;</span>
                      <span>•</span>
                      <span>{new Date(selectedMessage.date).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleReadStatus(selectedMessage)}
                      className="h-7 text-xs"
                    >
                      {selectedMessage.isRead ? 'Mark as Unread' : 'Mark as Read'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setIsReplying(!isReplying)}
                      className="h-7 text-xs gap-1"
                    >
                      <Reply className="size-3.5" /> Reply
                    </Button>
                  </div>
                </div>

                {/* Email Body */}
                <div className="py-2">
                  {selectedMessage.bodyHtml ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none text-xs"
                      dangerouslySetInnerHTML={{ __html: selectedMessage.bodyHtml }}
                    />
                  ) : (
                    <pre className="whitespace-pre-wrap font-sans text-xs text-foreground leading-relaxed">
                      {selectedMessage.bodyText}
                    </pre>
                  )}
                </div>

                {/* Reply Box */}
                {isReplying && (
                  <div className="mt-6 p-4 rounded-xl border border-border bg-surface space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold">Reply to {selectedMessage.from.email}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsReplying(false)}
                        className="h-6 text-[11px]"
                      >
                        Cancel
                      </Button>
                    </div>

                    <textarea
                      rows={5}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Type your reply..."
                      className="w-full p-2.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none font-sans"
                    />

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={handleReply}
                        disabled={replyMessage.isPending}
                        className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground"
                      >
                        <Send className="size-3" />
                        {replyMessage.isPending ? 'Sending...' : 'Send Reply'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center p-8 text-center">
                <EmptyState
                  icon={<Mail className="size-8 text-muted-foreground" />}
                  title="Select an email"
                  description="Choose a message from the list to view its full conversation and reply."
                />
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
