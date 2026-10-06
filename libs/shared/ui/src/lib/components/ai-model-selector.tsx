import { cn } from '@org/utils';
import {
  Check,
  ChevronDown,
  Gauge,
  Layers,
  Search,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  useMemo,
  type KeyboardEvent,
} from 'react';
import { Badge } from './badge.js';
import { AIModelIcon } from '../ai/AIModelIcon.jsx';
import { AIProviderIcon } from '../ai/AIProviderIcon.jsx';
import { normalizeModel } from '../ai/model-normalizer.js';

export interface AIModelOption {
  id: string;
  name: string;
  provider: 'OpenAI' | 'Anthropic' | 'Google' | 'DeepSeek' | 'Mistral' | 'NVIDIA' | 'Local' | string;
  contextWindow: string; // e.g. "128k", "1M", "2M"
  speed: 'fast' | 'balanced' | 'deep';
  costTier: '$' | '$$' | '$$$' | 'Free';
  capabilities?: ('reasoning' | 'vision' | 'code' | 'tools')[];
  description?: string;
  recommended?: boolean;
  apiKeyConnected?: boolean;
}

export const DEFAULT_AI_MODELS: AIModelOption[] = [
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    contextWindow: '128k',
    speed: 'fast',
    costTier: '$$',
    capabilities: ['vision', 'code', 'tools'],
    description: 'High-intelligence flagship model for complex multi-modal tasks.',
    recommended: true,
    apiKeyConnected: true,
  },
  {
    id: 'gpt-5',
    name: 'GPT-5',
    provider: 'OpenAI',
    contextWindow: '256k',
    speed: 'balanced',
    costTier: '$$$',
    capabilities: ['reasoning', 'vision', 'code', 'tools'],
    description: 'Next-generation frontier reasoning and multimodal system.',
    recommended: true,
    apiKeyConnected: true,
  },
  {
    id: 'o1',
    name: 'OpenAI o1',
    provider: 'OpenAI',
    contextWindow: '200k',
    speed: 'deep',
    costTier: '$$$',
    capabilities: ['reasoning', 'code', 'tools'],
    description: 'State-of-the-art reasoning model for math, coding, and architecture.',
    apiKeyConnected: true,
  },
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet (Hybrid)',
    provider: 'Anthropic',
    contextWindow: '200k',
    speed: 'balanced',
    costTier: '$$',
    capabilities: ['reasoning', 'code', 'tools', 'vision'],
    description: 'Hybrid reasoning and instantaneous response model.',
    recommended: true,
    apiKeyConnected: true,
  },
  {
    id: 'claude-sonnet-4-5',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    contextWindow: '200k',
    speed: 'balanced',
    costTier: '$$',
    capabilities: ['reasoning', 'code', 'tools', 'vision'],
    description: 'Frontier Claude model for autonomous agents and complex coding.',
    recommended: true,
    apiKeyConnected: true,
  },
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    contextWindow: '200k',
    speed: 'fast',
    costTier: '$$',
    capabilities: ['vision', 'code', 'tools', 'reasoning'],
    description: 'Industry-leading code generation, nuances, and agent workflows.',
    apiKeyConnected: true,
  },
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    provider: 'Google',
    contextWindow: '2M',
    speed: 'balanced',
    costTier: '$$',
    capabilities: ['vision', 'tools', 'code', 'reasoning'],
    description: 'Frontier multimodal model with 2M token context window.',
    recommended: true,
    apiKeyConnected: true,
  },
  {
    id: 'gemini-2-0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    contextWindow: '1M',
    speed: 'fast',
    costTier: '$',
    capabilities: ['vision', 'tools', 'code'],
    description: 'Ultra-fast next-gen multimodal with 1 million token context.',
    apiKeyConnected: true,
  },
  {
    id: 'deepseek-r1',
    name: 'DeepSeek R1',
    provider: 'DeepSeek',
    contextWindow: '64k',
    speed: 'deep',
    costTier: '$',
    capabilities: ['reasoning', 'code'],
    description: 'Open-weights reasoning powerhouse with visible chain of thought.',
    apiKeyConnected: true,
  },
];

export interface AIModelSelectorProps {
  models?: AIModelOption[];
  value?: string;
  onChange?: (modelId: string, model: AIModelOption) => void;
  className?: string;
  variant?: 'default' | 'compact' | 'subtle';
}

export function AIModelSelector({
  models = DEFAULT_AI_MODELS,
  value = 'gpt-4o',
  onChange,
  className,
  variant = 'default',
}: AIModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedModel = useMemo(() => {
    return models.find((m) => m.id === value) ?? models[0];
  }, [models, value]);

  const selectedMeta = useMemo(() => {
    return normalizeModel(selectedModel.id, selectedModel.provider);
  }, [selectedModel]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      window.addEventListener('click', handleOutsideClick);
      // Focus search input when popover opens
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

  // Filtered models
  const filteredModels = useMemo(() => {
    if (!search.trim()) return models;
    const q = search.toLowerCase();
    return models.filter((m) => {
      return (
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q) ||
        m.capabilities?.some((c) => c.toLowerCase().includes(q)) ||
        m.description?.toLowerCase().includes(q)
      );
    });
  }, [models, search]);

  // Group filtered models by provider
  const providers = useMemo(() => {
    return Array.from(new Set(filteredModels.map((m) => m.provider)));
  }, [filteredModels]);

  const handleSelect = (m: AIModelOption) => {
    onChange?.(m.id, m);
    setIsOpen(false);
    setSearch('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div
      ref={containerRef}
      onKeyDown={handleKeyDown}
      className={cn('relative inline-block', className)}
    >
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`Select AI Model. Current: ${selectedModel.name} by ${selectedModel.provider}`}
        className={cn(
          'flex h-7 items-center gap-1.5 rounded-btn border border-border bg-surface px-2.5 text-xs text-foreground shadow-xs cursor-pointer',
          'transition-all duration-(--duration-fast) hover:bg-accent hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          isOpen && 'border-primary ring-1 ring-primary/30'
        )}
      >
        <AIModelIcon
          modelId={selectedModel.id}
          provider={selectedModel.provider}
          variant="color"
          size={14}
        />
        <span className="font-medium truncate max-w-[140px] sm:max-w-[200px]">
          {selectedModel.name}
        </span>
        {selectedModel.contextWindow && selectedModel.contextWindow !== 'N/A' && (
          <Badge variant="secondary" className="font-mono text-[10px] h-4 px-1 shrink-0">
            {selectedModel.contextWindow}
          </Badge>
        )}
        <ChevronDown className={cn('size-3 text-muted-foreground transition-transform shrink-0', isOpen && 'rotate-180')} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="listbox"
          aria-label="AI Model options"
          className={cn(
            'absolute left-0 top-full z-50 mt-1 w-84 rounded-popup border border-border bg-popover p-1.5 text-popover-foreground shadow-overlay',
            'max-h-96 overflow-y-auto scrollbar-subtle animate-in fade-in zoom-in-95 duration-100'
          )}
        >
          {/* Search box inside dropdown */}
          <div className="relative mb-1.5 px-1">
            <Search className="size-3.5 absolute left-3 top-2.5 text-muted-foreground" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search models, providers or reasoning..."
              className="w-full h-8 pl-8 pr-2 text-xs rounded-md border border-border bg-surface-inset text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>

          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-border/60 flex items-center justify-between">
            <span>AI Foundation Models</span>
            <span>{filteredModels.length} models</span>
          </div>

          {filteredModels.length === 0 ? (
            <div className="p-4 text-center text-xs text-muted-foreground">
              No matching AI models found.
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {providers.map((provider) => {
                const providerModels = filteredModels.filter((m) => m.provider === provider);

                return (
                  <div key={provider} className="py-1">
                    <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1.5">
                      <AIProviderIcon provider={provider} size={12} variant="color" />
                      <span>{provider}</span>
                    </div>

                    {providerModels.map((m) => {
                      const isSelected = m.id === selectedModel.id;
                      const modelCaps = m.capabilities || [];

                      return (
                        <button
                          key={m.id}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          onClick={() => handleSelect(m)}
                          className={cn(
                            'flex w-full items-start justify-between rounded-md p-2 text-left text-xs transition-colors cursor-pointer',
                            'hover:bg-accent hover:text-accent-foreground',
                            isSelected && 'bg-surface-raised font-medium text-foreground',
                          )}
                        >
                          <div className="flex items-start gap-2 min-w-0 flex-1 pr-2">
                            <div className="mt-0.5 shrink-0">
                              <AIModelIcon
                                modelId={m.id}
                                provider={m.provider}
                                variant="color"
                                size={16}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground truncate">{m.name}</span>
                                {m.recommended && (
                                  <span className="rounded-xs bg-primary/15 text-primary-text px-1 py-0.2 text-[9px] font-bold shrink-0">
                                    REC
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                                <span>{m.provider}</span>
                                {modelCaps.length > 0 && (
                                  <>
                                    <span className="opacity-40">·</span>
                                    <span>{modelCaps.slice(0, 2).map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(' · ')}</span>
                                  </>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground font-mono">
                                <span className="flex items-center gap-0.5">
                                  <Layers className="size-2.5" />
                                  {m.contextWindow}
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <Gauge className="size-2.5" />
                                  {m.speed}
                                </span>
                                <span className="flex items-center gap-0.5 text-foreground/80 font-bold">
                                  {m.costTier}
                                </span>
                              </div>
                            </div>
                          </div>

                          {isSelected && <Check className="size-4 text-primary shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
