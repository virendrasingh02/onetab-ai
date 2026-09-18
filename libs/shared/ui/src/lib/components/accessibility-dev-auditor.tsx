import { useState, useCallback } from 'react';
import type { Result } from 'axe-core';
import { runAccessibilityAudit } from '../test-utils/axe-test-utils.js';
import { CheckCircle2, ShieldAlert, X, RefreshCw, Eye } from 'lucide-react';
import { cn } from '@org/utils';

export function AccessibilityDevAuditor() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [violations, setViolations] = useState<Result[] | null>(null);
  const [lastAuditedAt, setLastAuditedAt] = useState<Date | null>(null);
  const [activeHighlightSelector, setActiveHighlightSelector] = useState<string | null>(null);

  const handleRunAudit = useCallback(async () => {
    setIsRunning(true);
    try {
      const results = await runAccessibilityAudit(document.body);
      setViolations(results.violations);
      setLastAuditedAt(new Date());
    } catch (err) {
      console.error('Accessibility audit error:', err);
    } finally {
      setIsRunning(false);
    }
  }, []);

  const highlightElement = useCallback((selector: string) => {
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
  }, [activeHighlightSelector]);

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
      className="fixed bottom-4 right-4 z-[9999] font-sans text-xs select-none"
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
            'flex items-center gap-2 px-3 py-2 rounded-full shadow-2xl transition-all duration-200 cursor-pointer border',
            violations && totalViolations > 0
              ? 'bg-destructive text-destructive-foreground border-destructive/80'
              : 'bg-primary text-primary-foreground border-primary/80',
          )}
        >
          <ShieldAlert className="size-4" aria-hidden="true" />
          <span className="font-semibold">
            A11y Dev {violations ? `(${totalViolations})` : ''}
          </span>
        </button>
      ) : (
        <div className="w-96 max-h-[80vh] flex flex-col bg-popover text-popover-foreground border-2 border-border shadow-2xl rounded-xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border bg-surface-raised">
            <div className="flex items-center gap-2">
              <ShieldAlert className="size-4 text-primary" aria-hidden="true" />
              <span className="font-bold text-foreground">Accessibility Auditor</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-muted text-muted-foreground uppercase">
                Dev Mode
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleRunAudit}
                disabled={isRunning}
                aria-label="Re-run accessibility audit"
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
              >
                <RefreshCw className={cn('size-3.5', isRunning && 'animate-spin')} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close auditor panel"
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent cursor-pointer transition-colors"
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Severity Counters Bar */}
          <div className="grid grid-cols-4 gap-1 p-2 bg-surface text-center border-b border-border text-[11px]">
            <div className="p-1.5 rounded bg-destructive/10 border border-destructive/20">
              <div className="font-bold text-destructive">{counts.critical}</div>
              <div className="text-[10px] text-muted-foreground">Critical</div>
            </div>
            <div className="p-1.5 rounded bg-warning/10 border border-warning/20">
              <div className="font-bold text-warning-text">{counts.serious}</div>
              <div className="text-[10px] text-muted-foreground">Serious</div>
            </div>
            <div className="p-1.5 rounded bg-info/10 border border-info/20">
              <div className="font-bold text-info-text">{counts.moderate}</div>
              <div className="text-[10px] text-muted-foreground">Moderate</div>
            </div>
            <div className="p-1.5 rounded bg-muted/60 border border-border">
              <div className="font-bold text-foreground">{counts.minor}</div>
              <div className="text-[10px] text-muted-foreground">Minor</div>
            </div>
          </div>

          {/* Results List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[50vh] scrollbar-subtle">
            {isRunning ? (
              <div className="py-8 text-center text-muted-foreground space-y-2">
                <RefreshCw className="size-5 animate-spin mx-auto text-primary" aria-hidden="true" />
                <p>Running axe-core audit against live DOM…</p>
              </div>
            ) : violations && violations.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground space-y-2">
                <CheckCircle2 className="size-8 mx-auto text-success-text" aria-hidden="true" />
                <p className="font-semibold text-foreground">0 axe violations found!</p>
                <p className="text-[11px]">All checked WCAG 2.2 AA rules passed on this view.</p>
              </div>
            ) : violations ? (
              violations.map((v) => (
                <div
                  key={v.id}
                  className="p-2.5 rounded-lg border border-border bg-surface text-xs space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-semibold text-foreground flex items-center gap-1.5">
                      <span
                        className={cn(
                          'size-2 rounded-full shrink-0',
                          v.impact === 'critical'
                            ? 'bg-destructive'
                            : v.impact === 'serious'
                              ? 'bg-warning'
                              : 'bg-info',
                        )}
                      />
                      <span>{v.id}</span>
                    </div>
                    <span className="text-[9px] uppercase font-mono px-1 rounded bg-muted text-muted-foreground">
                      {v.impact}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-snug">{v.help}</p>

                  <div className="space-y-1 pt-1">
                    {v.nodes.slice(0, 3).map((node, nIdx) => {
                      const selector = node.target.join(' ');
                      return (
                        <div
                          key={nIdx}
                          className="flex items-center justify-between gap-1 p-1 rounded bg-muted/40 font-mono text-[10px]"
                        >
                          <span className="truncate text-subtle flex-1">{selector}</span>
                          <button
                            type="button"
                            onClick={() => highlightElement(selector)}
                            title="Highlight element on page"
                            className="p-1 rounded text-primary hover:bg-accent shrink-0"
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
                  className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg font-medium"
                >
                  Run Axe Audit
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          {lastAuditedAt && (
            <div className="p-2 border-t border-border bg-surface-raised flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Audited {lastAuditedAt.toLocaleTimeString()}</span>
              <a
                href="https://dequeuniversity.com/rules/axe/4.10"
                target="_blank"
                rel="noreferrer"
                className="hover:underline text-primary"
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
