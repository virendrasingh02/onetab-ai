import type { CardDefinition } from '@org/types';
import { Button, CodeInput, toast } from '@org/ui';
import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

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
          <Button size="sm" onClick={handleApply} className="text-xs h-7 gap-1">
            <Check className="size-3" />
            Apply Changes
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive-text text-xs font-mono">
          ⚠ {error}
        </div>
      )}

      <CodeInput
        language="json"
        fill
        showCopy={false}
        invalid={Boolean(error)}
        value={jsonText}
        onChange={(text) => {
          setJsonText(text);
          setError(null);
        }}
      />
    </div>
  );
}
