export { ZodValidationPipe, zodBody } from './lib/zod-validation.pipe.js';
export { HttpExceptionFilter } from './lib/http-exception.filter.js';

export {
  AppEvent,
  type AppEventName,
  type AppEventPayloads,
  type TaskCreatedEvent,
  type TaskAssignedEvent,
  type TaskCompletedEvent,
  type ProjectCreatedEvent,
  type DocumentCreatedEvent,
  type DocumentUpdatedEvent,
  type DocumentDeletedEvent,
  type ChannelCreatedEvent,
  type WorkspaceInvitedEvent,
  type MemberJoinedEvent,
  type MentionCreatedEvent,
  type MentionContextType,
  type MeetingScheduledEvent,
  type MeetingUpdatedEvent,
  type MeetingCancelledEvent,
  type MeetingEndedEvent,
} from './lib/events.js';

export {
  resolveTextMentions,
  type MentionCandidate,
} from './lib/mentions.js';

export {
  ALLOW_ARCHIVED_KEY,
  AllowArchivedWorkspace,
  CurrentUser,
  IS_PUBLIC_KEY,
  Public,
  REQUIRE_PLAN_KEY,
  REQUIRE_PLAN_FEATURE_KEY,
  RequirePlan,
  RequirePlanFeature,
  WorkspacePlan,
  RequireWorkspacePermissions,
  SYSTEM_ROLES_KEY,
  SystemRoles,
  WORKSPACE_PERMISSIONS_KEY,
  WORKSPACE_ROLES_KEY,
  WorkspaceId,
  WorkspaceMemberRole,
  WorkspacePermissions,
  WorkspaceRoles,
  type AuthenticatedUser,
} from './lib/decorators.js';


export {
  expiresAt,
  generateToken,
  hashToken,
  parseDuration,
  tokensMatch,
} from './lib/tokens.js';

export {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  mapPage,
  normalisePagination,
  toPage,
  type CursorQuery,
  type NormalisedPagination,
} from './lib/pagination.js';

export {
  PUBLIC_USER_SELECT,
  toChannel,
  toChannelMember,
  toChannelPin,
  toInvitation,
  toPublicUser,
  toUpload,
  toWorkspace,
} from './lib/serializers.js';
