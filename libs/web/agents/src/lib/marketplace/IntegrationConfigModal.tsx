import React, { useState, useEffect } from 'react';
import type { MarketplaceInstallation } from '@org/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Switch,
  Input,
  Label,
} from '@org/ui';
import { renderEntityIcon } from './MarketplaceCard';
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
  const [notifyChannel, setNotifyChannel] = useState('general');
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
        notifyChannel,
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
      <DialogContent className="max-w-md p-6 bg-surface border-border rounded-2xl">
        <DialogHeader className="space-y-2">
          <div className="flex items-center gap-3">
            {renderEntityIcon(installation.iconUrl ?? undefined, installation.kind, 'size-10')}
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                Configure {installation.name}
              </DialogTitle>
              <p className="text-xs text-muted-foreground">
                Settings & Channel Routing
              </p>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4 mt-3">
          {/* Notification channel */}
          <div>
            <Label className="text-xs font-semibold text-foreground">
              Primary Notification Channel
            </Label>
            <select
              value={notifyChannel}
              onChange={(e) => setNotifyChannel(e.target.value)}
              className="w-full mt-1.5 text-xs bg-surface border border-border text-foreground rounded-lg px-3 py-2"
            >
              <option value="general"># general</option>
              <option value="engineering"># engineering</option>
              <option value="alerts"># alerts-feed</option>
              <option value="product"># product-updates</option>
            </select>
          </div>

          {/* Webhook endpoint (if applicable) */}
          <div>
            <Label className="text-xs font-semibold text-foreground">
              Custom Webhook URL (Optional)
            </Label>
            <Input
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://hooks.yourcompany.com/services/..."
              className="mt-1.5 text-xs font-mono"
            />
          </div>

          {/* Slash Commands Switch */}
          <div className="rounded-xl border border-border/80 bg-surface-raised/40 p-3.5 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-foreground block">
                Enable Slash Commands
              </span>
              <span className="text-[11px] text-muted-foreground">
                Allow members to trigger commands in chat
              </span>
            </div>
            <Switch
              checked={enableSlashCommands}
              onCheckedChange={setEnableSlashCommands}
            />
          </div>

          {/* Scopes Overview */}
          {installation.grantedScopes && installation.grantedScopes.length > 0 && (
            <div className="rounded-xl border border-border/70 bg-surface-raised/30 p-3 space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                <Shield className="size-3" />
                Active Permissions
              </span>
              <div className="flex flex-wrap gap-1">
                {installation.grantedScopes.map((sc) => (
                  <span
                    key={sc}
                    className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-surface border border-border/70 text-muted-foreground"
                  >
                    {sc}
                  </span>
                ))}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onClose}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="xs"
              loading={isSaving}
              className="text-xs font-semibold"
            >
              <Check className="size-3.5 mr-1" />
              Save Configuration
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
