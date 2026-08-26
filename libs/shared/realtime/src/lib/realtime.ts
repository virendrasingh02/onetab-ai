/**
 * Unused. Left as documentation of a deliberate choice, not a stub waiting
 * to be filled in.
 *
 * Every real-time need in the app — new messages, presence, typing, agent
 * execution progress, tool-call updates — is carried over Matrix's own
 * `/sync` (see `packages/matrix-client` and `libs/web/chat/src/lib/
 * matrix-provider.tsx`), including for AI agents and connected apps: the API
 * posts and edits Matrix events as their bot identities
 * (`MatrixBotMessagingService` in `libs/api/matrix`) rather than pushing over
 * a second transport. A general WebSocket/SSE gateway would duplicate that
 * without covering anything Matrix doesn't already.
 *
 * This has one narrow legitimate exception: sub-100ms token-level streaming
 * of an in-flight agent turn's text (today's streaming is periodic
 * Matrix-edit based — see `AgentMatrixBridgeService.runTurn` — not
 * per-token). If that's ever wanted, a small SSE endpoint scoped to "stream
 * this one turn to the tab that's open" is the place for it — not a general
 * realtime layer, and not this file.
 */
export function realtime(): string {
  return 'realtime';
}
