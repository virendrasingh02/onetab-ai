import React, { useState } from 'react';
import type { MarketplaceKind } from '@org/types';
import { Button, Card, Input, Label, Textarea } from '@org/ui';
import { Code2, Send } from 'lucide-react';

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
}

export const MarketplaceDeveloperView: React.FC<MarketplaceDeveloperViewProps> = ({
  onPublishCustom,
  isLoading = false,
}) => {
  const [kind, setKind] = useState<MarketplaceKind>('INTEGRATION');
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
    <div className="py-6 space-y-8 max-w-4xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <Code2 className="size-6 text-primary" />
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Developer & Integration Portal
          </h2>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Publish custom internal applications, bot webhooks, or autonomous agents directly into your workspace marketplace.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Form Column */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-7 space-y-5 rounded-2xl border border-border/80 bg-surface p-6 shadow-xs"
        >
          {/* Kind Selector */}
          <div>
            <Label className="text-xs font-semibold text-foreground">Type</Label>
            <div className="grid grid-cols-2 gap-3 mt-1.5">
              <button
                type="button"
                onClick={() => setKind('INTEGRATION')}
                className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                  kind === 'INTEGRATION'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                }`}
              >
                App / Integration
              </button>
              <button
                type="button"
                onClick={() => setKind('AGENT')}
                className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-colors ${
                  kind === 'AGENT'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface-raised text-muted-foreground hover:text-foreground'
                }`}
              >
                AI Agent
              </button>
            </div>
          </div>

          {/* Name & Slug */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-foreground">Name</Label>
              <Input
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="e.g. Sentry Monitor"
                required
                className="mt-1 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs font-semibold text-foreground">Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g. sentry-monitor"
                required
                className="mt-1 text-xs font-mono"
              />
            </div>
          </div>

          {/* Tagline */}
          <div>
            <Label className="text-xs font-semibold text-foreground">
              Tagline (One-line summary)
            </Label>
            <Input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="Real-time error tracking and regression alerts"
              className="mt-1 text-xs"
            />
          </div>

          {/* Category & Version */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-semibold text-foreground">Category</Label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full mt-1 text-xs bg-surface border border-border text-foreground rounded-lg px-3 py-2"
              >
                <option value="Developer Tools">Developer Tools</option>
                <option value="Productivity">Productivity</option>
                <option value="Collaboration">Collaboration</option>
                <option value="Engineering">Engineering</option>
                <option value="Support">Support</option>
                <option value="Analytics">Analytics</option>
              </select>
            </div>
            <div>
              <Label className="text-xs font-semibold text-foreground">Version</Label>
              <Input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                placeholder="1.0.0"
                className="mt-1 text-xs font-mono"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <Label className="text-xs font-semibold text-foreground">
              Full Description & Workflows
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe key features, supported slash commands, and how team members can use it..."
              rows={4}
              className="mt-1 text-xs"
            />
          </div>

          {/* Slash Command (Optional) */}
          <div className="border-t border-border/60 pt-4 space-y-3">
            <Label className="text-xs font-semibold text-foreground">
              Slash Command Trigger (Optional)
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                value={commandName}
                onChange={(e) => setCommandName(e.target.value)}
                placeholder="/sentry alert"
                className="text-xs font-mono"
              />
              <Input
                value={commandDesc}
                onChange={(e) => setCommandDesc(e.target.value)}
                placeholder="Trigger an issue query"
                className="text-xs"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={isLoading}
            disabled={!name || !slug}
            className="w-full text-xs font-semibold shadow-xs"
          >
            <Send className="size-3.5 mr-1.5" />
            Publish to Workspace
          </Button>
        </form>

        {/* Live Manifest Preview Column */}
        <div className="lg:col-span-5 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Manifest Preview (SDK v1)
          </h3>
          <Card className="p-4 bg-surface-raised/50 border-border/80 font-mono text-[11px] overflow-x-auto text-muted-foreground">
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
