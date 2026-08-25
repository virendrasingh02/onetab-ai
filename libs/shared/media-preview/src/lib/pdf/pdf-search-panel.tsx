import { IconButton, Input } from '@org/ui';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface Match {
  page: number;
}

export interface PdfSearchPanelProps {
  doc: PDFDocumentProxy;
  numPages: number;
  onQueryChange: (query: string) => void;
  onNavigateToPage: (page: number) => void;
  onClose: () => void;
}

/**
 * Extracts and caches each page's text on demand (never all at once up
 * front) and searches incrementally as pages are scanned — a fresh
 * keystroke bumps `searchToken` so a stale in-flight search's results are
 * discarded instead of racing the new one onto the screen.
 */
export function PdfSearchPanel({
  doc,
  numPages,
  onQueryChange,
  onNavigateToPage,
  onClose,
}: PdfSearchPanelProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const pageTextCache = useRef<Map<number, string>>(new Map());
  const searchToken = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    onQueryChange(query);
  }, [query, onQueryChange]);

  useEffect(() => {
    const needle = query.trim().toLowerCase();
    const token = ++searchToken.current;

    if (!needle) {
      setMatches([]);
      setActiveIndex(0);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    (async () => {
      const found: Match[] = [];
      for (let page = 1; page <= numPages; page++) {
        if (searchToken.current !== token) return;

        let text = pageTextCache.current.get(page);
        if (text === undefined) {
          const pageProxy = await doc.getPage(page);
          const content = await pageProxy.getTextContent();
          text = content.items
            .map((item) => ('str' in item ? item.str : ''))
            .join(' ')
            .toLowerCase();
          pageTextCache.current.set(page, text);
        }

        let fromIndex = 0;
        for (;;) {
          const at = text.indexOf(needle, fromIndex);
          if (at === -1) break;
          found.push({ page });
          fromIndex = at + needle.length;
        }
      }

      if (searchToken.current === token) {
        setMatches(found);
        setActiveIndex(0);
        setIsSearching(false);
        if (found[0]) onNavigateToPage(found[0].page);
      }
    })();
  }, [query, doc, numPages, onNavigateToPage]);

  const goTo = (index: number) => {
    if (!matches.length) return;
    const wrapped = (index + matches.length) % matches.length;
    setActiveIndex(wrapped);
    onNavigateToPage(matches[wrapped].page);
  };

  const statusLabel = isSearching
    ? 'Searching…'
    : matches.length
      ? `${activeIndex + 1} of ${matches.length}`
      : query
        ? 'No matches'
        : '';

  return (
    <div className="gap-2 px-3 py-2 flex items-center border-b border-white/10 bg-black/40 text-white">
      <Search className="size-4 shrink-0 text-white/50" />
      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            goTo(event.shiftKey ? activeIndex - 1 : activeIndex + 1);
          } else if (event.key === 'Escape') {
            onClose();
          }
        }}
        placeholder="Search in document"
        aria-label="Search in document"
        className="h-8 max-w-xs border-white/15 bg-white/5 text-white placeholder:text-white/40"
      />
      <span className="min-w-24 shrink-0 text-xs text-white/70 tabular-nums">{statusLabel}</span>
      <IconButton
        variant="ghost"
        size="icon-sm"
        aria-label="Previous match"
        onClick={() => goTo(activeIndex - 1)}
        disabled={!matches.length}
        className="text-white hover:bg-white/10 hover:text-white"
      >
        <ChevronUp />
      </IconButton>
      <IconButton
        variant="ghost"
        size="icon-sm"
        aria-label="Next match"
        onClick={() => goTo(activeIndex + 1)}
        disabled={!matches.length}
        className="text-white hover:bg-white/10 hover:text-white"
      >
        <ChevronDown />
      </IconButton>
      <IconButton
        variant="ghost"
        size="icon-sm"
        aria-label="Close search"
        onClick={onClose}
        className="text-white hover:bg-white/10 hover:text-white"
      >
        <X />
      </IconButton>
    </div>
  );
}
