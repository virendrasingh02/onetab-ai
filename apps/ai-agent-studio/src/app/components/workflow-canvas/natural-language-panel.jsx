import { useState } from 'react';
import { Button, Input, toast } from '@org/ui';
import { cn } from '@org/utils';
import {
  Check,
  GitBranch,
  Plus,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { naturalLanguageService } from '../../services/naturalLanguageService.js';

export function NaturalLanguagePanel({
  nodes = [],
  edges = [],
  onApplyDiff,
  onClose,
  className,
}) {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [history, setHistory] = useState([
    {
      id: 'h-1',
      role: 'assistant',
      text: 'Hi! I am your AI Workflow Copilot. Tell me what changes or additions you would like to make to your canvas in plain language.',
      diff: null,
    },
  ]);
  const [pendingDiff, setPendingDiff] = useState(null);

  const handleSend = async (customPrompt = null) => {
    const text = customPrompt || prompt;
    if (!text.trim() || isProcessing) return;

    const userEntry = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: text.trim(),
    };

    setHistory((prev) => [...prev, userEntry]);
    setPrompt('');
    setIsProcessing(true);

    try {
      const result = await naturalLanguageService.applyConversationalEdit(nodes, edges, text);
      const assistantEntry = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: result.explanation,
        diff: result.diff,
      };
      setHistory((prev) => [...prev, assistantEntry]);
      setPendingDiff(result.diff);
    } catch {
      toast.error('Failed to generate workflow edits');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApply = (diff) => {
    if (!diff) return;
    onApplyDiff(diff);
    setPendingDiff(null);
    toast.success('Applied AI proposed changes to workflow canvas');
  };

  const handleReject = () => {
    setPendingDiff(null);
    toast.info('Rejected proposed changes');
  };

  return (
    <div
      className={cn(
        'flex h-full w-84 shrink-0 flex-col border-l border-border bg-surface select-none shadow-lg',
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">AI Workflow Copilot</div>
            <div className="text-[10px] text-muted-foreground">Natural Language Graph Editor</div>
          </div>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onClose}>
          <X className="size-3.5" />
        </Button>
      </div>

      {/* Conversation Thread */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {history.map((item) => {
          const isUser = item.role === 'user';
          return (
            <div
              key={item.id}
              className={cn(
                'rounded-xl p-3 text-xs leading-relaxed',
                isUser
                  ? 'ml-6 bg-primary text-primary-foreground font-medium'
                  : 'mr-4 bg-surface-raised border border-border text-foreground',
              )}
            >
              <div>{item.text}</div>

              {/* Proposed Diff Block */}
              {item.diff && (
                <div className="mt-2.5 pt-2 border-t border-border/80 space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <GitBranch className="size-3 text-primary" />
                    <span>Proposed Node Changes:</span>
                  </div>

                  {item.diff.addedNodes.length > 0 && (
                    <div className="space-y-1">
                      {item.diff.addedNodes.map((n) => (
                        <div
                          key={n.id}
                          className="flex items-center gap-1.5 rounded bg-success/10 px-2 py-1 text-[11px] text-success font-medium border border-success/20"
                        >
                          <Plus className="size-3" />
                          <span>Add: {n.data.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {item.diff.modifiedNodes.length > 0 && (
                    <div className="space-y-1">
                      {item.diff.modifiedNodes.map((n) => (
                        <div
                          key={n.id}
                          className="flex items-center gap-1.5 rounded bg-warning/10 px-2 py-1 text-[11px] text-warning font-medium border border-warning/20"
                        >
                          <Sparkles className="size-3" />
                          <span>Update: {n.data.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {pendingDiff === item.diff && (
                    <div className="mt-2 flex items-center gap-2 pt-1">
                      <Button
                        size="xs"
                        onClick={() => handleApply(item.diff)}
                        className="gap-1 text-[11px] font-semibold flex-1"
                      >
                        <Check className="size-3" />
                        Apply Diff
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        onClick={handleReject}
                        className="text-[11px] text-muted-foreground"
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Suggested Quick Commands */}
      <div className="px-3 pb-2 pt-1 border-t border-border/60">
        <div className="text-[10px] font-semibold text-muted-foreground mb-1 uppercase">Try asking:</div>
        <div className="flex flex-wrap gap-1">
          {[
            'Add human approval checkpoint',
            'Insert Knowledge Base search',
            'Add error handling branch',
          ].map((quick) => (
            <button
              key={quick}
              onClick={() => handleSend(quick)}
              disabled={isProcessing}
              className="rounded-full border border-border bg-surface-raised px-2 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-surface transition-colors"
            >
              {quick}
            </button>
          ))}
        </div>
      </div>

      {/* Input Box */}
      <div className="border-t border-border p-3 bg-surface">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-1.5"
        >
          <Input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type instructions to edit graph..."
            className="text-xs"
            disabled={isProcessing}
          />
          <Button
            type="submit"
            size="sm"
            disabled={isProcessing || !prompt.trim()}
            className="shrink-0 gap-1 font-semibold"
          >
            <Send className="size-3.5" />
          </Button>
        </form>
      </div>
    </div>
  );
}
