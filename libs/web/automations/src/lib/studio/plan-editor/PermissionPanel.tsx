import {
  describeAgentScope,
  requiredScopes,
  scopeForTool,
  type AgentBlueprint,
  type AgentScope,
  type StudioCatalog,
} from '@org/types';
import { Badge, Button, Checkbox } from '@org/ui';
import { cn } from '@org/utils';
import { AlertTriangle, ShieldCheck } from 'lucide-react';

/** The access a connected-app action needs, from the catalog. */
export function appAccessFor(catalog: StudioCatalog | undefined) {
  const access = new Map((catalog?.apps ?? []).flatMap((a) => a.actions.map((x) => [x.tool, x.access] as const)));
  return (tool: string) => access.get(tool);
}

/**
 * What the agent may touch. Every permission a step needs is listed with the
 * steps that need it; nothing is granted silently — a step whose permission
 * is unchecked is refused when the agent runs, and says so.
 */
export function PermissionPanel({
  blueprint,
  catalog,
  onChange,
}: {
  blueprint: AgentBlueprint;
  catalog: StudioCatalog | undefined;
  onChange: (scopes: AgentScope[]) => void;
}) {
  const appAccess = appAccessFor(catalog);
  const needed = requiredScopes(blueprint, appAccess);
  const granted = new Set(blueprint.scopes);
  const all = [...new Set<AgentScope>([...needed, ...blueprint.scopes])];
  const neededBy = (scope: AgentScope) =>
    blueprint.steps
      .filter((s) => (s.kind === 'delegate' ? scope === 'agents:run' : s.tool && scopeForTool(s.tool, appAccess(s.tool)) === scope))
      .map((s) => s.title);
  const missing = needed.filter((s) => !granted.has(s));

  if (all.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="size-4" aria-hidden /> This plan doesn’t read or change anything outside the run.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {missing.length ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs">
          <span className="flex items-center gap-2 text-foreground">
            <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
            {missing.length} permission{missing.length === 1 ? '' : 's'} the steps need {missing.length === 1 ? 'is' : 'are'} not granted — those steps will be refused.
          </span>
          <Button size="xs" variant="outline" onClick={() => onChange([...new Set([...blueprint.scopes, ...missing])])}>
            Grant what the plan needs
          </Button>
        </div>
      ) : null}
      <ul className="divide-y divide-border rounded-lg border border-border">
        {all.map((scope) => {
          const info = describeAgentScope(scope);
          const users = neededBy(scope);
          const id = `scope-${scope.replace(/[^a-z0-9]/gi, '-')}`;
          return (
            <li key={scope} className="flex items-start gap-3 px-3 py-2.5">
              <Checkbox
                id={id}
                checked={granted.has(scope)}
                onCheckedChange={(checked) =>
                  onChange(checked === true ? [...blueprint.scopes, scope] : blueprint.scopes.filter((s) => s !== scope))
                }
                className="mt-0.5"
              />
              <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  {info.label}
                  <Badge variant={info.access === 'write' ? 'warning' : 'neutral'} className="text-[10px]">
                    {info.access === 'write' ? 'Changes things' : 'Read only'}
                  </Badge>
                </span>
                <span className="block text-xs text-muted-foreground">{info.description}</span>
                <span className={cn('mt-0.5 block text-[11px]', users.length ? 'text-muted-foreground' : 'text-warning-text')}>
                  {users.length ? `Used by: ${users.join(', ')}` : 'No step uses this — you can remove it.'}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
