/**
 * @org/ui — shared, presentational components.
 *
 * Rules for this library:
 *  - No data fetching, no routing, no stores. Props in, callbacks out.
 *  - Every component accepts `className` and merges it through `cn()`.
 *  - Anything stateful enough to need a query belongs in a feature library.
 */

export {
  Button,
  buttonVariants,
  type ButtonProps,
} from './lib/components/button.js';

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from './lib/components/card.js';

export {
  Avatar,
  AvatarFallback,
  AvatarImage,
  PRESENCE_LABELS,
  toPresenceStatus,
  UserAvatar,
  WorkspaceAvatar,
  type AvatarProps,
  type PresenceStatus,
  type UserAvatarProps,
  type WorkspaceAvatarProps,
} from './lib/components/avatar.js';

export {
  ProjectGlyph,
  type ProjectGlyphProps,
  type ProjectGlyphSize,
} from './lib/components/project-glyph.js';

export {
  Badge,
  badgeVariants,
  type BadgeProps,
} from './lib/components/badge.js';

export {
  Skeleton,
  SkeletonList,
  type SkeletonListProps,
} from './lib/components/skeleton.js';

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
  type DialogContentProps,
} from './lib/components/dialog.js';

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
  type SheetContentProps,
} from './lib/components/sheet.js';

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  type DropdownMenuItemProps,
} from './lib/components/dropdown-menu.js';

export {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './lib/components/collapsible.js';

export {
  Hint,
  Kbd,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  renderShortcut,
  type HintProps,
  type KbdProps,
  type TooltipContentProps,
} from './lib/components/tooltip.js';

export {
  EmptyState,
  type EmptyStateProps,
} from './lib/components/empty-state.js';
export {
  LoadingState,
  Spinner,
  type LoadingStateProps,
  type SpinnerProps,
} from './lib/components/loading-state.js';
export {
  ErrorState,
  type ErrorStateProps,
} from './lib/components/error-state.js';
export {
  ErrorBoundary,
  type ErrorBoundaryProps,
} from './lib/components/error-boundary.js';

export {
  Input,
  Textarea,
  type InputProps,
  type TextareaProps,
} from './lib/components/input.js';

export {
  SearchInput,
  type SearchInputProps,
} from './lib/components/search-input.js';

export {
  usePromptDialog,
  type PromptDialog,
} from './lib/components/use-prompt-dialog.js';

export {
  ScrollArea,
  type ScrollAreaProps,
} from './lib/components/scroll-area.js';

export {
  LocalTime,
  useMinuteTick,
  type LocalTimeProps,
} from './lib/components/local-time.js';

export {
  TimezoneSelect,
  type TimezoneSelectProps,
} from './lib/components/timezone-select.js';

export {
  Label,
  Separator,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type TabsVariant,
} from './lib/components/primitives.js';

export { Checkbox } from './lib/components/checkbox.js';

export {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverAnchor,
} from './lib/components/popover.js';

export { Calendar, type CalendarProps } from './lib/components/calendar.js';

export {
  DatePicker,
  type DatePickerProps,
} from './lib/components/date-picker.js';

export {
  Form,
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  useFormField,
  type FormErrorProps,
} from './lib/components/form.js';

export {
  CommandPalette,
  useCommandPalette,
  type CommandPaletteProps,
} from './lib/components/command-palette.js';

/* --- design-token helpers ------------------------------------------------ */

export {
  accentClasses,
  accentClass,
  type AccentClassKind,
} from './lib/components/accent.js';

/* --- primitives ---------------------------------------------------------- */

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './lib/components/select.js';

export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './lib/components/table.js';

export { Progress, type ProgressProps } from './lib/components/progress.js';

export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from './lib/components/segmented-control.js';

export {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from './lib/components/breadcrumb.js';

/* --- page composition ---------------------------------------------------- */

export {
  Page,
  PageHeader,
  PageSection,
  Toolbar,
  type PageProps,
  type PageHeaderProps,
  type PageSectionProps,
} from './lib/components/page.js';

export { Panel, type PanelProps } from './lib/components/panel.js';

export {
  StatCard,
  TrendBadge,
  type StatCardProps,
  type Trend,
  type TrendBadgeProps,
} from './lib/components/stat-card.js';

export {
  IconPickerPopover,
  IconRenderer,
  EMOJI_CATEGORIES,
  ICON_REGISTRY,
  ICON_COLOR_PRESETS,
  type IconPickerPopoverProps,
  type IconRendererProps,
} from './lib/components/icon-picker-popover.js';

export {
  focusAudio,
  FOCUS_SOUND_OPTIONS,
  type FocusSoundType,
  type SoundOption,
} from './lib/components/focus-audio.js';

export {
  useFocusStore,
  type FocusState,
} from './lib/components/focus-mode-store.js';

export {
  ActivityDot,
  type ActivityDotProps,
  type ActivityLevel,
} from './lib/components/activity-dot.js';

export {
  useRightPanelStore,
  type HostedPanel,
  type RightPanelHostedView,
  type RightPanelProfile,
  type RightPanelState,
  type RightPanelView,
} from './lib/components/right-panel-store.js';

export {
  StatusModal,
  SLACK_STATUS_PRESETS,
  CLEAR_AFTER_OPTIONS,
  POPULAR_EMOJIS,
  type StatusModalProps,
  type StatusPreset,
  type ClearOption,
} from './lib/components/status-modal.js';

export {
  FocusModeWidget,
  FOCUS_DURATION_OPTIONS,
  type FocusModeWidgetProps,
  type FocusDurationOption,
  type StatusPublisher,
} from './lib/components/focus-mode-widget.js';

export {
  RegionSelect,
  type RegionSelectProps,
} from './lib/components/region-select.js';

export {
  TeamWorldClockModal,
  useWorldClockStore,
  type TeamWorldClockModalProps,
  type TeamMemberData,
} from './lib/components/team-world-clock-modal.js';

export { Toaster, toast, type ToasterProps } from './lib/components/toaster.js';

export {
  HuddleDock,
  useHuddleDockStore,
  type HuddleDockState,
} from './lib/components/huddle-dock.js';
