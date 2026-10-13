import React, { useState } from 'react';
import type { MarketplaceKind } from '@org/types';
import {
  AppSelect,
  Button,
  Card,
  Field,
  Input,
  PageSection,
  Textarea,
} from '@org/ui';
import { Bot, ExternalLink, Send } from 'lucide-react';

const CATEGORIES = [
  'Developer Tools',
  'Productivity',
  'Collaboration',
  'Engineering',
  'Support',
  'Analytics',
].map((value) => ({ value, label: value }));

/** Agents are not listed here: they carry a blueprint, which only AI Agent Studio can produce. */
const KIND: MarketplaceKind = 'INTEGRATION';

interface MarketplaceDeveloperViewProps {
  onPublishCustom: (data: {
    kind: MarketplaceKind;
    name: string;
    slug: string;
    tagline?: string;
    description?: string;
    category?: string;
    version?: string;
    iconUrl?: string;
    manifest?: Record<string, unknown>;
  }) => Promise<any>;
  isLoading?: boolean;
  /** Opens the standalone AI Agent Studio, where agents are built and published. */
  onOpenStudio?: () => void;
}

export const MarketplaceDeveloperView: React.FC<MarketplaceDeveloperViewProps> = ({
  onPublishCustom,
  isLoading = false,
  onOpenStudio,
}) => {
  const kind = KIND;
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Developer Tools');
  const [version, setVersion] = useState('1.0.0');
  const [iconUrl] = useState('icon:code');
  const [commandName, setCommandName] = useState('');
  const [commandDesc, setCommandDesc] = useState('');

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]/g, '-')) {
      setSlug(val.toLowerCase().replace(/[^a-z0-9]/g, '-'));
    }
  };

  const manifest = {
    entityType: kind,
    badge: 'COMMUNITY',
    capabilities: [tagline || 'Custom workspace integration'],
    permissions: [
      {
        scope: 'read:messages',
        name: 'Read channel messages',
        level: 'READ',
        description: 'Needed for context processing',
      },
    ],
    commands: commandName
      ? [{ command: commandName, description: commandDesc || 'Invoke custom integration' }]
      : [],
    security: {
      dataAccessed: ['Workspace context only'],
      authentication: 'Bearer Token / HMAC',
      dataStorage: 'Ephemerally processed',
    },
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) return;

    await onPublishCustom({
      kind,
      name,
      slug,
      tagline,
      description,
      category,
      version,
      iconUrl,
      manifest,
    });

    // Reset fields on success
    setName('');
    setSlug('');
    setTagline('');
    setDescription('');
    setCommandName('');
    setCommandDesc('');
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 py-3">
      <PageSection
        variant="plain"
        title="Developer & integration portal"
        description="Publish custom internal applications and bot webhooks into your workspace marketplace."
        className="mb-0"
      />

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Bot className="size-4.5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            Publishing an AI agent?
          </p>
          <p className="text-xs text-muted-foreground">
            Agents are built and published from AI Agent Studio — open the
            agent, then use its Marketplace tab. The listing carries the exact
            version you published, so installs work out of the box.
          </p>
        </div>
        {onOpenStudio && (
          <Button variant="outline" size="sm" onClick={onOpenStudio}>
            Open AI Agent Studio
            <ExternalLink className="size-3 ml-1.5 opacity-70" aria-hidden />
          </Button>
        )}
      </Card>

      <div className="gap-6 lg:grid-cols-12 grid grid-cols-1">
        <Card className="p-6 lg:col-span-7">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
              <Field label="Name" required>
                <Input
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Sentry Monitor"
                />
              </Field>
              <Field label="Slug" required>
                <Input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. sentry-monitor"
                  className="font-mono"
                />
              </Field>
            </div>

            <Field label="Tagline" hint="One-line summary">
              <Input
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                placeholder="Real-time error tracking and regression alerts"
              />
            </Field>

            <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
              <Field label="Category">
                <AppSelect
                  aria-label="Category"
                  value={category}
                  onValueChange={setCategory}
                  options={CATEGORIES}
                />
              </Field>
              <Field label="Version">
                <Input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0.0"
                  className="font-mono"
                />
              </Field>
            </div>

            <Field label="Full description & workflows">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe key features, supported slash commands, and how team members can use it..."
                rows={4}
              />
            </Field>

            <div className="space-y-3 border-t border-border/60 pt-4">
              <Field label="Slash command trigger" optional>
                <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
                  <Input
                    value={commandName}
                    onChange={(e) => setCommandName(e.target.value)}
                    placeholder="/sentry alert"
                    className="font-mono"
                    aria-label="Slash command"
                  />
                  <Input
                    value={commandDesc}
                    onChange={(e) => setCommandDesc(e.target.value)}
                    placeholder="Trigger an issue query"
                    aria-label="Slash command description"
                  />
                </div>
              </Field>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              loading={isLoading}
              disabled={!name || !slug}
              className="w-full"
            >
              <Send aria-hidden />
              Publish to workspace
            </Button>
          </form>
        </Card>

        {/* Live manifest preview */}
        <div className="space-y-3 lg:col-span-5">
          <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
            Manifest preview (SDK v1)
          </h3>
          <Card className="overflow-x-auto bg-surface-raised/50 p-4 font-mono text-[11px] text-muted-foreground">
            <pre>
              {JSON.stringify(
                {
                  kind,
                  name: name || 'Custom Integration',
                  slug: slug || 'custom-integration',
                  version,
                  manifest,
                },
                null,
                2,
              )}
            </pre>
          </Card>
        </div>
      </div>
    </div>
  );
};
