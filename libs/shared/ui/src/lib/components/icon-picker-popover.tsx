import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlarmClock,
  AlertCircle,
  AlertTriangle,
  Ambulance,
  Anchor,
  Apple,
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  BarChart3,
  Battery,
  Bell,
  Bookmark,
  Bot,
  Box,
  Briefcase,
  Bug,
  Calendar,
  Camera,
  Check,
  Clipboard,
  Clock,
  Code,
  Compass,
  Cpu,
  CreditCard,
  Database,
  Download,
  Eye,
  Feather,
  FileText,
  Filter,
  Flame,
  Folder,
  Gamepad2,
  Gift,
  GitBranch,
  Globe,
  HardDrive,
  Hash,
  Heart,
  Home,
  Image as ImageIcon,
  Inbox,
  Key,
  Laptop,
  Layers,
  LifeBuoy,
  Link as LinkIcon,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Mic,
  Moon,
  Music,
  Package,
  Paperclip,
  Phone,
  Pin,
  Plane,
  Plug,
  Plus,
  Printer,
  Radio,
  RefreshCw,
  Rocket,
  Search,
  Send,
  Settings,
  Shield,
  ShoppingBag,
  Shuffle,
  Sliders,
  Smartphone,
  Smile,
  Sparkles,
  Star,
  Sun,
  Tag,
  Terminal,
  ThumbsUp,
  Trash2,
  Tv,
  Upload,
  User,
  Video,
  Waves,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';
import { cn } from '@org/utils';
import { Button } from './button.js';
import { Input } from './input.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';
import { ScrollArea } from './scroll-area.js';

// Custom SVG icon for "123" like in reference image
function Icon123(props: LucideProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 10h2v7H3" />
      <path d="M5 10a2 2 0 0 1 2-2h1a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H5v4h5" />
      <path d="M14 8h3a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-1m1 0a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2h-3" />
    </svg>
  );
}

// Icon Registry mapping icon names to Lucide Icon components
export const ICON_REGISTRY: Record<string, React.ComponentType<LucideProps>> = {
  '123': Icon123,
  User,
  BarChart3,
  Plus,
  Plane,
  AlarmClock,
  AlertCircle,
  Bot,
  Gamepad2,
  Ambulance,
  Anchor,
  Apple,
  Plug,
  Waves,
  Compass,
  Sparkles,
  Folder,
  FileText,
  Code,
  Database,
  Shield,
  Zap,
  Box,
  Tag,
  Settings,
  Terminal,
  Rocket,
  Layers,
  GitBranch,
  Cpu,
  Globe,
  Key,
  Lock,
  Mail,
  Star,
  Heart,
  Bookmark,
  Eye,
  Bell,
  Trash2,
  Smile,
  Flame,
  Gift,
  Laptop,
  Coffee: (props: LucideProps) => (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 8h1a4 4 0 0 1 0 8h-1" />
      <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z" />
      <line x1="6" y1="1" x2="6" y2="4" />
      <line x1="10" y1="1" x2="10" y2="4" />
      <line x1="14" y1="1" x2="14" y2="4" />
    </svg>
  ),
  Music,
  Video,
  Camera,
  Hash,
  Check,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Filter,
  Package,
  Briefcase,
  Paperclip,
  Battery,
  Sliders,
  Activity,
  Award,
  Calendar,
  Clock,
  CreditCard,
  Download,
  Feather,
  HardDrive,
  Home,
  ImageIcon,
  Inbox,
  LifeBuoy,
  LinkIcon,
  MapPin,
  Megaphone,
  MessageSquare,
  Mic,
  Moon,
  Phone,
  Pin,
  Printer,
  Radio,
  Search,
  Send,
  ShoppingBag,
  Smartphone,
  Sun,
  ThumbsUp,
  Tv,
  Wifi,
  Wrench,
  Archive,
  Bug,
  AlertTriangle,
  Clipboard,
};

// Preset colors for icon color selector
/*
 * Icon tints, drawn from the same accent ramp as `--accent-*` in theme.css so a
 * hand-picked icon colour sits alongside the rest of the UI. These stay literal
 * hexes rather than tokens: the value is persisted with the entity and is
 * rendered into an inline `style`, so it must not shift when the theme does.
 */
export const ICON_COLOR_PRESETS = [
  { id: 'default', label: 'Default', hex: '#8A8F98' },
  { id: 'red', label: 'Red', hex: '#EB5757' },
  { id: 'orange', label: 'Orange', hex: '#FC7840' },
  { id: 'amber', label: 'Amber', hex: '#F2C94C' },
  { id: 'green', label: 'Green', hex: '#4CB782' },
  { id: 'teal', label: 'Teal', hex: '#0F9B8E' },
  { id: 'cyan', label: 'Cyan', hex: '#26B5CE' },
  { id: 'blue', label: 'Blue', hex: '#4EA7FC' },
  { id: 'indigo', label: 'Indigo', hex: '#6771D4' },
  { id: 'violet', label: 'Violet', hex: '#5E6AD2' },
  { id: 'pink', label: 'Pink', hex: '#E07BB8' },
  { id: 'slate', label: 'Slate', hex: '#6B6F76' },
];

/*
 * What the picker offers. `123` stays in the registry so anything already saved
 * with it still draws, but its hand-drawn glyph is not one to offer new.
 */
const PICKER_ICON_NAMES = Object.keys(ICON_REGISTRY).filter(
  (name) => name !== '123',
);

const TOOL_BUTTON_CLASS =
  'size-7 flex shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';

export interface IconRendererProps {
  icon?: string;
  iconColor?: string;
  className?: string;
  sizeClassName?: string;
  fallbackEmoji?: string;
}

export function IconRenderer({
  icon,
  iconColor,
  className,
  sizeClassName = 'size-5',
  fallbackEmoji = '📝',
}: IconRendererProps) {
  if (!icon) {
    return <span className={className}>{fallbackEmoji}</span>;
  }

  // Check if icon is custom uploaded URL or Data URI
  if (
    icon.startsWith('http://') ||
    icon.startsWith('https://') ||
    icon.startsWith('data:image')
  ) {
    return (
      <img
        src={icon}
        alt="icon"
        className={cn('rounded-sm object-cover', sizeClassName, className)}
      />
    );
  }

  // Check if icon is in Lucide Icon Registry
  const IconComponent = ICON_REGISTRY[icon];
  if (IconComponent) {
    return (
      <IconComponent
        className={cn(sizeClassName, className)}
        style={iconColor ? { color: iconColor } : undefined}
      />
    );
  }

  // Fallback as Emoji string
  return <span className={className}>{icon}</span>;
}

export interface IconPickerPopoverProps {
  icon?: string;
  iconColor?: string;
  onSelectIcon: (icon: string, iconColor?: string) => void;
  onRemoveIcon?: () => void;
  /**
   * Takes the chosen file instead of the picker inlining it as a `data:` URI.
   *
   * Anything that persists its icon to a column wants this: the caller uploads
   * the bytes and calls `onSelectIcon` with the resulting URL. Left out, the
   * upload view falls back to a data URI, which suits callers that keep their
   * icon inside a document body rather than a field of its own.
   */
  onUploadFile?: (file: File) => void;
  /** Hides the upload button, for callers that store icons elsewhere. */
  allowUpload?: boolean;
  /** Shown under the upload control — a rejected file, a failed upload. */
  uploadError?: string | null;
  /** A save is in flight: the picker stays readable but refuses new input. */
  isPending?: boolean;
  disabled?: boolean;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function IconPickerPopover({
  icon,
  iconColor = ICON_COLOR_PRESETS[0].hex,
  onSelectIcon,
  onRemoveIcon,
  onUploadFile,
  allowUpload = true,
  uploadError,
  isPending = false,
  disabled = false,
  trigger,
  align = 'start',
}: IconPickerPopoverProps) {
  const [view, setView] = useState<'icons' | 'upload'>('icons');
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(iconColor);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // The colour is editable here but owned by the entity, so a change that lands
  // from elsewhere — another tab, a rollback after a failed save — wins.
  useEffect(() => setSelectedColor(iconColor), [iconColor]);

  const filteredIcons = useMemo(() => {
    if (!filterQuery.trim()) return PICKER_ICON_NAMES;
    const q = filterQuery.toLowerCase().trim();
    return PICKER_ICON_NAMES.filter((name) => name.toLowerCase().includes(q));
  }, [filterQuery]);

  const handleRandomIcon = () => {
    const randomIndex = Math.floor(Math.random() * PICKER_ICON_NAMES.length);
    const randomIcon = PICKER_ICON_NAMES[randomIndex];
    const randomColorObj =
      ICON_COLOR_PRESETS[Math.floor(Math.random() * ICON_COLOR_PRESETS.length)];
    setSelectedColor(randomColorObj.hex);
    onSelectIcon(randomIcon, randomColorObj.hex);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Let the same file be picked again after a rejection — without this the
    // input holds the value and the second attempt fires no change event.
    e.target.value = '';

    if (onUploadFile) {
      onUploadFile(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        onSelectIcon(result);
        setIsOpen(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadedUrl.trim()) {
      onSelectIcon(uploadedUrl.trim());
      setUploadedUrl('');
      setIsOpen(false);
    }
  };

  return (
    <Popover
      open={isOpen}
      onOpenChange={(next) => {
        if (disabled) return;
        setIsOpen(next);
        if (!next) {
          setFilterQuery('');
          setView('icons');
        }
      }}
    >
      <PopoverTrigger asChild>
        {trigger || (
          <button
            type="button"
            disabled={disabled}
            aria-busy={isPending}
            className={cn(
              'size-16 text-3xl flex cursor-pointer items-center justify-center overflow-hidden rounded-2xl border-2 border-surface bg-surface-raised shadow-lg transition-transform',
              disabled ? 'cursor-not-allowed opacity-60' : 'hover:scale-105',
              isPending && 'animate-pulse',
            )}
            title={disabled ? 'You cannot change this icon' : 'Change Icon'}
          >
            <IconRenderer
              icon={icon}
              iconColor={selectedColor}
              sizeClassName="size-8"
            />
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent align={align} className="p-2 space-y-2 text-xs w-[272px]">
        {/* Search + actions: the one row of chrome the picker has. */}
        <div className="gap-0.5 flex items-center">
          <div className="mr-1 relative flex-1">
            <Search className="left-2 size-3.5 absolute top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filterQuery}
              onChange={(e) => {
                setFilterQuery(e.target.value);
                setView('icons');
              }}
              placeholder="Search icons"
              aria-label="Search icons"
              className="h-7 pl-7 text-xs rounded-md border-border/60 bg-surface-raised/80 text-popover-foreground placeholder:text-subtle focus:border-border-strong"
            />
          </div>

          <button
            type="button"
            onClick={handleRandomIcon}
            disabled={isPending}
            title="Random icon"
            aria-label="Random icon"
            className={TOOL_BUTTON_CLASS}
          >
            <Shuffle className="size-3.5" />
          </button>

          {allowUpload && (
            <button
              type="button"
              onClick={() =>
                setView((current) =>
                  current === 'upload' ? 'icons' : 'upload',
                )
              }
              title="Upload an image"
              aria-label="Upload an image"
              aria-pressed={view === 'upload'}
              className={cn(
                TOOL_BUTTON_CLASS,
                view === 'upload' && 'bg-muted text-foreground',
              )}
            >
              <Upload className="size-3.5" />
            </button>
          )}

          {onRemoveIcon && icon && (
            <button
              type="button"
              onClick={() => {
                onRemoveIcon();
                setIsOpen(false);
              }}
              title="Remove icon"
              aria-label="Remove icon"
              className={TOOL_BUTTON_CLASS}
            >
              <Trash2 className="size-3.5" />
            </button>
          )}
        </div>

        {view === 'icons' && (
          <>
            {/* Colours sit in the open: one click, and the grid previews them. */}
            <div
              role="group"
              aria-label="Icon colour"
              className="flex items-center justify-between"
            >
              {ICON_COLOR_PRESETS.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  disabled={isPending}
                  aria-label={color.label}
                  aria-pressed={selectedColor === color.hex}
                  title={color.label}
                  onClick={() => {
                    setSelectedColor(color.hex);
                    if (icon && ICON_REGISTRY[icon]) {
                      onSelectIcon(icon, color.hex);
                    }
                  }}
                  className="size-5 flex cursor-pointer items-center justify-center rounded-full"
                >
                  <span
                    className={cn(
                      'size-3 rounded-full transition-transform hover:scale-125',
                      selectedColor === color.hex &&
                        'ring-1 ring-foreground ring-offset-1 ring-offset-popover',
                    )}
                    style={{ backgroundColor: color.hex }}
                  />
                </button>
              ))}
            </div>

            {filteredIcons.length > 0 ? (
              <ScrollArea
                className="max-h-44"
                contentClassName="grid grid-cols-8 gap-0.5 pr-1"
              >
                {filteredIcons.map((name) => {
                  const IconComp = ICON_REGISTRY[name];
                  return (
                    <button
                      key={name}
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        onSelectIcon(name, selectedColor);
                        setIsOpen(false);
                      }}
                      title={name}
                      aria-label={name}
                      aria-pressed={icon === name}
                      className={cn(
                        'flex aspect-square cursor-pointer items-center justify-center rounded-md transition-colors',
                        icon === name ? 'bg-selected' : 'hover:bg-muted',
                      )}
                    >
                      <IconComp
                        className="size-4"
                        style={{ color: selectedColor }}
                      />
                    </button>
                  );
                })}
              </ScrollArea>
            ) : (
              <p className="py-6 text-center text-muted-foreground">
                No icons found
              </p>
            )}
          </>
        )}

        {view === 'upload' && allowUpload && (
          <div className="space-y-2">
            <label className="p-3 gap-1 flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border transition-colors hover:border-border-strong hover:bg-muted/50">
              <span className="font-medium text-secondary-foreground">
                Choose an image
              </span>
              <span className="text-[10px] text-subtle">
                {isPending ? 'Uploading…' : 'PNG, JPG, SVG up to 5MB'}
              </span>
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                disabled={isPending}
                className="hidden"
              />
            </label>
            {uploadError ? (
              <p className="text-[11px] text-destructive">{uploadError}</p>
            ) : null}

            <form onSubmit={handleUrlSubmit} className="gap-1 flex">
              <Input
                value={uploadedUrl}
                onChange={(e) => setUploadedUrl(e.target.value)}
                placeholder="Or paste an image URL"
                aria-label="Image URL"
                className="h-7 text-xs rounded-md border-border/60 bg-surface-raised/80 text-popover-foreground placeholder:text-subtle focus:border-border-strong"
              />
              <Button type="submit" size="sm" className="h-7 text-xs">
                Add
              </Button>
            </form>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
