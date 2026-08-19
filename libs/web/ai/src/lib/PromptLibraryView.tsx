import type { PromptTemplate } from '@org/types';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  EmptyState,
  ErrorState,
  Input,
  Label,
  LoadingState,
  Page,
  PageHeader,
  Textarea,
  usePromptDialog,
} from '@org/ui';
import { BookOpen, Check, Copy, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  usePromptTemplateMutations,
  usePromptTemplates,
} from './use-ai.js';

export function PromptLibraryView() {
  const query = usePromptTemplates();
  const { create, remove } = usePromptTemplateMutations();
  const promptDialog = usePromptDialog();

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: '',
    category: '',
    promptText: '',
  });
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Clear the pending reset on unmount so it cannot fire against a gone tree.
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopiedId(null), 2000);
  };

  /* Removing a template takes it away from the whole workspace, so ask first. */
  const confirmDelete = async (title: string, id: string) => {
    const confirmed = await promptDialog.confirmAction({
      title: `Delete “${title}”?`,
      description:
        'This template is removed for everyone in the workspace. This cannot be undone.',
      confirmLabel: 'Delete template',
      destructive: true,
    });
    if (confirmed) remove.mutate(id);
  };

  const submit = async () => {
    if (!draft.title.trim() || !draft.promptText.trim()) return;
    await create.mutateAsync({
      title: draft.title.trim(),
      category: draft.category.trim() || undefined,
      promptText: draft.promptText.trim(),
    });
    setDraft({ title: '', category: '', promptText: '' });
    setIsCreateOpen(false);
  };

  const prompts: PromptTemplate[] = query.data ?? [];

  return (
    <Page>
      <PageHeader
        title="Prompt library"
        description="Pre-built and custom prompt templates for your team."
        icon={<BookOpen />}
        accent="blue"
        actions={
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button leadingIcon={<Plus />}>New template</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New prompt template</DialogTitle>
              </DialogHeader>

              <div className="gap-4 flex flex-col">
                <div className="space-y-1.5">
                  <Label htmlFor="prompt-title">Title</Label>
                  <Input
                    id="prompt-title"
                    value={draft.title}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Sprint review summary generator"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prompt-category">
                    Category{' '}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="prompt-category"
                    value={draft.category}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        category: event.target.value,
                      }))
                    }
                    placeholder="Project management"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prompt-text">Prompt</Label>
                  <Textarea
                    id="prompt-text"
                    value={draft.promptText}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        promptText: event.target.value,
                      }))
                    }
                    rows={6}
                    placeholder="Analyze the following tasks and generate a 3-bullet summary for stakeholders:"
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="ghost"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={create.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => void submit()}
                  disabled={
                    !draft.title.trim() ||
                    !draft.promptText.trim() ||
                    create.isPending
                  }
                >
                  {create.isPending ? 'Saving…' : 'Save template'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* The copy result is announced rather than only shown on the button. */}
      <p aria-live="polite" className="sr-only">
        {copiedId ? 'Prompt copied to clipboard' : ''}
      </p>

      {query.isLoading ? (
        <LoadingState label="Loading prompt templates…" />
      ) : query.isError ? (
        <ErrorState
          title="Could not load the prompt library"
          description="This workspace's templates are unavailable."
        />
      ) : prompts.length === 0 ? (
        <EmptyState
          icon={<BookOpen />}
          title="No templates yet"
          description="Save the prompts your team keeps retyping so everyone starts from the same place."
          action={
            <Button
              leadingIcon={<Plus />}
              onClick={() => setIsCreateOpen(true)}
            >
              New template
            </Button>
          }
        />
      ) : (
        <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
          {prompts.map((prompt) => (
            <li key={prompt.id}>
              <Card className="group p-4 h-full justify-between transition-colors duration-(--duration-fast) hover:border-border-strong">
                <div>
                  <div className="gap-2 flex items-center justify-between">
                    <Badge variant="primary" className="uppercase">
                      {prompt.category}
                    </Badge>
                    {/* System templates are shared across workspaces, so this
                        workspace cannot delete them. */}
                    {prompt.isSystem ? (
                      <Badge variant="neutral">Built-in</Badge>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Delete ${prompt.title}`}
                        disabled={remove.isPending}
                        onClick={() => confirmDelete(prompt.title, prompt.id)}
                        className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <h2 className="mt-2 mb-2 text-sm font-semibold text-foreground">
                    {prompt.title}
                  </h2>
                  <p className="p-2.5 text-xs line-clamp-3 rounded-card border border-border bg-surface-inset font-mono text-muted-foreground">
                    {prompt.promptText}
                  </p>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  className="mt-4 w-full"
                  onClick={() => void handleCopy(prompt.id, prompt.promptText)}
                  leadingIcon={
                    copiedId === prompt.id ? (
                      <Check className="text-success" />
                    ) : (
                      <Copy />
                    )
                  }
                >
                  {copiedId === prompt.id ? 'Copied' : 'Use prompt'}
                </Button>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {promptDialog.dialog}
    </Page>
  );
}
