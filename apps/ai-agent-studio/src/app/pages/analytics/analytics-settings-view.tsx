import { useState, useEffect } from 'react';
import {
  Button,
  Card,
  Input,
  Switch,
  toast,
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

const SELECT_CLASS =
  'w-full max-w-xs h-9 px-3 rounded-md border border-border bg-surface text-xs text-foreground';

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
            <label className="text-xs font-semibold text-foreground">Metadata Retention</label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Run status, timings, token and cost metrics
            </p>
            <select
              value={draft.retentionDaysMetadata}
              onChange={(e) => set('retentionDaysMetadata', Number(e.target.value))}
              className={SELECT_CLASS}
            >
              <option value={30}>30 Days</option>
              <option value={90}>90 Days (Recommended)</option>
              <option value={180}>180 Days</option>
              <option value={365}>1 Year</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-foreground">Payload Retention</label>
            <p className="text-[11px] text-muted-foreground mb-2">
              Redacted span inputs and outputs
            </p>
            <select
              value={draft.retentionDaysPayload}
              onChange={(e) => set('retentionDaysPayload', Number(e.target.value))}
              className={SELECT_CLASS}
            >
              <option value={7}>7 Days</option>
              <option value={14}>14 Days (Recommended)</option>
              <option value={30}>30 Days</option>
              <option value={90}>90 Days</option>
            </select>
          </div>
        </div>

        {/* Budget */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-foreground">Monthly Budget ($)</label>
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
            <label className="text-xs font-semibold text-foreground">Budget Alert Threshold (%)</label>
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
          <label className="text-xs font-semibold text-foreground">Default Timeframe</label>
          <p className="text-[11px] text-muted-foreground mb-2">
            Range the analytics dashboards open with
          </p>
          <select
            value={draft.defaultTimeframe}
            onChange={(e) =>
              set('defaultTimeframe', e.target.value as AnalyticsSettingsConfig['defaultTimeframe'])
            }
            className={SELECT_CLASS}
          >
            <option value="24H">Last 24 hours</option>
            <option value="7D">Last 7 days</option>
            <option value="30D">Last 30 days</option>
            <option value="90D">Last 90 days</option>
          </select>
        </div>

        {/* Redaction & Security */}
        <div className="space-y-4 border-t border-border pt-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
            <ShieldCheck className="size-4 text-emerald-500" />
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
