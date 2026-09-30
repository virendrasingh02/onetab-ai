import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogBody,
  Input,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Code,
  Copy,
  Eye,
  EyeOff,
  Lock,
  Plus,
  Sliders,
  Trash2,
  Variable,
  Wand2,
} from 'lucide-react';
import { variableService } from '../../services/variableService.js';

export function VariablesTab() {
  const queryClient = useQueryClient();
  const [scopeFilter, setScopeFilter] = useState('ALL');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [revealSecrets, setRevealSecrets] = useState({});

  // Add form state
  const [keyName, setKeyName] = useState('');
  const [varValue, setVarValue] = useState('');
  const [varScope, setVarScope] = useState('WORKSPACE');
  const [varType, setVarType] = useState('string');
  const [isSecret, setIsSecret] = useState(false);

  // Expression tester state
  const [testExpression, setTestExpression] = useState('Hello {{ $vars.WORKSPACE_SLUG }}! Execution at {{ $date.now() }}');
  const [evaluatedResult, setEvaluatedResult] = useState('');

  const { data: variables = [], isLoading } = useQuery({
    queryKey: ['studio-variables', scopeFilter],
    queryFn: () => variableService.getVariables(scopeFilter),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => variableService.saveVariable(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-variables'] });
      setIsAddOpen(false);
      setKeyName('');
      setVarValue('');
      toast.success('Variable saved');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => variableService.deleteVariable(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['studio-variables'] });
      toast.success('Variable deleted');
    },
  });

  const functions = variableService.getFunctionsCatalog();

  const handleEvaluate = () => {
    const result = variableService.evaluateExpression(testExpression);
    setEvaluatedResult(result);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!keyName.trim()) return;
    saveMutation.mutate({
      key: keyName.toUpperCase().replace(/\s+/g, '_').trim(),
      value: varValue.trim(),
      scope: varScope,
      type: varType,
      isSecret,
    });
  };

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Variable className="size-4" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Variables & Expression Engine</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Manage environment secrets, execution state parameters, and dynamic expressions used across workflow nodes.
          </p>
        </div>

        <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-1.5 text-xs font-semibold">
          <Plus className="size-3.5" />
          Add Variable
        </Button>
      </div>

      {/* Scope Filter Pills */}
      <div className="flex items-center gap-2">
        {['ALL', 'WORKSPACE', 'GLOBAL', 'ENVIRONMENT'].map((sc) => (
          <button
            key={sc}
            onClick={() => setScopeFilter(sc)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors border',
              scopeFilter === sc
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-surface text-muted-foreground hover:bg-surface-raised hover:text-foreground',
            )}
          >
            {sc}
          </button>
        ))}
      </div>

      {/* Variables Table */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-border bg-surface-raised text-[11px] font-semibold text-muted-foreground uppercase">
            <tr>
              <th className="px-4 py-3">Variable Key</th>
              <th className="px-4 py-3">Scope</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {variables.map((v) => {
              const isRevealed = revealSecrets[v.id];
              return (
                <tr key={v.id} className="hover:bg-surface-raised transition-colors">
                  <td className="px-4 py-3 font-mono font-semibold text-foreground">
                    <div className="flex items-center gap-2">
                      {v.isSecret && <Lock className="size-3 text-amber-500" />}
                      <span>{v.key}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className="text-[10px]">
                      {v.scope}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground max-w-xs truncate">
                    {v.isSecret && !isRevealed ? '••••••••••••••••' : v.value}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {v.isSecret && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setRevealSecrets({ ...revealSecrets, [v.id]: !isRevealed })}
                        >
                          {isRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(`{{ $vars.${v.key} }}`);
                          toast.success(`Copied {{ $vars.${v.key} }}`);
                        }}
                        title="Copy variable tag"
                      >
                        <Copy className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => deleteMutation.mutate(v.id)}
                        className="text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Interactive Expression Builder & Sandbox */}
      <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Wand2 className="size-4 text-primary" />
              Dynamic Expression Evaluator
            </h3>
            <p className="text-xs text-muted-foreground">Test variable interpolation and built-in functions</p>
          </div>
          <Button size="xs" onClick={handleEvaluate} className="gap-1 font-semibold">
            Evaluate Expression
          </Button>
        </div>

        <div>
          <Input
            value={testExpression}
            onChange={(e) => setTestExpression(e.target.value)}
            className="font-mono text-xs"
            placeholder="Type expression using {{ $vars.KEY }} or {{ $date.now() }}"
          />
        </div>

        {evaluatedResult && (
          <div className="rounded-lg border border-border bg-surface-raised p-3 text-xs space-y-1">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase">Evaluated Output:</div>
            <div className="font-mono text-emerald-500 font-semibold">{evaluatedResult}</div>
          </div>
        )}

        {/* Function Catalog */}
        <div className="pt-2 border-t border-border/60">
          <div className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase">Function Reference Catalog:</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {functions.slice(0, 6).map((fn) => (
              <button
                key={fn.name}
                type="button"
                onClick={() => {
                  setTestExpression((prev) => `${prev} {{ ${fn.example} }}`);
                  toast.success(`Appended ${fn.name}`);
                }}
                className="rounded-lg border border-border bg-surface-raised p-2 text-left hover:border-primary/50 transition-colors"
              >
                <div className="font-mono text-[11px] font-semibold text-primary">{fn.name}</div>
                <div className="text-[10px] text-muted-foreground">{fn.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Create Variable Modal */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Context Variable</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddSubmit}>
            <DialogBody className="space-y-3 py-2 text-xs">
              <div>
                <label className="font-semibold text-foreground">Variable Key</label>
                <Input
                  placeholder="e.g. SLACK_WEBHOOK_URL"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="mt-1 font-mono text-xs uppercase"
                  required
                />
              </div>

              <div>
                <label className="font-semibold text-foreground">Scope</label>
                <select
                  value={varScope}
                  onChange={(e) => setVarScope(e.target.value)}
                  className="mt-1 w-full rounded-md border border-border bg-surface p-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
                >
                  <option value="WORKSPACE">Workspace (Shared across workspace workflows)</option>
                  <option value="GLOBAL">Global (System level)</option>
                  <option value="ENVIRONMENT">Environment (Secrets & Credentials)</option>
                </select>
              </div>

              <div>
                <label className="font-semibold text-foreground">Value</label>
                <Input
                  placeholder="Variable content or string"
                  value={varValue}
                  onChange={(e) => setVarValue(e.target.value)}
                  className="mt-1 font-mono text-xs"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  checked={isSecret}
                  onChange={(e) => setIsSecret(e.target.checked)}
                  className="size-3.5 rounded accent-primary cursor-pointer"
                  id="secretCheck"
                />
                <label htmlFor="secretCheck" className="text-foreground cursor-pointer">
                  Mask value as sensitive secret (encrypted in storage)
                </label>
              </div>
            </DialogBody>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Save Variable
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
