import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@org/ui';
import { AlertCircle, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  validationResult: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } | null;
  onPublishAnyway?: () => void;
}

export function ValidationModal({
  isOpen,
  onClose,
  validationResult,
  onPublishAnyway,
}: ValidationModalProps) {
  if (!validationResult) return null;

  const { valid, errors, warnings } = validationResult;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div
              className={`flex size-8 items-center justify-center rounded-lg ${
                valid
                  ? 'bg-emerald-500/15 text-emerald-500'
                  : 'bg-destructive/15 text-destructive'
              }`}
            >
              {valid ? (
                <ShieldCheck className="size-4" />
              ) : (
                <AlertCircle className="size-4" />
              )}
            </div>
            <div>
              <DialogTitle className="text-sm font-bold">
                {valid ? 'Workflow Validation Passed' : 'Workflow Has Issues'}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {valid
                  ? 'This agent graph is fully connected and ready to publish.'
                  : 'Resolve the errors below before publishing to workspace.'}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          {/* Checks summary */}
          <div className="rounded-lg border border-border bg-surface-raised/50 p-3 space-y-2">
            <div className="flex items-center gap-2 text-foreground font-medium">
              <CheckCircle2 className="size-3.5 text-emerald-500" />
              <span>Canvas Graph Topology</span>
            </div>
            <div className="flex items-center gap-2 text-foreground font-medium">
              {errors.some((e) => e.includes('Start')) ? (
                <AlertCircle className="size-3.5 text-destructive" />
              ) : (
                <CheckCircle2 className="size-3.5 text-emerald-500" />
              )}
              <span>Start Node Entrypoint</span>
            </div>
            <div className="flex items-center gap-2 text-foreground font-medium">
              {errors.some((e) => e.includes('Tool')) ? (
                <AlertCircle className="size-3.5 text-destructive" />
              ) : (
                <CheckCircle2 className="size-3.5 text-emerald-500" />
              )}
              <span>Tool & Model Attachments</span>
            </div>
          </div>

          {/* Errors list */}
          {errors.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive">
              <div className="font-semibold flex items-center gap-1.5 text-xs">
                <AlertCircle className="size-3.5" />
                <span>Errors ({errors.length})</span>
              </div>
              <ul className="list-inside list-disc space-y-1 text-[11px]">
                {errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Warnings list */}
          {warnings.length > 0 && (
            <div className="space-y-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-amber-500">
              <div className="font-semibold flex items-center gap-1.5 text-xs">
                <AlertTriangle className="size-3.5" />
                <span>Warnings ({warnings.length})</span>
              </div>
              <ul className="list-inside list-disc space-y-1 text-[11px]">
                {warnings.map((warn, i) => (
                  <li key={i}>{warn}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Back to Canvas
          </Button>
          {valid && onPublishAnyway && (
            <Button size="sm" onClick={onPublishAnyway}>
              Publish Agent
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
