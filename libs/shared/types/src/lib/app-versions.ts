import type {
  AppPlatform,
  AppOperatingSystem,
  AppReleaseChannel,
  AppReleaseStatus,
} from './enums.js';

export interface AppReleaseView {
  id: string;
  platform: AppPlatform;
  operatingSystem: AppOperatingSystem | null;
  version: string;
  buildNumber: string;
  releaseChannel: AppReleaseChannel;
  status: AppReleaseStatus;
  minimumSupportedVersion: string | null;
  releaseDate: string;
  rolloutPercentage: number;
  downloadUrl: string | null;
  releaseNotes: string | null;
  changelog: string | null;
  mandatoryUpdate: boolean;
  forceUpdate: boolean;
  isCurrent: boolean;
  createdById: string | null;
  createdByEmail?: string | null;
  createdByName?: string | null;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AppReleaseAuditLogView {
  id: string;
  releaseId: string | null;
  actorId: string | null;
  actorEmail: string;
  action: string;
  platform: AppPlatform;
  operatingSystem: AppOperatingSystem | null;
  version: string;
  previousState: string | null;
  newState: string | null;
  reason: string | null;
  createdAt: string;
}

export interface PlatformReleaseSummary {
  currentVersion: string | null;
  latestVersion: string | null;
  status: AppReleaseStatus | 'NOT_CONFIGURED';
  releaseDate: string | null;
  minimumSupportedVersion: string | null;
  rolloutPercentage: number;
  downloadUrl: string | null;
  mandatoryUpdate: boolean;
  activeReleaseCount: number;
}

export interface AppVersionsOverview {
  web: PlatformReleaseSummary;
  desktop: {
    windows: PlatformReleaseSummary;
    macos: PlatformReleaseSummary;
    linux: PlatformReleaseSummary;
  };
  metrics: {
    totalReleases: number;
    activeReleases: number;
    scheduledReleases: number;
    deprecatedReleases: number;
    disabledReleases: number;
    mandatoryReleases: number;
  };
}

export interface AppVersionCheckInput {
  platform: 'web' | 'desktop';
  os?: 'windows' | 'macos' | 'linux';
  currentVersion: string;
  buildNumber?: string;
  releaseChannel?: 'stable' | 'beta' | 'alpha' | 'nightly';
  architecture?: string;
  clientId?: string;
}

export type ClientUpdateState =
  | 'up-to-date'
  | 'update-available'
  | 'update-recommended'
  | 'update-required'
  | 'unsupported-version';

export interface AppVersionCheckResult {
  updateAvailable: boolean;
  status: ClientUpdateState;
  currentVersion: string;
  latestVersion: string;
  minimumSupportedVersion: string;
  mandatory: boolean;
  forceUpdate: boolean;
  downloadUrl: string | null;
  releaseNotes: string | null;
  changelog: string | null;
  releaseDate: string | null;
  releaseChannel: string;
  rolloutPercentage: number;
  rolloutEligible: boolean;
}

export interface CreateAppReleaseInput {
  platform: AppPlatform;
  operatingSystem?: AppOperatingSystem | null;
  version: string;
  buildNumber: string;
  releaseChannel?: AppReleaseChannel;
  status?: AppReleaseStatus;
  minimumSupportedVersion?: string | null;
  releaseDate?: string;
  rolloutPercentage?: number;
  downloadUrl?: string | null;
  releaseNotes?: string | null;
  changelog?: string | null;
  mandatoryUpdate?: boolean;
  forceUpdate?: boolean;
}

export interface UpdateAppReleaseInput {
  version?: string;
  buildNumber?: string;
  releaseChannel?: AppReleaseChannel;
  status?: AppReleaseStatus;
  minimumSupportedVersion?: string | null;
  releaseDate?: string;
  rolloutPercentage?: number;
  downloadUrl?: string | null;
  releaseNotes?: string | null;
  changelog?: string | null;
  mandatoryUpdate?: boolean;
  forceUpdate?: boolean;
}

export interface ScheduleAppReleaseInput {
  releaseDate: string;
  rolloutPercentage?: number;
  reason?: string;
}

export interface RolloutAppReleaseInput {
  rolloutPercentage: number;
  reason?: string;
}

export interface RollbackAppReleaseInput {
  targetReleaseId: string;
  reason: string;
}
