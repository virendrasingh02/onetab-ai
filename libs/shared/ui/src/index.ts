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
  UserAvatar,
  type AvatarProps,
  type PresenceStatus,
  type UserAvatarProps,
} from './lib/components/avatar.js';

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
  Hint,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  type HintProps,
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

export { Input, Textarea, type InputProps } from './lib/components/input.js';

export {
  Label,
  ScrollArea,
  ScrollBar,
  Separator,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from './lib/components/primitives.js';

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
