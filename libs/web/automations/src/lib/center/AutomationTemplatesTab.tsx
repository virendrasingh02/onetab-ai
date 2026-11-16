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
import {
  useCurrentWorkspace,
  useWorkspacePermission,
} from '@org/web-workspace';
import { ArrowRight, Clock, Layers, Search } from 'lucide-react';
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
  const [selectedTemplate, setSelectedTemplate] =
    useState<WorkflowTemplate | null>(null);

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
            description:
              'It starts paused so you can configure credentials and review steps.',
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
      <div className="sm:flex-row sm:items-center gap-4 flex flex-col items-start justify-between">
        <div className="gap-1.5 p-1 flex flex-wrap rounded-lg bg-muted/60">
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

        <div className="sm:w-64 w-full">
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch('');
                setActiveCategory('all');
              }}
            >
              Reset filters
            </Button>
          }
        />
      ) : (
        <div className="md:grid-cols-2 lg:grid-cols-3 gap-4 grid grid-cols-1">
          {filteredTemplates.map((template) => {
            const graph = template.build();
            const nodeCount = graph.nodes.length;

            return (
              <Card
                key={template.id}
                className="p-5 flex flex-col justify-between transition-all hover:border-primary/50 hover:shadow-sm"
              >
                <div>
                  <div className="gap-2 mb-2 flex items-start justify-between">
                    <span className="text-2xl" role="img" aria-hidden="true">
                      ⚡
                    </span>
                    <Badge
                      variant="outline"
                      className="font-normal text-meta uppercase"
                    >
                      {template.category ?? 'automation'}
                    </Badge>
                  </div>

                  <h3 className="font-semibold text-base tracking-tight mb-1 line-clamp-1 text-foreground">
                    {template.name}
                  </h3>

                  <p className="text-sm mb-4 leading-relaxed line-clamp-3 text-muted-foreground">
                    {template.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-border/50">
                  <div className="text-xs mb-3 flex items-center justify-between text-muted-foreground">
                    <span className="gap-1 inline-flex items-center">
                      <Layers className="h-3.5 w-3.5" />
                      {nodeCount} steps
                    </span>
                    {template.estimatedTimeSaved && (
                      <span className="gap-1 font-medium inline-flex items-center text-primary">
                        <Clock className="h-3.5 w-3.5" />
                        Saves ~{template.estimatedTimeSaved}
                      </span>
                    )}
                  </div>

                  <div className="gap-2 flex items-center">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs w-full"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs w-full"
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
        <Dialog
          open={!!selectedTemplate}
          onOpenChange={(open) => !open && setSelectedTemplate(null)}
        >
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <div className="gap-3 flex items-center">
                <span className="text-3xl">⚡</span>
                <div>
                  <DialogTitle>{selectedTemplate.name}</DialogTitle>
                  <div className="gap-2 mt-1 flex items-center">
                    <Badge variant="outline" className="uppercase">
                      {selectedTemplate.category}
                    </Badge>
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
              <p className="text-sm leading-relaxed text-muted-foreground">
                {selectedTemplate.description}
              </p>

              <div>
                <h4 className="text-xs font-semibold tracking-wider mb-2 text-muted-foreground uppercase">
                  Workflow Steps Included
                </h4>
                <div className="space-y-2 max-h-56 pr-1 overflow-y-auto">
                  {(
                    selectedTemplate.build().nodes as Array<{
                      id: string;
                      data?: { label?: string; type?: string };
                    }>
                  ).map((n, i) => (
                    <div
                      key={n.id}
                      className="p-2.5 text-xs flex items-center justify-between rounded-md border border-border/60 bg-muted/30"
                    >
                      <div className="gap-2 flex items-center">
                        <span className="w-5 h-5 font-bold flex items-center justify-center rounded-full bg-primary/10 text-2xs text-primary">
                          {i + 1}
                        </span>
                        <span className="font-medium text-foreground">
                          {n.data?.label ?? n.id}
                        </span>
                      </div>
                      <Badge variant="outline" className="text-2xs">
                        {n.data?.type ?? 'STEP'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {selectedTemplate.tags && selectedTemplate.tags.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold tracking-wider mb-1.5 text-muted-foreground uppercase">
                    Tags
                  </h4>
                  <div className="gap-1.5 flex flex-wrap">
                    {selectedTemplate.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 rounded bg-secondary text-meta text-secondary-foreground"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </DialogBody>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSelectedTemplate(null)}
              >
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
