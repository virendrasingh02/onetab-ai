import { Badge, Button, Card, Page, PageHeader } from '@org/ui';
import { BookOpen, Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface PromptTemplateItem {
  id: string;
  title: string;
  category: string;
  promptText: string;
}

const defaultPrompts: PromptTemplateItem[] = [
  {
    id: '1',
    title: 'Sprint review summary generator',
    category: 'Project management',
    promptText:
      'Analyze the following tasks and generate a 3-bullet sprint executive summary for stakeholders:',
  },
  {
    id: '2',
    title: 'Bug fix & code review',
    category: 'Development',
    promptText:
      'Review the following TypeScript code block for potential null pointer errors and memory leaks:',
  },
  {
    id: '3',
    title: 'Product requirements spec (PRD)',
    category: 'Product',
    promptText:
      'Structure a PRD document containing Goals, User Stories, Acceptance Criteria, and Tech Architecture for:',
  },
];

export function PromptLibraryView() {
  const [prompts] = useState<PromptTemplateItem[]>(defaultPrompts);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Clear the pending reset on unmount so it cannot fire against a gone tree.
  useEffect(() => () => clearTimeout(resetTimer.current), []);

  const handleCopy = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <Page>
      <PageHeader
        title="Prompt library"
        description="Pre-built and custom prompt templates for your team."
        icon={<BookOpen />}
        accent="blue"
      />

      {/* The copy result is announced rather than only shown on the button. */}
      <p aria-live="polite" className="sr-only">
        {copiedId ? 'Prompt copied to clipboard' : ''}
      </p>

      <ul className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
        {prompts.map((prompt) => (
          <li key={prompt.id}>
            <Card className="p-4 h-full justify-between transition-colors duration-(--duration-fast) hover:border-border-strong">
              <div>
                <Badge variant="primary" className="uppercase">
                  {prompt.category}
                </Badge>
                <h2 className="mt-2 mb-2 text-sm font-semibold text-foreground">
                  {prompt.title}
                </h2>
                <p className="p-2.5 text-xs line-clamp-3 rounded-lg border bg-surface-inset font-mono text-muted-foreground">
                  {prompt.promptText}
                </p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="mt-4 w-full"
                onClick={() => handleCopy(prompt.id, prompt.promptText)}
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
    </Page>
  );
}
