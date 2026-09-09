# @org/sync

Central background update & synchronisation for the web/desktop client.

`BackgroundSyncManager` owns the single timer, the realtime→cache invalidation
map, incremental catch-up on reconnect, a multi-tab leader lock for polling, an
offline read-state queue, and the `useSyncStatus()` surface. Screens register a
`SyncResource` instead of hand-rolling a `refetchInterval`.

Mount `<SyncProvider>` inside `<RealtimeProvider>` and a `<QueryClientProvider>`.
