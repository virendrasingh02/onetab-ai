# @org/icons

Icon selection, end to end: pick an icon, persist it, show it everywhere.

The pieces already existed and were spread thin — the picker markup in
`@org/ui`, the endpoints in `@org/api-client`, and the save wiring rewritten at
each call site. This library is the seam between them, and the only place a
screen needs to touch to make something's icon editable.

## Using it

An entity that already has an adapter is one component:

```tsx
import { WorkspaceIconPicker } from '@org/icons';

<WorkspaceIconPicker workspace={workspace} align="start" />;
```

Anything else supplies an `IconSource` — where the icon is now, and how to save
a new one — and gets the same behaviour:

```tsx
import { IconPicker, useIconEditor } from '@org/icons';

const editor = useIconEditor({
  icon: doc.icon,
  iconColor: doc.iconColor,
  save: ({ icon, iconColor }) => updateDocIcon(doc.id, icon, iconColor),
});

<IconPicker editor={editor} />;
```

For an entity that does not exist yet, `useLocalIcon()` holds the choice in
state and hands back `selection` to post with whatever request creates it.

## What the editor handles

So that no call site does it again:

- the new icon shows immediately, and keeps showing until the write lands — a
  refetch arriving mid-save cannot flicker the old one back;
- a failed write restores the previous icon and surfaces the reason;
- overlapping writes are refused, so the last response is always the last click;
- `canEdit: false` disables the trigger rather than failing on submit.

## Adding an entity

Write a hook next to `use-workspace-icon.ts` that returns
`useIconEditor({ icon, iconColor, save, upload?, canEdit? })`. Only `save`, the
cache updates it implies, and the permission rule are entity-specific;
everything else is inherited.

Persisted icon values are validated by `iconSchema` in `@org/validation` — a
Lucide registry name, an emoji, or an `http(s)` URL. `data:` URIs are refused
on purpose: an icon is a label, not a payload, and it is read on every list
request. An entity that wants images supplies `upload`, which the picker's
Upload tab uses in place of inlining the file.

The workspace deliberately does not: it has a logo with its own storage and
upload route, and the logo outranks the icon wherever both are set, so
`WorkspaceIconPicker` hides the upload tab and images go through the logo
control instead.
