import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  SearchInput,
  toast,
} from '@org/ui';
import { useCurrentWorkspace, useWorkspacePermission } from '@org/web-workspace';
import {
  ArrowRight,
  Clock,
  Layers,
  Search,
} from 'lucide-react';
import { useWorkflowMutations, useWorkflows } from '../use-automations.js';
import {
  WORKFLOW_TEMPLATES,
  type WorkflowTemplate,
} from '../workflow-templates.js';

const CATEGORY_TABS = [
  { id: 'all', label: 'All Templates' },
  { id: 'ai', label: 'AI & Agents' },
  { id: 'productivity', label: 'Productivity' },
  { id: 'communication', label: 'Communication' },
  { id: 'engineering', label: 'Engineering' },
  { id: 'governance', label: 'Governance' },
  { id: 'sync', label: 'Data Sync' },
] as const;

export function AutomationTemplatesTab() {
  const navigate = useNavigate();
  const { workspaceId, slug } = useCurrentWorkspace();
  const { can } = useWorkspacePermission();
  const workflowsQuery = useWorkflows(workspaceId);
  const { create } = useWorkflowMutations(workspaceId);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);

  const workflows = workflowsQuery.data ?? [];

  const filteredTemplates = WORKFLOW_TEMPLATES.filter((tpl) => {
    if (activeCategory !== 'all' && tpl.category !== activeCategory) {
      return false;
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = tpl.name.toLowerCase().includes(q);
      const matchDesc = tpl.description.toLowerCase().includes(q);
      const matchTags = tpl.tags?.some((t) => t.toLowerCase().includes(q));
      return matchName || matchDesc || matchTags;
    }
    return true;
  });

  const handleInstall = (template: WorkflowTemplate) => {
    if (!can('create')) {
      toast.error('You do not have permission to create automations');
      return;
    }
    const graph = template.build();
    const taken = new Set(workflows.map((w) => w.name));
    let name = template.name;
    for (let n = 2; taken.has(name); n++) name = `${template.name} (${n})`;

    create.mutate(
      {
        name,
        description: template.description,
        triggerType: graph.triggerType,
        nodesJson: JSON.stringify(graph.nodes),
        edgesJson: JSON.stringify(graph.edges),
        isActive: false,
      },
      {
        onSuccess: (wf) => {
          setSelectedTemplate(null);
          toast.success(`Created “${name}” from template`, {
            description: 'It starts paused so you can configure credentials and review steps.',
          });
          navigate(`/w/${slug}/automations/builder/${wf.id}`);
        },
        onError: () => {
          toast.error(`Could not create automation from “${template.name}”`);
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Header filter bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-1.5 p-1 bg-muted/60 rounded-lg">
          {CATEGORY_TABS.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeCategory === cat.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="w-full sm:w-64">
          <SearchInput
            placeholder="Search templates or tags…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
      </div>

      {/* Grid of templates */}
      {filteredTemplates.length === 0 ? (
        <EmptyState
          icon={<Search className="size-8" />}
          title="No templates match your search"
          description="Try adjusting your category or search terms to explore available automation templates."
          action={
            <Button variant="outline" size="sm" onClick={() => { setSearch(''); setActiveCategory('all'); }}>
              Reset filters
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const graph = template.build();
            const nodeCount = graph.nodes.length;

            return (
              <Card
                key={template.id}
                className="flex flex-col justify-between p-5 hover:border-primary/50 transition-all hover:shadow-sm"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-2xl" role="img" aria-hidden="true">
                      ⚡
                    </span>
                    <Badge variant="outline" className="text-[11px] font-normal uppercase">
                      {template.category ?? 'automation'}
                    </Badge>
                  </div>

                  <h3 className="font-semibold text-base tracking-tight text-foreground line-clamp-1 mb-1">
                    {template.name}
                  </h3>

                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4 leading-relaxed">
                    {template.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/50">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                    <span className="inline-flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5" />
                      {nodeCount} steps
                    </span>
                    {template.estimatedTimeSaved && (
                      <span className="inline-flex items-center gap-1 text-primary font-medium">
                        <Clock className="h-3.5 w-3.5" />
                        Saves ~{template.estimatedTimeSaved}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => handleInstall(template)}
                      disabled={create.isPending}
                    >
                      Use Template
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Preview Dialog */}
      {selectedTemplate && (
        <Dialog open={!!selectedTemplate} onOpenChange={(open) => !open && setSelectedTemplate(null)}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <span className="text-3xl">⚡</span>
                <div>
                  <DialogTitle>{selectedTemplate.name}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="uppercase">{selectedTemplate.category}</Badge>
                    {selectedTemplate.estimatedTimeSaved && (
                      <span className="text-xs text-muted-foreground">
                        Saves ~{selectedTemplate.estimatedTimeSaved}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {selectedTemplate.description}
              </p>

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Workflow Steps Included
                </h4>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {(selectedTemplate.build().nodes as Array<{ id: string; data?: { label?: string; type?: string } }>).map((n, i) => (
                    <div
                      key={n.id}
                      className="flex items-center justify-between p-2.5 rounded-md border border-border/60 bg-muted/30 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-[10px]">
                          {i + 1}
                        </span>
                        <span className="font-medium text-foreground">{n.data?.label ?? n.id}</span>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {n.data?.type ?? 'STEP'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTemplate.tags && selectedTemplate.tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                    Tags
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTemplate.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded text-[11px] bg-secondary text-secondary-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </DialogBody>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => handleInstall(selectedTemplate)}
                disabled={create.isPending}
              >
                Create Automation from Template
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
