import { useState, useEffect } from 'react';
import {
  Button,
  Card,
  Input,
  Switch,
  toast,
  AppSelect,
  Label,
} from '@org/ui';
import type { AnalyticsSettingsConfig } from '@org/types';
import {
  Save,
  Settings,
  ShieldCheck,
} from 'lucide-react';
import { analyticsService } from '../../services/analyticsService.js';
import { useStudioSession } from '../../session-guard.js';

interface AnalyticsSettingsViewProps {
  settings: AnalyticsSettingsConfig;
  onRefresh: () => void;
}

export function AnalyticsSettingsView({ settings, onRefresh }: AnalyticsSettingsViewProps) {
  const { activeWorkspace } = useStudioSession();
  const [draft, setDraft] = useState<AnalyticsSettingsConfig>(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  const set = <K extends keyof AnalyticsSettingsConfig>(key: K, value: AnalyticsSettingsConfig[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await analyticsService.updateSettings(activeWorkspace.id, {
        retentionDaysMetadata: draft.retentionDaysMetadata,
        retentionDaysPayload: draft.retentionDaysPayload,
        redactSecrets: draft.redactSecrets,
        budgetMonthlyUsd: draft.budgetMonthlyUsd,
        budgetAlertThresholdPct: draft.budgetAlertThresholdPct,
        defaultTimeframe: draft.defaultTimeframe,
      });
      toast('Analytics telemetry settings updated');
      onRefresh();
    } catch (err: any) {
      toast(err.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <Settings className="size-4 text-primary" />
          Analytics & Telemetry Configuration
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tune retention, budget alerting, and secret redaction policies
        </p>
      </div>

      <Card className="p-6 shadow-2xs space-y-6">
        {/* Retention */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs font-semibold text-foreground">Metadata Retention</Label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Run status, timings, token and cost metrics
            </p>
            <AppSelect
              className="max-w-xs"
              value={String(draft.retentionDaysMetadata)}
              onValueChange={(v) => set('retentionDaysMetadata', Number(v))}
              options={[
                { value: '30', label: '30 Days' },
                { value: '90', label: '90 Days (Recommended)' },
                { value: '180', label: '180 Days' },
                { value: '365', label: '1 Year' },
              ]}
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-foreground">Payload Retention</Label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Redacted span inputs and outputs
            </p>
            <AppSelect
              className="max-w-xs"
              value={String(draft.retentionDaysPayload)}
              onValueChange={(v) => set('retentionDaysPayload', Number(v))}
              options={[
                { value: '7', label: '7 Days' },
                { value: '14', label: '14 Days (Recommended)' },
                { value: '30', label: '30 Days' },
                { value: '90', label: '90 Days' },
              ]}
            />
          </div>
        </div>

        {/* Budget */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-xs font-semibold text-foreground">Monthly Budget ($)</Label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Used for budget utilization and spend projections
            </p>
            <Input
              type="number"
              min={0}
              value={draft.budgetMonthlyUsd}
              onChange={(e) => set('budgetMonthlyUsd', Number(e.target.value))}
              className="max-w-xs h-9 text-xs font-mono"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-foreground">Budget Alert Threshold (%)</Label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Warn when spend reaches this share of the budget
            </p>
            <Input
              type="number"
              min={1}
              max={100}
              value={draft.budgetAlertThresholdPct}
              onChange={(e) => set('budgetAlertThresholdPct', Number(e.target.value))}
              className="max-w-xs h-9 text-xs font-mono"
            />
          </div>
        </div>

        {/* Default timeframe */}
        <div>
          <Label className="text-xs font-semibold text-foreground">Default Timeframe</Label>
          <p className="text-[11px] text-muted-foreground mb-2">
            Range the analytics dashboards open with
          </p>
          <AppSelect
            value={draft.defaultTimeframe}
            onValueChange={(v) => set('defaultTimeframe', v as AnalyticsSettingsConfig['defaultTimeframe'])}
            options={[
              { value: '24H', label: 'Last 24 hours' },
              { value: '7D', label: 'Last 7 days' },
              { value: '30D', label: 'Last 30 days' },
              { value: '90D', label: 'Last 90 days' },
            ]}
          />
        </div>

        {/* Redaction & Security */}
        <div className="space-y-4 border-t border-border pt-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <ShieldCheck className="size-4 text-success-text" />
            Security & Credential Masking
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-medium text-foreground">
                Deep Secret & API Token Redaction
              </div>
              <div className="text-[11px] text-muted-foreground">
                Masks values under these keys in traces: {draft.redactedKeys.join(', ')}
              </div>
            </div>
            <Switch
              checked={draft.redactSecrets}
              onCheckedChange={(checked) => set('redactSecrets', checked)}
            />
          </div>
        </div>

        {/* Save button */}
        <div className="flex justify-end border-t border-border pt-4">
          <Button
            variant="default"
            size="sm"
            onClick={handleSave}
            loading={isSaving}
            className="text-xs gap-1.5"
          >
            <Save className="size-3.5" />
            Save Configuration
          </Button>
        </div>
      </Card>
    </div>
  );
}
