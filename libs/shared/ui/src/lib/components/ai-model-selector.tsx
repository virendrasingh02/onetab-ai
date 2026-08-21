import { cn } from '@org/utils';
import {
  Check,
  ChevronDown,
  Gauge,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
} from 'react';
import { Badge } from './badge.js';


export interface AIModelOption {
  id: string;
  name: string;
  provider: 'OpenAI' | 'Anthropic' | 'Google' | 'DeepSeek' | 'Mistral' | 'NVIDIA' | 'Local';
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
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    contextWindow: '200k',
    speed: 'fast',
    costTier: '$$',
    capabilities: ['vision', 'code', 'tools', 'reasoning'],
    description: 'Industry-leading code generation, nuances, and agent workflows.',
    recommended: true,
    apiKeyConnected: true,
  },
  {
    id: 'claude-3-7-sonnet',
    name: 'Claude 3.7 Sonnet (Hybrid)',
    provider: 'Anthropic',
    contextWindow: '200k',
    speed: 'balanced',
    costTier: '$$',
    capabilities: ['reasoning', 'code', 'tools'],
    description: 'Hybrid reasoning and instantaneous response model.',
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
}

export function AIModelSelector({
  models = DEFAULT_AI_MODELS,
  value = 'gpt-4o',
  onChange,
  className,
}: AIModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedModel = models.find((m) => m.id === value) ?? models[0];

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

  // Group models by provider
  const providers = Array.from(new Set(models.map((m) => m.provider)));

  const handleSelect = (m: AIModelOption) => {
    onChange?.(m.id, m);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={cn('relative inline-block', className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className={cn(
          'flex h-7 items-center gap-1.5 rounded-btn border border-border bg-surface px-2.5 text-xs text-foreground shadow-xs cursor-pointer',
          'transition-all duration-(--duration-fast) hover:bg-accent hover:border-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        )}
      >
        <Sparkles className="size-3.5 text-primary" />
        <span className="font-medium">{selectedModel.name}</span>
        <Badge variant="secondary" className="font-mono text-[10px] h-4 px-1">
          {selectedModel.contextWindow}
        </Badge>
        <ChevronDown className={cn('size-3 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className={cn(
            'absolute left-0 top-full z-50 mt-1 w-80 rounded-popup border border-border bg-popover p-1.5 text-popover-foreground shadow-overlay',
            'animate-in fade-in-80 zoom-in-95 duration-100 max-h-96 overflow-y-auto scrollbar-subtle',
          )}
        >
          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle border-b border-border flex items-center justify-between">
            <span>Select AI Model</span>
            <span className="text-[10px] font-normal normal-case text-muted-foreground">Provider &amp; Specs</span>
          </div>

          <div className="divide-y divide-border/60">
            {providers.map((provider) => {
              const providerModels = models.filter((m) => m.provider === provider);

              return (
                <div key={provider} className="py-1">
                  <div className="px-2 py-1 text-[10px] font-bold text-subtle uppercase">
                    {provider}
                  </div>

                  {providerModels.map((m) => {
                    const isSelected = m.id === selectedModel.id;

                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleSelect(m)}
                        className={cn(
                          'flex w-full items-start justify-between rounded-sm p-2 text-left text-xs transition-colors cursor-pointer',
                          'hover:bg-accent hover:text-accent-foreground',
                          isSelected && 'bg-surface-raised font-medium text-foreground',
                        )}
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">{m.name}</span>
                            {m.recommended && (
                              <span className="rounded-xs bg-primary/15 text-primary-text px-1 py-0.2 text-[9px] font-bold">
                                REC
                              </span>
                            )}
                          </div>
                          {m.description && (
                            <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                              {m.description}
                            </p>
                          )}
                          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-subtle font-mono">
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

                        {isSelected && <Check className="size-4 text-primary shrink-0 mt-0.5" />}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
