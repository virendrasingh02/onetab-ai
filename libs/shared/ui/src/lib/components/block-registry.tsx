import { Sparkles } from 'lucide-react';
import { Badge } from './badge.js';
import { Button } from './button.js';
import { CodeBlock } from '../code-block/index.js';
import { StatCard } from './stat-card.js';

import { UniversalCard, type UniversalCardConfig } from './universal-card-registry.js';

export type BlockType =
  | 'hero'
  | 'stats'
  | 'features'
  | 'card-grid'
  | 'pricing'
  | 'faq'
  | 'cta'
  | 'code-sample';

export interface PageBlockConfig {
  id: string;
  type: BlockType;
  title?: string;
  subtitle?: string;
  description?: string;
  badge?: string;
  data?: any;
  actions?: { label: string; variant?: 'primary' | 'secondary' | 'outline'; href?: string; onClick?: () => void }[];
}

export function BlockRenderer({ block }: { block: PageBlockConfig }) {
  switch (block.type) {
    case 'hero':
      return (
        <section className="relative overflow-hidden rounded-card border border-border bg-gradient-to-b from-primary/10 via-surface-raised/40 to-surface p-8 sm:p-12 text-center shadow-xs">
          <div className="mx-auto max-w-2xl space-y-4">
            {block.badge && (
              <Badge variant="secondary" className="border-primary/30 text-primary-text bg-primary/10 font-medium">
                {block.badge}
              </Badge>
            )}
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
              {block.title}
            </h1>
            {block.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">
                {block.description}
              </p>
            )}
            {block.actions && block.actions.length > 0 && (
              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                {block.actions.map((act, idx) => (
                  <Button
                    key={idx}
                    variant={act.variant ?? (idx === 0 ? 'primary' : 'outline')}
                    onClick={act.onClick}
                    size="lg"
                  >
                    {act.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </section>
      );

    case 'stats':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {(block.data?.items ?? []).map((item: any, idx: number) => (
            <StatCard
              key={idx}
              label={item.label}
              value={item.value}
              hint={item.trendLabel ?? item.description}
            />

          ))}
        </div>
      );

    case 'features':
      return (
        <section className="space-y-6">
          {(block.title || block.description) && (
            <div className="text-center max-w-xl mx-auto space-y-2">
              {block.badge && <Badge variant="secondary">{block.badge}</Badge>}
              <h2 className="text-xl font-bold text-foreground">{block.title}</h2>
              <p className="text-xs text-muted-foreground">{block.description}</p>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(block.data?.features ?? []).map((feat: any, idx: number) => (
              <div
                key={idx}
                className="rounded-card border border-border bg-surface p-4 shadow-xs hover:border-border-strong transition-all space-y-2.5"
              >
                <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Sparkles className="size-4" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">{feat.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{feat.description}</p>
              </div>
            ))}
          </div>
        </section>
      );

    case 'card-grid':
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(block.data?.cards ?? []).map((cardConfig: UniversalCardConfig) => (
            <UniversalCard key={cardConfig.id} config={cardConfig} />
          ))}
        </div>
      );

    case 'code-sample': {
      const codeSnippet = block.data?.code ?? '// Example code';
      return (
        <CodeBlock
          code={codeSnippet}
          filename={block.data?.filename ?? 'snippet.ts'}
          language={block.data?.language}
        />
      );
    }

    case 'cta':
      return (
        <div className="rounded-card border border-primary/30 bg-primary/10 p-6 text-center space-y-3">
          <h3 className="text-lg font-bold text-foreground">{block.title}</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">{block.description}</p>
          {block.actions && block.actions.length > 0 && (
            <div className="pt-2">
              <Button size="md" variant="primary" onClick={block.actions[0].onClick}>
                {block.actions[0].label}
              </Button>
            </div>
          )}
        </div>
      );

    default:
      return null;
  }
}
