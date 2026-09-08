import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  EmptyState,
  Hint,
  Input,
  Spinner,
  useRightPanelStore,
} from '@org/ui';
import { useContextOverview, useContextLinkMutations } from '@org/web-work-tools';
import {
  Bot,
  CheckSquare,
  ExternalLink,
  FileText,
  Link2,
  MessageSquare,
  Paperclip,
  Plus,
  Sparkles,
  Users,
  X,
} from 'lucide-react';

export interface UniversalContextPanelProps {
  workspaceId: string;
  workspaceSlug: string;
  targetType: string;
  targetId: string;
  title?: string;
  onClose: () => void;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function getTypeIcon(type: string) {
  switch (type.toLowerCase()) {
    case 'task':
      return CheckSquare;
    case 'message':
      return MessageSquare;
    case 'file':
      return Paperclip;
    case 'doc':
      return FileText;
    case 'agent':
      return Bot;
    default:
      return Link2;
  }
}

export function UniversalContextPanel({
  workspaceId,
  workspaceSlug,
  targetType,
  targetId,
  title,
  onClose,
}: UniversalContextPanelProps) {
  const navigate = useNavigate();
  const setView = useRightPanelStore((s) => s.setView);

  const { data: overview, isLoading, error } = useContextOverview(
    workspaceId,
    targetType,
    targetId,
  );

  const { createLink, isCreatingLink } = useContextLinkMutations(workspaceId);

  const [showAddLinkForm, setShowAddLinkForm] = useState(false);
  const [linkTargetType, setLinkTargetType] = useState('task');
  const [linkTargetId, setLinkTargetId] = useState('');
  const [linkRelationType, setLinkRelationType] = useState('RELATES_TO');
  const [linkError, setLinkError] = useState<string | null>(null);

  const handleCreateLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!linkTargetId.trim()) return;
    setLinkError(null);
    try {
      await createLink({
        sourceType: targetType,
        sourceId: targetId,
        targetType: linkTargetType,
        targetId: linkTargetId.trim(),
        linkType: linkRelationType,
      });
      setLinkTargetId('');
      setShowAddLinkForm(false);
    } catch (err: unknown) {
      setLinkError(
        err instanceof Error ? err.message : 'Failed to create connection',
      );
    }
  };

  const handleAskAI = () => {
    setView('assistant');
  };

  const displayTitle = overview?.title || title || `${targetType} details`;
  const TargetIcon = getTypeIcon(targetType);

  const totalLinkedItems =
    (overview?.relatedPeople.length ?? 0) +
    (overview?.relatedTasks.length ?? 0) +
    (overview?.relatedMessages.length ?? 0) +
    (overview?.relatedDocs.length ?? 0) +
    (overview?.relatedFiles.length ?? 0) +
    (overview?.relatedAgents.length ?? 0);

  return (
    <div className="flex h-full flex-col min-h-0 bg-background text-foreground">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          <TargetIcon className="size-4 shrink-0 text-primary" />
          <span className="truncate text-sm font-semibold">{displayTitle}</span>
          <Badge variant="outline" className="text-[10px] uppercase font-mono">
            {targetType}
          </Badge>
        </div>
        <Hint label="Close panel">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X className="size-4" />
          </Button>
        </Hint>
      </div>

      {/* Action Toolbar */}
      <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/30 px-3 py-2">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={handleAskAI}
        >
          <Sparkles className="size-3.5 text-primary" />
          Ask AI
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={() => setShowAddLinkForm(!showAddLinkForm)}
        >
          <Plus className="size-3.5" />
          Link Item
        </Button>
        <div className="ml-auto text-[11px] text-muted-foreground">
          {totalLinkedItems} linked
        </div>
      </div>

      {/* Add Link Inline Form */}
      {showAddLinkForm && (
        <form
          onSubmit={handleCreateLink}
          className="border-b border-border bg-muted/40 p-3 space-y-2 text-xs"
        >
          <div className="font-medium text-foreground flex items-center gap-1">
            <Link2 className="size-3.5 text-primary" />
            Connect Existing Item
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-semibold">
                Type
              </label>
              <select
                value={linkTargetType}
                onChange={(e) => setLinkTargetType(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="task">Task</option>
                <option value="message">Message</option>
                <option value="doc">Document</option>
                <option value="file">File</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground uppercase font-semibold">
                Relation
              </label>
              <select
                value={linkRelationType}
                onChange={(e) => setLinkRelationType(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="RELATES_TO">Relates to</option>
                <option value="RESOLVES">Resolves</option>
                <option value="BLOCKED_BY">Blocked by</option>
                <option value="DOCUMENTED_BY">Documented by</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground uppercase font-semibold">
              Item ID or Reference
            </label>
            <Input
              value={linkTargetId}
              onChange={(e) => setLinkTargetId(e.target.value)}
              placeholder="e.g. task ID or reference"
              className="h-7 text-xs"
            />
          </div>
          {linkError && (
            <p className="text-[11px] text-destructive">{linkError}</p>
          )}
          <div className="flex justify-end gap-1.5 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs"
              onClick={() => setShowAddLinkForm(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              className="h-6 text-xs"
              disabled={isCreatingLink || !linkTargetId.trim()}
            >
              {isCreatingLink ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </form>
      )}

      {/* Main Body */}
      <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-border/60">
        {isLoading && (
          <div className="flex h-48 items-center justify-center">
            <Spinner className="size-6 text-primary" />
          </div>
        )}

        {error && !isLoading && (
          <div className="p-4 text-center text-xs text-destructive">
            Failed to load context overview.
          </div>
        )}

        {!isLoading && overview && totalLinkedItems === 0 && !showAddLinkForm && (
          <div className="p-6 text-center">
            <EmptyState
              icon={<Link2 className="size-8 text-muted-foreground" />}
              title="No connections yet"
              description="Connect this item with related tasks, messages, or files to build a rich context graph."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddLinkForm(true)}
                >
                  Connect an item
                </Button>
              }
            />
          </div>
        )}

        {!isLoading && overview && (
          <>
            {/* Related People */}
            {overview.relatedPeople.length > 0 && (
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5" />
                    People ({overview.relatedPeople.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {overview.relatedPeople.map((person) => (
                    <div
                      key={person.id}
                      className="flex items-center justify-between rounded-lg border border-border/50 bg-card p-2 text-xs transition-colors hover:bg-muted/40"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium text-[11px] shrink-0">
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 truncate">
                          <p className="font-medium text-foreground truncate">
                            {person.name}
                          </p>
                          {person.role && (
                            <p className="text-[10px] text-muted-foreground truncate">
                              {person.role}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[11px]"
                        onClick={() =>
                          navigate(`/w/${workspaceSlug}/dms/${person.id}`)
                        }
                      >
                        Message
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Related Tasks */}
            {overview.relatedTasks.length > 0 && (
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <CheckSquare className="size-3.5" />
                    Tasks ({overview.relatedTasks.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {overview.relatedTasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => navigate(task.href)}
                      className="w-full text-left rounded-lg border border-border/50 bg-card p-2 text-xs transition-colors hover:bg-muted/40 hover:border-primary/40 block group"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {task.identifier || task.id.slice(0, 7)}
                        </span>
                        <Badge
                          variant={
                            task.status === 'DONE' ? 'outline' : 'secondary'
                          }
                          className="text-[9px] px-1 py-0 uppercase"
                        >
                          {task.status}
                        </Badge>
                      </div>
                      <div className="font-medium text-foreground group-hover:text-primary transition-colors truncate">
                        {task.title}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Related Messages */}
            {overview.relatedMessages.length > 0 && (
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="size-3.5" />
                    Messages ({overview.relatedMessages.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {overview.relatedMessages.map((msg) => (
                    <button
                      key={msg.id}
                      type="button"
                      onClick={() => navigate(msg.href)}
                      className="w-full text-left rounded-lg border border-border/50 bg-card p-2 text-xs transition-colors hover:bg-muted/40 hover:border-primary/40 block group"
                    >
                      <div className="flex items-center justify-between gap-1 mb-1 text-[10px] text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {msg.senderName}
                        </span>
                        <span>{msg.channelName ? `#${msg.channelName}` : ''}</span>
                      </div>
                      <p className="line-clamp-2 text-muted-foreground group-hover:text-foreground text-[11px]">
                        {msg.body}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Related Docs */}
            {overview.relatedDocs.length > 0 && (
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <FileText className="size-3.5" />
                    Documents ({overview.relatedDocs.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {overview.relatedDocs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => navigate(doc.href)}
                      className="w-full text-left rounded-lg border border-border/50 bg-card p-2 text-xs transition-colors hover:bg-muted/40 hover:border-primary/40 flex items-center justify-between group"
                    >
                      <span className="truncate font-medium text-foreground group-hover:text-primary">
                        {doc.title}
                      </span>
                      <ExternalLink className="size-3 text-muted-foreground shrink-0 ml-1" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Related Files */}
            {overview.relatedFiles.length > 0 && (
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Paperclip className="size-3.5" />
                    Files ({overview.relatedFiles.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {overview.relatedFiles.map((file) => (
                    <a
                      key={file.id}
                      href={file.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-lg border border-border/50 bg-card p-2 text-xs transition-colors hover:bg-muted/40 hover:border-primary/40 flex items-center justify-between group"
                    >
                      <div className="min-w-0 truncate">
                        <p className="font-medium text-foreground truncate group-hover:text-primary">
                          {file.filename}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatBytes(file.size)}
                        </p>
                      </div>
                      <ExternalLink className="size-3 text-muted-foreground shrink-0 ml-1" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Related Agents */}
            {overview.relatedAgents.length > 0 && (
              <div className="p-3 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  <span className="flex items-center gap-1.5">
                    <Bot className="size-3.5" />
                    Assigned Agents ({overview.relatedAgents.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {overview.relatedAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="rounded-lg border border-border/50 bg-card p-2 text-xs flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <Bot className="size-3.5 text-primary" />
                        <span className="font-medium text-foreground">
                          {agent.name}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {agent.model}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
