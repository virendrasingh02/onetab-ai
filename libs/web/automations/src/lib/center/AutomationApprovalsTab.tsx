import { Card } from '@org/ui';
import { AIApprovalsSection } from '@org/web-ai';
import { ShieldCheck } from 'lucide-react';

export function AutomationApprovalsTab() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Human-in-the-Loop Approvals
          </h3>
          <p className="text-sm text-muted-foreground">
            Workflows and AI agents paused on sensitive operations (e.g. external writes, emails, deletions) await approval here before continuing.
          </p>
        </div>
      </div>

      <Card className="p-5">
        <AIApprovalsSection />
      </Card>
    </div>
  );
}
