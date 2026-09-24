import { agentsApi, approvalsApi } from '@org/api-client';
import { Badge, Button, Input, toast } from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  Copy,
  Flame,
  Loader2,
  Play,
  RotateCcw,
  ShieldAlert,
  StopCircle,
  Terminal,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useStudioSession } from '../../session-guard.js';

interface TestConsoleDrawerProps {
  agentId: string;
  agentName: string;
  isOpen: boolean;
  onClose: () => void;
  onNodeHighlight?: (nodeId: string, status: 'running' | 'success' | 'failed' | 'waiting') => void;
}

export function TestConsoleDrawer({
  agentId,
  agentName,
  isOpen,
  onClose,
  onNodeHighlight,
}: TestConsoleDrawerProps) {
  const { activeWorkspace } = useStudioSession();
  const [prompt, setPrompt] = useState('Research current AI development frameworks and summarize findings');
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [selectedStep, setSelectedStep] = useState<any | null>(null);
  const [isApproving, setIsApproving] = useState(false);

  if (!isOpen) return null;

  const handleRun = async () => {
    if (!prompt.trim()) return;
    setIsRunning(true);
    setExecutionResult(null);
    setSelectedStep(null);

    try {
      const res = await agentsApi.testRun(activeWorkspace.id, agentId, {
        message: prompt,
        prompt,
      });
      setExecutionResult(res);
      if (res.steps?.length > 0) {
        setSelectedStep(res.steps[res.steps.length - 1]);
      }
      toast.success(
        res.status === 'WAITING_APPROVAL'
          ? 'Execution waiting for human approval'
          : 'Agent test completed',
      );
    } catch (err: any) {
      toast.error('Test execution failed', {
        description: err?.message || 'Error executing agent graph',
      });
      setExecutionResult({
        status: 'FAILED',
        error: err?.message || 'Execution error',
        steps: [],
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleApprove = async () => {
    setIsApproving(true);
    try {
      // Find pending approval for this agent
      const approvals = await approvalsApi.list(activeWorkspace.id, 'PENDING');
      const target = approvals.find((a: any) => a.entityId === agentId);
      if (target) {
        await approvalsApi.decide(activeWorkspace.id, target.id, {
          decision: 'APPROVED',
          comment: 'Approved in test console',
        });
        toast.success('Approved! Resuming workflow…');
        // Re-run or update status
        await handleRun();
      } else {
        toast.info('No pending approval found in registry');
      }
    } catch (err: any) {
      toast.error('Could not approve', { description: err?.message });
    } finally {
      setIsApproving(false);
    }
  };

  const copyOutput = () => {
    if (!executionResult) return;
    const text =
      typeof executionResult.output === 'object'
        ? JSON.stringify(executionResult.output, null, 2)
        : String(executionResult.output || '');
    navigator.clipboard.writeText(text);
    toast.success('Output copied to clipboard');
  };

  return (
    <div className="absolute inset-x-0 bottom-0 z-30 flex h-[380px] flex-col border-t border-border bg-surface shadow-2xl backdrop-blur-md select-none">
      {/* Header */}
      <div className="flex h-11 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-2.5">
          <Terminal className="size-4 text-primary" />
          <span className="text-xs font-bold text-foreground">
            Test Console — {agentName}
          </span>
          {executionResult && (
            <Badge
              variant={
                executionResult.status === 'SUCCESS'
                  ? 'success'
                  : executionResult.status === 'WAITING_APPROVAL'
                  ? 'warning'
                  : 'destructive'
              }
              className="text-[10px]"
            >
              {executionResult.status}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {executionResult && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground mr-2 font-mono">
              <span className="flex items-center gap-1">
                <Clock className="size-3" /> {executionResult.duration || 0}ms
              </span>
              <span className="flex items-center gap-1">
                <Activity className="size-3" /> {executionResult.tokensUsed || 0} tokens
              </span>
              <span className="flex items-center gap-1 text-amber-500 font-semibold">
                <Coins className="size-3" /> {executionResult.credits || 1} cr
              </span>
            </div>
          )}

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Body: Two columns (Input & Trace Timeline on Left, Step Inspector & Output on Right) */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Column: Input form & Trace steps */}
        <div className="flex w-1/2 flex-col border-r border-border p-3 overflow-y-auto space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-foreground">
              Test Input / Prompt
            </label>
            <div className="flex gap-2">
              <Input
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Enter test query or prompt…"
                disabled={isRunning}
                className="h-8 text-xs font-mono"
                onKeyDown={(e) => e.key === 'Enter' && void handleRun()}
              />
              <Button
                size="sm"
                onClick={() => void handleRun()}
                disabled={isRunning || !prompt.trim()}
                className="h-8 gap-1.5 px-3 font-semibold shrink-0"
              >
                {isRunning ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Play className="size-3.5 fill-current" />
                )}
                <span>{isRunning ? 'Running…' : 'Run Test'}</span>
              </Button>
            </div>
          </div>

          {/* Pending Approval Banner */}
          {executionResult?.status === 'WAITING_APPROVAL' && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-amber-500">
                <ShieldAlert className="size-4" />
                <span>Human Approval Required</span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Execution paused at approval node. An operator must review and sign off on this action.
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  size="xs"
                  onClick={() => void handleApprove()}
                  loading={isApproving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                >
                  <Check className="size-3" /> Approve Action
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => setExecutionResult({ ...executionResult, status: 'REJECTED' })}
                  className="text-destructive hover:bg-destructive/10"
                >
                  Reject
                </Button>
              </div>
            </div>
          )}

          {/* Execution Trace Timeline */}
          {executionResult?.steps?.length > 0 && (
            <div className="space-y-1 pt-1">
              <div className="text-[11px] font-bold text-foreground">
                Execution Steps Trace
              </div>
              <div className="space-y-1">
                {executionResult.steps.map((step: any, index: number) => {
                  const isSelected = selectedStep?.stepId === step.stepId;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => setSelectedStep(step)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg border p-2 text-left text-xs transition-colors',
                        isSelected
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border bg-surface-raised/40 hover:bg-surface-raised text-foreground',
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="flex size-5 items-center justify-center rounded-full bg-surface border border-border text-[10px] font-bold">
                          {index + 1}
                        </span>
                        <span className="font-semibold truncate">
                          {step.label || step.stepId}
                        </span>
                        <span className="font-mono text-[10px] text-muted-foreground uppercase">
                          ({step.nodeType})
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {step.status === 'SUCCESS' ? (
                          <CheckCircle2 className="size-3.5 text-emerald-500" />
                        ) : step.status === 'WAITING' ? (
                          <UserCheck className="size-3.5 text-amber-500" />
                        ) : (
                          <AlertCircle className="size-3.5 text-destructive" />
                        )}
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {step.latencyMs || 0}ms
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Step Output & Details */}
        <div className="flex w-1/2 flex-col p-3 overflow-hidden bg-surface-raised/20">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <div className="text-[11px] font-bold text-foreground">
              {selectedStep
                ? `Step: ${selectedStep.label || selectedStep.stepId}`
                : 'Final Output'}
            </div>
            {executionResult && (
              <Button
                variant="ghost"
                size="xs"
                onClick={copyOutput}
                className="gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <Copy className="size-3" /> Copy Output
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto pt-2">
            {isRunning ? (
              <div className="flex h-full flex-col items-center justify-center text-xs text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-primary mb-2" />
                <span>Executing agent graph and tools…</span>
              </div>
            ) : selectedStep ? (
              <pre className="font-mono text-[11px] text-foreground leading-relaxed whitespace-pre-wrap bg-surface p-2.5 rounded-lg border border-border overflow-x-auto">
                {typeof selectedStep.output === 'object'
                  ? JSON.stringify(selectedStep.output, null, 2)
                  : String(selectedStep.output || 'No output data')}
              </pre>
            ) : executionResult ? (
              <pre className="font-mono text-[11px] text-foreground leading-relaxed whitespace-pre-wrap bg-surface p-2.5 rounded-lg border border-border overflow-x-auto">
                {typeof executionResult.output === 'object'
                  ? JSON.stringify(executionResult.output, null, 2)
                  : String(executionResult.output || 'Execution complete')}
              </pre>
            ) : (
              <div className="flex h-full flex-col items-center justify-center text-xs text-muted-foreground">
                <Terminal className="size-6 text-muted-foreground/30 mb-1" />
                <span>Run a test to inspect real-time outputs & traces</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
