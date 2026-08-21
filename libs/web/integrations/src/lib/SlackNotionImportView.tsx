import type { Accent } from '@org/design-system';
import { accentClasses, Badge, Button, Card, Page, PageHeader } from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertTriangle,
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

export function SlackNotionImportView({
  embedded = false,
}: { embedded?: boolean } = {}) {
  /*
   * Neither side of this screen is wired to anything real. The "import"
   * buttons never read a Slack/Notion export — the API behind them (when
   * called at all) takes a channel list straight from the request body and
   * marks the job COMPLETED before any work happens. Export has no backend
   * at all: no ExportJob, no packaging, no download. This used to show a
   * green "Import started… populating in the background" / "Download link
   * will be ready shortly" toast on click with nothing behind it — the
   * clearest case in the app of a success message for something that never
   * ran. Until the real pipelines exist, every action here is disabled and
   * says so instead of pretending to work.
   */
  const content = (
    <div className="space-y-8">
      <div className="gap-2.5 p-4 text-xs flex items-start rounded-xl border border-accent-amber/30 bg-accent-amber/10 text-foreground">
        <AlertTriangle
          className="size-4 mt-0.5 shrink-0 text-accent-amber"
          aria-hidden
        />
        <p>
          Import and export aren&apos;t built yet — there is no Slack/Notion
          parser and no export pipeline behind this screen. The buttons below
          are disabled so nothing here can be mistaken for a real transfer.
        </p>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold tracking-wider text-foreground text-subtle uppercase">
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
                          Coming soon
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
                    disabled
                    title="Not implemented yet"
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
