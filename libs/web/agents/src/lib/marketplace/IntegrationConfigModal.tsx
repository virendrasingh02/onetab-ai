import React, { useState, useEffect } from 'react';
import type { MarketplaceInstallation } from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Field,
  Switch,
  Input,
} from '@org/ui';
import { EntityIcon } from './marketplace-ui';
import { useNotifyChannelOptions } from './use-marketplace';
import { Shield, Check } from 'lucide-react';

interface IntegrationConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  installation: MarketplaceInstallation | null;
  onSaveSettings: (
    slug: string,
    settings: Record<string, unknown>,
  ) => Promise<void>;
}

export const IntegrationConfigModal: React.FC<IntegrationConfigModalProps> = ({
  isOpen,
  onClose,
  installation,
  onSaveSettings,
}) => {
  const [notifyChannel, setNotifyChannel] = useState('');
  const channelOptions = useNotifyChannelOptions(installation?.workspaceId);
  const channelValue = channelOptions.resolve(notifyChannel);
  const [enableSlashCommands, setEnableSlashCommands] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (installation?.settings) {
      const s = installation.settings as Record<string, any>;
      if (s.notifyChannel) setNotifyChannel(s.notifyChannel);
      if (s.enableSlashCommands !== undefined)
        setEnableSlashCommands(Boolean(s.enableSlashCommands));
      if (s.webhookUrl) setWebhookUrl(s.webhookUrl);
    }
  }, [installation]);

  if (!installation) return null;

  const targetSlug =
    installation.listingSlug ||
    installation.listing?.slug ||
    installation.listingId;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveSettings(targetSlug, {
        notifyChannel: channelValue || null,
        enableSlashCommands,
        webhookUrl,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            <EntityIcon iconUrl={installation.iconUrl} kind={installation.kind} />
            <div>
              <DialogTitle>
                Configure {installation.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Settings & channel routing
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave}>
          <DialogBody className="space-y-4">
          <Field label="Primary notification channel">
            <AppSelect
              aria-label="Primary notification channel"
              value={channelValue}
              onValueChange={setNotifyChannel}
              options={channelOptions.options}
              loading={channelOptions.isLoading}
              searchable={channelOptions.options.length > 8}
              placeholder={
                channelOptions.isError
                  ? "Couldn't load channels"
                  : 'No channels in this workspace'
              }
              disabled={channelOptions.options.length === 0}
            />
          </Field>

          <Field label="Custom webhook URL" optional>
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.yourcompany.com/services/..."
              className="font-mono"
            />
          </Field>

          <div className="rounded-xl border border-border/60 bg-surface-raised/40 p-3.5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold block text-foreground">
                Enable slash commands
              </span>
              <span className="text-[11px] text-muted-foreground">
                Allow members to trigger commands in chat
              </span>
            </div>
            <Switch
              checked={enableSlashCommands}
              onCheckedChange={setEnableSlashCommands}
              aria-label="Enable slash commands"
            />
          </div>

          {installation.grantedScopes && installation.grantedScopes.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-surface-raised/30 p-3 space-y-1.5">
              <span className="text-[11px] font-semibold gap-1 flex items-center text-muted-foreground">
                <Shield className="size-3" aria-hidden />
                Active permissions
              </span>
              <div className="gap-1 flex flex-wrap">
                {installation.grantedScopes.map((sc) => (
                  <Badge key={sc} variant="neutral" className="font-mono">
                    {sc}
                  </Badge>
                ))}
              </div>
            </div>
          )}
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" loading={isSaving}>
              <Check aria-hidden />
              Save configuration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
