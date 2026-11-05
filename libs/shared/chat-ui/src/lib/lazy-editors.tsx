import { lazy, Suspense } from 'react';
import type { ComposerProps } from './composer.js';
import type { InlineMessageEditorProps } from './inline-message-editor.js';

/**
 * Lexical loads with the first editor on screen. This library's barrel reaches
 * the entry of every app (the providers use its contexts), so without these
 * boundaries a sign-in page would download the rich-text editor.
 */
const LoadedComposer = lazy(async () => ({
  default: (await import('./composer.js')).Composer,
}));

const LoadedInlineMessageEditor = lazy(async () => ({
  default: (await import('./inline-message-editor.js')).InlineMessageEditor,
}));

/** Holds roughly the composer's resting height, so the message list does not jump. */
function EditorPlaceholder() {
  return (
    <div
      aria-hidden
      className="min-h-24 w-full rounded-xl border border-border bg-background"
    />
  );
}

export function Composer(props: ComposerProps) {
  return (
    <Suspense fallback={<EditorPlaceholder />}>
      <LoadedComposer {...props} />
    </Suspense>
  );
}

export function InlineMessageEditor(props: InlineMessageEditorProps) {
  return (
    <Suspense fallback={<EditorPlaceholder />}>
      <LoadedInlineMessageEditor {...props} />
    </Suspense>
  );
}
