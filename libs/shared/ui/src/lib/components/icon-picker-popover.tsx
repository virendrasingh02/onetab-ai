import React, { useMemo, useState } from 'react';
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
  LucideProps,
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
import { cn } from '@org/utils';
import { Button } from './button.js';
import { Input } from './input.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';

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
export const ICON_COLOR_PRESETS = [
  { id: 'default', label: 'Default', hex: '#f8fafc' },
  { id: 'slate', label: 'Slate', hex: '#94a3b8' },
  { id: 'red', label: 'Red', hex: '#ef4444' },
  { id: 'orange', label: 'Orange', hex: '#f97316' },
  { id: 'amber', label: 'Amber', hex: '#f59e0b' },
  { id: 'yellow', label: 'Yellow', hex: '#eab308' },
  { id: 'emerald', label: 'Emerald', hex: '#10b981' },
  { id: 'cyan', label: 'Cyan', hex: '#06b6d4' },
  { id: 'sky', label: 'Sky', hex: '#0ea5e9' },
  { id: 'blue', label: 'Blue', hex: '#3b82f6' },
  { id: 'indigo', label: 'Indigo', hex: '#6366f1' },
  { id: 'violet', label: 'Violet', hex: '#8b5cf6' },
  { id: 'purple', label: 'Purple', hex: '#a855f7' },
  { id: 'fuchsia', label: 'Fuchsia', hex: '#d946ef' },
  { id: 'pink', label: 'Pink', hex: '#ec4899' },
  { id: 'rose', label: 'Rose', hex: '#f43f5e' },
];

export const EMOJI_CATEGORIES = [
  {
    name: 'Popular',
    emojis: ['📝', '🚀', '⚡', '🎨', '🛡️', '📊', '💡', '📚', '🧩', '🔬', '⚙️', '🌐', '🎯', '🔥', '✨', '🌟'],
  },
  {
    name: 'Smileys',
    emojis: ['😀', '😃', '😄', '😁', '🥳', '😎', '🤖', '👾', '👽', '👻', '🎃', '😺', '🤠', '🧠', '👀', '🤙'],
  },
  {
    name: 'Objects',
    emojis: ['📦', '📁', '📄', '💻', '📱', '🖥️', '🔑', '🔒', '🏷️', '📌', '🎨', '🎭', '🎬', '🎧', '🎤', '🥁'],
  },
  {
    name: 'Symbols',
    emojis: ['⏰', '⌛', '💰', '💳', '💎', '🛒', '🎁', '🎂', '☕', '🍔', '🍕', '🍎', '🌈', '☀️', '🌙', '⭐'],
  },
];

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
  if (icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('data:image')) {
    return (
      <img
        src={icon}
        alt="icon"
        className={cn('object-cover rounded-sm', sizeClassName, className)}
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

interface IconPickerPopoverProps {
  icon?: string;
  iconColor?: string;
  onSelectIcon: (icon: string, iconColor?: string) => void;
  onRemoveIcon?: () => void;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function IconPickerPopover({
  icon,
  iconColor = '#f8fafc',
  onSelectIcon,
  onRemoveIcon,
  trigger,
  align = 'start',
}: IconPickerPopoverProps) {
  const [activeTab, setActiveTab] = useState<'emoji' | 'icons' | 'upload'>('icons');
  const [filterQuery, setFilterQuery] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(iconColor);
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const iconNames = useMemo(() => Object.keys(ICON_REGISTRY), []);

  const filteredIcons = useMemo(() => {
    if (!filterQuery.trim()) return iconNames;
    const q = filterQuery.toLowerCase().trim();
    return iconNames.filter((name) => name.toLowerCase().includes(q));
  }, [iconNames, filterQuery]);

  const handleRandomIcon = () => {
    const randomIndex = Math.floor(Math.random() * iconNames.length);
    const randomIcon = iconNames[randomIndex];
    const randomColorObj = ICON_COLOR_PRESETS[Math.floor(Math.random() * ICON_COLOR_PRESETS.length)];
    setSelectedColor(randomColorObj.hex);
    onSelectIcon(randomIcon, randomColorObj.hex);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        if (result) {
          onSelectIcon(result);
          setIsOpen(false);
        }
      };
      reader.readAsDataURL(file);
    }
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
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        {trigger || (
          <button
            type="button"
            className="size-16 rounded-2xl bg-surface-raised border-2 border-surface shadow-lg flex items-center justify-center text-3xl hover:scale-105 transition-transform cursor-pointer overflow-hidden"
            title="Change Icon"
          >
            <IconRenderer icon={icon} iconColor={selectedColor} sizeClassName="size-8" />
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align={align}
        className="w-[340px] p-0 border border-border/80 bg-zinc-900/95 backdrop-blur-xl text-zinc-100 shadow-2xl rounded-xl overflow-hidden text-xs"
      >
        {/* Navigation Tabs Bar & Remove Button */}
        <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2 bg-zinc-950/60">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('emoji')}
              className={cn(
                'text-xs font-medium transition-colors pb-0.5 border-b-2 cursor-pointer',
                activeTab === 'emoji'
                  ? 'border-white text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200',
              )}
            >
              Emoji
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('icons')}
              className={cn(
                'text-xs font-medium transition-colors pb-0.5 border-b-2 cursor-pointer',
                activeTab === 'icons'
                  ? 'border-white text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200',
              )}
            >
              Icons
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload')}
              className={cn(
                'text-xs font-medium transition-colors pb-0.5 border-b-2 cursor-pointer',
                activeTab === 'upload'
                  ? 'border-white text-white'
                  : 'border-transparent text-zinc-400 hover:text-zinc-200',
              )}
            >
              Upload
            </button>
          </div>

          {onRemoveIcon && (
            <button
              type="button"
              onClick={() => {
                onRemoveIcon();
                setIsOpen(false);
              }}
              className="text-xs text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            >
              Remove
            </button>
          )}
        </div>

        {/* Tab 1: ICONS (Ref Image Design) */}
        {activeTab === 'icons' && (
          <div className="p-3 space-y-3">
            {/* Filter Search Bar + Action Controls */}
            <div className="flex items-center gap-1.5">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
                <Input
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Filter..."
                  className="h-8 pl-8 text-xs bg-zinc-800/80 border-zinc-700/60 focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-500 rounded-md"
                />
              </div>

              {/* Shuffle / Random Icon Button */}
              <button
                type="button"
                onClick={handleRandomIcon}
                title="Random Icon"
                className="size-8 rounded-md bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer shrink-0"
              >
                <Shuffle className="size-3.5" />
              </button>

              {/* Color Selector Button */}
              <Popover open={isColorPickerOpen} onOpenChange={setIsColorPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    title="Change Icon Color"
                    className="size-8 rounded-md bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/60 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  >
                    <span
                      className="size-3.5 rounded-full border border-zinc-400/30 shadow-xs"
                      style={{ backgroundColor: selectedColor }}
                    />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  align="end"
                  className="w-48 p-2 bg-zinc-900 border border-zinc-700 text-zinc-100 shadow-xl rounded-lg"
                >
                  <p className="text-[11px] font-semibold text-zinc-400 mb-2 px-1">Icon Color</p>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ICON_COLOR_PRESETS.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => {
                          setSelectedColor(color.hex);
                          setIsColorPickerOpen(false);
                          if (icon && ICON_REGISTRY[icon]) {
                            onSelectIcon(icon, color.hex);
                          }
                        }}
                        title={color.label}
                        className="size-8 rounded-md flex items-center justify-center hover:scale-110 transition-transform cursor-pointer border border-zinc-700"
                        style={{ backgroundColor: color.hex }}
                      >
                        {selectedColor === color.hex && (
                          <Check className="size-3.5 text-zinc-950 stroke-[3]" />
                        )}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Scrollable Icon Grid */}
            <div className="space-y-1">
              <p className="text-[11px] font-semibold text-zinc-400 px-0.5">Icons</p>
              <div className="max-h-56 overflow-y-auto pr-1 grid grid-cols-6 gap-1.5 scrollbar-thin scrollbar-thumb-zinc-700">
                {filteredIcons.map((name) => {
                  const IconComp = ICON_REGISTRY[name];
                  const isSelected = icon === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        onSelectIcon(name, selectedColor);
                        setIsOpen(false);
                      }}
                      title={name}
                      className={cn(
                        'size-10 rounded-lg flex items-center justify-center transition-all cursor-pointer border',
                        isSelected
                          ? 'bg-zinc-700/80 border-zinc-500 shadow-sm scale-105'
                          : 'bg-zinc-800/40 border-transparent hover:bg-zinc-800 hover:border-zinc-700',
                      )}
                    >
                      <IconComp className="size-5" style={{ color: selectedColor }} />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: EMOJI */}
        {activeTab === 'emoji' && (
          <div className="p-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-zinc-400" />
              <Input
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder="Search emojis..."
                className="h-8 pl-8 text-xs bg-zinc-800/80 border-zinc-700/60 focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-500 rounded-md"
              />
            </div>

            <div className="max-h-56 overflow-y-auto space-y-3 pr-1">
              {EMOJI_CATEGORIES.map((cat) => {
                const filteredList = filterQuery.trim()
                  ? cat.emojis.filter((e) => e.includes(filterQuery.trim()))
                  : cat.emojis;

                if (filteredList.length === 0) return null;

                return (
                  <div key={cat.name} className="space-y-1">
                    <p className="text-[10px] font-semibold text-zinc-400 px-0.5">{cat.name}</p>
                    <div className="grid grid-cols-7 gap-1">
                      {filteredList.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => {
                            onSelectIcon(emoji);
                            setIsOpen(false);
                          }}
                          className="size-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-lg transition-transform hover:scale-110 cursor-pointer"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab 3: UPLOAD */}
        {activeTab === 'upload' && (
          <div className="p-4 space-y-4 text-xs">
            <div>
              <p className="font-semibold text-zinc-200 mb-1">Upload File</p>
              <label className="border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer bg-zinc-900/50 hover:bg-zinc-800/50 transition-colors">
                <Upload className="size-6 text-zinc-400" />
                <span className="text-zinc-300 font-medium text-center">
                  Click or drag image file here
                </span>
                <span className="text-[10px] text-zinc-500">PNG, JPG, SVG up to 5MB</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="relative flex items-center gap-2 my-2">
              <div className="flex-1 border-t border-zinc-800" />
              <span className="text-[10px] text-zinc-500 uppercase font-semibold">OR LINK</span>
              <div className="flex-1 border-t border-zinc-800" />
            </div>

            <form onSubmit={handleUrlSubmit} className="space-y-2">
              <p className="font-semibold text-zinc-200">Image URL</p>
              <div className="flex gap-2">
                <Input
                  value={uploadedUrl}
                  onChange={(e) => setUploadedUrl(e.target.value)}
                  placeholder="https://example.com/icon.png"
                  className="h-8 text-xs bg-zinc-800/80 border-zinc-700/60 focus:border-zinc-500 text-zinc-100 placeholder:text-zinc-500 rounded-md"
                />
                <Button type="submit" size="sm" className="h-8 text-xs bg-zinc-100 text-zinc-900 hover:bg-white">
                  Submit
                </Button>
              </div>
            </form>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
