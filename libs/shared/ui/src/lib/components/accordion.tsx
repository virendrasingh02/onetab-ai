import { cn } from '@org/utils';
import { ChevronDown } from 'lucide-react';
import {
  createContext,
  useContext,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';

interface AccordionContextValue {
  expandedItems: string[];
  toggleItem: (value: string) => void;
}

const AccordionContext = createContext<AccordionContextValue | null>(null);

export interface AccordionProps extends ComponentProps<'div'> {
  type?: 'single' | 'multiple';
  value?: string | string[];
  defaultValue?: string | string[];
  onValueChange?: (value: string | string[]) => void;
  collapsible?: boolean;
}

export function Accordion({
  type = 'single',
  value: controlledValue,
  defaultValue = type === 'single' ? '' : [],
  onValueChange,
  collapsible = true,
  className,
  children,
  ...props
}: AccordionProps) {
  const [internalValue, setInternalValue] = useState<string[]>(() => {
    if (Array.isArray(defaultValue)) return defaultValue;
    return defaultValue ? [defaultValue] : [];
  });

  const expandedItems = Array.isArray(controlledValue)
    ? controlledValue
    : controlledValue !== undefined
    ? controlledValue ? [controlledValue] : []
    : internalValue;

  const toggleItem = (val: string) => {
    let next: string[];
    if (type === 'single') {
      const isCurrent = expandedItems.includes(val);
      if (isCurrent && collapsible) {
        next = [];
      } else {
        next = [val];
      }
    } else {
      next = expandedItems.includes(val)
        ? expandedItems.filter((i) => i !== val)
        : [...expandedItems, val];
    }

    if (controlledValue === undefined) {
      setInternalValue(next);
    }
    onValueChange?.(type === 'single' ? (next[0] ?? '') : next);
  };

  return (
    <AccordionContext.Provider value={{ expandedItems, toggleItem }}>
      <div className={cn('divide-y divide-border border-y border-border', className)} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

const AccordionItemContext = createContext<{ value: string; isOpen: boolean } | null>(null);

export interface AccordionItemProps extends ComponentProps<'div'> {
  value: string;
}

export function AccordionItem({
  value,
  className,
  children,
  ...props
}: AccordionItemProps) {
  const context = useContext(AccordionContext);
  const isOpen = context?.expandedItems.includes(value) ?? false;

  return (
    <AccordionItemContext.Provider value={{ value, isOpen }}>
      <div className={cn('py-1', className)} {...props}>
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

export interface AccordionTriggerProps extends ComponentProps<'button'> {
  icon?: ReactNode;
}

export function AccordionTrigger({
  className,
  icon,
  children,
  ...props
}: AccordionTriggerProps) {
  const itemContext = useContext(AccordionItemContext);
  const rootContext = useContext(AccordionContext);

  if (!itemContext || !rootContext) {
    throw new Error('AccordionTrigger must be used inside AccordionItem');
  }

  const { value, isOpen } = itemContext;

  return (
    <button
      type="button"
      aria-expanded={isOpen}
      onClick={() => rootContext.toggleItem(value)}
      className={cn(
        'flex w-full items-center justify-between py-2 text-xs font-medium text-foreground transition-all duration-(--duration-fast)',
        'hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-sm text-left',
        className,
      )}
      {...props}
    >
      <div className="flex items-center gap-2">
        {icon}
        <span>{children}</span>
      </div>
      <ChevronDown
        className={cn(
          'size-4 text-muted-foreground transition-transform duration-(--duration-base) shrink-0',
          isOpen && 'rotate-180 text-foreground',
        )}
      />
    </button>
  );
}

export interface AccordionContentProps extends ComponentProps<'div'> {}

export function AccordionContent({
  className,
  children,
  ...props
}: AccordionContentProps) {
  const itemContext = useContext(AccordionItemContext);
  if (!itemContext) {
    throw new Error('AccordionContent must be used inside AccordionItem');
  }

  if (!itemContext.isOpen) return null;

  return (
    <div
      className={cn(
        'overflow-hidden pb-3 pt-1 text-xs text-muted-foreground transition-all animate-in fade-in-50 duration-150',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
