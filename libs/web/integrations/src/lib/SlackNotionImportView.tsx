import type { Accent } from '@org/design-system';
import { accentClasses, Badge, Button, Card, Page, PageHeader } from '@org/ui';
import { cn } from '@org/utils';
import {
  Download,
  FileText,
  HardDrive,
  MessageSquare,
  UploadCloud,
  type LucideIcon,
} from 'lucide-react';

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

import { MigrationCenterView } from './migration-center-view.js';

export function SlackNotionImportView({
  embedded = false,
}: { embedded?: boolean } = {}) {
  const content = (
    <div className="space-y-10">
      {/* Production Slack Migration Center */}
      <MigrationCenterView embedded />

      {/* Other File Archive Import & Export Tools */}
      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-wider text-foreground text-subtle uppercase">
          Additional Import & Export Formats
        </h2>
        <ul className="gap-6 md:grid-cols-2 grid grid-cols-1">
          {SOURCES.filter((s) => s.id !== 'slack').map((source) => {
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
                      <div className="min-w-0 gap-2 flex items-center">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            {source.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {source.format}
                          </p>
                        </div>
                        <Badge
                          variant="neutral"
                          className="shrink-0 text-[10px]"
                        >
                          Beta
                        </Badge>
                      </div>
                    </div>
                    <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                      {source.description}
                    </p>
                  </div>

                  <Button
                    className="w-full"
                    size="sm"
                    variant="outline"
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
        <h2 className="mb-3 text-sm font-semibold tracking-wider text-foreground text-subtle uppercase">
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
                      <div className="min-w-0 gap-2 flex items-center">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground">
                            {exp.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {exp.format}
                          </p>
                        </div>
                        <Badge
                          variant="neutral"
                          className="shrink-0 text-[10px]"
                        >
                          Coming soon
                        </Badge>
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
                    disabled
                    title="Not implemented yet"
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
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <Page>
      <PageHeader
        title="Import & Export"
        description="Import channels and documents from Slack & Notion, or export your workspace data — both coming soon."
        icon={<UploadCloud />}
        accent="cyan"
      />
      {content}
    </Page>
  );
}
