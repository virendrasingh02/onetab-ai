# @org/ui

Shared presentational components.

## Design

Props in, callbacks out. No data fetching, no routing, no stores — anything stateful enough to need a query belongs in a feature library. Every component accepts `className` and merges it through `cn()`, so Tailwind overrides are predictable.

## Surface

- Primitives: Button, Card, Avatar, Badge, Input/Textarea, Label, Separator, ScrollArea, Switch, Tabs, Skeleton.
- Overlays: Dialog, Sheet, DropdownMenu, Tooltip/Hint, CommandPalette.
- States: EmptyState, LoadingState, ErrorState, ErrorBoundary, SkeletonList.
- Forms: React Hook Form bindings (Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormError).

## Notes

`FormField` forwards React Hook Form 7.8x third generic, without which a schema using `.default()` produces an unassignable `control`.

## Commands

```sh
nx lint @org/ui
nx typecheck @org/ui
```
