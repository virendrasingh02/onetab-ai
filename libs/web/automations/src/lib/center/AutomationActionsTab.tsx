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
  SearchInput,
} from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import { ExternalLink } from 'lucide-react';
import { NODE_CATALOG, type NodeCatalogItem } from '../workflow-catalog.js';

const CATEGORIES = [
  { id: 'all', label: 'All Actions' },
  { id: 'ai', label: 'AI & Intelligence' },
  { id: 'knowledge', label: 'Knowledge & Search' },
  { id: 'tools', label: 'Tools & Workspace' },
  { id: 'logic', label: 'Logic & Flow' },
] as const;

export function AutomationActionsTab() {
  const navigate = useNavigate();
  const { slug } = useCurrentWorkspace();

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState<NodeCatalogItem | null>(
    null,
  );

  const filteredItems = NODE_CATALOG.filter((item) => {
    // Exclude the root trigger node from the actions catalog
    if (item.type === 'TRIGGER' || item.category === 'triggers') return false;

    if (activeCategory !== 'all' && item.category !== activeCategory)
      return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchLabel = item.label.toLowerCase().includes(q);
      const matchDesc = item.description.toLowerCase().includes(q);
      const matchType = item.type.toLowerCase().includes(q);
      return matchLabel || matchDesc || matchType;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Search and Category Filter */}
      <div className="sm:flex-row sm:items-center gap-4 flex flex-col items-start justify-between">
        <div className="gap-1.5 p-1 flex flex-wrap rounded-lg bg-muted/60">
          {CATEGORIES.map((cat) => (
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
            placeholder="Search actions by name or type…"
            value={search}
            onValueChange={setSearch}
          />
        </div>
      </div>

      {/* Grid of Action Nodes */}
      <div className="md:grid-cols-2 lg:grid-cols-3 gap-4 grid grid-cols-1">
        {filteredItems.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.type}
              className="p-5 flex flex-col justify-between transition-colors hover:border-primary/50"
            >
              <div>
                <div className="gap-2 mb-2 flex items-start justify-between">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="font-mono text-meta">
                    {item.type}
                  </Badge>
                </div>

                <h3 className="font-semibold text-base mb-1 text-foreground">
                  {item.label}
                </h3>

                <p className="text-sm mb-4 leading-relaxed line-clamp-2 text-muted-foreground">
                  {item.description}
                </p>
              </div>

              <div className="pt-3 flex items-center justify-between border-t border-border/50">
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs h-8"
                  onClick={() => setSelectedAction(item)}
                >
                  View Details
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 gap-1"
                  onClick={() => navigate(`/w/${slug}/automations/builder/new`)}
                >
                  Use in Builder
                  <ExternalLink className="h-3 w-3 ml-0.5" />
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Details Dialog */}
      {selectedAction && (
        <Dialog
          open={!!selectedAction}
          onOpenChange={(open) => !open && setSelectedAction(null)}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <div className="gap-3 flex items-center">
                <div className="p-2 rounded-md bg-primary/10 text-primary">
                  <selectedAction.icon className="h-6 w-6" />
                </div>
                <div>
                  <DialogTitle>{selectedAction.label}</DialogTitle>
                  <Badge variant="outline" className="text-xs mt-1 font-mono">
                    {selectedAction.type}
                  </Badge>
                </div>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-4 py-2">
              <p className="text-sm leading-relaxed text-muted-foreground">
                {selectedAction.description}
              </p>

              <div>
                <h4 className="text-xs font-semibold tracking-wider mb-2 text-muted-foreground uppercase">
                  Configurable Parameters
                </h4>
                <div className="space-y-2 max-h-56 pr-1 overflow-y-auto">
                  {selectedAction.fields.map((f) => (
                    <div
                      key={f.key}
                      className="p-2.5 text-xs rounded-md border border-border/50 bg-muted/20"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <span className="font-medium text-foreground">
                          {f.label}
                        </span>
                        <code className="text-2xs text-muted-foreground">
                          {f.key} ({f.kind})
                        </code>
                      </div>
                      {f.hint && (
                        <p className="text-meta text-muted-foreground">
                          {f.hint}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {selectedAction.outputs && selectedAction.outputs.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold tracking-wider mb-1.5 text-muted-foreground uppercase">
                    Context Outputs
                  </h4>
                  <div className="gap-1.5 flex flex-wrap">
                    {selectedAction.outputs.map((out) => (
                      <span
                        key={out}
                        className="px-2 py-0.5 rounded bg-muted font-mono text-2xs text-foreground"
                      >
                        {`{{${selectedAction.type.toLowerCase()}.${out}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </DialogBody>

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedAction(null)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setSelectedAction(null);
                  navigate(`/w/${slug}/automations/builder/new`);
                }}
              >
                Open Workflow Builder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
