# @org/web-channels

Channel queries, mutations and screens.

## Design

Starring a channel is applied optimistically: it is a pure UI affordance in the sidebar and waiting for a round trip makes it feel broken. The previous list is restored if the call fails.

## Surface

- `useChannels`, `useGroupedChannels`, `useChannel`, `useChannelMembers/Pins/Files`.
- Mutations: create, update, archive, make-private, join, preferences, members, pins.
- `ChannelPage` — About / Members / Files / Media / Pins.
- `CreateChannelPage`, `BrowseChannelsPage`.

## Notes

`useGroupedChannels` sorts each group alphabetically so the sidebar does not reshuffle as unrelated data refreshes.

## Commands

```sh
nx lint @org/web-channels
nx typecheck @org/web-channels
```
