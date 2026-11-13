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
        setError(
          'Invalid card schema: missing required properties (cardId, name, rootComponent).',
        );
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
    <div className="p-4 space-y-3 flex h-full flex-col border-l border-border/60 bg-surface">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold block text-foreground">
            JSON Source Schema
          </span>
          <span className="text-2xs text-muted-foreground">
            Direct AST &amp; schema editing with validation
          </span>
        </div>
        <div className="gap-1.5 flex items-center">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="text-xs h-7 gap-1"
          >
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
        <div className="p-2.5 text-xs rounded-lg border border-destructive/30 bg-destructive/10 font-mono text-destructive-text">
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
