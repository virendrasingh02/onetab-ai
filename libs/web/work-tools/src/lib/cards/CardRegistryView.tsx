import {
  UniversalCardRenderer,
  useCardRegistryStore,
} from '@org/chat-ui';
import type { CardDefinition } from '@org/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@org/ui';
import {
  Building2,
  Copy,
  Download,
  Edit,
  Eye,
  GitPullRequest,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Search,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

export function CardRegistryView() {
  const { workspaceSlug } = useParams<{ workspaceSlug?: string }>();
  const navigate = useNavigate();

  const store = useCardRegistryStore();
  const allCards = Object.values(store.cards);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Preview Modal State
  const [previewCard, setPreviewCard] = useState<CardDefinition | null>(null);

  // Import Modal State
  const [importOpen, setImportOpen] = useState(false);
  const [importJsonText, setImportJsonText] = useState('');

  // Filtered Cards
  const filteredCards = useMemo(() => {
    return allCards.filter((card) => {
      const matchesSearch =
        card.name.toLowerCase().includes(search.toLowerCase()) ||
        (card.description && card.description.toLowerCase().includes(search.toLowerCase())) ||
        (card.tags && card.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));

      const matchesCat = categoryFilter === 'all' || card.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || card.status === statusFilter;

      return matchesSearch && matchesCat && matchesStatus;
    });
  }, [allCards, search, categoryFilter, statusFilter]);

  const handleCreateNew = () => {
    if (workspaceSlug) {
      navigate(`/w/${workspaceSlug}/cards/builder`);
    } else {
      navigate('/cards/builder');
    }
  };

  const handleEditCard = (cardId: string) => {
    if (workspaceSlug) {
      navigate(`/w/${workspaceSlug}/cards/${cardId}/builder`);
    } else {
      navigate(`/cards/${cardId}/builder`);
    }
  };

  const handleDuplicate = (cardId: string) => {
    const dup = store.duplicateCard(cardId);
    if (dup) {
      toast.success(`Duplicated "${dup.name}"`);
    }
  };

  const handleExport = (cardId: string) => {
    const json = store.exportCardJSON(cardId);
    if (json) {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cardId}.card.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Card definition exported.');
    }
  };

  const handleImportSubmit = () => {
    const res = store.importCardJSON(importJsonText);
    if (res.success && res.card) {
      toast.success(`Imported card "${res.card.name}"`);
      setImportOpen(false);
      setImportJsonText('');
    } else {
      toast.error(res.error || 'Failed to import card.');
    }
  };

  const getCardIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Building2':
        return <Building2 className="size-4 text-success" />;
      case 'GitPullRequest':
        return <GitPullRequest className="size-4 text-info-text" />;
      case 'ShieldAlert':
        return <ShieldAlert className="size-4 text-warning-text" />;
      case 'Sparkles':
        return <Sparkles className="size-4 text-accent-violet" />;
      default:
        return <LayoutGrid className="size-4 text-primary" />;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-y-auto">
      {/* Header Bar */}
      <div className="border-b border-border/80 bg-surface px-6 py-5 shrink-0">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="size-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                <LayoutGrid className="size-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Universal Card Registry
              </h1>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Platform-level custom card definitions rendered across Matrix Chat, AI Agent Responses, Workflows, Dashboards, and Inboxes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="text-xs h-8 gap-1.5"
            >
              <Upload className="size-3.5" />
              <span>Import JSON</span>
            </Button>

            <Button
              size="sm"
              onClick={handleCreateNew}
              className="text-xs h-8 gap-1.5 bg-primary text-primary-foreground shadow-xs"
            >
              <Plus className="size-3.5" />
              <span>Create Card</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto w-full p-6 space-y-6 flex-1">
        {/* Filters & Search Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-surface p-3 rounded-2xl border border-border/70 shadow-xs">
          <div className="relative flex-1 w-full">
            <Search className="size-3.5 absolute left-3 top-3 text-muted-foreground" />
            <Input
              placeholder="Search cards by name, description, tags…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 text-xs h-9 bg-surface-inset"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40 text-xs h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="crm">CRM &amp; Sales</SelectItem>
                <SelectItem value="development">Development</SelectItem>
                <SelectItem value="ai">AI &amp; Agents</SelectItem>
                <SelectItem value="productivity">Productivity</SelectItem>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 text-xs h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="text-xs">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map((card) => (
            <div
              key={card.cardId}
              className="p-5 rounded-2xl border border-border/80 bg-surface hover:border-primary/50 transition-all duration-200 shadow-xs hover:shadow-md flex flex-col justify-between gap-4 group"
            >
              {/* Card Top */}
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-surface-raised border border-border/70 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
                      {getCardIcon(card.icon)}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground tracking-tight">
                        {card.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5 font-mono text-[10px] text-muted-foreground">
                        <span className="uppercase font-semibold text-primary">{card.category}</span>
                        <span>·</span>
                        <span>v{card.version}</span>
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44 text-xs">
                      <DropdownMenuItem onClick={() => handleEditCard(card.cardId)}>
                        <Edit className="size-3.5 mr-2" />
                        Edit in Builder
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setPreviewCard(card)}>
                        <Eye className="size-3.5 mr-2" />
                        Preview Card
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(card.cardId)}>
                        <Copy className="size-3.5 mr-2" />
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleExport(card.cardId)}>
                        <Download className="size-3.5 mr-2" />
                        Export JSON
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => {
                          store.deleteCard(card.cardId);
                          toast.info(`Deleted "${card.name}"`);
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="size-3.5 mr-2" />
                        Delete Card
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {card.description || 'No description provided.'}
                </p>

                {/* Supported Surfaces Badges */}
                <div className="flex items-center gap-1 flex-wrap pt-1">
                  {card.supportedSurfaces?.map((s) => (
                    <span
                      key={s}
                      className="px-1.5 py-0.5 rounded bg-surface-raised border border-border/60 text-[9px] font-mono text-muted-foreground uppercase"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                <span className="text-[11px] text-muted-foreground">
                  Used <strong className="font-semibold text-foreground">{card.usageCount || 0}</strong> times
                </span>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setPreviewCard(card)}
                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                  >
                    Preview
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEditCard(card.cardId)}
                    className="h-7 text-xs px-2.5 gap-1 shadow-2xs"
                  >
                    <Edit className="size-3" />
                    <span>Edit</span>
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --- PREVIEW MODAL --- */}
      {previewCard && (
        <Dialog open={!!previewCard} onOpenChange={() => setPreviewCard(null)}>
          <DialogContent className="max-w-xl bg-surface border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                <Eye className="size-4 text-primary" />
                <span>Card Preview: {previewCard.name} (v{previewCard.version})</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Live interactive rendering of card template with mock sample data.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 flex justify-center">
              <UniversalCardRenderer cardDefinition={previewCard} data={previewCard.sampleData} />
            </div>

            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setPreviewCard(null)} className="text-xs">
                Close
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  const id = previewCard.cardId;
                  setPreviewCard(null);
                  handleEditCard(id);
                }}
                className="text-xs gap-1.5 bg-primary text-primary-foreground"
              >
                <Edit className="size-3.5" />
                <span>Open in Builder</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* --- IMPORT MODAL --- */}
      {importOpen && (
        <Dialog open={importOpen} onOpenChange={setImportOpen}>
          <DialogContent className="max-w-lg bg-surface border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold">
                <Upload className="size-4 text-primary" />
                <span>Import Card JSON</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Paste the exported JSON schema of a custom card definition.
              </DialogDescription>
            </DialogHeader>

            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste card JSON schema here…"
              rows={12}
              className="w-full p-3 font-mono text-xs bg-surface-inset text-foreground rounded-xl border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary"
            />

            <DialogFooter>
              <Button size="sm" variant="outline" onClick={() => setImportOpen(false)} className="text-xs">
                Cancel
              </Button>
              <Button size="sm" onClick={handleImportSubmit} className="text-xs bg-primary text-primary-foreground">
                Import Card
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
