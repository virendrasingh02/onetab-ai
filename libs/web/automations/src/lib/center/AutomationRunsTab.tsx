import { Card } from '@org/ui';
import { AIRunsSection } from '@org/web-ai';
import { Activity } from 'lucide-react';

export function AutomationRunsTab() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Runs and Logs
          </h3>
          <p className="text-sm text-muted-foreground">
            Real-time execution traces, step logs, node outputs, and runtime state across all workflow runs.
          </p>
        </div>
      </div>

      <Card className="p-5">
        <AIRunsSection />
      </Card>
    </div>
  );
}
