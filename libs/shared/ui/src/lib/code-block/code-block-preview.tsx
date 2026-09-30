import { cn } from '@org/utils';
import { AlertCircle, Eye, RefreshCw } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { normalizeLanguage } from './code-block.utils.js';

export interface CodeBlockPreviewProps {
  code: string;
  language?: string;
  className?: string;
}

const PREVIEWABLE_LANGUAGES = new Set(['html', 'htm', 'xml', 'svg', 'css']);

export function isLanguagePreviewable(language?: string): boolean {
  const norm = normalizeLanguage(language);
  return PREVIEWABLE_LANGUAGES.has(norm);
}

export function CodeBlockPreview({
  code,
  language = 'html',
  className,
}: CodeBlockPreviewProps) {
  const [reloadKey, setReloadKey] = useState(0);
  const normalized = normalizeLanguage(language);
  const canPreview = PREVIEWABLE_LANGUAGES.has(normalized);

  const previewSrcDoc = useMemo(() => {
    if (!canPreview) return '';

    if (normalized === 'css') {
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
${code}
</style>
</head>
<body style="font-family:sans-serif;padding:16px;">
  <div class="preview-container">
    <h1>CSS Preview Heading</h1>
    <p>This is a paragraph styled by the CSS block above.</p>
    <button class="preview-button">Preview Button</button>
  </div>
</body>
</html>`;
    }

    if (normalized === 'svg') {
      return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
body { display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; background:transparent; }
svg { max-width: 100%; max-height: 100%; }
</style>
</head>
<body>
${code}
</body>
</html>`;
    }

    // HTML / XML
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 16px; color: #1e293b; }
</style>
</head>
<body>
${code}
</body>
</html>`;
  }, [code, normalized, canPreview]);

  if (!canPreview) {
    return (
      <div className={cn('p-6 flex flex-col items-center justify-center text-center bg-surface-raised/40 border border-border/70 rounded-b-lg text-muted-foreground gap-2', className)}>
        <AlertCircle className="size-6 text-muted-foreground/60" />
        <div className="text-xs font-medium text-foreground">Preview unavailable for {normalized}</div>
        <p className="text-[11px] max-w-sm text-muted-foreground/80">
          Safe sandboxed visual previews are supported for HTML, SVG, and CSS snippets.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col border border-border/80 rounded-b-lg overflow-hidden bg-background', className)}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/60 bg-surface-raised/50 text-[11px] text-muted-foreground select-none">
        <span className="flex items-center gap-1.5 font-medium text-foreground">
          <Eye className="size-3 text-accent-cyan" />
          <span>Sandboxed Preview</span>
        </span>
        <button
          type="button"
          onClick={() => setReloadKey((k) => k + 1)}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] hover:bg-surface text-muted-foreground hover:text-foreground transition-colors"
          title="Reload preview"
        >
          <RefreshCw className="size-3" />
          <span>Refresh</span>
        </button>
      </div>

      <iframe
        key={reloadKey}
        title="Code Preview"
        srcDoc={previewSrcDoc}
        sandbox="allow-scripts allow-forms"
        className="w-full h-64 border-none bg-white rounded-b-lg"
      />
    </div>
  );
}
