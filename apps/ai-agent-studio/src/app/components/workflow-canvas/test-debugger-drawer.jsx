import { useState } from 'react';
import { Badge, Button, CodeBlock, Input, toast } from '@org/ui';
import { cn } from '@org/utils';
import {
  Activity,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Eye,
  EyeOff,
  Flame,
  Play,
  RefreshCw,
  RotateCcw,
  Sparkles,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { executionService } from '../../services/executionService.js';

export function TestDebuggerDrawer({
  agent,
  nodes = [],
  edges = [],
  isOpen,
  onClose,
}) {
  const [promptInput, setPromptInput] = useState(
    'Customer inquired: "How can I enable Okta SSO on my enterprise plan?"',
  );
  const [isRunning, setIsRunning] = useState(false);
  const [currentExecution, setCurrentExecution] = useState(null);
  const [selectedStep, setSelectedStep] = useState(null);
  const [maskSensitive, setMaskSensitive] = useState(true);

  if (!isOpen) return null;

  const handleRun = async () => {
    setIsRunning(true);
    setCurrentExecution(null);
    setSelectedStep(null);

    try {
      const result = await executionService.runWorkflowSimulation(
        agent,
        promptInput,
        (updatedExec) => {
          setCurrentExecution(updatedExec);
          if (updatedExec.steps) {
            const active = updatedExec.steps.find((s) => s.status === 'RUNNING') || updatedExec.steps[updatedExec.steps.length - 1];
            setSelectedStep(active);
          }
        },
      );
      toast.success(`Workflow simulation complete (${result.durationMs}ms)`);
    } catch {
      toast.error('Simulation failed');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-border bg-surface shadow-2xl backdrop-blur-md">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500 font-bold">
            <Play className="size-4 fill-emerald-500" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">Interactive Workflow Debugger</div>
            <div className="text-[11px] text-muted-foreground">{agent.name}</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setMaskSensitive(!maskSensitive)}
            title={maskSensitive ? 'Mask sensitive data' : 'Show raw data'}
          >
            {maskSensitive ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </Button>

          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
        {/* Input Configuration */}
        <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Trigger Payload Input</span>
            <span className="text-[10px] text-muted-foreground">CHAT_MESSAGE</span>
          </div>

          <textarea
            rows={2}
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            disabled={isRunning}
            className="w-full rounded-md border border-border bg-surface p-2.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
          />

          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1.5">
              {[
                'Single sign-on inquiry',
                'Refund $240 invoice request',
                'Firecrawl competitor crawl',
              ].map((sample) => (
                <button
                  key={sample}
                  type="button"
                  onClick={() => setPromptInput(sample)}
                  className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  {sample}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              onClick={handleRun}
              loading={isRunning}
              className="gap-1.5 font-semibold text-xs"
            >
              <Play className="size-3.5" />
              Start Run
            </Button>
          </div>
        </div>

        {/* Live Simulation Execution Trace */}
        {currentExecution && (
          <div className="space-y-4">
            {/* Run Summary Banner */}
            <div className="flex items-center justify-between rounded-xl border border-border bg-surface-raised px-4 py-3">
              <div className="flex items-center gap-3">
                <Badge
                  variant={currentExecution.status === 'SUCCESS' ? 'success' : 'outline'}
                  className="text-xs"
                >
                  {currentExecution.status}
                </Badge>
                <div className="font-mono text-[11px] text-muted-foreground">
                  ID: {currentExecution.id}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="size-3.5" />
                  <span>{currentExecution.durationMs ? `${currentExecution.durationMs}ms` : 'running...'}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Coins className="size-3.5 text-emerald-500" />
                  <span>{currentExecution.costEstimated || '$0.00'}</span>
                </div>
              </div>
            </div>

            {/* Stepper Timeline */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Execution Steps Timeline:
              </div>

              <div className="space-y-1.5">
                {currentExecution.steps?.map((step, idx) => {
                  const isSuccess = step.status === 'SUCCESS';
                  const isRunningStep = step.status === 'RUNNING';
                  const isSelected = selectedStep?.id === step.id;

                  return (
                    <div
                      key={step.id}
                      onClick={() => setSelectedStep(step)}
                      className={cn(
                        'flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-all',
                        isSelected ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-border bg-surface hover:bg-surface-raised',
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-5 items-center justify-center rounded-full bg-surface-raised border border-border text-[10px] font-bold text-muted-foreground">
                          {idx + 1}
                        </span>

                        <div className="font-semibold text-foreground">{step.nodeName}</div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] text-muted-foreground">
                          {step.durationMs ? `${step.durationMs}ms` : ''}
                        </span>

                        {isSuccess && <CheckCircle2 className="size-4 text-emerald-500" />}
                        {isRunningStep && <RefreshCw className="size-4 text-primary animate-spin" />}
                        {step.status === 'IDLE' && <span className="size-2 rounded-full bg-muted" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step Payload Inspector */}
            {selectedStep && selectedStep.output && (
              <div className="space-y-1 font-mono text-[11px]">
                <div className="flex items-center justify-between pb-1 text-muted-foreground">
                  <span>Step Payload: {selectedStep.nodeName}</span>
                  <span className="text-emerald-500 font-bold">{selectedStep.status}</span>
                </div>

                <CodeBlock
                  variant="compact"
                  language="json"
                  code={JSON.stringify(selectedStep.output, null, 2)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
