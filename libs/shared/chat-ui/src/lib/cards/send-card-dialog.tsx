import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Building2,
  ChevronRight,
  FileText,
  GitPullRequest,
  LayoutGrid,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useCardRegistryStore } from './card-registry-store.js';
import { UniversalCardRenderer } from './universal-card-renderer.js';

export interface SendCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSendCard: (cardId: string, version: number, data: Record<string, unknown>) => void | Promise<void>;
}

export function SendCardDialog({ open, onOpenChange, onSendCard }: SendCardDialogProps) {
  /*
   * Selected as the raw map, not `Object.values(...).filter(...)` inline: a
   * zustand selector's result is compared by reference, and building a new
   * array on every call — even when `s.cards` hasn't changed — never
   * compares equal to the last one. That forces another render, which calls
   * the selector again, which builds another new array: an infinite loop.
   * Deriving the filtered list with `useMemo` below keeps it array-shaped
   * only when `cardsById` itself actually changes.
   */
  const cardsById = useCardRegistryStore((s) => s.cards);
  const cards = useMemo(
    () => Object.values(cardsById).filter((c) => c.status !== 'archived'),
    [cardsById],
  );
  const [selectedCardId, setSelectedCardId] = useState<string>(cards[0]?.cardId || 'crm-lead');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [step, setStep] = useState<'select' | 'configure'>('select');

  const selectedCard = useMemo(
    () => cards.find((c) => c.cardId === selectedCardId) || cards[0],
    [cards, selectedCardId],
  );

  // Initialize form data with default values when selecting a card
  React.useEffect(() => {
    if (selectedCard) {
      const initial: Record<string, unknown> = {};
      if (selectedCard.schema?.fields) {
        for (const [key, field] of Object.entries(selectedCard.schema.fields)) {
          initial[key] = field.defaultValue !== undefined ? field.defaultValue : '';
        }
      }
      setFormData(initial);
    }
  }, [selectedCard]);

  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.description && c.description.toLowerCase().includes(search.toLowerCase())) ||
        (c.tags && c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));

      const matchesCat = categoryFilter === 'all' || c.category === categoryFilter;

      return matchesSearch && matchesCat;
    });
  }, [cards, search, categoryFilter]);

  const handleFieldChange = (key: string, value: unknown) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSend = async () => {
    if (!selectedCard) return;

    // Validate required fields
    if (selectedCard.schema?.fields) {
      for (const [key, field] of Object.entries(selectedCard.schema.fields)) {
        if (field.required && (formData[key] === undefined || formData[key] === '' || formData[key] === null)) {
          toast.error(`Please fill in the required field: "${field.label}"`);
          return;
        }
      }
    }

    try {
      await onSendCard(selectedCard.cardId, selectedCard.version || 1, formData);
      toast.success(`Sent "${selectedCard.name}" card to room.`);
      onOpenChange(false);
      setStep('select');
    } catch {
      toast.error('Failed to send card to room.');
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-surface border-border text-foreground p-0 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <DialogHeader className="p-4 border-b border-border/60">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <LayoutGrid className="size-4 text-primary" />
              <span>Send Universal Card</span>
            </DialogTitle>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setStep('select')}
                className={cn(
                  'px-2 py-1 rounded font-semibold transition-colors',
                  step === 'select' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                1. Select Card
              </button>
              <ChevronRight className="size-3 text-muted-foreground" />
              <button
                type="button"
                onClick={() => setStep('configure')}
                className={cn(
                  'px-2 py-1 rounded font-semibold transition-colors',
                  step === 'configure' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                2. Enter Data &amp; Preview
              </button>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Choose a registered card template from your workspace and populate dynamic fields to send inside Matrix chat.
          </DialogDescription>
        </DialogHeader>

        {/* Content Body */}
        {step === 'select' ? (
          <div className="p-4 overflow-y-auto space-y-4 flex-1">
            {/* Search & Filters */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
                <Input
                  placeholder="Search registered cards…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 text-xs h-8"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-36 text-xs h-8">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent className="text-xs">
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="crm">CRM &amp; Sales</SelectItem>
                  <SelectItem value="development">Development</SelectItem>
                  <SelectItem value="ai">AI &amp; Agents</SelectItem>
                  <SelectItem value="productivity">Productivity</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredCards.map((c) => {
                const isSelected = selectedCardId === c.cardId;
                return (
                  <button
                    key={c.cardId}
                    type="button"
                    onClick={() => {
                      setSelectedCardId(c.cardId);
                      setStep('configure');
                    }}
                    className={cn(
                      'p-3 rounded-xl border text-left transition-all flex flex-col justify-between gap-2 cursor-pointer',
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary/40 shadow-xs'
                        : 'border-border/80 bg-surface-raised hover:bg-accent/60',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="size-8 rounded-lg bg-surface flex items-center justify-center border border-border/60">
                          {getCardIcon(c.icon)}
                        </div>
                        <div>
                          <span className="font-bold text-xs text-foreground block">{c.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase font-mono">{c.category} · v{c.version}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[9px] py-0 h-4 capitalize">
                        {c.status}
                      </Badge>
                    </div>
                    {c.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                        {c.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 flex-1 overflow-hidden">
            {/* Left: Dynamic Form based on schema */}
            <div className="p-4 border-r border-border/60 overflow-y-auto space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2">
                <span className="font-bold text-xs text-foreground flex items-center gap-1.5">
                  <FileText className="size-3.5 text-primary" />
                  <span>Card Data Fields</span>
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {selectedCard.name} (v{selectedCard.version})
                </span>
              </div>

              {selectedCard.schema?.fields && Object.keys(selectedCard.schema.fields).length > 0 ? (
                Object.entries(selectedCard.schema.fields).map(([key, field]) => (
                  <div key={key} className="space-y-1">
                    <Label className="text-xs font-semibold text-foreground flex items-center gap-1">
                      <span>{field.label}</span>
                      {field.required && <span className="text-destructive">*</span>}
                    </Label>

                    {field.type === 'enum' && field.options ? (
                      <Select
                        value={String(formData[key] || '')}
                        onValueChange={(val) => handleFieldChange(key, val)}
                      >
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue placeholder="Select an option…" />
                        </SelectTrigger>
                        <SelectContent className="text-xs">
                          {field.options.map((opt) => (
                            <SelectItem key={String(opt.value)} value={String(opt.value)}>
                              {opt.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={field.type === 'number' ? 'number' : 'text'}
                        value={String(formData[key] ?? '')}
                        onChange={(e) =>
                          handleFieldChange(
                            key,
                            field.type === 'number' ? Number(e.target.value) : e.target.value,
                          )
                        }
                        className="text-xs h-8"
                      />
                    )}
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic">No schema fields required for this card.</p>
              )}
            </div>

            {/* Right: Live Interactive Card Preview */}
            <div className="p-4 bg-surface-inset overflow-y-auto flex flex-col justify-center items-center">
              <div className="w-full max-w-md">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                  Live Card Preview
                </span>
                <UniversalCardRenderer
                  cardDefinition={selectedCard}
                  data={formData}
                  isInteractive={false}
                />
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <DialogFooter className="p-3 border-t border-border/60 flex items-center justify-between sm:justify-between bg-surface">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (step === 'configure') setStep('select');
              else onOpenChange(false);
            }}
            className="text-xs"
          >
            {step === 'configure' ? '← Back to Templates' : 'Cancel'}
          </Button>

          {step === 'select' ? (
            <Button
              type="button"
              size="sm"
              onClick={() => setStep('configure')}
              className="text-xs gap-1.5"
            >
              <span>Continue</span>
              <ChevronRight className="size-3" />
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleSend}
              className="text-xs gap-1.5 bg-primary text-primary-foreground shadow-xs"
            >
              <Send className="size-3.5" />
              <span>Send Card</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
