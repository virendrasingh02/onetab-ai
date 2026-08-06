import type { Accent } from '@org/design-system';
import { accentClasses, Button, Card, Page, PageHeader } from '@org/ui';
import { cn } from '@org/utils';
import {
  ArrowRight,
  CheckCircle,
  FileText,
  MessageSquare,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

interface ImportSource {
  id: string;
  name: string;
  format: string;
  description: string;
  cta: string;
  icon: LucideIcon;
  accent: Accent;
}

const SOURCES: ImportSource[] = [
  {
    id: 'slack',
    name: 'Import Slack workspace',
    format: 'JSON zip export package',
    description:
      'Upload your Slack export to recreate public channels, message history, user profiles and file attachments.',
    cta: 'Upload Slack export',
    icon: MessageSquare,
    accent: 'violet',
  },
  {
    id: 'notion',
    name: 'Import Notion workspace',
    format: 'Markdown & HTML export package',
    description:
      'Convert Notion pages, inline databases and wiki hierarchies into OneTab documents and boards.',
    cta: 'Upload Notion export',
    icon: FileText,
    accent: 'cyan',
  },
];

export function SlackNotionImportView() {
  const [importStatus, setImportStatus] = useState<'IDLE' | 'SUCCESS'>('IDLE');

  return (
    <Page>
      <PageHeader
        title="Import data"
        description="Bring channels, messages, attachments and pages into OneTab AI."
        icon={<UploadCloud />}
        accent="cyan"
      />

      <ul className="gap-6 md:grid-cols-2 grid grid-cols-1">
        {SOURCES.map((source) => {
          const Icon = source.icon;
          return (
            <li key={source.id}>
              <Card className="p-6 h-full justify-between">
                <div>
                  <div className="mb-3 gap-3 flex items-center">
                    <span
                      aria-hidden
                      className={cn(
                        'size-11 flex shrink-0 items-center justify-center rounded-lg',
                        accentClasses[source.accent].soft,
                      )}
                    >
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-foreground">
                        {source.name}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {source.format}
                      </p>
                    </div>
                  </div>
                  <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                    {source.description}
                  </p>
                </div>

                <Button
                  className="w-full"
                  size="sm"
                  onClick={() => setImportStatus('SUCCESS')}
                  trailingIcon={<ArrowRight />}
                >
                  {source.cta}
                </Button>
              </Card>
            </li>
          );
        })}
      </ul>

      {/*
        `role="status"` so the outcome is announced — previously the banner
        appeared silently for screen reader users.
      */}
      <div role="status" aria-live="polite">
        {importStatus === 'SUCCESS' ? (
          <p className="mt-6 gap-3 p-4 text-sm flex items-center rounded-xl border border-success/40 bg-success/10 text-success">
            <CheckCircle className="size-5 shrink-0" aria-hidden />
            Migration started. Channels and documents are being populated in the
            background.
          </p>
        ) : null}
      </div>
    </Page>
  );
}
