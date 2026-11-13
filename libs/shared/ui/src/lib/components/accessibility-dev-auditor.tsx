import { useState, useCallback } from 'react';
import type { Result } from 'axe-core';
import { CheckCircle2, ShieldAlert, X, RefreshCw, Eye } from 'lucide-react';
import { cn } from '@org/utils';

export function AccessibilityDevAuditor() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [violations, setViolations] = useState<Result[] | null>(null);
  const [lastAuditedAt, setLastAuditedAt] = useState<Date | null>(null);
  const [activeHighlightSelector, setActiveHighlightSelector] = useState<
    string | null
  >(null);

  const handleRunAudit = useCallback(async () => {
    setIsRunning(true);
    try {
      const { runAccessibilityAudit } =
        await import('../test-utils/axe-test-utils.js');
      const results = await runAccessibilityAudit(document.body);
      setViolations(results.violations);
      setLastAuditedAt(new Date());
    } catch (err) {
      console.error('Accessibility audit error:', err);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const highlightElement = useCallback(
    (selector: string) => {
      try {
        // Remove any existing audit highlights
        document.querySelectorAll('.a11y-dev-highlight').forEach((el) => {
          el.classList.remove('a11y-dev-highlight');
          (el as HTMLElement).style.outline = '';
        });

        if (activeHighlightSelector === selector) {
          setActiveHighlightSelector(null);
          return;
        }

        const target = document.querySelector(selector);
        if (target) {
          (target as HTMLElement).style.outline = '3px solid #ef4444';
          (target as HTMLElement).classList.add('a11y-dev-highlight');
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setActiveHighlightSelector(selector);
        }
      } catch (e) {
        console.warn('Could not highlight selector:', selector, e);
      }
    },
    [activeHighlightSelector],
  );

  // Completely inactive if not in development
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    return null;
  }

  const counts = {
    critical: violations?.filter((v) => v.impact === 'critical').length ?? 0,
    serious: violations?.filter((v) => v.impact === 'serious').length ?? 0,
    moderate: violations?.filter((v) => v.impact === 'moderate').length ?? 0,
    minor: violations?.filter((v) => v.impact === 'minor').length ?? 0,
  };

  const totalViolations = violations?.length ?? 0;

  return (
    <aside
      aria-label="Accessibility Developer Auditor"
      className="bottom-4 right-4 text-xs fixed z-[9999] font-sans select-none"
    >
      {!isOpen ? (
        <button
          type="button"
          onClick={() => {
            setIsOpen(true);
            if (!violations) void handleRunAudit();
          }}
          aria-label="Open Accessibility Dev Auditor"
          className={cn(
            'gap-2 px-3 py-2 shadow-2xl flex cursor-pointer items-center rounded-full border transition-all duration-200',
            violations && totalViolations > 0
              ? 'border-destructive/80 bg-destructive text-destructive-foreground'
              : 'border-primary/80 bg-primary text-primary-foreground',
          )}
        >
          <ShieldAlert className="size-4" aria-hidden="true" />
          <span className="font-semibold">
            A11y Dev {violations ? `(${totalViolations})` : ''}
          </span>
        </button>
      ) : (
        <div className="w-96 shadow-2xl animate-in fade-in-50 zoom-in-95 flex max-h-[80vh] flex-col overflow-hidden rounded-xl border-2 border-border bg-popover text-popover-foreground duration-150">
          {/* Header */}
          <div className="p-3 flex items-center justify-between border-b border-border bg-surface-raised">
            <div className="gap-2 flex items-center">
              <ShieldAlert className="size-4 text-primary" aria-hidden="true" />
              <span className="font-bold text-foreground">
                Accessibility Auditor
              </span>
              <span className="px-1.5 py-0.5 rounded bg-muted font-mono text-2xs text-muted-foreground uppercase">
                Dev Mode
              </span>
            </div>
            <div className="gap-1 flex items-center">
              <button
                type="button"
                onClick={handleRunAudit}
                disabled={isRunning}
                aria-label="Re-run accessibility audit"
                className="p-1 rounded cursor-pointer text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <RefreshCw
                  className={cn('size-3.5', isRunning && 'animate-spin')}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close auditor panel"
                className="p-1 rounded cursor-pointer text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Severity Counters Bar */}
          <div className="gap-1 p-2 grid grid-cols-4 border-b border-border bg-surface text-center text-meta">
            <div className="p-1.5 rounded border border-destructive/20 bg-destructive/10">
              <div className="font-bold text-destructive">
                {counts.critical}
              </div>
              <div className="text-2xs text-muted-foreground">Critical</div>
            </div>
            <div className="p-1.5 rounded border border-warning/20 bg-warning/10">
              <div className="font-bold text-warning-text">
                {counts.serious}
              </div>
              <div className="text-2xs text-muted-foreground">Serious</div>
            </div>
            <div className="p-1.5 rounded border border-info/20 bg-info/10">
              <div className="font-bold text-info-text">{counts.moderate}</div>
              <div className="text-2xs text-muted-foreground">Moderate</div>
            </div>
            <div className="p-1.5 rounded border border-border bg-muted/60">
              <div className="font-bold text-foreground">{counts.minor}</div>
              <div className="text-2xs text-muted-foreground">Minor</div>
            </div>
          </div>

          {/* Results List */}
          <div className="p-3 space-y-2.5 scrollbar-subtle max-h-[50vh] flex-1 overflow-y-auto">
            {isRunning ? (
              <div className="py-8 space-y-2 text-center text-muted-foreground">
                <RefreshCw
                  className="size-5 animate-spin mx-auto text-primary"
                  aria-hidden="true"
                />
                <p>Running axe-core audit against live DOM…</p>
              </div>
            ) : violations && violations.length === 0 ? (
              <div className="py-8 space-y-2 text-center text-muted-foreground">
                <CheckCircle2
                  className="size-8 mx-auto text-success-text"
                  aria-hidden="true"
                />
                <p className="font-semibold text-foreground">
                  0 axe violations found!
                </p>
                <p className="text-meta">
                  All checked WCAG 2.2 AA rules passed on this view.
                </p>
              </div>
            ) : violations ? (
              violations.map((v) => (
                <div
                  key={v.id}
                  className="p-2.5 text-xs space-y-1.5 rounded-lg border border-border bg-surface"
                >
                  <div className="gap-2 flex items-start justify-between">
                    <div className="font-semibold gap-1.5 flex items-center text-foreground">
                      <span
                        className={cn(
                          'size-2 shrink-0 rounded-full',
                          v.impact === 'critical'
                            ? 'bg-destructive'
                            : v.impact === 'serious'
                              ? 'bg-warning'
                              : 'bg-info',
                        )}
                      />
                      <span>{v.id}</span>
                    </div>
                    <span className="px-1 rounded bg-muted font-mono text-3xs text-muted-foreground uppercase">
                      {v.impact}
                    </span>
                  </div>
                  <p className="leading-snug text-meta text-muted-foreground">
                    {v.help}
                  </p>

                  <div className="space-y-1 pt-1">
                    {v.nodes.slice(0, 3).map((node, nIdx) => {
                      const selector = node.target.join(' ');
                      return (
                        <div
                          key={nIdx}
                          className="gap-1 p-1 rounded flex items-center justify-between bg-muted/40 font-mono text-2xs"
                        >
                          <span className="flex-1 truncate text-subtle">
                            {selector}
                          </span>
                          <button
                            type="button"
                            onClick={() => highlightElement(selector)}
                            title="Highlight element on page"
                            className="p-1 rounded shrink-0 text-primary hover:bg-accent"
                          >
                            <Eye className="size-3" aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                <button
                  type="button"
                  onClick={handleRunAudit}
                  className="px-3 py-1.5 font-medium rounded-lg bg-foreground text-background"
                >
                  Run Axe Audit
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          {lastAuditedAt && (
            <div className="p-2 flex items-center justify-between border-t border-border bg-surface-raised text-2xs text-muted-foreground">
              <span>Audited {lastAuditedAt.toLocaleTimeString()}</span>
              <a
                href="https://dequeuniversity.com/rules/axe/4.10"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                axe-core 4.x
              </a>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
