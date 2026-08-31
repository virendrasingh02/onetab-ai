import type { ApprovalMessageContent, Message, StructuredMessageAction } from '@org/types';
import {
  Badge,
  Button,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  FileDiff,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';

export interface ApprovalCardProps {
  message: Message;
  event: ApprovalMessageContent;
  isOwn?: boolean;
  isHighlighted?: boolean;
  onApprove?: () => void | Promise<void>;
  onReject?: () => void | Promise<void>;
  onAction?: (action: StructuredMessageAction) => void | Promise<void>;
}

export function ApprovalCard({
  message,
  event,
  isHighlighted = false,
  onApprove,
  onReject,
  onAction,
}: ApprovalCardProps) {
  const [localStatus, setLocalStatus] = useState<ApprovalMessageContent['status']>(event.status);
  const [isProcessing, setIsProcessing] = useState(false);

  const riskBadgeConfig = {
    low: { label: 'Low Risk', variant: 'neutral' as const, color: 'text-muted-foreground' },
    medium: { label: 'Medium Risk', variant: 'warning' as const, color: 'text-warning-text' },
    high: { label: 'High Risk', variant: 'destructive' as const, color: 'text-destructive-text' },
    critical: { label: 'Critical Risk', variant: 'destructive' as const, color: 'text-destructive-text font-bold' },
  }[event.riskLevel || 'medium'];

  const handleApprove = async () => {
    setIsProcessing(true);
    try {
      if (onApprove) {
        await onApprove();
      } else if (onAction) {
        await onAction({
          id: 'approve',
          label: 'Approve Action',
          variant: 'primary',
          actionType: 'approval.approved',
          payload: { approvalId: event.approvalId },
        });
      }
      setLocalStatus('approved');
      toast.success('Action approved successfully');
    } catch {
      toast.error('Failed to submit approval');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      if (onReject) {
        await onReject();
      } else if (onAction) {
        await onAction({
          id: 'reject',
          label: 'Reject Action',
          variant: 'destructive',
          actionType: 'approval.rejected',
          payload: { approvalId: event.approvalId },
        });
      }
      setLocalStatus('rejected');
      toast.info('Action rejected');
    } catch {
      toast.error('Failed to submit rejection');
    } finally {
      setIsProcessing(false);
    }
  };

  const isPending = localStatus === 'pending';

  return (
    <article
      data-message-id={message.id}
      className={cn(
        'group/approval relative my-2 rounded-2xl border bg-surface/95 backdrop-blur-sm p-4 transition-all duration-200 shadow-xs hover:shadow-md',
        isPending
          ? 'border-warning/50 ring-1 ring-warning/20'
          : localStatus === 'approved'
            ? 'border-success/40 bg-success/5'
            : 'border-border',
        isHighlighted && 'ring-2 ring-primary/60',
      )}
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-9 rounded-xl bg-warning/10 text-warning-text flex items-center justify-center shrink-0 ring-2 ring-warning/20">
            <ShieldAlert className="size-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                {event.title}
              </h3>
              <Badge variant={riskBadgeConfig.variant} className="text-[10px] py-0 h-4 font-semibold">
                {riskBadgeConfig.label}
              </Badge>
              <Badge
                variant={
                  localStatus === 'approved'
                    ? 'success'
                    : localStatus === 'rejected'
                      ? 'destructive'
                      : 'warning'
                }
                className="text-[10px] py-0 h-4 capitalize font-bold"
              >
                {localStatus}
              </Badge>
            </div>
            {event.agentName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Requested by <span className="font-semibold text-foreground">{event.agentName}</span>
              </p>
            )}
          </div>
        </div>

        {event.expiresAt && isPending && (
          <div className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground shrink-0">
            <Clock className="size-3" />
            <span>Expires {new Date(event.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </header>

      {/* Description */}
      {event.description && (
        <p className="mt-3 text-xs sm:text-sm text-foreground/90 leading-relaxed">
          {event.description}
        </p>
      )}

      {/* Proposed Action */}
      {event.proposedAction && (
        <div className="mt-3 rounded-xl bg-surface-raised p-3 border border-border/60 text-xs font-mono text-foreground">
          <span className="text-[10px] font-bold text-muted-foreground uppercase block mb-1">
            Proposed Command / Action
          </span>
          <pre className="overflow-x-auto whitespace-pre-wrap">{event.proposedAction}</pre>
        </div>
      )}

      {/* Diff Preview */}
      {event.diffPreview && (
        <div className="mt-3 rounded-xl border border-border bg-surface-inset text-foreground font-mono text-xs overflow-hidden shadow-xs">
          <div className="px-3 py-1.5 bg-surface-raised border-b border-border flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <FileDiff className="size-3.5 text-primary" />
              <span>{event.diffPreview.filename || 'Diff Preview'}</span>
            </span>
          </div>
          <div className="p-3 overflow-x-auto">
            <pre className="leading-relaxed">
              {event.diffPreview.diff.split('\n').map((line, idx) => {
                const isAdd = line.startsWith('+');
                const isRem = line.startsWith('-');
                return (
                  <div
                    key={idx}
                    className={cn(
                      'px-1 rounded',
                      isAdd && 'bg-success/20 text-success-text font-semibold',
                      isRem && 'bg-destructive/20 text-destructive-text line-through opacity-80',
                    )}
                  >
                    {line}
                  </div>
                );
              })}
            </pre>
          </div>
        </div>
      )}

      {/* Side Effects Warnings */}
      {event.sideEffects && event.sideEffects.length > 0 && (
        <div className="mt-3 rounded-xl border border-warning/30 bg-warning/5 p-3 text-xs text-foreground">
          <span className="text-[10px] font-bold uppercase tracking-wider text-warning-text block mb-1.5 flex items-center gap-1">
            <AlertTriangle className="size-3.5" />
            <span>Potential Side Effects:</span>
          </span>
          <ul className="space-y-1 pl-4 list-disc text-muted-foreground text-[11px]">
            {event.sideEffects.map((effect, idx) => (
              <li key={idx}>{effect}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Interactive Controls */}
      {isPending ? (
        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={isProcessing}
            onClick={handleReject}
            className="h-8 text-xs px-3 border-border hover:bg-destructive/10 hover:text-destructive"
          >
            <XCircle className="size-3.5 mr-1" />
            <span>Reject</span>
          </Button>

          <Button
            size="sm"
            variant="success"
            disabled={isProcessing}
            onClick={handleApprove}
            className="h-8 text-xs px-4 gap-1.5 shadow-xs"
          >
            <Check className="size-3.5" />
            <span>Approve Action</span>
          </Button>
        </div>
      ) : (
        <div className="mt-3.5 pt-2.5 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            {localStatus === 'approved' ? (
              <CheckCircle2 className="size-3.5 text-success" />
            ) : (
              <XCircle className="size-3.5 text-destructive" />
            )}
            <span>
              {localStatus === 'approved' ? 'Approved' : 'Rejected'}
              {event.approverName && ` by ${event.approverName}`}
            </span>
          </span>
          {event.decidedAt && (
            <time className="text-[11px]">
              {new Date(event.decidedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </time>
          )}
        </div>
      )}
    </article>
  );
}
