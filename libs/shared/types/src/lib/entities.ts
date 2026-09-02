import type {
  ChannelRole,
  ChannelVisibility,
  InvitationStatus,
  MembershipStatus,
  PresenceStatus,
  SystemRole,
  WorkspaceRole,
  WorkspaceStatus,
} from './enums.js';
import type { WorkspacePermission } from './permissions.js';

/** ISO-8601 timestamp. Transport is always a string; parse at the edge. */
export type IsoDateString = string;

/** A user as exposed to other members. Never includes credentials. */
export interface PublicUser {
  id: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  coverUrl?: string | null;
  title?: string | null;
  jobTitle?: string | null;
  location?: string | null;
  website?: string | null;
  github?: string | null;
  presence: PresenceStatus;
  statusText?: string | null;
  statusEmoji?: string | null;
  statusExpiresAt?: IsoDateString | null;
  lastSeenAt: IsoDateString | null;
  /*
   * IANA zone, e.g. `Asia/Kolkata`. Public because "what time is it where they
   * are" is a question colleagues ask constantly, and because a stored offset
   * would be wrong twice a year — the zone id survives DST, an offset does not.
   */
  timezone: string;
}

export interface UserPresence {
  userId: string;
  workspaceId?: string | null;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeenAt?: IsoDateString | null;
  lastActiveAt?: IsoDateString | null;
  connectedAt?: IsoDateString | null;
  statusText?: string | null;
  statusEmoji?: string | null;
  deviceId?: string | null;
}

/** Single stop within a linear or radial gradient. */
export interface GradientStop {
  color: string;
  position: number; // 0 to 100
  opacity?: number; // 0 to 1
}

/** Structured gradient definition. */
export interface GradientConfig {
  type: 'linear' | 'radial';
  angle?: number; // 0 to 360 (for linear)
  shape?: 'circle' | 'ellipse'; // (for radial)
  stops: GradientStop[];
}

/** Color tokens configurable by users/admins. */
export interface ThemeColorsConfig {
  primary: string;
  primaryForeground?: string;
  secondary?: string;
  secondaryForeground?: string;
  accent?: string;
  accentForeground?: string;
  background?: string;
  foreground?: string;
  card?: string;
  cardForeground?: string;
  muted?: string;
  mutedForeground?: string;
  border?: string;
  input?: string;
  ring?: string;
  destructive?: string;
  destructiveForeground?: string;
  success?: string;
  successForeground?: string;
  warning?: string;
  warningForeground?: string;
  info?: string;
  infoForeground?: string;
  sidebar?: string;
  sidebarForeground?: string;
  sidebarBorder?: string;
}

/** Named gradient slots across the platform. */
export interface ThemeGradientsConfig {
  primary?: GradientConfig | string;
  secondary?: GradientConfig | string;
  accent?: GradientConfig | string;
  hero?: GradientConfig | string;
  sidebar?: GradientConfig | string;
  surface?: GradientConfig | string;
  button?: GradientConfig | string;
  background?: GradientConfig | string;
}

/** Background treatments for specific platform areas. */
export interface ThemeBackgroundsConfig {
  pageType: 'flat' | 'gradient' | 'subtle-pattern';
  sidebarType: 'flat' | 'gradient';
  headerType: 'flat' | 'gradient' | 'glass';
  cardType: 'flat' | 'gradient' | 'glass';
  glassBlur?: number; // px blur amount
  surfaceOpacity?: number; // 0 to 1
}

/** Typography customizations. */
export interface ThemeTypographyConfig {
  fontFamily: string; // e.g. 'Inter', 'JetBrains Mono', 'Plus Jakarta Sans'
  monoFamily?: string;
  baseFontSize?: '13px' | '14px' | '15px' | '16px';
  headingWeight?: '500' | '600' | '700' | '800';
  bodyWeight?: '400' | '500';
  lineHeight?: '1.4' | '1.5' | '1.6';
}

/** Geometry and border radii customizations. */
export interface ThemeShapeConfig {
  radiusBase: '0px' | '4px' | '6px' | '8px' | '10px' | '12px' | '16px' | '9999px';
  radiusButton?: '0px' | '4px' | '6px' | '8px' | '10px' | '12px' | '9999px';
  radiusCard?: '0px' | '6px' | '8px' | '10px' | '12px' | '16px' | '20px';
  radiusInput?: '0px' | '4px' | '6px' | '8px' | '10px' | '12px';
  radiusDialog?: '0px' | '8px' | '12px' | '16px' | '24px';
}

/** Shadow elevations and border treatments. */
export interface ThemeShadowsConfig {
  elevation: 'none' | 'subtle' | 'balanced' | 'elevated' | 'dramatic';
  borderIntensity: 'subtle' | 'medium' | 'strong' | 'none';
}

/** Theme configuration object stored in user/workspace preferences. */
export interface ThemeConfig {
  mode: 'light' | 'dark' | 'system';
  type: 'default' | 'custom' | 'preset';
  name?: string;
  presetId?: string;
  brandColor?: string; // Legacy / quick shortcut
  neutralColor?: string; // Legacy / quick shortcut
  colors?: Partial<ThemeColorsConfig>;
  gradients?: Partial<ThemeGradientsConfig>;
  backgrounds?: Partial<ThemeBackgroundsConfig>;
  typography?: Partial<ThemeTypographyConfig>;
  shape?: Partial<ThemeShapeConfig>;
  shadows?: Partial<ThemeShadowsConfig>;
}

/** The authenticated user's own profile — adds private fields. */
export interface CurrentUser extends PublicUser {
  email: string;
  bio: string | null;
  systemRole: SystemRole;
  emailVerifiedAt: IsoDateString | null;
  createdAt: IsoDateString;
}

/**
 * A chosen icon, as it is stored and transported.
 *
 * `icon` is one of three things, told apart by inspecting the value rather than
 * by a discriminator: a Lucide icon name from the shared registry ("Rocket"),
 * an emoji ("🚀"), or an `http(s)` image URL. `iconColor` is a hex colour and
 * only applies to the registry case — emoji and images carry their own colour.
 *
 * Both are nullable everywhere: "no icon chosen" is a real state, and every
 * render site falls back to something derived from the entity itself.
 */
export interface IconSelection {
  icon: string | null;
  iconColor: string | null;
}

export interface Workspace extends IconSelection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  ownerId: string;
  status: WorkspaceStatus;
  supportEmail?: string | null;
  accentColor?: string | null;
  defaultLandingView?: string | null;
  allowExternalSharing?: boolean;
  aiProjectRecaps?: boolean;
  archivedAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface UserSessionDto {
  id: string;
  userAgent: string | null;
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  ipAddress: string | null;
  location: string;
  createdAt: IsoDateString;
  lastActiveAt: IsoDateString;
  isCurrent: boolean;
}

export interface SecurityOverviewDto {
  password: {
    hasPassword: boolean;
    strength: 'strong' | 'moderate' | 'weak';
    createdAt: IsoDateString | null;
    lastChangedAt: IsoDateString | null;
  };
  twoFactor: {
    isEnabled: boolean;
    verifiedAt: IsoDateString | null;
    hasBackupCodes: boolean;
    isEnforced: boolean;
  };
  sso: {
    isConnected: boolean;
    providerType: string | null;
    isOrganizationManaged: boolean;
  };
  passkeysCount: number;
  activeSessionsCount: number;
}

export interface TotpSetupResponse {
  secret: string;
  qrCodeUri: string;
}

export interface TotpVerifyResponse {
  backupCodes: string[];
  message: string;
}

export interface WebAuthnCredentialDto {
  id: string;
  credentialId: string;
  deviceName: string | null;
  createdAt: IsoDateString;
  lastUsedAt: IsoDateString | null;
}

/**
 * A workspace in the switcher, with the viewer's own standing attached.
 *
 * `permissions` is derived from `role` server-side and shipped alongside it so
 * the client can disable an action it is not allowed to take. It is a hint for
 * the interface only — the API re-derives it on every request and never reads
 * it back from the browser.
 */
export interface WorkspaceSummary extends Workspace {
  role: WorkspaceRole;
  permissions: readonly WorkspacePermission[];
  memberCount: number;
  channelCount: number;
  /** The email address associated with the viewer's membership in this workspace. */
  email?: string | null;
  /** The viewer's membership status in this workspace. */
  membershipStatus?: MembershipStatus;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  role: WorkspaceRole;
  status: MembershipStatus;
  joinedAt: IsoDateString;
  user: PublicUser;
  /** The workspace-specific email address for this member, if configured. */
  email?: string | null;
}

export interface Channel {
  id: string;
  workspaceId: string;
  name: string;
  slug: string;
  topic: string | null;
  description: string | null;
  visibility: ChannelVisibility;
  isArchived: boolean;
  archivedAt: IsoDateString | null;
  createdById: string;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

/** A channel in the sidebar, with the viewer's membership state folded in. */
export interface ChannelSummary extends Channel {
  memberCount: number;
  /** Null when the viewer is not a member (public channel they can preview). */
  membership: {
    role: ChannelRole;
    isFavorite: boolean;
    isMuted: boolean;
    lastReadAt: IsoDateString | null;
  } | null;
}

export interface ChannelMember {
  id: string;
  channelId: string;
  role: ChannelRole;
  isFavorite: boolean;
  isMuted: boolean;
  joinedAt: IsoDateString;
  user: PublicUser;
}

export interface ChannelBookmark {
  id: string;
  label: string;
  href: string;
  emoji?: string;
}

export interface ChannelPin {
  id: string;
  channelId: string;
  title: string;
  url: string | null;
  note: string | null;
  pinnedById: string;
  pinnedAt: IsoDateString;
}

export interface Invitation {
  id: string;
  workspaceId: string;
  email: string | null;
  role: WorkspaceRole;
  status: InvitationStatus;
  expiresAt: IsoDateString;
  acceptedAt: IsoDateString | null;
  declinedAt?: IsoDateString | null;
  revokedAt?: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt?: IsoDateString;
  invitedBy: PublicUser;
  workspace?: {
    id: string;
    name: string;
    slug: string;
    avatarUrl?: string | null;
    icon?: string | null;
    iconColor?: string | null;
  } | null;
  channelId?: string | null;
  channel?: { id: string; name: string; slug: string } | null;
  teamId?: string | null;
  team?: { id: string; name: string; key: string } | null;
  projectId?: string | null;
  project?: { id: string; name: string; slug: string } | null;
  message?: string | null;
  maxUses?: number | null;
  useCount?: number;
  isLink?: boolean;
  token?: string;
}

export interface InvitationPublicPreview {
  valid: boolean;
  status: InvitationStatus;
  email: string | null;
  role: WorkspaceRole;
  expiresAt: IsoDateString;
  message: string | null;
  isLink: boolean;
  workspace: {
    id: string;
    name: string;
    slug: string;
    avatarUrl: string | null;
    icon: string | null;
    iconColor: string | null;
  };
  inviter: {
    id: string;
    name: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  channel?: { id: string; name: string; slug: string } | null;
  team?: { id: string; name: string; key: string } | null;
  project?: { id: string; name: string; slug: string } | null;
}

export interface InviteBatchResult {
  invited: Invitation[];
  alreadyMembers: string[];
  alreadyInvited?: string[];
  tokens?: Record<string, string>;
}

export interface Upload {
  id: string;
  workspaceId: string;
  channelId: string | null;
  filename: string;
  mimeType: string;
  size: number;
  storageKey: string;
  createdAt: IsoDateString;
  uploader: PublicUser;
}
