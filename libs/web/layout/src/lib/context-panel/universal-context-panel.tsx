import { MessagePreview } from '@org/chat-ui';
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
  AppSelect,
} from '@org/ui';
import {
  useContextOverview,
  useContextLinkMutations,
} from '@org/web-work-tools';
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

  const {
    data: overview,
    isLoading,
    error,
  } = useContextOverview(workspaceId, targetType, targetId);

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
    <div className="min-h-0 flex h-full flex-col bg-background text-foreground">
      {/* Header */}
      <div className="h-12 px-3 flex shrink-0 items-center justify-between border-b border-border">
        <div className="min-w-0 gap-2 flex items-center">
          <TargetIcon className="size-4 shrink-0 text-primary" />
          <span className="text-sm font-semibold truncate">{displayTitle}</span>
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
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
      <div className="gap-1.5 px-3 py-2 flex items-center border-b border-border/60 bg-muted/30">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={handleAskAI}
        >
          <Sparkles className="size-3.5" />
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
          className="p-3 space-y-2 text-xs border-b border-border bg-muted/40"
        >
          <div className="font-medium gap-1 flex items-center text-foreground">
            <Link2 className="size-3.5 text-primary" />
            Connect Existing Item
          </div>
          <div className="gap-2 grid grid-cols-2">
            <div>
              <label className="font-semibold text-[10px] text-muted-foreground uppercase">
                Type
              </label>
              <AppSelect
                size="sm"
                value={linkTargetType}
                onValueChange={setLinkTargetType}
                aria-label="Link type"
                options={[
                  { value: 'task', label: 'Task' },
                  { value: 'message', label: 'Message' },
                  { value: 'doc', label: 'Document' },
                  { value: 'file', label: 'File' },
                ]}
              />
            </div>
            <div>
              <label className="font-semibold text-[10px] text-muted-foreground uppercase">
                Relation
              </label>
              <AppSelect
                size="sm"
                value={linkRelationType}
                onValueChange={setLinkRelationType}
                aria-label="Relation"
                options={[
                  { value: 'RELATES_TO', label: 'Relates to' },
                  { value: 'RESOLVES', label: 'Resolves' },
                  { value: 'BLOCKED_BY', label: 'Blocked by' },
                  { value: 'DOCUMENTED_BY', label: 'Documented by' },
                ]}
              />
            </div>
          </div>
          <div>
            <label className="font-semibold text-[10px] text-muted-foreground uppercase">
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
          <div className="gap-1.5 pt-1 flex justify-end">
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
      <div className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto">
        {isLoading && (
          <div className="h-48 flex items-center justify-center">
            <Spinner className="size-6 text-primary" />
          </div>
        )}

        {error && !isLoading && (
          <div className="p-4 text-xs text-center text-destructive">
            Failed to load context overview.
          </div>
        )}

        {!isLoading &&
          overview &&
          totalLinkedItems === 0 &&
          !showAddLinkForm && (
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
                <div className="text-xs font-semibold tracking-wider flex items-center justify-between text-muted-foreground uppercase">
                  <span className="gap-1.5 flex items-center">
                    <Users className="size-3.5" />
                    People ({overview.relatedPeople.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {overview.relatedPeople.map((person) => (
                    <div
                      key={person.id}
                      className="p-2 text-xs flex items-center justify-between rounded-lg border border-border/50 bg-card transition-colors hover:bg-muted/40"
                    >
                      <div className="gap-2 min-w-0 flex items-center">
                        <div className="size-6 font-medium flex shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] text-primary">
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 truncate">
                          <p className="font-medium truncate text-foreground">
                            {person.name}
                          </p>
                          {person.role && (
                            <p className="truncate text-[10px] text-muted-foreground">
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
                <div className="text-xs font-semibold tracking-wider flex items-center justify-between text-muted-foreground uppercase">
                  <span className="gap-1.5 flex items-center">
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
                      className="p-2 text-xs group block w-full rounded-lg border border-border/50 bg-card text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
                    >
                      <div className="gap-1 mb-1 flex items-center justify-between">
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {task.identifier || task.id.slice(0, 7)}
                        </span>
                        <Badge
                          variant={
                            task.status === 'DONE' ? 'outline' : 'secondary'
                          }
                          className="px-1 py-0 text-[9px] uppercase"
                        >
                          {task.status}
                        </Badge>
                      </div>
                      <div className="font-medium truncate text-foreground transition-colors group-hover:text-primary">
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
                <div className="text-xs font-semibold tracking-wider flex items-center justify-between text-muted-foreground uppercase">
                  <span className="gap-1.5 flex items-center">
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
                      className="p-2 text-xs group block w-full rounded-lg border border-border/50 bg-card text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
                    >
                      <div className="gap-1 mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {msg.senderName}
                        </span>
                        <span>
                          {msg.channelName ? `#${msg.channelName}` : ''}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[11px] text-muted-foreground group-hover:text-foreground">
                        <MessagePreview text={msg.body} />
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Related Docs */}
            {overview.relatedDocs.length > 0 && (
              <div className="p-3 space-y-2">
                <div className="text-xs font-semibold tracking-wider flex items-center justify-between text-muted-foreground uppercase">
                  <span className="gap-1.5 flex items-center">
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
                      className="p-2 text-xs group flex w-full items-center justify-between rounded-lg border border-border/50 bg-card text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
                    >
                      <span className="font-medium truncate text-foreground group-hover:text-primary">
                        {doc.title}
                      </span>
                      <ExternalLink className="size-3 ml-1 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Related Files */}
            {overview.relatedFiles.length > 0 && (
              <div className="p-3 space-y-2">
                <div className="text-xs font-semibold tracking-wider flex items-center justify-between text-muted-foreground uppercase">
                  <span className="gap-1.5 flex items-center">
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
                      className="p-2 text-xs group flex items-center justify-between rounded-lg border border-border/50 bg-card transition-colors hover:border-primary/40 hover:bg-muted/40"
                    >
                      <div className="min-w-0 truncate">
                        <p className="font-medium truncate text-foreground group-hover:text-primary">
                          {file.filename}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatBytes(file.size)}
                        </p>
                      </div>
                      <ExternalLink className="size-3 ml-1 shrink-0 text-muted-foreground" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Related Agents */}
            {overview.relatedAgents.length > 0 && (
              <div className="p-3 space-y-2">
                <div className="text-xs font-semibold tracking-wider flex items-center justify-between text-muted-foreground uppercase">
                  <span className="gap-1.5 flex items-center">
                    <Bot className="size-3.5" />
                    Assigned Agents ({overview.relatedAgents.length})
                  </span>
                </div>
                <div className="space-y-1.5">
                  {overview.relatedAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="p-2 text-xs flex items-center justify-between rounded-lg border border-border/50 bg-card"
                    >
                      <div className="gap-2 flex items-center">
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
