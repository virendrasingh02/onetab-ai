import { agentsApi } from '@org/api-client';
import { Badge, Button, Card, Input, Page, PageHeader, toast } from '@org/ui';
import { cn } from '@org/utils';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Bot,
  Flame,
  Layers,
  Search,
  Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { STUDIO_TEMPLATES, type StudioTemplate } from '../data/templates.js';
import { agentService } from '../services/agentService.js';
import { useStudioSession } from '../session-guard.js';

export function TemplatesPage() {
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

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
    { id: 'research', label: 'Web & Deep Research' },
    { id: 'automation', label: 'Automation & Monitoring' },
    { id: 'support', label: 'Customer Support & Knowledge' },
    { id: 'writer', label: 'Content & Editorial' },
    { id: 'multi-agent', label: 'Multi-Agent Systems' },
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
          const isFirecrawl = template.tags.includes('Firecrawl');
          const isPreselected = template.id === preselectedId;
          const isCreating =
            createFromTemplateMutation.isPending &&
            createFromTemplateMutation.variables?.id === template.id;
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
                        isFirecrawl
                          ? 'bg-warning/15 text-warning'
                          : 'bg-primary/10 text-primary'
                      }`}
                    >
                      {isFirecrawl ? (
                        <Flame className="size-5" />
                      ) : template.category === 'multi-agent' ? (
                        <Users className="size-5" />
                      ) : (
                        <Bot className="size-5" />
                      )}
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

                {/* Tags */}
                <div className="mt-3.5 flex flex-wrap gap-1">
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
