import { useState, useEffect } from 'react';
import type { GraphEntityType } from '@org/types';
import { cn } from '@org/utils';
import { Search, X } from 'lucide-react';

export interface GraphSearchProps {
  value: string;
  onChange: (val: string) => void;
  selectedType?: GraphEntityType | 'ALL';
  onTypeChange?: (type: GraphEntityType | 'ALL') => void;
  resultCount?: number;
  placeholder?: string;
  className?: string;
}

const FILTER_TYPES: Array<{ label: string; value: GraphEntityType | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Projects', value: 'Project' },
  { label: 'Tasks', value: 'Task' },
  { label: 'Docs', value: 'Document' },
  { label: 'Code', value: 'SourceFile' },
  { label: 'Components', value: 'Component' },
  { label: 'APIs', value: 'Endpoint' },
  { label: 'Database', value: 'Database' },
];

export function GraphSearch({
  value,
  onChange,
  selectedType = 'ALL',
  onTypeChange,
  resultCount,
  placeholder = 'Search entities, symbols, tasks, code...',
  className,
}: GraphSearchProps) {
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setLocalVal(v);
    onChange(v);
  };

  return (
    <div className={cn('space-y-2.5', className)}>
      <div className="relative flex items-center">
        <Search className="absolute left-3 size-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={localVal}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="w-full pl-9 pr-9 py-2 text-xs rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
        />
        {localVal && (
          <button
            type="button"
            onClick={() => {
              setLocalVal('');
              onChange('');
            }}
            className="absolute right-2.5 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
        {FILTER_TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => onTypeChange?.(t.value)}
            className={cn(
              'px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
              selectedType === t.value
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground',
            )}
          >
            {t.label}
          </button>
        ))}

        {typeof resultCount === 'number' && (
          <span className="ml-auto text-[11px] text-muted-foreground whitespace-nowrap pl-2">
            {resultCount} {resultCount === 1 ? 'result' : 'results'}
          </span>
        )}
      </div>
    </div>
  );
}
