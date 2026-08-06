import { Button, Textarea } from '@org/ui';
import { CornerDownLeft, FileText, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { sendToBackground, type CapturedPage } from '../lib/messaging.js';

interface AskAiTabProps {
  page: CapturedPage | null;
}

/**
 * Free-form prompt, optionally grounded in the current page.
 *
 * The page text is attached as context rather than pasted into the prompt, so
 * what the user typed stays visible and editable while the model still sees
 * what they are looking at.
 */
export function AskAiTab({ page }: AskAiTabProps) {
  const [prompt, setPrompt] = useState('');
  const [usePageContext, setUsePageContext] = useState(true);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /**
   * A right-click on a selection parks the text here and opens the popup, so
   * the prompt is pre-filled from the page the user was actually reading.
   */
  useEffect(() => {
    void chrome.storage.session
      .get('onetab.pendingPrompt')
      .then((stored) => {
        const pending = stored['onetab.pendingPrompt'] as string | undefined;
        if (pending) {
          setPrompt(`Explain this: "${pending}"`);
          return chrome.storage.session.remove('onetab.pendingPrompt');
        }
        return undefined;
      })
      .finally(() => inputRef.current?.focus());
  }, []);

  async function ask() {
    const trimmed = prompt.trim();
    if (!trimmed || pending) return;

    setPending(true);
    setError(null);
    setAnswer(null);

    const response = await sendToBackground<string>({
      type: 'ai:ask',
      prompt: trimmed,
      context: usePageContext && page?.text ? page.text : undefined,
    });

    if (response.ok) setAnswer(response.data);
    else setError(response.error);
    setPending(false);
  }

  return (
    <div className="gap-2.5 flex flex-col">
      <Textarea
        ref={inputRef}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={(event) => {
          // Enter sends; Shift+Enter breaks the line. The popup is small, so
          // reaching for a button on every question would be the slow path.
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            void ask();
          }
        }}
        placeholder="Ask anything about this page…"
        rows={3}
        className="min-h-[68px]"
      />

      <div className="gap-2 flex items-center justify-between">
        {page?.text ? (
          <button
            type="button"
            onClick={() => setUsePageContext((value) => !value)}
            aria-pressed={usePageContext}
            className={`gap-1.5 px-1.5 py-0.5 font-medium inline-flex items-center rounded-[6px] border text-[11px] transition-colors duration-[120ms] ${
              usePageContext
                ? 'border-[#6E56CF]/30 bg-[#6E56CF]/15 text-[#7C6AF5]'
                : 'border-[#27272A] bg-[#16171A] text-[#A1A1AA] hover:text-[#FAFAFA]'
            }`}
          >
            <FileText className="size-3" aria-hidden />
            {page.fromSelection ? 'Selection' : 'Page'} as context
          </button>
        ) : (
          <span className="text-[11px] text-[#52525B]">No page context</span>
        )}

        <Button
          size="sm"
          onClick={() => void ask()}
          loading={pending}
          disabled={!prompt.trim()}
          trailingIcon={<CornerDownLeft className="size-3.5" />}
        >
          Ask
        </Button>
      </div>

      {error ? (
        <p className="px-2.5 py-2 text-xs rounded-[8px] border border-[#E5484D]/30 bg-[#E5484D]/10 text-[#E5484D]">
          {error}
        </p>
      ) : null}

      {answer ? (
        <div className="p-2.5 rounded-[8px] border border-[#27272A] bg-[#16171A]">
          <div className="mb-1.5 gap-1.5 font-semibold flex items-center text-[11px] text-[#7C6AF5]">
            <Sparkles className="size-3" aria-hidden />
            Answer
          </div>
          <p className="text-xs leading-relaxed whitespace-pre-wrap text-[#A1A1AA]">
            {answer}
          </p>
        </div>
      ) : null}
    </div>
  );
}
