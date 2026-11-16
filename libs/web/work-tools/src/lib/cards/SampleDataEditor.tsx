import { Button, CodeInput, toast } from '@org/ui';
import { Check } from 'lucide-react';
import { useEffect, useState } from 'react';

export interface SampleDataEditorProps {
  sampleData: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

export function SampleDataEditor({
  sampleData,
  onChange,
}: SampleDataEditorProps) {
  const [jsonText, setJsonText] = useState(() =>
    JSON.stringify(sampleData, null, 2),
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setJsonText(JSON.stringify(sampleData, null, 2));
  }, [sampleData]);

  const handleApply = () => {
    try {
      const parsed = JSON.parse(jsonText);
      if (typeof parsed !== 'object' || parsed === null) {
        setError('Sample data must be a valid JSON object.');
        return;
      }
      setError(null);
      onChange(parsed);
      toast.success('Sample data updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid JSON');
    }
  };

  return (
    <div className="p-4 space-y-3 flex h-full flex-col border-l border-border/60 bg-surface">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-bold block text-foreground">
            Sample Mock Data
          </span>
          <span className="text-2xs text-muted-foreground">
            Test bindings and preview rendering with realistic mock data
          </span>
        </div>
        <Button size="sm" onClick={handleApply} className="text-xs h-7 gap-1">
          <Check className="size-3" />
          Update Preview
        </Button>
      </div>

      {error && (
        <div className="p-2.5 text-xs rounded-lg border border-destructive/30 bg-destructive/10 font-mono text-destructive-text">
          ⚠ {error}
        </div>
      )}

      <CodeInput
        language="json"
        fill
        showCopy={true}
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
