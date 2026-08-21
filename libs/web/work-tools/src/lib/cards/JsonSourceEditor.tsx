import type { CardDefinition } from '@org/types';
import { Button, toast } from '@org/ui';
import { Check, Copy, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';

export interface JsonSourceEditorProps {
  card: CardDefinition;
  onChange: (updatedCard: CardDefinition) => void;
}

export function JsonSourceEditor({ card, onChange }: JsonSourceEditorProps) {
  const [jsonText, setJsonText] = useState(() => JSON.stringify(card, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJsonText(JSON.stringify(card, null, 2));
    setError(null);
  }, [card]);

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (!parsed.cardId || !parsed.name || !parsed.rootComponent) {
        setError('Invalid card schema: missing required properties (cardId, name, rootComponent).');
        return;
      }
      setError(null);
      onChange(parsed);
      toast.success('JSON source changes applied successfully.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON syntax');
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    toast.success('Card JSON copied to clipboard.');
  };

  return (
    <div className="flex flex-col h-full bg-surface border-l border-border/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold text-foreground block">JSON Source Schema</span>
          <span className="text-[10px] text-muted-foreground">Direct AST &amp; schema editing with validation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={handleCopy} className="text-xs h-7 gap-1">
            <Copy className="size-3" />
            Copy
          </Button>
          <Button size="sm" onClick={handleApply} className="text-xs h-7 gap-1 bg-primary text-primary-foreground">
            <Check className="size-3" />
            Apply Changes
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-mono">
          ⚠ {error}
        </div>
      )}

      <textarea
        value={jsonText}
        onChange={(e) => {
          setJsonText(e.target.value);
          setError(null);
        }}
        spellCheck={false}
        className="flex-1 w-full p-3 font-mono text-[11px] leading-relaxed bg-surface-inset text-foreground rounded-xl border border-border/70 focus:outline-none focus:ring-1 focus:ring-primary resize-none overflow-y-auto"
      />
    </div>
  );
}
