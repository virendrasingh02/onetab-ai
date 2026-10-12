import { Button, CodeBlock, toast } from '@org/ui';
import { Check, Copy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/** Copies text and says so; tolerates a browser that refuses clipboard access. */
export function CopyButton({ text, label = 'Copy', className }: { text: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={className}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => setCopied(false), 1800);
        } catch {
          toast.error('Copy failed', { description: 'Your browser blocked clipboard access. Select the text and copy it by hand.' });
        }
      }}
    >
      {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : label}
    </Button>
  );
}

/** A titled, copyable code block. */
export function SnippetBlock({
  title,
  code,
  language,
}: {
  title: string;
  code: string;
  language: 'html' | 'javascript' | 'bash' | 'python';
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-foreground">{title}</span>
        <CopyButton text={code} label="Copy code" className="h-7 text-xs" />
      </div>
      <CodeBlock code={code} language={language} showLineNumbers={false} />
    </div>
  );
}
