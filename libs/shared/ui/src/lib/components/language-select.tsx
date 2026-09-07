import {
  getLanguageConfig,
  SUPPORTED_LANGUAGES,
  type LanguageConfig,
  type SupportedLanguageCode,
} from '@org/i18n';
import { cn } from '@org/utils';
import { Check, ChevronsUpDown, Globe, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from './button.js';
import { Input } from './input.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';
import { ScrollArea } from './scroll-area.js';

export interface LanguageSelectProps {
  /** The selected language code, e.g. 'en', 'hi', 'ar' */
  value: SupportedLanguageCode | string;
  /** Callback fired when user selects a language */
  onChange: (languageCode: SupportedLanguageCode) => void;
  id?: string;
  className?: string;
  disabled?: boolean;
  /** When true, renders a smaller button without the full name for compact headers/footers */
  compact?: boolean;
  /** Placeholder text for search filter */
  searchPlaceholder?: string;
}

/**
 * Accessible, searchable language selector.
 * Displays flag, native name, English name, and RTL indicator.
 */
export function LanguageSelect({
  value,
  onChange,
  id,
  className,
  disabled = false,
  compact = false,
  searchPlaceholder = 'Search language...',
}: LanguageSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const currentLang = useMemo(() => {
    return getLanguageConfig(value);
  }, [value]);

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return SUPPORTED_LANGUAGES;
    return SUPPORTED_LANGUAGES.filter(
      (lang: LanguageConfig) =>
        lang.name.toLowerCase().includes(needle) ||
        lang.nativeName.toLowerCase().includes(needle) ||
        lang.code.toLowerCase().includes(needle)
    );

  }, [query]);

  const select = (code: SupportedLanguageCode) => {
    onChange(code);
    setOpen(false);
    setQuery('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-label={`Select language (current: ${currentLang.name})`}
          className={cn(
            compact
              ? 'h-8 px-2.5 text-xs font-normal gap-1.5'
              : 'h-9 px-3 text-xs font-normal w-full justify-between',
            className
          )}
        >
          <span className="min-w-0 gap-2 flex items-center">
            {compact ? (
              <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <span className="text-sm shrink-0" aria-hidden>
                {currentLang.flag}
              </span>
            )}
            <span className="truncate font-medium">
              {compact ? currentLang.nativeName : currentLang.name}
            </span>
            {!compact && currentLang.nativeName !== currentLang.name && (
              <span className="truncate text-muted-foreground text-[11px]">
                ({currentLang.nativeName})
              </span>
            )}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50 ml-1.5" aria-hidden />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align={compact ? 'end' : 'start'}
        className="p-0 w-72 shadow-md"
        sideOffset={4}
      >
        <div className="p-2 border-b">
          <div className="relative">
            <Search
              className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
              aria-hidden
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label="Filter languages"
              className="h-8 pl-8 text-xs"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="max-h-64 overflow-y-auto p-1">
          {matches.length === 0 ? (
            <div className="px-3 py-4 text-xs text-center text-muted-foreground">
              No languages found
            </div>
          ) : (
            <div className="flex flex-col gap-0.5" role="listbox">
              {matches.map((lang: LanguageConfig) => {
                const isSelected = lang.code === currentLang.code;

                return (
                  <button
                    key={lang.code}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => select(lang.code)}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-1.5 rounded-sm text-xs text-left transition-colors',
                      'hover:bg-accent hover:text-accent-foreground cursor-pointer',
                      isSelected && 'bg-accent/60 font-medium'
                    )}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-base shrink-0" aria-hidden>
                        {lang.flag}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <span className="truncate font-medium">{lang.nativeName}</span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {lang.name}
                          {lang.isRtl && (
                            <span className="ml-1.5 px-1 py-0.2 text-[9px] rounded bg-muted uppercase tracking-wider font-mono">
                              RTL
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="size-3.5 text-primary shrink-0 ml-2" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

