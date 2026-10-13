import { agentsApi } from '@org/api-client';
import { Badge, Button, Card, Input, Page, PageHeader, toast } from '@org/ui';
import { cn } from '@org/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Bot,
  Calendar,
  CheckSquare,
  Clock,
  CreditCard,
  FileCheck,
  GitPullRequest,
  Inbox,
  Layers,
  MapPin,
  Search,
  Target,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { STUDIO_TEMPLATES, type StudioTemplate } from '../data/templates.js';
import { agentService } from '../services/agentService.js';
import { useConnectors } from '../services/connectors.js';
import { useStudioSession } from '../session-guard.js';

/** The icons templates name in `StudioTemplate.icon`. */
const TEMPLATE_ICONS: Record<string, LucideIcon> = {
  Calendar,
  CheckSquare,
  Clock,
  CreditCard,
  FileCheck,
  GitPullRequest,
  Inbox,
  Layers,
  MapPin,
  Target,
};

/** Apps a template's steps use (`slack.send_message` → `SLACK`). */
const templateApps = (template: StudioTemplate) =>
  Array.from(new Set(template.requiredTools.filter((t) => t.includes('.')).map((t) => t.split('.')[0].toUpperCase())));

export function TemplatesPage() {
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const connectorsQuery = useConnectors();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  // `?use=<templateId>` (from the overview's quick-start links) highlights a template.
  const preselectedId = searchParams.get('use');
  useEffect(() => {
    if (!preselectedId) return;
    document
      .getElementById(`template-${preselectedId}`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [preselectedId]);

  const createFromTemplateMutation = useMutation({
    mutationFn: async (template: StudioTemplate) => {
      const payload = {
        name: template.name,
        role: template.name.replace('Agent', 'Specialist').trim(),
        description: template.description,
        systemPrompt: `You are an autonomous AI agent configured from the ${template.name} template.`,
        model: template.recommendedModel,
        provider: template.recommendedProvider,
        tools: template.requiredTools,
        graphJson: JSON.stringify({
          nodes: template.nodes,
          edges: template.edges,
        }),
      };
      try {
        return await agentsApi.create(activeWorkspace.id, payload);
      } catch {
        return agentService.createAgent(activeWorkspace.id, payload);
      }
    },
    onSuccess: (newAgent) => {
      queryClient.invalidateQueries({
        queryKey: ['agents', activeWorkspace.id],
      });
      toast.success(`Template installed! Opening builder…`);
      navigate(`/agents/${newAgent.id}`);
    },
    onError: (err: any) => {
      toast.error('Failed to clone template', { description: err?.message });
    },
  });

  const categories = [
    { id: 'all', label: 'All Templates' },
    { id: 'automation', label: 'Office & Automation' },
    { id: 'productivity', label: 'Daily Ops & Productivity' },
    { id: 'engineering', label: 'Engineering & DevOps' },
    { id: 'support', label: 'Support & Triage' },
    { id: 'multi-agent', label: 'Multi-App Workflows' },
  ];

  const filteredTemplates = STUDIO_TEMPLATES.filter((tpl) => {
    const matchesCat =
      selectedCategory === 'all' || tpl.category === selectedCategory;
    const matchesSearch =
      tpl.name.toLowerCase().includes(search.toLowerCase()) ||
      tpl.description.toLowerCase().includes(search.toLowerCase()) ||
      tpl.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()));
    return matchesCat && matchesSearch;
  });

  return (
    <Page width="wide" padding="none" className="space-y-6">
      {/* Header bar matching Admin */}
      <PageHeader
        title="Workflow Templates"
        description="Production-tested workflows inspired by Firecrawl Open Agent Builder concepts with web search, scraping, RAG, and approvals."
        icon={<Layers className="size-5" />}
        accent="violet"
        actions={
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Search templates & tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        }
      />

      {/* Category Tabs Toolbar matching Admin */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-border pb-2.5 scrollbar-none">
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={selectedCategory === cat.id ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setSelectedCategory(cat.id)}
            className="text-xs h-8 whitespace-nowrap"
          >
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Templates Grid using standard Card */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => {
          const isPreselected = template.id === preselectedId;
          const isCreating =
            createFromTemplateMutation.isPending &&
            createFromTemplateMutation.variables?.id === template.id;

          // Apps the template needs that aren't connected yet (unknown while loading).
          const missingApps = connectorsQuery.data
            ? templateApps(template).filter(
                (p) => connectorsQuery.data.find((c) => c.provider === p)?.status !== 'connected',
              )
            : null;
          const TemplateIcon = TEMPLATE_ICONS[template.icon] ?? (template.category === 'multi-agent' ? Users : Bot);

          return (
            <Card
              key={template.id}
              id={`template-${template.id}`}
              className={cn(
                'group flex flex-col justify-between p-5 transition-all hover:border-primary/50 hover:shadow-md',
                isPreselected && 'border-primary ring-2 ring-primary/30',
              )}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex size-9 items-center justify-center rounded-xl font-bold shrink-0 ${
                        template.category === 'automation'
                          ? 'bg-success/15 text-success-text'
                          : template.category === 'engineering'
                            ? 'bg-info/15 text-info-text'
                            : 'bg-primary/10 text-primary'
                      }`}
                    >
                      <TemplateIcon className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                        {template.name}
                      </h3>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {template.nodes.length} nodes ·{' '}
                        {template.edges.length} connections
                      </span>
                    </div>
                  </div>
                </div>

                <p className="mt-3 text-xs leading-relaxed text-muted-foreground line-clamp-3">
                  {template.description}
                </p>

                {missingApps && (
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
                        missingApps.length === 0
                          ? 'border-success/30 bg-success/10 text-success-text'
                          : 'border-warning/30 bg-warning/10 text-warning-text',
                      )}
                    >
                      <Zap className="size-2.5" aria-hidden="true" />
                      {missingApps.length === 0
                        ? 'All apps connected'
                        : `Connect ${missingApps.map((p) => p.charAt(0) + p.slice(1).toLowerCase().replace(/_/g, ' ')).join(', ')}`}
                    </span>
                  </div>
                )}

                {/* Tags */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {template.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="text-[10px] py-0 font-normal"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {template.recommendedModel}
                </span>

                <Button
                  size="xs"
                  variant="primary"
                  onClick={() => createFromTemplateMutation.mutate(template)}
                  loading={isCreating}
                  disabled={createFromTemplateMutation.isPending && !isCreating}
                  className="gap-1 font-semibold"
                >
                  <span>Use Template</span>
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </Page>
  );
}
