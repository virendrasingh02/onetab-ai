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
  ButtonGroup,
  IconButton,
  buttonVariants,
  type ButtonProps,
  type ButtonGroupProps,
  type IconButtonProps,
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
  AvatarPresenceProvider,
  PRESENCE_LABELS,
  PRESENCE_STYLES,
  PresenceDot,
  toPresenceStatus,
  useResolvedPresence,
  UserAvatar,
  WorkspaceAvatar,
  type ApiPresenceStatus,
  type AvatarPresenceResolver,
  type AvatarProps,
  type PresenceDotProps,
  type PresenceInput,
  type PresenceStatus,
  type UserAvatarProps,
  type WorkspaceAvatarProps,
} from './lib/components/avatar.js';

export {
  UserAvatarGroup,
  type AvatarGroupUser,
  type UserAvatarGroupProps,
} from './lib/components/avatar-group.js';

export {
  UserIdentity,
  type UserIdentityProps,
} from './lib/components/user-identity.js';

export {
  UserSelector,
  MultiUserSelector,
  AssigneeSelector,
  UserSearch,
  type UserSelectorMember,
  type UserSelectorProps,
} from './lib/components/user-selector.js';

export {
  MultiSelect,
  type MultiSelectOption,
  type MultiSelectProps,
} from './lib/components/multi-select.js';

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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  renderShortcut,
  type HintProps,
  type TooltipContentProps,
} from './lib/components/tooltip.js';

export {
  Kbd,
  KbdGroup,
  KbdShortcut,
  kbdVariants,
  formatKey,
  parseShortcutString,
  getPlatform,
  usePlatform,
  useKeyboardShortcut,
  SHORTCUTS,
  type KbdProps,
  type KbdGroupProps,
  type KbdShortcutProps,
  type KbdSize,
  type KbdVariant,
  type Platform,
  type ShortcutOptions,
} from './lib/components/kbd.js';

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
  InputGroup,
  Textarea,
  type InputProps,
  type InputGroupProps,
  type TextareaProps,
} from './lib/components/input.js';

export { Field, type FieldProps } from './lib/components/field.js';


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
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentProps,
  type TabsVariant,
  type TabsSize,
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
  EmojiPicker,
  GifPicker,
  EmojiGifPicker,
  EmojiGifPickerPopover,
  GifSourceProvider,
  useGifSource,
  usePickerRecents,
  useEmojiShortcodeIndex,
  searchEmojiShortcodes,
  setEmojiPickerBaseUrl,
  CURATED_GIFS,
  type EmojiPickerProps,
  type EmojiSelection,
  type GifPickerProps,
  type EmojiGifPickerProps,
  type EmojiGifPickerPopoverProps,
  type EmojiGifTab,
  type GifSource,
  type GifItem,
  type GifPage,
  type EmojiShortcodeEntry,
} from './lib/components/emoji-gif-picker/index.js';

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
  SidebarActivityIndicator,
  SidebarBadge,
  WorkspaceActivityIndicator,
  SidebarActivityConfigProvider,
  useSidebarActivityConfig,
  resolveSidebarActivity,
  hasSidebarActivity,
  DEFAULT_SIDEBAR_ACTIVITY_CONFIG,
  type SidebarActivityIndicatorProps,
  type WorkspaceActivityIndicatorProps,
  type SidebarBadgeProps,
  type SidebarActivityState,
  type SidebarActivityConfig,
  type SidebarActivitySurface,
  type ActivityIndicatorType,
  type ResolvedSidebarActivity,
} from './lib/components/sidebar-activity-indicator.js';

export {
  useSidebarCustomizerStore,
  type SidebarCustomizerStore,
  type SidebarCustomizerTab,
} from './lib/components/use-sidebar-customizer-store.js';

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

/* --- platform design system primitives & advanced components ------------ */

export { Slider, type SliderProps } from './lib/components/slider.js';

export {
  RadioGroup,
  RadioGroupItem,
  type RadioGroupProps,
  type RadioGroupItemProps,
} from './lib/components/radio-group.js';

export {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  type AccordionProps,
  type AccordionItemProps,
  type AccordionTriggerProps,
  type AccordionContentProps,
} from './lib/components/accordion.js';

export {
  Toggle,
  toggleVariants,
  type ToggleProps,
} from './lib/components/toggle.js';

export {
  ToggleGroup,
  ToggleGroupItem,
  type ToggleGroupProps,
  type ToggleGroupItemProps,
} from './lib/components/toggle-group.js';

export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  type ContextMenuProps,
  type ContextMenuTriggerProps,
  type ContextMenuContentProps,
  type ContextMenuItemProps,
  type ContextMenuCheckboxItemProps,
  type ContextMenuRadioItemProps,
  type ContextMenuLabelProps,
  type ContextMenuSeparatorProps,
  type ContextMenuShortcutProps,
  type ContextMenuSubTriggerProps,
  type ContextMenuSubContentProps,
} from './lib/components/context-menu.js';

export {
  Drawer,
  DrawerFooter,
  type DrawerProps,
} from './lib/components/drawer.js';

export {
  Pagination,
  type PaginationProps,
} from './lib/components/pagination.js';

export {
  Combobox,
  type ComboboxProps,
  type ComboboxOption,
  type ComboboxGroup,
  type ComboboxRef,
} from './lib/components/combobox.js';

export {
  AppSelect,
  type AppSelectProps,
  type AppSelectOption,
  type AppSelectGroup,
} from './lib/components/app-select.js';

export {
  DataGrid,
  type DataGridProps,
  type DataGridColumn,
  type DataGridBulkAction,
  type SortDirection,
} from './lib/components/data-grid.js';

export {
  KanbanBoard,
  type KanbanBoardProps,
  type KanbanCardItem,
  type KanbanColumn,
} from './lib/components/kanban-board.js';

export {
  Timeline,
  type TimelineProps,
  type TimelineItem,
  type TimelineEventStatus,
} from './lib/components/timeline.js';

export {
  TreeView,
  type TreeViewProps,
  type TreeNode,
} from './lib/components/tree-view.js';

export {
  ResizablePanels,
  type ResizablePanelsProps,
} from './lib/components/resizable-panels.js';

export {
  FilterBuilder,
  type FilterBuilderProps,
  type FilterRule,
  type FilterField,
  type FilterOperator,
} from './lib/components/filter-builder.js';

/* --- AI-native design system layer -------------------------------------- */

export {
  AIAgentCard,
  type AIAgentCardProps,
  type AgentStatus,
} from './lib/components/ai-agent-card.js';

export {
  AIModelSelector,
  DEFAULT_AI_MODELS,
  type AIModelSelectorProps,
  type AIModelOption,
} from './lib/components/ai-model-selector.js';

export {
  AIExecutionTimeline,
  type AIExecutionTimelineProps,
  type AIExecutionStep,
  type AIExecutionStepType,
  type AIExecutionStepStatus,
} from './lib/components/ai-execution-timeline.js';

export {
  AIThinkingState,
  type AIThinkingStateProps,
} from './lib/components/ai-thinking-state.js';

export {
  AICitationViewer,
  type AICitationViewerProps,
  type AICitation,
} from './lib/components/ai-citation-viewer.js';

export {
  AIUsageWidget,
  type AIUsageWidgetProps,
} from './lib/components/ai-usage-widget.js';

/* --- Universal dynamic cards & block system ----------------------------- */

export {
  UniversalCard,
  type UniversalCardProps,
  type UniversalCardConfig,
  type UniversalCardType,
  type UniversalCardAction,
} from './lib/components/universal-card-registry.js';


export {
  BlockRenderer,
  type PageBlockConfig,
  type BlockType,
} from './lib/components/block-registry.js';

export {
  QRCode,
  type QRCodeProps,
} from './lib/components/qr-code.js';

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './lib/components/alert-dialog.js';

export {
  Alert,
  AlertTitle,
  AlertDescription,
  alertVariants,
} from './lib/components/alert.js';

export {
  HoverCard,
  HoverCardTrigger,
  HoverCardPortal,
  HoverCardContent,
  UserHoverCard,
  ProjectHoverCard,
  KanbanCardHoverCard,
  ChannelHoverCard,
  type HoverCardProps,
  type HoverCardContentProps,
  type UserHoverCardProps,
  type ProjectHoverCardProps,
  type KanbanCardHoverCardProps,
  type ChannelHoverCardProps,
} from './lib/components/hover-card.js';

export {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
  MenubarLabel,
  MenubarCheckboxItem,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarPortal,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarGroup,
  MenubarSub,
  MenubarShortcut,
} from './lib/components/menubar.js';

export {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
} from './lib/components/navigation-menu.js';

export {
  PlanBadge,
  type PlanBadgeProps,
} from './lib/components/plan-badge.js';

export {
  UsageMeter,
  type UsageMeterProps,
} from './lib/components/usage-meter.js';


