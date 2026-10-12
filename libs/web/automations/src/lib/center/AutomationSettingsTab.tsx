import { useState } from 'react';
import {
  Button,
  Card,
  Input,
  toast,
} from '@org/ui';
import {
  Save,
  Settings,
  ShieldCheck,
  Timer,
  Zap,
} from 'lucide-react';

export function AutomationSettingsTab() {

  const [concurrencyLimit, setConcurrencyLimit] = useState(5);
  const [defaultTimeoutSeconds, setDefaultTimeoutSeconds] = useState(120);
  const [maxRetries, setMaxRetries] = useState(2);
  const [notifyOnFailure, setNotifyOnFailure] = useState(true);
  const [requireApprovalForExternalWrites, setRequireApprovalForExternalWrites] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success('Automation settings saved successfully');
    }, 400);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          Workspace Automation Settings
        </h3>
        <p className="text-sm text-muted-foreground">
          Configure runtime limits, concurrency pools, default retry policies, and human approval rules.
        </p>
      </div>

      {/* Concurrency & Timeout Limits */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Timer className="h-4 w-4 text-primary" />
          <h4 className="font-semibold text-sm text-foreground">Execution Controls & Timeouts</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Max Concurrent Executions
            </label>
            <Input
              type="number"
              min={1}
              max={50}
              value={concurrencyLimit}
              onChange={(e) => setConcurrencyLimit(Number(e.target.value))}
            />
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Controls maximum simultaneous workflow runs before queueing.
            </span>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Default Timeout (Seconds)
            </label>
            <Input
              type="number"
              min={10}
              max={600}
              value={defaultTimeoutSeconds}
              onChange={(e) => setDefaultTimeoutSeconds(Number(e.target.value))}
            />
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Maximum execution duration before a run is automatically terminated.
            </span>
          </div>
        </div>
      </Card>

      {/* Retries & Error Handling */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <Zap className="h-4 w-4 text-amber-500" />
          <h4 className="font-semibold text-sm text-foreground">Automatic Retries & Resilience</h4>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
              Default Retry Attempts
            </label>
            <Input
              type="number"
              min={0}
              max={5}
              value={maxRetries}
              onChange={(e) => setMaxRetries(Number(e.target.value))}
              className="max-w-xs"
            />
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Number of times transient network or connector failures will retry with exponential backoff.
            </span>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="notifyFailure"
              checked={notifyOnFailure}
              onChange={(e) => setNotifyOnFailure(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="notifyFailure" className="text-sm font-medium text-foreground cursor-pointer">
              Send failure notifications to the automation owner and workspace alert channel
            </label>
          </div>
        </div>
      </Card>

      {/* AI & Human-in-the-Loop Governance */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <h4 className="font-semibold text-sm text-foreground">AI Governance & Approval Guardrails</h4>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="approvalRequired"
              checked={requireApprovalForExternalWrites}
              onChange={(e) => setRequireApprovalForExternalWrites(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <label htmlFor="approvalRequired" className="text-sm font-medium text-foreground cursor-pointer">
              Enforce human review before executing high-impact external actions (bulk emails, document deletion, financial operations)
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            When enabled, nodes performing external writes will automatically transition the workflow into <code className="text-primary font-mono text-[11px]">WAITING_APPROVAL</code> status until signed off by an authorized admin.
          </p>
        </div>
      </Card>

      <div className="flex justify-end pt-2">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
