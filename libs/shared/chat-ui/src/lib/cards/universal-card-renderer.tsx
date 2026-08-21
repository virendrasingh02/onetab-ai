import type {
  CardActionDefinition,
  CardComponentNode,
  CardDefinition,
  CardRenderContext,
} from '@org/types';
import {
  Badge,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Code2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileCode,
  FileSpreadsheet,
  FileText,
  GitMerge,
  GitPullRequest,
  HelpCircle,
  ImageIcon,
  Info,
  Layers,
  Link2,
  Loader2,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  Terminal,
  User,
  Workflow,
  XCircle,
} from 'lucide-react';
import React, { memo, useMemo, useState } from 'react';
import { MarkdownMessage } from '../markdown-message.js';
import { evaluateCondition, evaluateTemplate } from './card-evaluator.js';
import { useCardRegistryStore } from './card-registry-store.js';

export interface UniversalCardRendererProps {
  cardId?: string;
  version?: number;
  cardDefinition?: CardDefinition;
  data?: Record<string, unknown>;
  context?: CardRenderContext;
  isHighlighted?: boolean;
  onAction?: (action: CardActionDefinition, data: Record<string, unknown>) => void | Promise<void>;
  onFieldChange?: (fieldName: string, value: unknown) => void;
  className?: string;
  isInteractive?: boolean;
}

// Icon helper map
const ICON_MAP: Record<string, React.ElementType> = {
  Building2,
  GitPullRequest,
  GitMerge,
  ShieldAlert,
  Sparkles,
  CheckSquare,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  Calendar,
  Mail,
  Phone,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  Download,
  FileText,
  FileCode,
  FileSpreadsheet,
  ImageIcon,
  Terminal,
  Code2,
  User,
  Workflow,
  Layers,
};

export const UniversalCardRenderer = memo(function UniversalCardRenderer({
  cardId,
  version,
  cardDefinition,
  data = {},
  context,
  isHighlighted = false,
  onAction,
  onFieldChange,
  className,
  isInteractive = true,
}: UniversalCardRendererProps) {
  const registryCard = useCardRegistryStore((s) => (cardId ? s.getCard(cardId, version) : undefined));
  const card = cardDefinition || registryCard;

  const [localData, setLocalData] = useState<Record<string, unknown>>(() => ({
    ...(card?.sampleData || {}),
    ...data,
  }));

  const [activeTab, setActiveTab] = useState<string>('0');
  const [accordionOpen, setAccordionOpen] = useState<Record<string, boolean>>({});
  const [confirmationAction, setConfirmationAction] = useState<CardActionDefinition | null>(null);

  // Sync data updates from parent
  React.useEffect(() => {
    setLocalData((prev) => ({ ...prev, ...data }));
  }, [data]);

  const handleFieldUpdate = (fieldName: string, value: unknown) => {
    setLocalData((prev) => ({ ...prev, [fieldName]: value }));
    if (onFieldChange) {
      onFieldChange(fieldName, value);
    }
  };

  const handleActionClick = async (action: CardActionDefinition) => {
    if (!isInteractive) return;

    if (action.requiresConfirmation) {
      setConfirmationAction(action);
      return;
    }

    await executeAction(action);
  };

  const executeAction = async (action: CardActionDefinition) => {
    try {
      if (action.type === 'open_url') {
        const targetUrl = evaluateTemplate(action.url, localData, context);
        if (targetUrl) {
          window.open(targetUrl, '_blank', 'noopener,noreferrer');
        }
      } else if (action.type === 'copy_value') {
        const valToCopy = evaluateTemplate(action.payloadTemplate?.['value'] || '', localData, context);
        if (valToCopy) {
          navigator.clipboard?.writeText(valToCopy);
          toast.success(action.successMessage || 'Copied to clipboard');
        }
      }

      if (onAction) {
        await onAction(action, localData);
      }

      if (action.successMessage && action.type !== 'copy_value') {
        toast.success(action.successMessage);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : action.errorMessage || 'Action execution failed';
      toast.error(msg);
    }
  };

  // Fallback rendering if card definition not found
  if (!card) {
    return (
      <article
        className={cn(
          'my-2 rounded-2xl border border-border/80 bg-surface/90 p-4 text-xs font-mono shadow-xs',
          isHighlighted && 'ring-2 ring-primary/60',
          className,
        )}
      >
        <div className="flex items-center gap-2 font-bold text-muted-foreground mb-2">
          <HelpCircle className="size-4 text-primary" />
          <span>Universal Card: {cardId || 'Unknown'} {version ? `(v${version})` : ''}</span>
        </div>
        <p className="text-muted-foreground mb-2">Card definition unavailable in local registry. Raw structured data payload:</p>
        <pre className="p-3 rounded-lg bg-surface-inset text-foreground/90 overflow-x-auto text-[11px]">
          {JSON.stringify(data, null, 2)}
        </pre>
      </article>
    );
  }

  // Recursive Component Node Renderer
  const renderNode = (node: CardComponentNode): React.ReactNode => {
    if (!evaluateCondition(node.visibleWhen, localData, context)) {
      return null;
    }

    const props = node.props || {};
    const style = node.style || {};

    // Helper for applying inline styles
    const inlineStyle: React.CSSProperties = {
      padding: style.padding,
      margin: style.margin,
      gap: style.gap,
      borderRadius: style.borderRadius,
      width: style.width,
      height: style.height,
      maxWidth: style.maxWidth,
      maxHeight: style.maxHeight,
      textAlign: style.textAlign,
    };

    switch (node.type) {
      case 'container':
        return (
          <div
            key={node.id}
            style={inlineStyle}
            className={cn(
              'rounded-xl transition-all',
              style.background === 'surface' && 'bg-surface',
              style.background === 'surface-raised' && 'bg-surface-raised',
              style.border && 'border border-border/80',
            )}
          >
            {node.children?.map(renderNode)}
          </div>
        );

      case 'row':
        return (
          <div
            key={node.id}
            style={inlineStyle}
            className={cn(
              'flex flex-row',
              style.alignItems === 'center' && 'items-center',
              style.alignItems === 'start' && 'items-start',
              style.alignItems === 'end' && 'items-end',
              style.justifyContent === 'between' && 'justify-between',
              style.justifyContent === 'center' && 'justify-center',
              style.justifyContent === 'end' && 'justify-end',
              style.flexWrap === 'wrap' && 'flex-wrap',
            )}
          >
            {node.children?.map(renderNode)}
          </div>
        );

      case 'column':
      case 'stack':
        return (
          <div
            key={node.id}
            style={inlineStyle}
            className={cn(
              'flex flex-col',
              style.alignItems === 'center' && 'items-center',
              style.alignItems === 'start' && 'items-start',
              style.alignItems === 'end' && 'items-end',
              style.justifyContent === 'between' && 'justify-between',
            )}
          >
            {node.children?.map(renderNode)}
          </div>
        );

      case 'grid': {
        const cols = (props['columns'] as number) || 2;
        return (
          <div
            key={node.id}
            style={inlineStyle}
            className={cn(
              'grid',
              cols === 2 && 'grid-cols-1 sm:grid-cols-2',
              cols === 3 && 'grid-cols-1 sm:grid-cols-3',
              cols === 4 && 'grid-cols-2 sm:grid-cols-4',
            )}
          >
            {node.children?.map(renderNode)}
          </div>
        );
      }

      case 'spacer':
        return <div key={node.id} style={{ height: (props['size'] as string) || '12px' }} />;

      case 'divider':
        return <hr key={node.id} className="my-3 border-border/60" />;

      case 'heading': {
        const text = evaluateTemplate(props['text'], localData, context);
        const level = (props['level'] as number) || 3;
        const Tag = level === 1 ? 'h1' : level === 2 ? 'h2' : 'h3';
        return (
          <Tag
            key={node.id}
            style={inlineStyle}
            className={cn(
              'font-bold text-foreground tracking-tight',
              level === 1 && 'text-base sm:text-lg',
              level === 2 && 'text-sm sm:text-base',
              level === 3 && 'text-xs sm:text-sm',
            )}
          >
            {text}
          </Tag>
        );
      }

      case 'text':
      case 'paragraph': {
        const text = evaluateTemplate(props['text'], localData, context);
        return (
          <p
            key={node.id}
            style={inlineStyle}
            className={cn(
              'text-xs leading-relaxed',
              props['variant'] === 'muted' ? 'text-muted-foreground' : 'text-foreground',
              props['size'] === 'xs' && 'text-[11px]',
              props['size'] === 'sm' && 'text-xs',
              props['size'] === 'md' && 'text-sm',
            )}
          >
            {text}
          </p>
        );
      }

      case 'markdown': {
        const content = evaluateTemplate(props['content'] || props['text'], localData, context);
        return (
          <div key={node.id} style={inlineStyle} className="text-xs text-foreground leading-relaxed">
            <MarkdownMessage text={content} />
          </div>
        );
      }

      case 'badge': {
        const text = evaluateTemplate(props['text'] || props['label'], localData, context);
        const variant = (props['variant'] as any) || 'primary';
        return (
          <Badge
            key={node.id}
            variant={variant}
            className="text-[10px] py-0 h-4 font-semibold uppercase tracking-wider"
          >
            {text}
          </Badge>
        );
      }

      case 'avatar': {
        const name = evaluateTemplate(props['name'], localData, context);
        const src = evaluateTemplate(props['src'], localData, context);
        return (
          <UserAvatar
            key={node.id}
            name={name || 'User'}
            src={src || undefined}
            size={(props['size'] as any) || 'md'}
          />
        );
      }

      case 'key_value': {
        const label = evaluateTemplate(props['label'], localData, context);
        const value = evaluateTemplate(props['value'], localData, context);
        return (
          <div key={node.id} className="p-2.5 rounded-xl border border-border/70 bg-surface-raised text-xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
              {label}
            </span>
            <span className="font-semibold text-foreground mt-0.5 block truncate">
              {value}
            </span>
          </div>
        );
      }

      case 'button': {
        const label = evaluateTemplate(props['label'], localData, context);
        const iconName = props['icon'] as string;
        const IconComponent = iconName ? ICON_MAP[iconName] : null;
        const actionId = node.actionId || (props['actionId'] as string);
        const action = card.actions?.find((a) => a.id === actionId);

        return (
          <Button
            key={node.id}
            size="sm"
            variant={(props['variant'] as any) || 'outline'}
            onClick={() => {
              if (action) {
                void handleActionClick(action);
              }
            }}
            className="h-7 text-xs gap-1.5 shadow-2xs"
          >
            {IconComponent && <IconComponent className="size-3.5" />}
            <span>{label}</span>
          </Button>
        );
      }

      case 'button_group':
        return (
          <div
            key={node.id}
            style={inlineStyle}
            className="flex items-center flex-wrap gap-2 pt-2 border-t border-border/60"
          >
            {node.children?.map(renderNode)}
          </div>
        );

      case 'input': {
        const fieldName = String(props['name'] || node.id);
        const placeholder = evaluateTemplate(props['placeholder'], localData, context);
        const val = String(localData[fieldName] || '');

        return (
          <div key={node.id} className="space-y-1 my-1">
            {props['label'] && (
              <Label className="text-xs font-semibold text-foreground">
                {evaluateTemplate(props['label'], localData, context)}
              </Label>
            )}
            <Input
              placeholder={placeholder}
              value={val}
              onChange={(e) => handleFieldUpdate(fieldName, e.target.value)}
              className="text-xs h-8"
            />
          </div>
        );
      }

      case 'select': {
        const fieldName = String(props['name'] || node.id);
        const val = String(localData[fieldName] || '');
        const options = (props['options'] as Array<{ label: string; value: string }>) || [];

        return (
          <div key={node.id} className="space-y-1 my-1">
            {props['label'] && (
              <Label className="text-xs font-semibold text-foreground">
                {evaluateTemplate(props['label'], localData, context)}
              </Label>
            )}
            <Select value={val} onValueChange={(newVal) => handleFieldUpdate(fieldName, newVal)}>
              <SelectTrigger className="text-xs h-8">
                <SelectValue placeholder={props['placeholder'] as string || 'Select…'} />
              </SelectTrigger>
              <SelectContent className="text-xs">
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      }

      case 'checkbox': {
        const fieldName = String(props['name'] || node.id);
        const checked = Boolean(localData[fieldName]);

        return (
          <div key={node.id} className="flex items-center gap-2 py-1">
            <Checkbox
              id={node.id}
              checked={checked}
              onCheckedChange={(c) => handleFieldUpdate(fieldName, Boolean(c))}
            />
            <label htmlFor={node.id} className="text-xs text-foreground cursor-pointer select-none">
              {evaluateTemplate(props['label'] || props['text'], localData, context)}
            </label>
          </div>
        );
      }

      case 'alert': {
        const title = evaluateTemplate(props['title'], localData, context);
        const description = evaluateTemplate(props['description'], localData, context);
        return (
          <div key={node.id} className="my-2 rounded-lg border border-border bg-surface-muted/60 p-3 text-xs">
            <div className="font-semibold text-foreground">{title}</div>
            {description && <div className="mt-1 text-muted-foreground">{description}</div>}
          </div>
        );
      }

      case 'progress': {
        const value = Number(evaluateTemplate(props['value'], localData, context)) || 0;
        const max = Number(props['max']) || 100;
        const pct = Math.min(100, Math.max(0, (value / max) * 100));

        return (
          <div key={node.id} className="my-2 space-y-1">
            {props['label'] && (
              <div className="flex justify-between text-[11px] font-semibold text-muted-foreground">
                <span>{evaluateTemplate(props['label'], localData, context)}</span>
                <span>{pct.toFixed(0)}%</span>
              </div>
            )}
            <div className="h-2 w-full rounded-full bg-surface-raised overflow-hidden border border-border/60">
              <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      }

      case 'image': {
        const src = evaluateTemplate(props['src'], localData, context);
        const alt = evaluateTemplate(props['alt'], localData, context) || 'Card image';
        return (
          <img
            key={node.id}
            src={src}
            alt={alt}
            style={inlineStyle}
            className="rounded-xl object-cover border border-border/60 max-h-64 w-full"
          />
        );
      }

      default:
        // Default container rendering for unhandled AST nodes
        return (
          <div key={node.id} style={inlineStyle}>
            {node.children?.map(renderNode)}
          </div>
        );
    }
  };

  return (
    <article
      data-card-id={card.cardId}
      data-card-version={card.version}
      className={cn(
        'group/card relative my-2 rounded-2xl border border-border/80 bg-surface/90 backdrop-blur-sm p-4 transition-all duration-200 shadow-xs hover:shadow-md max-w-2xl',
        isHighlighted && 'ring-2 ring-primary/60',
        className,
      )}
    >
      {renderNode(card.rootComponent)}

      {/* Confirmation Modal for Sensitive Actions */}
      {confirmationAction && (
        <Dialog open={!!confirmationAction} onOpenChange={() => setConfirmationAction(null)}>
          <DialogContent className="max-w-md bg-surface border-border text-foreground">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-sm font-bold text-rose-500">
                <AlertTriangle className="size-4" />
                <span>{confirmationAction.confirmationTitle || 'Confirm Action'}</span>
              </DialogTitle>
            </DialogHeader>
            <p className="text-xs text-muted-foreground">
              {confirmationAction.confirmationMessage || `Are you sure you want to execute "${confirmationAction.label}"?`}
            </p>
            <div className="flex justify-end gap-2 mt-4">
              <Button size="sm" variant="outline" onClick={() => setConfirmationAction(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  const act = confirmationAction;
                  setConfirmationAction(null);
                  void executeAction(act);
                }}
              >
                Confirm &amp; Execute
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </article>
  );
});
