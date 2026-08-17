import type { Accent } from '@org/design-system';
import { accentClasses, Button, Card, Page, PageHeader } from '@org/ui';
import { cn } from '@org/utils';
import {
  ArrowRight,
  CheckCircle,
  Download,
  FileText,
  HardDrive,
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

interface ExportOption {
  id: string;
  name: string;
  format: string;
  description: string;
  cta: string;
  icon: LucideIcon;
  accent: Accent;
}

const EXPORTS: ExportOption[] = [
  {
    id: 'export-workspace',
    name: 'Export Workspace Data',
    format: 'JSON zip archive',
    description:
      'Download a complete backup of workspace channels, message history, members, and settings.',
    cta: 'Download Workspace Export',
    icon: Download,
    accent: 'blue',
  },
  {
    id: 'export-files',
    name: 'Export Files & Attachments',
    format: 'ZIP media archive',
    description:
      'Package all uploaded files, images, documents, and canvas whiteboards into a single zip archive.',
    cta: 'Download Files Archive',
    icon: HardDrive,
    accent: 'amber',
  },
];

export function SlackNotionImportView({ embedded = false }: { embedded?: boolean } = {}) {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const content = (
    <div className="space-y-8">
      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wider text-subtle">
          Import Data
        </h2>
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
                        <h3 className="text-sm font-semibold text-foreground">
                          {source.name}
                        </h3>
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
                    onClick={() =>
                      setStatusMessage(
                        `Import started for ${source.name}. Data is populating in the background.`,
                      )
                    }
                    trailingIcon={<ArrowRight />}
                  >
                    {source.cta}
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wider text-subtle">
          Export Data
        </h2>
        <ul className="gap-6 md:grid-cols-2 grid grid-cols-1">
          {EXPORTS.map((exp) => {
            const Icon = exp.icon;
            return (
              <li key={exp.id}>
                <Card className="p-6 h-full justify-between">
                  <div>
                    <div className="mb-3 gap-3 flex items-center">
                      <span
                        aria-hidden
                        className={cn(
                          'size-11 flex shrink-0 items-center justify-center rounded-lg',
                          accentClasses[exp.accent].soft,
                        )}
                      >
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-foreground">
                          {exp.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {exp.format}
                        </p>
                      </div>
                    </div>
                    <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                      {exp.description}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    size="sm"
                    onClick={() =>
                      setStatusMessage(
                        `Export request created for ${exp.name}. Download link will be ready shortly.`,
                      )
                    }
                    trailingIcon={<Download />}
                  >
                    {exp.cta}
                  </Button>
                </Card>
              </li>
            );
          })}
        </ul>
      </div>

      <div role="status" aria-live="polite">
        {statusMessage ? (
          <p className="mt-6 gap-3 p-4 text-sm flex items-center rounded-xl border border-success/40 bg-success/10 text-success-text">
            <CheckCircle className="size-5 shrink-0" aria-hidden />
            {statusMessage}
          </p>
        ) : null}
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Page>
      <PageHeader
        title="Import & Export"
        description="Import channels and documents from Slack & Notion, or export your workspace data."
        icon={<UploadCloud />}
        accent="cyan"
      />
      {content}
    </Page>
  );
}
