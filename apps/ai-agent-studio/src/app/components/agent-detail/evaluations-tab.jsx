import { useState } from 'react';
import {
  Badge,
  Button,
  CodeBlock,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  confirm,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { agentsApi } from '@org/api-client';
import { Award, CheckCircle2, Clock, Eye, Play, Plus, RefreshCw, Trash2, Zap } from 'lucide-react';
import { errorText } from '../agent-architect/architect-ui.js';
import { useStudioSession } from '../../session-guard.js';

const STATUS_VARIANT = {
  SUCCESS: 'success',
  WAITING_APPROVAL: 'warning',
  FAILED: 'destructive',
  ERROR: 'destructive',
  PENDING: 'outline',
};

/** A test run's final answer, as text: the run output, else the last step's. */
function outputText(res) {
  const pick = (value) => {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && typeof value.text === 'string') return value.text;
    return JSON.stringify(value, null, 2);
  };
  return pick(res.output) ?? pick(res.steps?.[res.steps.length - 1]?.output) ?? '';
}

/**
 * Regression cases for this agent, saved in its configuration. Running the
 * suite executes each input as a real test run (reads real data, simulates
 * writes and approvals) and records what the agent actually produced. There
 * is no automatic grader, so comparing the output with the expectation is
 * left to the reviewer.
 *
 * @param {{ agent: any; onUpdate?: (patch: Record<string, any>) => void | Promise<void> }} props
 */
export function EvaluationsTab({ agent, onUpdate }) {
  const { activeWorkspace } = useStudioSession();

  const [testCases, setTestCases] = useState(() =>
    Array.isArray(agent?.configuration?.evaluationCases) ? agent.configuration.evaluationCases : [],
  );
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [inspectCase, setInspectCase] = useState(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newInput, setNewInput] = useState('');
  const [newExpected, setNewExpected] = useState('');

  const persist = async (cases) => {
    setTestCases(cases);
    if (onUpdate) await onUpdate({ configuration: { evaluationCases: cases } });
  };

  const ranCases = testCases.filter((tc) => tc.status && tc.status !== 'PENDING');
  const succeeded = ranCases.filter((tc) => tc.status === 'SUCCESS').length;
  const avgLatency = ranCases.length
    ? Math.round(ranCases.reduce((acc, c) => acc + (c.latencyMs || 0), 0) / ranCases.length)
    : 0;
  const totalTokens = ranCases.reduce((acc, c) => acc + (c.tokens || 0), 0);

  const handleAddTestCase = async (e) => {
    e.preventDefault();
    if (!newInput.trim()) return;
    await persist([
      ...testCases,
      {
        id: `tc-${Date.now().toString(36)}`,
        input: newInput.trim(),
        expected: newExpected.trim(),
        status: 'PENDING',
      },
    ]);
    setIsAddOpen(false);
    setNewInput('');
    setNewExpected('');
  };

  const handleDelete = async (tc) => {
    const ok = await confirm({
      title: 'Delete this test case?',
      description: tc.input,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (ok) await persist(testCases.filter((c) => c.id !== tc.id));
  };

  const handleRunSuite = async () => {
    if (testCases.length === 0) return;
    setIsRunning(true);
    setProgress({ done: 0, total: testCases.length });

    const results = [];
    for (const tc of testCases) {
      try {
        const res = await agentsApi.testRun(activeWorkspace.id, agent.id, { message: tc.input });
        results.push({
          ...tc,
          status: res.status,
          actual: outputText(res),
          latencyMs: res.duration,
          tokens: res.tokensUsed,
          notices: res.notices,
          ranAt: new Date().toISOString(),
        });
      } catch (err) {
        results.push({
          ...tc,
          status: 'ERROR',
          actual: errorText(err, 'The test run could not start'),
          latencyMs: 0,
          tokens: 0,
          ranAt: new Date().toISOString(),
        });
      }
      setProgress((p) => ({ ...p, done: p.done + 1 }));
    }

    await persist(results);
    setIsRunning(false);

    const errors = results.filter((r) => r.status === 'ERROR' || r.status === 'FAILED').length;
    if (errors > 0) toast.error(`${errors} of ${results.length} runs failed`);
    else toast.success(`All ${results.length} runs completed`);
  };

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6 max-w-5xl mx-auto">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-success/15 text-success">
              <Award className="size-4" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Test Cases</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Re-run saved inputs against {agent.name} in Test mode and compare what it produced with what you expected.
            Test runs read real data but don't send or change anything.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsAddOpen(true)} className="gap-1.5 text-xs">
            <Plus className="size-3.5" />
            Add Test Case
          </Button>
          <Button
            size="sm"
            onClick={handleRunSuite}
            loading={isRunning}
            disabled={testCases.length === 0}
            className="gap-1.5 text-xs font-semibold"
          >
            <Play className="size-3.5" />
            Run All
          </Button>
        </div>
      </div>

      {isRunning && (
        <div className="rounded-xl border border-border bg-surface p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <RefreshCw className="size-3.5 text-primary animate-spin" />
              Running test cases…
            </span>
            <span className="font-mono text-muted-foreground">
              {progress.done}/{progress.total}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
            <div
              className="h-full bg-success transition-all duration-300"
              style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {ranCases.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Completed runs</span>
              <CheckCircle2 className="size-4 text-success" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">
              {succeeded}/{ranCases.length}
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Avg duration</span>
              <Clock className="size-4 text-primary" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">{avgLatency}ms</div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 shadow-2xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-medium">Tokens used</span>
              <Zap className="size-4 text-warning" />
            </div>
            <div className="mt-2 text-2xl font-bold text-foreground">{totalTokens.toLocaleString()}</div>
          </div>
        </div>
      )}

      {testCases.length === 0 ? (
        <EmptyState
          icon={<Award className="size-6" />}
          title="No test cases yet"
          description="Add the questions this agent must keep answering well, then run them after every change."
          action={
            <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-1.5">
              <Plus className="size-3.5" /> Add Test Case
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden divide-y divide-border">
          {testCases.map((tc) => (
            <div key={tc.id} className="p-4 text-xs space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="font-semibold text-foreground">{tc.input}</div>
                  {tc.expected && <div className="text-muted-foreground">Expected: {tc.expected}</div>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant={STATUS_VARIANT[tc.status] ?? 'outline'} className="text-[10px]">
                    {tc.status === 'PENDING' || !tc.status ? 'Not run' : tc.status}
                  </Badge>
                  {tc.actual != null && (
                    <Button variant="ghost" size="icon-xs" onClick={() => setInspectCase(tc)} title="View output">
                      <Eye className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => void handleDelete(tc)}
                    disabled={isRunning}
                    className="text-muted-foreground hover:text-destructive"
                    title="Delete test case"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              {tc.actual != null && (
                <p
                  className={cn(
                    'line-clamp-2 font-mono text-[11px]',
                    tc.status === 'ERROR' || tc.status === 'FAILED' ? 'text-destructive' : 'text-muted-foreground',
                  )}
                >
                  {tc.actual || '(no output)'}
                </p>
              )}
              {tc.ranAt && (
                <div className="text-[10px] text-muted-foreground">
                  {new Date(tc.ranAt).toLocaleString()} · {tc.latencyMs ?? 0}ms · {tc.tokens ?? 0} tokens
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add test case */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleAddTestCase}>
            <DialogHeader>
              <DialogTitle>Add Test Case</DialogTitle>
            </DialogHeader>
            <DialogBody className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Input *</label>
                <textarea
                  rows={3}
                  required
                  value={newInput}
                  onChange={(e) => setNewInput(e.target.value)}
                  placeholder="What a user would send this agent"
                  className="w-full rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Expected behaviour</label>
                <textarea
                  rows={2}
                  value={newExpected}
                  onChange={(e) => setNewExpected(e.target.value)}
                  placeholder="What a good answer includes (for your review)"
                  className="w-full rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
                />
              </div>
            </DialogBody>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!newInput.trim()}>
                Add
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Inspect output */}
      <Dialog open={inspectCase !== null} onOpenChange={(open) => !open && setInspectCase(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Test run output</DialogTitle>
          </DialogHeader>
          {inspectCase && (
            <DialogBody className="space-y-3 text-xs">
              <div>
                <div className="font-semibold text-foreground">Input</div>
                <p className="text-muted-foreground">{inspectCase.input}</p>
              </div>
              {inspectCase.expected && (
                <div>
                  <div className="font-semibold text-foreground">Expected</div>
                  <p className="text-muted-foreground">{inspectCase.expected}</p>
                </div>
              )}
              <div>
                <div className="font-semibold text-foreground">Actual output</div>
                <CodeBlock variant="compact" code={inspectCase.actual || '(no output)'} maxHeight="320px" />
              </div>
              {Array.isArray(inspectCase.notices) && inspectCase.notices.length > 0 && (
                <div>
                  <div className="font-semibold text-foreground">Notices</div>
                  <ul className="list-disc pl-4 text-muted-foreground">
                    {inspectCase.notices.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </DialogBody>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
