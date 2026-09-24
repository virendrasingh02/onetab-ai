import { agentsApi } from '@org/api-client';
import { Badge, Button, Input, LoadingState, toast } from '@org/ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowRight,
  Bot,
  Briefcase,
  Check,
  Cpu,
  Flame,
  Globe,
  Layers,
  Search,
  Sparkles,
  Users,
  Wrench,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { STUDIO_TEMPLATES, type StudioTemplate } from '../data/templates.js';
import { useStudioSession } from '../session-guard.js';

export function TemplatesPage() {
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [activeTemplate, setActiveTemplate] = useState<StudioTemplate | null>(() => {
    const preselect = searchParams.get('use');
    return STUDIO_TEMPLATES.find((t) => t.id === preselect) || null;
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: (template: StudioTemplate) =>
      agentsApi.create(activeWorkspace.id, {
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
      }),
    onSuccess: (newAgent) => {
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
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
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Workflow Templates
            </h1>
            <Badge variant="outline" className="text-xs">
              {STUDIO_TEMPLATES.length} pre-built
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Production-tested workflows inspired by Firecrawl Open Agent Builder concepts with web search, scraping, RAG, and approvals.
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search templates & tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1.5 overflow-x-auto border-b border-border pb-2.5 scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              selectedCategory === cat.id
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface text-muted-foreground hover:bg-surface-raised hover:text-foreground'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredTemplates.map((template) => {
          const isFirecrawl = template.tags.includes('Firecrawl');
          return (
            <div
              key={template.id}
              className="group flex flex-col justify-between rounded-xl border border-border bg-surface p-5 transition-all hover:border-primary/50 hover:shadow-md"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex size-9 items-center justify-center rounded-xl font-bold ${
                        isFirecrawl
                          ? 'bg-amber-500/15 text-amber-500'
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
                        {template.nodes.length} nodes · {template.edges.length} connections
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
                    <span
                      key={tag}
                      className="rounded bg-surface-raised px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground border border-border"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-3 text-xs">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {template.recommendedModel}
                </span>

                <Button
                  size="xs"
                  onClick={() => createFromTemplateMutation.mutate(template)}
                  loading={createFromTemplateMutation.isPending}
                  className="gap-1 font-semibold"
                >
                  <span>Use Template</span>
                  <ArrowRight className="size-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
