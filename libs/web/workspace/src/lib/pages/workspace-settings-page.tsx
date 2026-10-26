import { zodResolver } from '@hookform/resolvers/zod';
import {
  appDownloadsApi,
  authApi,
  channelApi,
  http,
  integrationsApi,
  queryKeys,
  toApiError,
  userApi,
  workspaceApi,
} from '@org/api-client';
import {
  browserSupportsPasskeys,
  formErrorMessage,
  passkeyErrorMessage,
  useAuthStore,
  useCurrentUser,
} from '@org/auth';
import { useTheme } from '@org/design-system';
import {
  Badge,
  Button,
  confirm,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  LanguageSelect,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  UserAvatar,
  WorkspaceAvatar,
  toast,
  useFocusStore,
  useSidebarCustomizerStore,
  FOCUS_SOUND_OPTIONS,
  FOCUS_DURATION_OPTIONS,
  focusAudio,
  type FocusSoundType,
  SettingsBadge,
  SettingsCard,
  SettingsRow,
  SegmentedControl,
  SettingsSectionHeader,
} from '@org/ui';
import { cn, getSystemTimezone, initials, slugify } from '@org/utils';
import {
  PolicySubjectRole,
  WorkspaceRole,
  WorkspaceStatus,
  hasWorkspaceRole,
  type UserSessionDto,
  type TotpSetupResponse,
} from '@org/types';
import {
  changePasswordSchema,
  updateProfileSchema,
  updateWorkspaceSchema,
  workspaceLogoError,
  WORKSPACE_LOGO_MIME_TYPES,
  type ChangePasswordInput,
  type UpdateProfileInput,
  type UpdateWorkspaceInput,
} from '@org/validation';
import { useTranslation, type SupportedLanguageCode } from '@org/i18n';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Moon,
  Sun,
  Monitor,
  CheckCircle2,
  Upload,
  Trash2,
  Smile,
  Target,
  Clock,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Mail,
  Smartphone,
  Copy,
  Check,
  ImagePlus,
  Laptop,
  Tablet,
  Key,
  Shield,
  ShieldCheck,
  LogOut,
  Globe,
} from 'lucide-react';
import { useState, useRef, useEffect, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AppDownloadCard,
  DesktopSettingsCard,
  PlatformDiagnosticsLink,
} from '@org/web-desktop';
import {
  useCurrentWorkspace,
  useDeleteWorkspace,
  useSetWorkspaceArchived,
  useUpdateWorkspace,
  useUploadWorkspaceLogo,
  useRemoveWorkspaceLogo,
  useWorkspacePolicies,
  useActiveSessions,
  useRevokeSession,
  useRevokeOtherSessions,
  useSecurityOverview,
  useSetupTotp,
  useVerifyTotp,
  useDisableTotp,
  useRegenerateRecoveryCodes,
  useWebAuthnCredentials,
  useRegisterWebAuthn,
  useDeleteWebAuthn,
  useDisconnectIdentity,
} from '../use-workspaces.js';
import { SettingsLayout } from '../settings-layout.js';
import { useRegisterSettingsDirty } from '../settings-dirty.store.js';
import { useWorkspacePreference } from '../settings-preferences.store.js';
import { WorkspaceMembersSettings } from '../components/workspace-members-settings.js';
import { WorkspacePermissionsSettings } from '../components/workspace-permissions-settings.js';
import { WorkspaceAuditSettings } from '../components/workspace-audit-settings.js';
import { WorkspaceBillingSettings } from '../components/workspace-billing-settings.js';
import { WorkspaceCompanyAnalytics } from '../components/workspace-company-analytics.js';
import { UpgradePlanBanner } from '../components/upgrade-plan-banner.js';
import { AIProvidersSettings } from '../components/ai-providers-settings.js';
import { EnterpriseCustomLLMSettings } from '../components/enterprise-custom-llm-settings.js';
import { EnterpriseIdentitySettingsPanel } from '../components/enterprise-identity-settings.js';
import { ChatSettingsPanel } from '../components/chat-settings-panel.js';
import { NotificationDisplaySettingsPanel } from '../components/notification-display-settings-panel.js';
import { NotificationDeliverySettings } from '../components/notification-delivery-settings.js';
import { LanguageRegionSettings } from '../components/language-region-settings.js';

/**
 * Panels this page renders but does not own.
 *
 * `@org/web-workspace` is the lowest layer of the feature graph — twelve
 * libraries import `useCurrentWorkspace` from it — so it cannot import back out
 * to `@org/web-integrations` or `@org/web-work-tools` for the two tabs that are
 * really those features' own settings UI. The route composes them in instead.
 */
export interface WorkspaceSettingsPageProps {
  /** The Slack/Notion migration panel, from `@org/web-integrations`. */
  importPanel?: ReactNode;
  /** The kanban field-customisation panel, from `@org/web-work-tools`. */
  kanbanPanel?: ReactNode;
  /** The theme customization panel, from `@org/web-settings`. */
  themePanel?: ReactNode;
  /** The full profile panel, from `@org/web-profile`. */
  profilePanel?: ReactNode;
  /** The employee work-profile panel (contact, birthday, privacy), from `@org/web-members`. */
  workProfilePanel?: ReactNode;
  /** The invitations & access-links manager, from `@org/web-invitations`. */
  invitationsPanel?: ReactNode;
  /** The Matrix end-to-end encryption and key backup panel, from `@org/web-chat`. */
  encryptionSecurityPanel?: ReactNode;
}

/** Short badge label for a `WorkspacePolicy` subject-role value. Mirrors `POLICY_OPTIONS` in `workspace-permissions-settings.tsx`. */
function policySubjectLabel(role: PolicySubjectRole | undefined): string {
  switch (role) {
    case PolicySubjectRole.OWNER_ONLY:
      return 'Owner only';
    case PolicySubjectRole.ADMINS:
      return 'Admins & Owner';
    case PolicySubjectRole.MEMBERS:
      return 'Everyone';
    default:
      return 'Loading…';
  }
}

export function WorkspaceSettingsPage({
  importPanel,
  kanbanPanel,
  themePanel,
  profilePanel,
  workProfilePanel,
  invitationsPanel,
  encryptionSecurityPanel,
}: WorkspaceSettingsPageProps = {}) {
  const { workspace, workspaceId, isLoading } = useCurrentWorkspace();
  const updateWorkspace = useUpdateWorkspace(workspaceId);
  const uploadLogo = useUploadWorkspaceLogo(workspaceId);
  const removeLogo = useRemoveWorkspaceLogo(workspaceId);
  const deleteWorkspace = useDeleteWorkspace();
  const setArchived = useSetWorkspaceArchived(workspaceId);
  const queryClient = useQueryClient();

  // Real workspace policy — read here (rather than only inside
  // <WorkspacePermissionsSettings>) so the Channels & AI tabs can show the
  // actual current value instead of re-declaring their own fetch, and so a
  // save from the Permissions tab is instantly reflected everywhere on this
  // page via the shared `queryKeys.workspaces.policies` cache entry.
  const policiesQuery = useWorkspacePolicies(workspaceId);

  const defaultChannelQuery = useQuery({
    queryKey: queryKeys.workspaces.defaultChannel(workspaceId ?? ''),
    queryFn: () => workspaceApi.getDefaultChannel(workspaceId as string),
    enabled: !!workspaceId,
  });
  const channelsListQuery = useQuery({
    queryKey: queryKeys.channels.list(workspaceId ?? '', false),
    queryFn: () => channelApi.list(workspaceId as string, false),
    enabled: !!workspaceId,
  });
  const saveDefaultChannelMutation = useMutation({
    mutationFn: (channelId: string | null) =>
      workspaceApi.saveDefaultChannel(workspaceId as string, channelId),
    onSuccess: (saved) => {
      queryClient.setQueryData(
        queryKeys.workspaces.defaultChannel(workspaceId ?? ''),
        saved,
      );
      toast.success('Default join channel updated.');
    },
    meta: { errorMessage: 'Could not update the default join channel.' },
  });
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { workspaceSlug, section: routeSection } = useParams<{
    workspaceSlug: string;
    section: string;
  }>();
  const [searchParams, setSearchParams] = useSearchParams();

  // Logo & slug states for General Settings
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isLogoRemoved, setIsLogoRemoved] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);
  // The URL follows the name until the admin edits the URL by hand.
  const [slugTouched, setSlugTouched] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const handleSelectLogo = (file: File | undefined) => {
    if (!file) return;
    const problem = workspaceLogoError(file);
    setLogoError(problem);
    if (!problem) {
      setLogoFile(file);
      setIsLogoRemoved(false);
    }
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoError(null);
    setIsLogoRemoved(true);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleCopySlugUrl = () => {
    if (!workspace) return;
    const fullUrl = `${window.location.origin}/w/${workspace.slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 2000);
    toast.success('Workspace URL copied to clipboard');
  };

  const user = useCurrentUser();
  const setUser = useAuthStore((state) => state.setUser);
  const { t, locale, setLocale } = useTranslation();

  const handleLanguageChange = async (newLocale: SupportedLanguageCode) => {
    setLocale(newLocale);
    try {
      await userApi.updateLanguage({ language: newLocale });
      if (user) {
        setUser({ ...user, preferredLanguage: newLocale });
      }
      toast.success(t('settings.language_changed_success'));
    } catch {
      toast.error(t('settings.language_change_error'));
    }
  };

  /* The zone this device is in — offered as the default and used to point out
     when the saved profile disagrees with where the user actually is. */
  const systemTimezone = getSystemTimezone();

  /*
   * The active section is the `:section` path segment
   * (`/w/:slug/settings/<section>`). A handful of ids have older aliases that
   * still arrive from deep links and redirects — fold them onto the canonical
   * id so the sidebar highlights the right row.
   */
  const SECTION_ALIASES: Record<string, string> = {
    preferences: 'appearance',
    theme: 'appearance',
    // The workspace-branding editor was removed; stale links land on the
    // personal Appearance section, which covers theme for this workspace.
    'workspace-appearance': 'appearance',
    plans: 'billing',
    'timezone-region': 'profile',
    // Work Profile was merged into Profile (its "Work & privacy" view).
    'work-profile': 'profile',
    'focus-status': 'profile',
    'integrations/import': 'import-export',
  };
  const rawSection =
    routeSection ||
    searchParams.get('tab') ||
    searchParams.get('section') ||
    'appearance';
  const currentTab = SECTION_ALIASES[rawSection] ?? rawSection;
  /* Profile has two views: the account (identity, status, hours) and the
     employee's work & privacy details. `?view=work` deep-links the latter. */
  const profileWorkView =
    !!workProfilePanel &&
    (searchParams.get('view') === 'work' || rawSection === 'work-profile');
  const setProfileView = (view: 'account' | 'work') => {
    const next = new URLSearchParams(searchParams);
    if (view === 'work') next.set('view', 'work');
    else next.delete('view');
    setSearchParams(next, { replace: true });
  };

  const handleTabChange = (val: string) => {
    if (!workspaceSlug) return;
    navigate(`/w/${workspaceSlug}/settings/${val}`);
  };

  /*
   * Preferences below have no server API yet. They used to be plain `useState`,
   * so every one reset on refresh; `useWorkspacePreference` keeps the exact
   * `useState` signature but persists the value per workspace to `localStorage`
   * (see `settings-preferences.store.ts`). Settings that *do* have a backend
   * (profile, workspace name/logo, language, notification categories, theme)
   * are untouched and still go through their own mutations.
   */

  // Preference Settings
  const [homeView, setHomeView] = useWorkspacePreference(
    workspaceId,
    'homeView',
    'agent',
  );
  const [displayNamePref, setDisplayNamePref] = useWorkspacePreference(
    workspaceId,
    'displayNamePref',
    'username',
  );
  const [firstDay, setFirstDay] = useWorkspacePreference(
    workspaceId,
    'firstDay',
    'monday',
  );
  const [convertEmojis, setConvertEmojis] = useWorkspacePreference(
    workspaceId,
    'convertEmojis',
    true,
  );
  const [sendShortcut, setSendShortcut] = useWorkspacePreference(
    workspaceId,
    'sendShortcut',
    'ctrl-enter',
  );
  const [fontSize, setFontSize] = useWorkspacePreference(
    workspaceId,
    'fontSize',
    'default',
  );

  const [docAutoSave, setDocAutoSave] = useWorkspacePreference(
    workspaceId,
    'docAutoSave',
    true,
  );
  const [grammarAssistance, setGrammarAssistance] = useWorkspacePreference(
    workspaceId,
    'grammarAssistance',
    true,
  );
  const [codeSyntaxTheme, setCodeSyntaxTheme] = useWorkspacePreference(
    workspaceId,
    'codeSyntaxTheme',
    'github-dark',
  );

  const [highQualityVideo, setHighQualityVideo] = useWorkspacePreference(
    workspaceId,
    'highQualityVideo',
    true,
  );
  const [fileRetention, setFileRetention] = useWorkspacePreference(
    workspaceId,
    'fileRetention',
    'forever',
  );

  // Off until chosen: turning it on publishes your calendar to this workspace.
  const [googleCalendarSync, setGoogleCalendarSync] = useWorkspacePreference(
    workspaceId,
    'googleCalendarSync',
    false,
  );
  const desktopReleasesQuery = useQuery({
    queryKey: [...queryKeys.appVersions.all(), 'desktop-downloads'],
    queryFn: () => appDownloadsApi.desktop(),
    enabled: currentTab === 'downloads',
    staleTime: 5 * 60_000,
  });
  const integrationsQuery = useQuery({
    queryKey: queryKeys.integrations.list(workspaceId ?? ''),
    queryFn: () => integrationsApi.list(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 15_000,
  });
  const githubConnection = integrationsQuery.data?.find(
    (i) => i.provider === 'GITHUB' && i.status === 'CONNECTED',
  );
  const googleCalendarConnection = integrationsQuery.data?.find(
    (i) => i.provider === 'GOOGLE_CALENDAR' && i.status === 'CONNECTED',
  );
  const githubWebhookQuery = useQuery({
    queryKey: ['github-webhook-setup', workspaceId, githubConnection?.id],
    queryFn: () =>
      integrationsApi.getWebhookSetup(
        workspaceId as string,
        githubConnection?.id as string,
      ),
    enabled: !!workspaceId && !!githubConnection,
    retry: false,
  });
  const [meetingProvider, setMeetingProvider] = useWorkspacePreference(
    workspaceId,
    'meetingProvider',
    'onetab-meet',
  );
  const [autoRecordMeetings, setAutoRecordMeetings] = useWorkspacePreference(
    workspaceId,
    'autoRecordMeetings',
    false,
  );

  // Workflow Automations preferences
  const [githubPRWebhook, setGithubPRWebhook] = useWorkspacePreference(
    workspaceId,
    'githubPRWebhook',
    true,
  );
  const [channelTrigger, setChannelTrigger] = useWorkspacePreference(
    workspaceId,
    'channelTrigger',
    true,
  );
  const [maxConcurrentRuns, setMaxConcurrentRuns] = useWorkspacePreference(
    workspaceId,
    'maxConcurrentRuns',
    '5',
  );
  const [retryFailedSteps, setRetryFailedSteps] = useWorkspacePreference(
    workspaceId,
    'retryFailedSteps',
    true,
  );

  // Dialog & transient UI state (not persisted).
  const openStatusModal = useFocusStore((s) => s.openStatusModal);
  const openFocusModal = useFocusStore((s) => s.openFocusModal);
  const focusStore = useFocusStore();
  const [testSoundPlaying, setTestSoundPlaying] =
    useState<FocusSoundType | null>(null);

  // Profile Update Form & Mutation
  const updateProfile = useMutation({
    mutationFn: (input: UpdateProfileInput) => userApi.updateProfile(input),
    onSuccess: (updated) => setUser(updated),
  });

  const profileForm = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    values: {
      name: user?.name ?? '',
      displayName: user?.displayName ?? '',
      bio: user?.bio ?? '',
      // Falling back to the device's zone rather than UTC: an unset timezone is
      // "we never asked", and the browser already knows the likely answer.
      timezone: user?.timezone ?? systemTimezone,
      avatarUrl: user?.avatarUrl ?? '',
    },
  });

  // Workspace Update Form. The logo is not a form field: it is staged in
  // `logoFile` and goes through its own upload route. Keeping `avatarUrl` out
  // also matters for validation — the resolved logo URL is API-relative
  // (`/api/v1/workspaces/:id/logo`), which `z.string().url()` rejects, and with
  // no visible field to show that error the Save button silently did nothing.
  const workspaceForm = useForm<UpdateWorkspaceInput>({
    resolver: zodResolver(updateWorkspaceSchema),
    values: {
      name: workspace?.name ?? '',
      slug: workspace?.slug ?? '',
      description: workspace?.description ?? '',
      supportEmail: workspace?.supportEmail ?? '',
      defaultLandingView:
        (workspace?.defaultLandingView as UpdateWorkspaceInput['defaultLandingView']) ??
        'home',
      allowExternalSharing: workspace?.allowExternalSharing ?? true,
      aiProjectRecaps: workspace?.aiProjectRecaps ?? true,
    },
    // A background refetch (sync poll, another tab's save) must not wipe what
    // the admin is in the middle of typing.
    resetOptions: { keepDirtyValues: true },
  });

  // Security & Sessions Hooks & Queries
  const sessionsQuery = useActiveSessions();
  const securityOverviewQuery = useSecurityOverview();
  const webAuthnQuery = useWebAuthnCredentials();
  const revokeSessionMutation = useRevokeSession();
  const revokeOtherSessionsMutation = useRevokeOtherSessions();
  const setupTotpMutation = useSetupTotp();
  const verifyTotpMutation = useVerifyTotp();
  const disableTotpMutation = useDisableTotp();
  const regenerateRecoveryMutation = useRegenerateRecoveryCodes();
  const registerWebAuthnMutation = useRegisterWebAuthn();
  const deleteWebAuthnMutation = useDeleteWebAuthn();

  // Dialog & Flow States for Security
  const [totpSetupModalOpen, setTotpSetupModalOpen] = useState(false);
  const [totpSetupData, setTotpSetupData] = useState<TotpSetupResponse | null>(
    null,
  );
  const [totpCodeInput, setTotpCodeInput] = useState('');
  const [totpBackupCodes, setTotpBackupCodes] = useState<string[] | null>(null);
  const [totpCopiedSecret, setTotpCopiedSecret] = useState(false);
  const [recoveryCodesModalOpen, setRecoveryCodesModalOpen] = useState(false);
  const [recoveryCodesList, setRecoveryCodesList] = useState<string[]>([]);
  const [revokeModalSession, setRevokeModalSession] =
    useState<UserSessionDto | null>(null);
  const [revokeOtherModalOpen, setRevokeOtherModalOpen] = useState(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState(false);
  const [addPasskeyModalOpen, setAddPasskeyModalOpen] = useState(false);
  const [passkeyDeviceName, setPasskeyDeviceName] = useState('');
  const [disableTotpModalOpen, setDisableTotpModalOpen] = useState(false);
  const [disableTotpPassword, setDisableTotpPassword] = useState('');
  const disconnectIdentityMutation = useDisconnectIdentity();
  const [disconnectingProvider, setDisconnectingProvider] = useState<
    string | null
  >(null);

  const [connectingProvider, setConnectingProvider] = useState<
    'google' | 'apple' | null
  >(null);

  /*
   * The link URL is fetched with the bearer token (a plain navigation can't
   * carry one); the API seals this user's id into the flow cookie and the
   * provider sends the browser back here with `?linked=` or `?oauth_error=`.
   */
  const handleConnectProvider = async (provider: 'google' | 'apple') => {
    setConnectingProvider(provider);
    try {
      const { url } = await authApi.getOAuthLinkUrl(provider, {
        returnTo: window.location.pathname,
      });
      window.location.assign(url);
    } catch (err) {
      setConnectingProvider(null);
      toast.error(toApiError(err).message || `Could not connect ${provider}.`);
    }
  };

  // Result of a Connect round-trip through the provider.
  useEffect(() => {
    const linked = searchParams.get('linked');
    const oauthError = searchParams.get('oauth_error');
    if (!linked && !oauthError) return;
    const name = (linked ?? '') === 'apple' ? 'Apple' : 'Google';
    if (linked) {
      toast.success(`${name} account connected.`);
      void queryClient.invalidateQueries({ queryKey: ['auth'] });
    } else if (oauthError === 'oauth_account_linked_to_other') {
      toast.error('That account is already linked to another user.');
    } else if (oauthError !== 'oauth_cancelled') {
      toast.error('Could not connect the account. Please try again.');
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('linked');
        next.delete('oauth_error');
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams, queryClient]);

  const handleDisconnectProvider = async (provider: 'google' | 'apple') => {
    const overview = securityOverviewQuery.data;
    const hasPassword = Boolean(overview?.password.hasPassword);
    const otherProviderConnected =
      provider === 'google'
        ? Boolean(overview?.socialProviders?.apple.isConnected)
        : Boolean(overview?.socialProviders?.google.isConnected);

    if (!hasPassword && !otherProviderConnected) {
      toast.error(
        'Cannot disconnect your only sign-in method. Please set a password or connect another provider first.',
      );
      return;
    }

    setDisconnectingProvider(provider);
    try {
      await disconnectIdentityMutation.mutateAsync(provider);
      toast.success(
        `${provider === 'google' ? 'Google' : 'Apple'} account disconnected.`,
      );
    } catch (err: any) {
      toast.error(err?.message || `Failed to disconnect ${provider}.`);
    } finally {
      setDisconnectingProvider(null);
    }
  };

  // Password Change Mutation & Form
  const changePassword = useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      http.post('/auth/change-password', input).then(() => undefined),
    onSuccess: () => {
      setChangePasswordModalOpen(false);
      toast.success('Password changed successfully');
    },
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  });

  const onProfileSubmit = profileForm.handleSubmit(async (values) => {
    try {
      await updateProfile.mutateAsync({
        ...values,
        displayName: values.displayName || null,
        bio: values.bio || null,
        avatarUrl: values.avatarUrl || null,
      });
    } catch {
      // Rendered by <FormError>.
    }
  });

  const currentAvatarUrl = isLogoRemoved
    ? null
    : (logoPreview ?? (workspace?.avatarUrl || null));

  const isLogoChanged =
    logoFile !== null || (isLogoRemoved && Boolean(workspace?.avatarUrl));
  const isWorkspaceDirty = workspaceForm.formState.isDirty || isLogoChanged;
  const isSavingWorkspace =
    updateWorkspace.isPending || uploadLogo.isPending || removeLogo.isPending;

  const onWorkspaceSubmit = workspaceForm.handleSubmit(async (values) => {
    if (!workspace) return;
    const { dirtyFields } = workspaceForm.formState;

    // Only the fields the admin actually touched are sent, so the audit log's
    // `changedKeys` is honest and an unrelated save cannot clobber a value
    // another admin changed meanwhile.
    const patch: UpdateWorkspaceInput = {};
    if (dirtyFields.name) patch.name = values.name;
    if (dirtyFields.description) patch.description = values.description || null;
    if (dirtyFields.supportEmail)
      patch.supportEmail = values.supportEmail || null;
    if (dirtyFields.defaultLandingView)
      patch.defaultLandingView = values.defaultLandingView;
    if (dirtyFields.allowExternalSharing)
      patch.allowExternalSharing = values.allowExternalSharing;
    if (dirtyFields.aiProjectRecaps)
      patch.aiProjectRecaps = values.aiProjectRecaps;

    const nextSlug = values.slug?.trim().toLowerCase();
    const slugChanged = Boolean(nextSlug) && nextSlug !== workspace.slug;
    if (slugChanged) {
      const ok = await confirm({
        title: 'Change the workspace URL?',
        description: `Links to /w/${workspace.slug} will stop working. Members will need to use /w/${nextSlug} from now on.`,
        confirmLabel: 'Change URL',
      });
      if (!ok) return;
      patch.slug = nextSlug;
    }

    let stage: 'logo' | 'details' = 'logo';
    try {
      if (isLogoRemoved && workspace.avatarUrl) {
        await removeLogo.mutateAsync();
        setIsLogoRemoved(false);
      } else if (logoFile) {
        await uploadLogo.mutateAsync(logoFile);
        setLogoFile(null);
      }

      stage = 'details';
      if (Object.keys(patch).length > 0) {
        const saved = await updateWorkspace.mutateAsync(patch);
        // Re-baseline on the server's copy so the form is clean right away
        // rather than after the list refetch lands.
        workspaceForm.reset({
          name: saved.name,
          slug: saved.slug,
          description: saved.description ?? '',
          supportEmail: saved.supportEmail ?? '',
          defaultLandingView:
            saved.defaultLandingView as UpdateWorkspaceInput['defaultLandingView'],
          allowExternalSharing: saved.allowExternalSharing,
          aiProjectRecaps: saved.aiProjectRecaps,
        });
        setSlugTouched(false);
        if (saved.slug !== workspace.slug) {
          // Every query under this page is keyed on the slug in the URL, which
          // now 404s — move to the new address in place.
          navigate(`/w/${saved.slug}/settings/general`, { replace: true });
        }
      }

      toast.success('Workspace settings saved');
    } catch (err) {
      const apiError = toApiError(err);
      if (slugChanged && apiError.status === 409) {
        workspaceForm.setError('slug', { message: apiError.message });
        return;
      }
      // Field/request errors from the PATCH render in <FormError>; logo
      // failures have no inline slot, so they toast.
      if (stage === 'logo') {
        toast.error(apiError.message || 'Could not update the workspace logo.');
      }
    }
  });

  const discardWorkspaceChanges = () => {
    setSlugTouched(false);
    workspaceForm.reset();
    setLogoFile(null);
    setLogoError(null);
    setIsLogoRemoved(false);
    updateWorkspace.reset();
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  /*
   * Register the two real forms with the unsaved-changes guard, so leaving the
   * settings surface (a nav row, Back, Close, Escape, tab close) while edits are
   * in flight prompts first. `settings.profile` also covers the timezone edits
   * in Language & Region, which dirty `profileForm`. Kept above the early return
   * so the hook order is stable.
   */
  useRegisterSettingsDirty(
    'settings.profile',
    profileForm.formState.isDirty,
    () => onProfileSubmit(),
    () => profileForm.reset(),
  );
  useRegisterSettingsDirty(
    'settings.workspace',
    isWorkspaceDirty,
    () => onWorkspaceSubmit(),
    discardWorkspaceChanges,
  );

  if (isLoading || !workspace) return <LoadingState fullPage />;

  const isAdmin = hasWorkspaceRole(workspace.role, WorkspaceRole.ADMIN);
  const isOwner = workspace.role === WorkspaceRole.OWNER;
  const isArchived = workspace.status === WorkspaceStatus.ARCHIVED;

  const onPasswordSubmit = passwordForm.handleSubmit(async (values) => {
    try {
      await changePassword.mutateAsync(values);
      passwordForm.reset();
    } catch {
      // Rendered by <FormError>.
    }
  });

  const handleStartTotpSetup = async () => {
    try {
      const res = await setupTotpMutation.mutateAsync();
      setTotpSetupData(res);
      setTotpCodeInput('');
      setTotpBackupCodes(null);
      setTotpSetupModalOpen(true);
    } catch {
      toast.error('Failed to initiate 2FA setup');
    }
  };

  const handleVerifyTotp = async () => {
    if (!totpCodeInput || totpCodeInput.trim().length !== 6) {
      toast.error('Please enter a valid 6-digit verification code');
      return;
    }
    try {
      const res = await verifyTotpMutation.mutateAsync({
        code: totpCodeInput.trim(),
      });
      setTotpBackupCodes(res.backupCodes);
      toast.success('Two-factor authentication enabled!');
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || 'Invalid code. Please try again.',
      );
    }
  };

  const handleConfirmDisableTotp = async () => {
    try {
      await disableTotpMutation.mutateAsync({
        currentPassword: disableTotpPassword,
      });
      setDisableTotpModalOpen(false);
      setDisableTotpPassword('');
      toast.success('Two-factor authentication disabled');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to disable 2FA');
    }
  };

  const handleGenerateRecoveryCodes = async () => {
    try {
      const res = await regenerateRecoveryMutation.mutateAsync();
      setRecoveryCodesList(res.codes);
      setRecoveryCodesModalOpen(true);
      toast.success('Recovery codes generated');
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message || 'Failed to generate recovery codes',
      );
    }
  };

  const handleRegisterPasskey = async () => {
    try {
      await registerWebAuthnMutation.mutateAsync(
        passkeyDeviceName.trim() || undefined,
      );
      setAddPasskeyModalOpen(false);
      setPasskeyDeviceName('');
      toast.success('Passkey added');
    } catch (error) {
      const message = passkeyErrorMessage(error);
      if (message) toast.error(message);
    }
  };

  return (
    <SettingsLayout activeTab={currentTab} onTabChange={handleTabChange}>
      {/* ---------------- SECTION 1: APPEARANCE & PREFERENCES ---------------- */}
      {(currentTab === 'appearance' ||
        currentTab === 'preferences' ||
        currentTab === 'theme') && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Appearance & Preferences</>}
            description={
              <>
                Customize app themes, color palette, default home views, and
                keyboard interaction.
              </>
            }
          />

          {themePanel}

          {/* Subsection: General */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
              General
            </h3>
            <SettingsCard divided>
              <SettingsRow
                title={
                  <>{t('settings.language_title', 'Interface Language')}</>
                }
                description={
                  <>
                    {t(
                      'settings.language_description',
                      'Choose your preferred language for the web and desktop applications',
                    )}
                  </>
                }
              >
                <div className="w-56">
                  <LanguageSelect
                    value={locale}
                    onChange={handleLanguageChange}
                  />
                </div>
              </SettingsRow>

              <SettingsRow
                title={<>Default home view</>}

                description={
                  <>Select which view to display when launching Onetab-AI</>
                }
              >
                <Select value={homeView} onValueChange={setHomeView}>
                  <SelectTrigger className="w-52 h-8 text-xs border-border bg-surface">
                    <SelectValue placeholder="Select view" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent" className="text-xs">
                      AI Chat & Agent (default)
                    </SelectItem>
                    <SelectItem value="dashboard" className="text-xs">
                      Dashboard Overview
                    </SelectItem>
                    <SelectItem value="kanban" className="text-xs">
                      Tasks & Kanban
                    </SelectItem>
                    <SelectItem value="docs" className="text-xs">
                      Notes & Documents
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>

              <SettingsRow
                title={<>Display names</>}
                description={
                  <>Select how names are displayed across the interface</>
                }
              >
                <Select
                  value={displayNamePref}
                  onValueChange={setDisplayNamePref}
                >
                  <SelectTrigger className="w-36 h-8 text-xs border-border bg-surface">
                    <SelectValue placeholder="Username" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="username" className="text-xs">
                      Username
                    </SelectItem>
                    <SelectItem value="fullname" className="text-xs">
                      Full name
                    </SelectItem>
                    <SelectItem value="displayname" className="text-xs">
                      Display name
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>

              <SettingsRow
                title={<>First day of the week</>}
                description={<>Used for date pickers and schedule views</>}
              >
                <Select value={firstDay} onValueChange={setFirstDay}>
                  <SelectTrigger className="w-36 h-8 text-xs border-border bg-surface">
                    <SelectValue placeholder="Monday" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monday" className="text-xs">
                      Monday
                    </SelectItem>
                    <SelectItem value="sunday" className="text-xs">
                      Sunday
                    </SelectItem>
                    <SelectItem value="saturday" className="text-xs">
                      Saturday
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>

              <SettingsRow
                title={<>Convert text emoticons into emojis</>}
                description={
                  <>
                    Strings like{' '}
                    <code className="px-1 rounded bg-muted text-[10px]">
                      :)
                    </code>{' '}
                    will be converted to 😄
                  </>
                }
              >
                <Switch
                  checked={convertEmojis}
                  onCheckedChange={setConvertEmojis}
                />
              </SettingsRow>

              <SettingsRow
                title={<>Send comments on...</>}
                description={
                  <>
                    Choose which key press is used to submit messages and
                    comments
                  </>
                }
              >
                <Select value={sendShortcut} onValueChange={setSendShortcut}>
                  <SelectTrigger className="w-36 h-8 text-xs border-border bg-surface">
                    <SelectValue placeholder="Ctrl+Enter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ctrl-enter" className="text-xs">
                      Ctrl+Enter
                    </SelectItem>
                    <SelectItem value="enter" className="text-xs">
                      Enter
                    </SelectItem>
                    <SelectItem value="cmd-enter" className="text-xs">
                      Cmd+Enter
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>
            </SettingsCard>
          </div>

          {/* Subsection: Interface and theme */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
              Interface and theme
            </h3>
            <SettingsCard divided>
              <SettingsRow
                title={<>App sidebar</>}
                description={
                  <>
                    Customize sidebar item visibility, ordering, and activity
                    indicator (dot / badge) style
                  </>
                }
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs px-3"
                  onClick={() =>
                    useSidebarCustomizerStore.getState().openWith('indicators')
                  }
                >
                  Customize
                </Button>
              </SettingsRow>

              <SettingsRow
                title={<>Font size</>}
                description={<>Adjust the size of text across the app</>}
              >
                <Select value={fontSize} onValueChange={setFontSize}>
                  <SelectTrigger className="w-32 h-8 text-xs border-border bg-surface">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default" className="text-xs">
                      Default
                    </SelectItem>
                    <SelectItem value="compact" className="text-xs">
                      Compact
                    </SelectItem>
                    <SelectItem value="large" className="text-xs">
                      Large
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>

              <SettingsRow
                title={<>Interface theme</>}
                description={<>Select your preferred appearance theme</>}
              >
                <div className="gap-1.5 p-1 flex items-center rounded-lg border border-border/50 bg-muted/40">
                  <button
                    onClick={() => setTheme('light')}
                    className={`gap-1.5 px-3 py-1 text-xs font-medium flex items-center rounded-md transition-all ${
                      theme === 'light'
                        ? 'shadow-2xs font-semibold bg-background text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Sun className="size-3.5 text-accent-amber" />
                    <span>Light</span>
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`gap-1.5 px-3 py-1 text-xs font-medium flex items-center rounded-md transition-all ${
                      theme === 'dark'
                        ? 'shadow-2xs font-semibold bg-background text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Moon className="size-3.5 text-accent-indigo" />
                    <span>Dark</span>
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={`gap-1.5 px-3 py-1 text-xs font-medium flex items-center rounded-md transition-all ${
                      theme === 'system'
                        ? 'shadow-2xs font-semibold bg-background text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Monitor className="size-3.5 text-muted-foreground" />
                    <span>System</span>
                  </button>
                </div>
              </SettingsRow>
            </SettingsCard>
          </div>

          <DesktopSettingsCard />

          {/*
            DesktopSettingsCard renders null on the web build (it's entirely
            desktop preferences), so a web-mode developer would otherwise have
            no path to the diagnostics screen at all — this renders
            independently of it and self-hides via import.meta.env.PROD.
          */}
          <PlatformDiagnosticsLink />
        </div>
      )}

      {/* ---------------- SECTION 1.5: LANGUAGE & REGION ---------------- */}
      {currentTab === 'language' && <LanguageRegionSettings />}

      {/* ---------------- SECTION 2: PROFILE, STATUS & REGION ---------------- */}
      {(currentTab === 'profile' ||
        currentTab === 'timezone-region' ||
        currentTab === 'focus-status') &&
        user && (
          <div className="space-y-8">
            <SettingsSectionHeader
              title={<>Profile</>}
              description={
                <>
                  Manage your personal identity, status, focus preferences,
                  working hours, and your work details.
                </>
              }
            />

            {workProfilePanel && (
              <SegmentedControl
                aria-label="Profile view"
                value={profileWorkView ? 'work' : 'account'}
                onChange={setProfileView}
                options={[
                  { value: 'account', label: 'Account' },
                  {
                    value: 'work',
                    label: 'Work & privacy',
                    hint: 'Contact details, birthday, privacy and celebration notifications',
                  },
                ]}
              />
            )}

            {profileWorkView
              ? workProfilePanel
              : (profilePanel ?? (
                  <SettingsCard>
                    <div className="sm:flex-row sm:items-center gap-4 pb-6 flex flex-col justify-between border-b border-border/40">
                      <div className="gap-5 flex items-center">
                        <UserAvatar
                          name={user.displayName ?? user.name}
                          src={profileForm.watch('avatarUrl') || user.avatarUrl}
                          seed={user.id}
                          size="xl"
                          presence={user.presence}
                          statusEmoji={user.statusEmoji}
                          statusText={user.statusText}
                        />
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-foreground">
                            {user.displayName ?? user.name}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {user.email}
                          </p>
                          <span className="px-2.5 py-0.5 font-semibold inline-block rounded-full bg-primary/10 text-[10px] text-primary">
                            {workspace.role}
                          </span>
                        </div>
                      </div>

                      {/* Quick Status & Focus Mode controls */}
                      <div className="gap-2 flex items-center">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={openStatusModal}
                          className="text-xs gap-1.5"
                        >
                          <Smile className="size-3.5 text-primary" />
                          {user.statusText ? 'Edit Status' : 'Set Status'}
                        </Button>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={openFocusModal}
                          className="text-xs gap-1.5"
                        >
                          <Target className="size-3.5" />
                          Focus Mode
                        </Button>
                      </div>
                    </div>

                    {/* Active Status Highlight if set */}
                    {(user.statusText || user.statusEmoji) && (
                      <div className="p-3 text-xs flex items-center justify-between rounded-xl border border-primary/25 bg-primary/5 text-foreground">
                        <div className="gap-2 min-w-0 flex items-center">
                          <span className="text-lg">
                            {user.statusEmoji || '💬'}
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold block truncate">
                              {user.statusText}
                            </span>
                            {user.statusExpiresAt && (
                              <span className="gap-1 mt-0.5 flex items-center text-[11px] text-muted-foreground">
                                <Clock className="size-3" />
                                Clears{' '}
                                {new Date(
                                  user.statusExpiresAt,
                                ).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={openStatusModal}
                          className="h-7 text-xs text-primary"
                        >
                          Change
                        </Button>
                      </div>
                    )}

                    <Form {...profileForm}>
                      <form
                        onSubmit={onProfileSubmit}
                        className="space-y-4 max-w-xl"
                        noValidate
                      >
                        <FormError
                          error={formErrorMessage(updateProfile.error)}
                        />

                        <FormField
                          control={profileForm.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">
                                Full name
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ''}
                                  className="h-9 text-xs"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={profileForm.control}
                          name="displayName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">
                                Display name
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  value={field.value ?? ''}
                                  placeholder="Optional"
                                  className="h-9 text-xs"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={profileForm.control}
                          name="bio"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">
                                Bio
                              </FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  value={field.value ?? ''}
                                  rows={3}
                                  placeholder="What you work on..."
                                  className="text-xs"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={profileForm.control}
                          name="avatarUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs font-medium">
                                Avatar Image
                              </FormLabel>
                              <div className="gap-3 flex items-center">
                                <FormControl>
                                  <Input
                                    {...field}
                                    value={field.value ?? ''}
                                    placeholder="Image URL (https://...) or upload an image"
                                    className="h-9 text-xs flex-1 font-mono"
                                  />
                                </FormControl>
                                <label className="gap-1.5 px-3 py-2 text-xs font-medium inline-flex shrink-0 cursor-pointer items-center rounded-md border border-border transition-colors hover:bg-accent">
                                  <Upload className="size-3.5 text-muted-foreground" />
                                  <span>Upload</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        const reader = new FileReader();
                                        reader.onload = (evt) => {
                                          if (evt.target?.result) {
                                            profileForm.setValue(
                                              'avatarUrl',
                                              evt.target.result as string,
                                              {
                                                shouldDirty: true,
                                              },
                                            );
                                          }
                                        };
                                        reader.readAsDataURL(file);
                                      }
                                    }}
                                  />
                                </label>
                                {field.value ? (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 text-xs px-2.5 text-destructive hover:text-destructive"
                                    onClick={() =>
                                      profileForm.setValue('avatarUrl', '', {
                                        shouldDirty: true,
                                      })
                                    }
                                  >
                                    <Trash2 className="size-3.5 mr-1" />
                                    Remove
                                  </Button>
                                ) : null}
                              </div>
                              <FormDescription className="mt-1 text-[11px] text-muted-foreground">
                                Upload an image file or paste an image URL. If
                                removed, fallback displays single letter initial
                                &quot;
                                {initials(
                                  profileForm.watch('name') || user.name,
                                )}
                                &quot;.
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Region, timezone, date/time formats and working hours
                        moved to Settings → Language & Region. The `timezone`
                        field still rides this form; it's edited there. */}

                        <div className="pt-2">
                          <Button
                            type="submit"
                            size="sm"
                            loading={updateProfile.isPending}
                            disabled={!profileForm.formState.isDirty}
                            className="text-xs"
                          >
                            Save profile
                          </Button>
                        </div>
                      </form>
                    </Form>
                  </SettingsCard>
                ))}

            {/* Subsection: Slack Status */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
                Slack-Style Status
              </h3>
              <div className="p-5 space-y-5 rounded-xl border border-border bg-surface shadow-xs">
                <div className="sm:flex-row sm:items-center gap-4 p-4 flex flex-col justify-between rounded-xl border border-border bg-surface">
                  <div className="gap-3 flex items-center">
                    <span className="text-3xl">{user.statusEmoji || '💬'}</span>
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">
                        {user.statusText || 'No active status'}
                      </h4>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {user.statusExpiresAt
                          ? `Clears automatically at ${new Date(user.statusExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                          : 'Visible to all teammates across channels and direct messages'}
                      </p>
                    </div>
                  </div>

                  <div className="gap-2 flex items-center">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={openStatusModal}
                      className="text-xs gap-1.5"
                    >
                      <Smile className="size-3.5 text-primary" />
                      {user.statusText ? 'Edit Status' : 'Set Status'}
                    </Button>
                    {user.statusText && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          userApi.clearStatus().then((updated) => {
                            setUser(updated);
                          });
                        }}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>

                {/* Quick Status Presets */}
                <div className="space-y-2">
                  <label className="text-xs font-medium block text-foreground">
                    Quick 1-Click Status Presets
                  </label>
                  <div className="sm:grid-cols-3 md:grid-cols-4 gap-2 grid grid-cols-2">
                    {[
                      { emoji: '💬', text: 'In a meeting' },
                      { emoji: '🚗', text: 'Commuting' },
                      { emoji: '🤒', text: 'Out sick' },
                      { emoji: '🌴', text: 'Vacationing' },
                      { emoji: '🍱', text: 'Out for lunch' },
                      { emoji: '🏠', text: 'Working remotely' },
                      { emoji: '🎯', text: 'Deep focus' },
                      { emoji: '☕', text: 'Taking a break' },
                    ].map((preset) => (
                      <button
                        key={preset.text}
                        type="button"
                        onClick={() => {
                          userApi
                            .updateStatus({
                              statusText: preset.text,
                              statusEmoji: preset.emoji,
                              statusExpiresAt: new Date(
                                Date.now() + 60 * 60 * 1000,
                              ).toISOString(),
                            })
                            .then((updated) => {
                              setUser(updated);
                            });
                        }}
                        className="gap-2 p-2.5 text-xs flex items-center rounded-xl border border-border bg-surface text-left text-foreground transition-all hover:border-primary/40 hover:bg-accent/50"
                      >
                        <span className="text-base leading-none">
                          {preset.emoji}
                        </span>
                        <span className="font-medium truncate">
                          {preset.text}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Subsection: Focus Mode & Pomodoro */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
                Focus Mode & Ambient Zen Audio
              </h3>
              <SettingsCard>
                {/* Active Session Bar or Launch Trigger */}
                {focusStore.isActive ? (
                  <div className="p-4 sm:flex-row sm:items-center gap-4 flex flex-col justify-between rounded-xl border border-primary/40 bg-primary/10">
                    <div className="gap-3 flex items-center">
                      <div className="size-10 font-bold text-sm flex items-center justify-center rounded-xl bg-primary font-mono text-primary-foreground">
                        {Math.floor(focusStore.remainingSeconds / 60)}m
                      </div>
                      <div>
                        <h4 className="text-xs font-bold gap-2 flex items-center text-foreground">
                          <span>Active Focus Session</span>
                          <span className="px-2 py-0.5 font-bold rounded-full bg-primary text-[10px] text-primary-foreground">
                            {focusStore.isPaused ? 'PAUSED' : 'IN PROGRESS'}
                          </span>
                        </h4>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {focusStore.taskObjective || 'Deep work session'}
                        </p>
                      </div>
                    </div>

                    <div className="gap-2 flex items-center">
                      {focusStore.isPaused ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={focusStore.resumeFocus}
                          className="text-xs gap-1.5"
                        >
                          <Play className="size-3.5" />
                          Resume
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={focusStore.pauseFocus}
                          className="text-xs gap-1.5"
                        >
                          <Pause className="size-3.5" />
                          Pause
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => focusStore.stopFocus()}
                        className="text-xs"
                      >
                        Stop Session
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-foreground">
                          Launch a Focus Session
                        </h4>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          Blocks distractions, generates ambient focus audio,
                          and updates your Slack status.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={openFocusModal}
                        className="text-xs gap-1.5"
                      >
                        <Target className="size-3.5" />
                        Start Focus Session
                      </Button>
                    </div>

                    {/* Preset Buttons */}
                    <div className="sm:grid-cols-4 gap-3 grid grid-cols-2">
                      {FOCUS_DURATION_OPTIONS.map((opt) => (
                        <button
                          key={opt.minutes}
                          type="button"
                          onClick={() => {
                            focusStore.startFocus({
                              durationMinutes: opt.minutes,
                              taskObjective: opt.label,
                            });
                          }}
                          className="p-3.5 space-y-1 rounded-xl border border-border bg-surface text-left transition-all hover:border-primary/50 hover:bg-accent/40"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-lg">{opt.icon}</span>
                            <span className="text-xs font-bold font-mono text-primary">
                              {opt.minutes}m
                            </span>
                          </div>
                          <div className="text-xs font-semibold text-foreground">
                            {opt.label}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Ambient Audio Synthesizer */}
                <div className="space-y-3 pt-4 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-medium gap-1.5 flex items-center text-foreground">
                        <Volume2 className="size-3.5 text-primary" />
                        Ambient Audio Soundscape
                      </h4>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Native Web Audio synthesized noise and alpha wave beat
                        generators.
                      </p>
                    </div>
                    {testSoundPlaying && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          focusAudio.stop();
                          setTestSoundPlaying(null);
                        }}
                        className="h-7 text-xs gap-1 text-destructive"
                      >
                        <VolumeX className="size-3" />
                        Stop Audio
                      </Button>
                    )}
                  </div>

                  <div className="sm:grid-cols-2 md:grid-cols-3 gap-2.5 grid grid-cols-1">
                    {FOCUS_SOUND_OPTIONS.filter((s) => s.id !== 'none').map(
                      (sound) => {
                        const isTesting = testSoundPlaying === sound.id;
                        const isSelected = focusStore.soundType === sound.id;

                        return (
                          <div
                            key={sound.id}
                            className={cn(
                              'p-3 gap-2 text-xs flex items-center justify-between rounded-xl border transition-all',
                              isSelected
                                ? 'border-primary/50 bg-primary/5'
                                : 'border-border bg-surface hover:bg-accent/30',
                            )}
                          >
                            <div
                              className="gap-2 flex flex-1 cursor-pointer items-center truncate"
                              onClick={() => focusStore.setSound(sound.id)}
                            >
                              <span className="text-base">{sound.icon}</span>
                              <span className="font-medium truncate text-foreground">
                                {sound.name}
                              </span>
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => {
                                if (isTesting) {
                                  focusAudio.stop();
                                  setTestSoundPlaying(null);
                                } else {
                                  focusAudio.play(
                                    sound.id,
                                    focusStore.soundVolume,
                                  );
                                  setTestSoundPlaying(sound.id);
                                }
                              }}
                              className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                            >
                              {isTesting ? (
                                <Pause className="size-3.5 text-primary" />
                              ) : (
                                <Play className="size-3.5" />
                              )}
                            </Button>
                          </div>
                        );
                      },
                    )}
                  </div>
                </div>
              </SettingsCard>
            </div>
          </div>
        )}

      {/* ---------------- SECTION: CHAT & MESSAGING ---------------- */}
      {currentTab === 'chat' && <ChatSettingsPanel />}

      {/* ---------------- SECTION 3: NOTIFICATIONS ---------------- */}
      {currentTab === 'notifications' && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Notifications</>}
            description={
              <>
                What notifies you in {workspace.name}, and where it reaches you.
              </>
            }
          />

          <NotificationDeliverySettings workspaceId={workspaceId} />

          {/* Display Preferences & Screen Positioning */}
          <div className="pt-8 border-t border-border">
            <NotificationDisplaySettingsPanel workspaceId={workspaceId} />
          </div>
        </div>
      )}

      {/* ---------------- SECTION: APPS & DOWNLOADS ---------------- */}
      {currentTab === 'downloads' && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Apps & Downloads</>}
            description={
              <>
                Install OneTab AI on your computer and phone. Versions shown are
                the builds currently published.
              </>
            }
          />

          <AppDownloadCard
            workspaceId={workspaceId}
            desktopReleases={desktopReleasesQuery.data}
            releasesLoading={desktopReleasesQuery.isLoading}
          />
        </div>
      )}

      {/* ---------------- SECTION: AI PROVIDERS & API KEYS ---------------- */}
      {currentTab === 'ai-providers' && (
        <AIProvidersSettings workspaceId={workspaceId ?? ''} />
      )}

      {/* ---------------- SECTION: ENTERPRISE CUSTOM LLM ---------------- */}
      {currentTab === 'enterprise-custom-llm' && (
        <EnterpriseCustomLLMSettings workspaceId={workspaceId ?? ''} />
      )}

      {/* ---------------- SECTION 4: AI MODELS & PERSONA ---------------- */}

      {currentTab === 'ai-persona' && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>AI Models & Persona</>}
            description={
              <>
                Model, temperature, tools, and system prompt are configured per
                Agent or Coworker — there is no single workspace-wide default.
                This page covers who may create them and where your provider
                keys live.
              </>
            }
          />

          <div className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
              Creation Policy
            </h3>
            <SettingsCard divided>
              <SettingsRow
                title={<>Who can create AI Agents</>}
                description={<>Managed in Permissions & Policies.</>}
              >
                <div className="gap-2 flex items-center">
                  <Badge variant="neutral" className="text-[10px]">
                    {policySubjectLabel(policiesQuery.data?.whoCanCreateAgents)}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-[11px]"
                    onClick={() => handleTabChange('permissions')}
                  >
                    Manage
                  </Button>
                </div>
              </SettingsRow>

              <SettingsRow
                title={<>Who can create AI Coworkers</>}
                description={<>Managed in Permissions & Policies.</>}
              >
                <div className="gap-2 flex items-center">
                  <Badge variant="neutral" className="text-[10px]">
                    {policySubjectLabel(
                      policiesQuery.data?.whoCanCreateCoworkers,
                    )}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-[11px]"
                    onClick={() => handleTabChange('permissions')}
                  >
                    Manage
                  </Button>
                </div>
              </SettingsRow>
            </SettingsCard>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
              Model, Persona & Provider Keys
            </h3>
            <SettingsCard divided>
              <SettingsRow
                title={<>Per-agent model, temperature & system prompt</>}
                description={
                  <>Each Agent has its own model, tools, and instructions.</>
                }
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() =>
                    workspaceSlug && navigate(`/w/${workspaceSlug}/ai/agents`)
                  }
                >
                  Open AI Workspace
                </Button>
              </SettingsRow>

              <SettingsRow
                title={<>Per-coworker persona & tools</>}
                description={
                  <>Role, personality, allowed actions, and delegate agents.</>
                }
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() =>
                    workspaceSlug &&
                    navigate(`/w/${workspaceSlug}/ai/agents?type=coworker`)
                  }
                >
                  Open Coworkers
                </Button>
              </SettingsRow>

              <SettingsRow
                title={<>Provider API keys</>}
                description={
                  <>The LLM providers this workspace has connected.</>
                }
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => handleTabChange('ai-providers')}
                >
                  Open AI Providers
                </Button>
              </SettingsRow>
            </SettingsCard>
          </div>
        </div>
      )}

      {/* ---------------- SECTION 5: AGENT MARKETPLACE & AUTOMATIONS ---------------- */}
      {currentTab === 'agent-marketplace' && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Agent Marketplace</>}
            description={
              <>
                Browse and install pre-built Agents and Coworkers from the
                marketplace.
              </>
            }
          />

          <SettingsCard divided>
            <SettingsRow
              title={<>Marketplace catalog</>}
              description={
                <>
                  Publicly listed Agents, Coworkers, workflows, and themes
                  available to install into this workspace.
                </>
              }
            >
              <Button
                variant="primary"
                size="sm"
                className="h-7 px-2.5 text-[11px]"
                onClick={() =>
                  workspaceSlug && navigate(`/w/${workspaceSlug}/marketplace`)
                }
              >
                Browse Marketplace
              </Button>
            </SettingsRow>

            <SettingsRow
              title={<>Your Agents & Coworkers</>}
              description={<>Everything already installed in this workspace.</>}
            >
              <div className="gap-2 flex items-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() =>
                    workspaceSlug && navigate(`/w/${workspaceSlug}/ai/agents`)
                  }
                >
                  Agents
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() =>
                    workspaceSlug &&
                    navigate(`/w/${workspaceSlug}/ai/agents?type=coworker`)
                  }
                >
                  Coworkers
                </Button>
              </div>
            </SettingsRow>
          </SettingsCard>
        </div>
      )}

      {currentTab === 'automations' && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Workflow Automations</>}
            description={
              <>
                Configure event triggers, webhooks, and multi-step workflow
                execution logs.
              </>
            }
          />

          <SettingsCard divided>
            <SettingsRow
              title={<>GitHub PR Event Webhook</>}
              description={
                <>
                  Trigger automation workflows on incoming GitHub pull requests
                </>
              }
            >
              <Switch
                checked={githubPRWebhook}
                onCheckedChange={setGithubPRWebhook}
                disabled={!githubConnection}
              />
            </SettingsRow>

            <SettingsRow
              title={<>GitHub webhook setup</>}
              description={
                !githubConnection ? (
                  <>
                    Connect GitHub in Integrations first — pull-request events
                    arrive through a webhook on your repository.
                  </>
                ) : githubWebhookQuery.data ? (
                  <>
                    In your repository: Settings → Webhooks → Add webhook.
                    Content type <code>application/json</code>, events{' '}
                    <em>Pull requests</em>. Workflows with the “GitHub pull
                    request” trigger then run for this workspace.
                  </>
                ) : githubWebhookQuery.isError ? (
                  <>Only workspace admins can see the webhook URL and secret.</>
                ) : (
                  <>Loading…</>
                )
              }
            >
              {githubWebhookQuery.data ? (
                <div className="gap-1.5 flex flex-col">
                  {(
                    [
                      ['Payload URL', githubWebhookQuery.data.url],
                      ['Secret', githubWebhookQuery.data.secret],
                    ] as const
                  ).map(([label, value]) => (
                    <Button
                      key={label}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 gap-2 px-2.5 justify-between text-[11px]"
                      onClick={() => {
                        void navigator.clipboard?.writeText(value).then(
                          () => toast.success(`${label} copied`),
                          () => toast.error('Could not copy'),
                        );
                      }}
                    >
                      <span>Copy {label.toLowerCase()}</span>
                      <Copy className="size-3" />
                    </Button>
                  ))}
                </div>
              ) : null}
            </SettingsRow>

            <SettingsRow
              title={<>Channel Message Keywords Trigger</>}
              description={
                <>Fire workflows when specific key phrases appear in channels</>
              }
            >
              <Switch
                checked={channelTrigger}
                onCheckedChange={setChannelTrigger}
              />
            </SettingsRow>

            <SettingsRow
              title={<>Max Concurrent Workflow Runs</>}
              description={<>Limit parallel execution capacity</>}
            >
              <Select
                value={maxConcurrentRuns}
                onValueChange={setMaxConcurrentRuns}
              >
                <SelectTrigger className="w-36 h-8 text-xs border-border bg-surface">
                  <SelectValue placeholder="5 runs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5" className="text-xs">
                    5 parallel runs
                  </SelectItem>
                  <SelectItem value="10" className="text-xs">
                    10 parallel runs
                  </SelectItem>
                  <SelectItem value="1" className="text-xs">
                    1 parallel run
                  </SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            <SettingsRow
              title={<>Auto-retry failed workflow steps</>}
              description={
                <>Retry failed HTTP steps up to 3 times automatically</>
              }
            >
              <Switch
                checked={retryFailedSteps}
                onCheckedChange={setRetryFailedSteps}
              />
            </SettingsRow>
          </SettingsCard>
        </div>
      )}

      {/* ---------------- SECTION 6: WORK TOOLS ---------------- */}
      {currentTab === 'channels' && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Channels & DMs</>}
            description={
              <>
                Default channel for new members and channel lifecycle. Who may
                create channels, react, edit or read-receipt policy live in
                Permissions & Policies.
              </>
            }
          />

          <SettingsCard divided>
            <SettingsRow
              title={<>Default Join Channel</>}
              description={
                <>
                  Channel automatically joined by new workspace members. Off
                  means new members join no channel automatically.
                </>
              }
            >
              <Select
                value={defaultChannelQuery.data?.channelId ?? 'none'}
                disabled={!isAdmin || saveDefaultChannelMutation.isPending}
                onValueChange={(val) =>
                  saveDefaultChannelMutation.mutate(val === 'none' ? null : val)
                }
              >
                <SelectTrigger className="w-48 h-8 text-xs border-border bg-surface">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="text-xs">
                    None
                  </SelectItem>
                  {(channelsListQuery.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-xs">
                      #{c.slug ?? c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SettingsRow>

            <SettingsRow
              title={<>Auto-archive inactive channels</>}
              description={<>Configured in Permissions & Policies.</>}
            >
              <div className="gap-2 flex items-center">
                <Badge variant="neutral" className="text-[10px]">
                  {policiesQuery.data?.autoArchiveInactiveDays == null
                    ? 'Never'
                    : `${policiesQuery.data.autoArchiveInactiveDays} days`}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => handleTabChange('permissions')}
                >
                  Manage
                </Button>
              </div>
            </SettingsRow>

            <SettingsRow
              title={<>Who can create channels, react & read receipts</>}
              description={<>Configured in Permissions & Policies.</>}
            >
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-[11px]"
                onClick={() => handleTabChange('permissions')}
              >
                Open Permissions & Policies
              </Button>
            </SettingsRow>

            <SettingsRow
              title={<>Direct Message End-to-End Encryption</>}
              description={
                <>Coming soon — not yet available for this workspace.</>
              }
            >
              <Switch checked={false} disabled />
            </SettingsRow>
          </SettingsCard>
        </div>
      )}

      {currentTab === 'kanban-tasks' && kanbanPanel}

      {currentTab === 'documents' && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Notes & Documents</>}
            description={
              <>
                Document editor preferences, auto-save, and Markdown syntax
                themes.
              </>
            }
          />

          <SettingsCard divided>
            <SettingsRow
              title={<>Auto-save Drafts</>}
              description={<>Automatically save document edits as you type</>}
            >
              <Switch checked={docAutoSave} onCheckedChange={setDocAutoSave} />
            </SettingsRow>

            <SettingsRow
              title={<>Grammar & Spellcheck Assistance</>}
              description={
                <>
                  Highlight spelling defects and grammar suggestions in editor
                </>
              }
            >
              <Switch
                checked={grammarAssistance}
                onCheckedChange={setGrammarAssistance}
              />
            </SettingsRow>

            <SettingsRow
              title={<>Code Syntax Highlighting Theme</>}
              description={
                <>Theme used for code snippets inside document blocks</>
              }
            >
              <Select
                value={codeSyntaxTheme}
                onValueChange={setCodeSyntaxTheme}
              >
                <SelectTrigger className="w-40 h-8 text-xs border-border bg-surface">
                  <SelectValue placeholder="Github Dark" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="github-dark" className="text-xs">
                    Github Dark
                  </SelectItem>
                  <SelectItem value="one-dark" className="text-xs">
                    One Dark
                  </SelectItem>
                  <SelectItem value="dracula" className="text-xs">
                    Dracula
                  </SelectItem>
                  <SelectItem value="vs-light" className="text-xs">
                    VS Light
                  </SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>
          </SettingsCard>
        </div>
      )}

      {currentTab === 'files' && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Files & Storage</>}
            description={
              <>
                Workspace storage allocation, high quality media previews, and
                retention.
              </>
            }
          />

          <div className="p-5 space-y-4 rounded-xl border border-border bg-surface shadow-xs">
            <div className="text-xs flex items-center justify-between">
              <span className="font-medium text-foreground">
                Workspace Storage Used
              </span>
              <span className="font-mono text-muted-foreground">
                12.4 GB / 50.0 GB
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted/50">
              <div className="h-full w-[25%] rounded-full bg-primary transition-all" />
            </div>
          </div>

          <SettingsCard divided>
            <SettingsRow
              title={<>High Quality Video & Media Previews</>}
              description={
                <>
                  Generate high-res video thumbnails and audio waveform previews
                </>
              }
            >
              <Switch
                checked={highQualityVideo}
                onCheckedChange={setHighQualityVideo}
              />
            </SettingsRow>

            <SettingsRow
              title={<>File Retention Policy</>}
              description={
                <>Duration to keep deleted files in workspace trash</>
              }
            >
              <Select value={fileRetention} onValueChange={setFileRetention}>
                <SelectTrigger className="w-32 h-8 text-xs border-border bg-surface">
                  <SelectValue placeholder="Forever" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forever" className="text-xs">
                    Forever
                  </SelectItem>
                  <SelectItem value="1year" className="text-xs">
                    1 Year
                  </SelectItem>
                  <SelectItem value="6months" className="text-xs">
                    6 Months
                  </SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>
          </SettingsCard>
        </div>
      )}

      {currentTab === 'schedule' && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Schedule & Meetings</>}
            description={
              <>
                Configure calendar integrations, default meeting provider, and
                auto-record settings.
              </>
            }
          />

          <SettingsCard divided>
            <SettingsRow
              title={<>Google Calendar Sync</>}
              description={
                googleCalendarConnection ? (
                  <>
                    Two-way sync with{' '}
                    {googleCalendarConnection.displayName ??
                      'your Google Calendar'}
                    : upcoming events appear in this workspace’s Meetings
                    (visible to its members; private and all-day events are
                    skipped) and meetings you schedule here are added to your
                    calendar.
                  </>
                ) : (
                  <>
                    Connect Google Calendar in Integrations to sync it with this
                    workspace’s Meetings.
                  </>
                )
              }
            >
              <Switch
                checked={googleCalendarSync}
                onCheckedChange={setGoogleCalendarSync}
                disabled={!googleCalendarConnection}
              />
            </SettingsRow>

            <SettingsRow
              title={<>Default Meeting Room Provider</>}
              description={
                <>Provider used when generating instant meeting links</>
              }
            >
              <Select
                value={meetingProvider}
                onValueChange={setMeetingProvider}
              >
                <SelectTrigger className="w-44 h-8 text-xs border-border bg-surface">
                  <SelectValue placeholder="Onetab Meet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onetab-meet" className="text-xs">
                    Onetab Native Meet
                  </SelectItem>
                  <SelectItem value="google-meet" className="text-xs">
                    Google Meet
                  </SelectItem>
                  <SelectItem value="zoom" className="text-xs">
                    Zoom Meetings
                  </SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            <SettingsRow
              title={<>Auto-record Team Meetings</>}
              description={
                <>
                  Automatically save video transcript and recording to workspace
                  docs
                </>
              }
            >
              <Switch
                checked={autoRecordMeetings}
                onCheckedChange={setAutoRecordMeetings}
              />
            </SettingsRow>
          </SettingsCard>
        </div>
      )}

      {/* ---------------- SECTION 7: INTEGRATIONS & IMPORT ---------------- */}
      {currentTab === 'integrations' && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Integration Hub</>}
            description={
              <>
                Connect external web services, OAuth providers, and dev tools.
                Managed in the full Integration Hub.
              </>
            }
          />

          <SettingsCard divided>
            <SettingsRow
              title={<>Connected apps & providers</>}
              description={
                <>
                  Slack, Google, GitHub, custom APIs and more — connect,
                  configure, and view sync logs.
                </>
              }
            >
              <Button
                variant="primary"
                size="sm"
                className="h-7 px-2.5 text-[11px]"
                onClick={() =>
                  workspaceSlug && navigate(`/w/${workspaceSlug}/integrations`)
                }
              >
                Open Integration Hub
              </Button>
            </SettingsRow>

            <SettingsRow
              title={<>Who can install & manage apps</>}
              description={<>Configured in Permissions & Policies.</>}
            >
              <div className="gap-2 flex items-center">
                <Badge variant="neutral" className="text-[10px]">
                  {policySubjectLabel(policiesQuery.data?.whoCanInstallApps)}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2.5 text-[11px]"
                  onClick={() => handleTabChange('permissions')}
                >
                  Manage
                </Button>
              </div>
            </SettingsRow>
          </SettingsCard>
        </div>
      )}

      {(currentTab === 'import-export' || currentTab === 'migrations') && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Slack Migration & Export Center</>}
            description={
              <>
                Migrate channels, messages, and documents from Slack or Notion.
              </>
            }
          />

          <div className="p-5 rounded-xl border border-border bg-surface shadow-xs">
            {importPanel}
          </div>
        </div>
      )}

      {/* ---------------- SECTION 8: WORKSPACE ADMIN ---------------- */}
      {currentTab === 'members' && (
        <WorkspaceMembersSettings
          workspaceId={workspaceId}
          workspaceSlug={workspace?.slug}
          workspaceName={workspace?.name}
          workspaceRole={workspace?.role}
          onNavigateToTab={handleTabChange}
        />
      )}

      {currentTab === 'invitations' && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Invitations &amp; Access</>}
            description={
              <>
                Track pending invitations, resend or revoke them, and manage
                shareable access links for {workspace?.name ?? 'this workspace'}
                .
              </>
            }
          />
          {invitationsPanel}
        </div>
      )}

      {currentTab === 'permissions' && (
        <WorkspacePermissionsSettings
          workspaceId={workspaceId}
          workspaceRole={workspace?.role}
        />
      )}
      {currentTab === 'enterprise-identity' && (
        <EnterpriseIdentitySettingsPanel
          workspace={workspace}
          isOwner={isOwner}
          isAdmin={isAdmin}
        />
      )}

      {currentTab === 'audit-log' && (
        <WorkspaceAuditSettings
          workspaceId={workspaceId}
          workspaceRole={workspace?.role}
        />
      )}

      {(currentTab === 'billing' || currentTab === 'plans') && (
        <WorkspaceBillingSettings
          totalMembers={workspace?.memberCount ?? 1}
          workspaceName={workspace?.name}
          isOwner={isOwner}
        />
      )}

      {currentTab === 'analytics' && (
        <WorkspaceCompanyAnalytics
          workspaceId={workspaceId}
          workspaceName={workspace?.name}
          onNavigateToTab={handleTabChange}
        />
      )}

      {currentTab === 'general' && (
        <div className="space-y-8">
          <UpgradePlanBanner
            variant="compact"
            totalMembers={workspace?.memberCount ?? 1}
            maxSeats={5}
            currentPlan="free"
            onUpgradeClick={() => handleTabChange('billing')}
          />
          <SettingsSectionHeader
            title={<>Workspace General Settings</>}
            description={
              <>
                Configure your workspace identity, branding, and core
                preferences.
              </>
            }
          />

          <Form {...workspaceForm}>
            <form onSubmit={onWorkspaceSubmit} className="space-y-8" noValidate>
              <FormError error={formErrorMessage(updateWorkspace.error)} />

              {/* CARD 1: Workspace Details */}
              <SettingsCard>
                <div className="gap-5 pb-6 flex items-center border-b border-border/40">
                  <WorkspaceAvatar
                    name={workspaceForm.watch('name') || workspace.name}
                    src={currentAvatarUrl}
                    icon={workspace.icon}
                    iconColor={workspace.iconColor}
                    seed={workspace.id}
                    size="xl"
                  />
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground">
                      {workspaceForm.watch('name') || workspace.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Workspace Details — identity, branding logo, and contact
                      info.
                    </p>
                  </div>
                </div>

                {/* Workspace Logo Upload */}
                <div>
                  <label className="text-xs font-medium mb-2 block text-foreground">
                    Workspace Logo{' '}
                    <span className="font-normal text-muted-foreground">
                      (Optional)
                    </span>
                  </label>
                  <div className="gap-4 p-4 max-w-xl flex items-center rounded-xl border border-border bg-background">
                    <button
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => logoInputRef.current?.click()}
                      className="h-16 w-16 relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border-strong bg-surface-raised transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
                      aria-label="Upload workspace logo"
                    >
                      {currentAvatarUrl ? (
                        <img
                          src={currentAvatarUrl}
                          alt="Workspace logo preview"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImagePlus className="h-6 w-6 text-muted-foreground" />
                      )}
                    </button>

                    <div className="min-w-0 flex-1">
                      {isAdmin && (
                        <div className="gap-2 flex flex-wrap items-center">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => logoInputRef.current?.click()}
                            className="h-8 text-xs border-border-strong bg-surface-raised text-foreground hover:bg-selected"
                          >
                            <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
                            {currentAvatarUrl ? 'Replace' : 'Upload image'}
                          </Button>
                          {currentAvatarUrl && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={handleRemoveLogo}
                              className="h-8 text-xs text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove
                            </Button>
                          )}
                        </div>
                      )}
                      <p className="text-xs mt-1.5 truncate text-muted-foreground">
                        {logoFile
                          ? logoFile.name
                          : 'PNG, JPEG, WebP or GIF · 256×256 px · up to 2 MB'}
                      </p>
                      {logoError && (
                        <p className="text-xs mt-1 text-destructive">
                          {logoError}
                        </p>
                      )}
                    </div>
                  </div>

                  <input
                    ref={logoInputRef}
                    type="file"
                    accept={WORKSPACE_LOGO_MIME_TYPES.join(',')}
                    className="hidden"
                    disabled={!isAdmin}
                    onChange={(event) =>
                      handleSelectLogo(event.target.files?.[0])
                    }
                  />
                </div>

                <div className="max-w-xl space-y-5">
                  <FormField
                    control={workspaceForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">
                          Workspace Name
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder="e.g. Acme Corp, Design System Team"
                            disabled={!isAdmin}
                            className="h-9 text-xs"
                            onChange={(event) => {
                              field.onChange(event);
                              if (slugTouched) return;
                              const derived = slugify(event.target.value).slice(
                                0,
                                40,
                              );
                              if (derived) {
                                workspaceForm.setValue('slug', derived, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                });
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Workspace URL Slug — routing is path-based (`/w/:slug`),
                      so the field shows the real host as a prefix. */}
                  <FormField
                    control={workspaceForm.control}
                    name="slug"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">
                          Workspace URL
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            onChange={(event) => {
                              setSlugTouched(true);
                              field.onChange(
                                event.target.value
                                  .toLowerCase()
                                  .replace(/[^a-z0-9-]/g, '-'),
                              );
                            }}
                            prefix={`${window.location.host}/w/`}
                            spellCheck={false}
                            autoComplete="off"
                            maxLength={40}
                            disabled={!isAdmin}
                            className="h-9 text-xs font-mono"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="-mt-3 space-y-1.5">
                    <div className="text-xs gap-2 flex items-center justify-between text-muted-foreground">
                      <span className="gap-1.5 min-w-0 flex items-center">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                        <span className="truncate">
                          Live at{' '}
                          <code className="font-mono text-primary">
                            {window.location.host}/w/{workspace.slug}
                          </code>
                          {workspaceForm.watch('slug') &&
                            workspaceForm.watch('slug') !== workspace.slug && (
                              <>
                                {' '}
                                → will change to{' '}
                                <code className="font-mono text-primary">
                                  /w/{workspaceForm.watch('slug')}
                                </code>{' '}
                                on save
                              </>
                            )}
                        </span>
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCopySlugUrl}
                        className="h-6 px-2 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        {copiedSlug ? (
                          <>
                            <Check className="h-3 w-3 text-success" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3 w-3" /> Copy link
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <FormField
                    control={workspaceForm.control}
                    name="supportEmail"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">
                          Support / Contact Email
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            type="email"
                            placeholder="e.g. support@yourcompany.com"
                            disabled={!isAdmin}
                            className="h-9 text-xs"
                          />
                        </FormControl>
                        <FormDescription className="text-[11px]">
                          Contact address displayed to invited members and
                          helpdesk notifications.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={workspaceForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">
                          Description
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            rows={3}
                            placeholder="e.g. All projects, teams, and collaboration for our organization"
                            disabled={!isAdmin}
                            className="text-xs"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </SettingsCard>

              {/* CARD 2: Workspace Preferences */}
              <SettingsCard>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Workspace Preferences
                  </h3>
                  <p className="text-xs mt-0.5 text-muted-foreground">
                    Customize default navigation and sharing capabilities across
                    your team.
                  </p>
                </div>

                <div className="max-w-xl space-y-5">
                  <FormField
                    control={workspaceForm.control}
                    name="defaultLandingView"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">
                          Default Landing View
                        </FormLabel>
                        <Select
                          value={field.value ?? 'home'}
                          onValueChange={field.onChange}
                          disabled={!isAdmin}
                        >
                          <FormControl>
                            <SelectTrigger className="h-9 text-xs">
                              <SelectValue placeholder="Select default view" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="home">
                              Workspace Home (Dashboard)
                            </SelectItem>
                            <SelectItem value="projects">
                              Projects & Sprints
                            </SelectItem>
                            <SelectItem value="tasks">Kanban Tasks</SelectItem>
                            <SelectItem value="chat">Chat Channels</SelectItem>
                            <SelectItem value="docs">
                              Documents & Knowledge Base
                            </SelectItem>
                            <SelectItem value="meetings">
                              Video Meetings
                            </SelectItem>
                            <SelectItem value="agents">
                              AI Agents & Workflows
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-[11px]">
                          The initial view members see upon switching to or
                          opening this workspace.
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <div className="pt-2 space-y-4 border-t border-border/40">
                    <FormField
                      control={workspaceForm.control}
                      name="allowExternalSharing"
                      render={({ field }) => (
                        <FormItem className="p-4 flex items-center justify-between rounded-xl border border-border bg-background">
                          <div className="space-y-0.5 pr-4">
                            <FormLabel className="text-xs font-medium cursor-pointer">
                              External Public Sharing
                            </FormLabel>
                            <FormDescription className="text-[11px]">
                              Allow members to create view-only public links for
                              documents, canvases, and roadmaps.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value ?? true}
                              onCheckedChange={field.onChange}
                              disabled={!isAdmin}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={workspaceForm.control}
                      name="aiProjectRecaps"
                      render={({ field }) => (
                        <FormItem className="p-4 flex items-center justify-between rounded-xl border border-border bg-background">
                          <div className="space-y-0.5 pr-4">
                            <FormLabel className="text-xs font-medium cursor-pointer">
                              AI Project Recaps & Activity Digest
                            </FormLabel>
                            <FormDescription className="text-[11px]">
                              Automatically generate weekly AI project progress
                              digests and action item summaries.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value ?? true}
                              onCheckedChange={field.onChange}
                              disabled={!isAdmin}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </SettingsCard>

              {isAdmin ? (
                <div className="bottom-4 gap-3 px-4 py-3 backdrop-blur sticky z-10 flex items-center justify-between rounded-xl border border-border bg-background/95 shadow-sm">
                  <p className="text-xs text-muted-foreground">
                    {isWorkspaceDirty
                      ? 'You have unsaved changes.'
                      : 'All changes saved.'}
                  </p>
                  <div className="gap-2 flex items-center">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={discardWorkspaceChanges}
                      disabled={!isWorkspaceDirty || isSavingWorkspace}
                      className="text-xs"
                    >
                      Discard
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      loading={isSavingWorkspace}
                      disabled={!isWorkspaceDirty}
                      className="text-xs font-medium"
                    >
                      Save changes
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Only workspace admins can change these settings.
                </p>
              )}
            </form>
          </Form>
        </div>
      )}

      {/* ---------------- SECTION 9: ACCOUNT SECURITY ---------------- */}
      {currentTab === 'security' && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Account Security & Access</>}
            description={
              <>
                Manage authentication credentials, two-factor factors, and
                active sessions across your devices.
              </>
            }
          />

          {/* SECURITY CHECKUP — every line is derived from the real
              security overview; nothing here is decorative. */}
          {(() => {
            const overview = securityOverviewQuery.data;
            if (!overview) {
              return (
                <SettingsCard>
                  <LoadingState />
                </SettingsCard>
              );
            }
            const passkeys =
              webAuthnQuery.data?.length ?? overview.passkeysCount;
            const checks: Array<{
              key: string;
              ok: boolean;
              title: string;
              detail: string;
              action?: ReactNode;
            }> = [
              {
                key: 'password',
                ok: overview.password.hasPassword || passkeys > 0,
                title: overview.password.hasPassword
                  ? 'Password set'
                  : 'No password',
                detail: overview.password.hasPassword
                  ? overview.password.lastChangedAt
                    ? `Last changed ${new Date(overview.password.lastChangedAt).toLocaleDateString()}`
                    : 'Not changed since you created it'
                  : 'You sign in with an email link, Google/Apple or a passkey.',
                action: (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setChangePasswordModalOpen(true)}
                  >
                    {overview.password.hasPassword ? 'Change' : 'Set password'}
                  </Button>
                ),
              },
              {
                key: '2fa',
                ok: overview.twoFactor.isEnabled,
                title: overview.twoFactor.isEnabled
                  ? 'Two-factor authentication on'
                  : 'Two-factor authentication off',
                detail: overview.twoFactor.isEnabled
                  ? overview.twoFactor.isEnforced
                    ? 'Required by your workspace.'
                    : 'A code from your authenticator app is required at sign-in.'
                  : 'Add a second step so a stolen password is not enough.',
                action: overview.twoFactor.isEnabled ? undefined : (
                  <Button
                    size="sm"
                    onClick={handleStartTotpSetup}
                    loading={setupTotpMutation.isPending}
                  >
                    Turn on
                  </Button>
                ),
              },
              ...(overview.twoFactor.isEnabled
                ? [
                    {
                      key: 'recovery',
                      ok: overview.twoFactor.hasBackupCodes,
                      title: overview.twoFactor.hasBackupCodes
                        ? 'Recovery codes saved'
                        : 'No recovery codes',
                      detail:
                        'One-time codes that get you in if you lose your phone.',
                      action: overview.twoFactor.hasBackupCodes ? undefined : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleGenerateRecoveryCodes}
                          loading={regenerateRecoveryMutation.isPending}
                        >
                          Generate
                        </Button>
                      ),
                    },
                  ]
                : []),
              {
                key: 'passkeys',
                ok: passkeys > 0,
                title:
                  passkeys > 0
                    ? `${passkeys} passkey${passkeys === 1 ? '' : 's'}`
                    : 'No passkeys',
                detail:
                  'Sign in with Face ID, Touch ID, Windows Hello or a security key.',
                action:
                  passkeys > 0 || !browserSupportsPasskeys() ? undefined : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddPasskeyModalOpen(true)}
                    >
                      Add
                    </Button>
                  ),
              },
            ];
            const passed = checks.filter((c) => c.ok).length;
            const allGood = passed === checks.length;
            const sessions = overview.activeSessionsCount;

            return (
              <div className="space-y-3">
                <div className="gap-3 px-1 flex flex-wrap items-end justify-between">
                  <div>
                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Security checkup
                    </h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {allGood
                        ? 'Your account is well protected.'
                        : `${passed} of ${checks.length} protections in place.`}
                      {sessions > 0 &&
                        ` Signed in on ${sessions} device${sessions === 1 ? '' : 's'}.`}
                    </p>
                  </div>
                  <div
                    className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-inset"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={checks.length}
                    aria-valuenow={passed}
                    aria-label="Security checkup progress"
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        allGood ? 'bg-success' : 'bg-warning',
                      )}
                      style={{ width: `${(passed / checks.length) * 100}%` }}
                    />
                  </div>
                </div>
                <SettingsCard divided>
                  {checks.map((check) => (
                    <SettingsRow
                      key={check.key}
                      icon={
                        check.ok ? (
                          <CheckCircle2 className="text-success" />
                        ) : (
                          <Shield className="text-warning-text" />
                        )
                      }
                      title={check.title}
                      description={check.detail}
                    >
                      {check.action}
                    </SettingsRow>
                  ))}
                  {(overview.sso.isConnected ||
                    overview.sso.isOrganizationManaged) && (
                    <SettingsRow
                      icon={<Globe />}
                      title="Single sign-on"
                      description={
                        overview.sso.isConnected
                          ? `Connected via ${overview.sso.providerType || 'your identity provider'}`
                          : 'Your organization manages sign-in for this account.'
                      }
                      badge={
                        overview.sso.isConnected ? (
                          <SettingsBadge tone="success">
                            Connected
                          </SettingsBadge>
                        ) : null
                      }
                    >
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTabChange('enterprise-identity')}
                        >
                          Manage
                        </Button>
                      )}
                    </SettingsRow>
                  )}
                </SettingsCard>
              </div>
            );
          })()}

          {/* SIGN-IN METHODS SECTION */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Sign-in Methods
            </h2>
            <SettingsCard divided>
              {/* Email / Password Row */}
              <div className="p-5 sm:flex-row sm:items-center gap-4 flex flex-col justify-between">
                <div className="gap-4 flex items-start">
                  <div className="h-10 w-10 flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-foreground">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="gap-2 flex items-center">
                      <h4 className="text-xs font-semibold text-foreground">
                        Email & Password
                      </h4>
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-medium text-[10px]',
                          securityOverviewQuery.data?.password.hasPassword
                            ? 'border-success/20 bg-success/10 text-success-text'
                            : 'border-border bg-muted/40 text-muted-foreground',
                        )}
                      >
                        {securityOverviewQuery.data?.password.hasPassword
                          ? 'Configured'
                          : 'No password set'}
                      </Badge>
                    </div>
                    <p className="mt-1 max-w-lg text-[11px] text-muted-foreground">
                      Sign in using your work email address and secure password.
                    </p>
                  </div>
                </div>
                <div className="gap-2 flex shrink-0 items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setChangePasswordModalOpen(true)}
                    className="text-xs h-8"
                  >
                    {securityOverviewQuery.data?.password.hasPassword
                      ? 'Change password'
                      : 'Set password'}
                  </Button>
                </div>
              </div>

              {/* Google Row */}
              <div className="p-5 sm:flex-row sm:items-center gap-4 flex flex-col justify-between">
                <div className="gap-4 flex items-start">
                  <div className="h-10 w-10 flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-foreground">
                    <svg
                      className="size-5 shrink-0"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                      />
                    </svg>
                  </div>
                  <div>
                    <div className="gap-2 flex items-center">
                      <h4 className="text-xs font-semibold text-foreground">
                        Google
                      </h4>
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-medium text-[10px]',
                          securityOverviewQuery.data?.socialProviders?.google
                            .isConnected
                            ? 'border-success/20 bg-success/10 text-success-text'
                            : 'border-border bg-muted/40 text-muted-foreground',
                        )}
                      >
                        {securityOverviewQuery.data?.socialProviders?.google
                          .isConnected
                          ? 'Connected'
                          : 'Not connected'}
                      </Badge>
                    </div>
                    <p className="mt-1 max-w-lg text-[11px] text-muted-foreground">
                      {securityOverviewQuery.data?.socialProviders?.google
                        .isConnected
                        ? `Connected with ${securityOverviewQuery.data.socialProviders.google.email || 'Google account'}.`
                        : 'Sign in to Onetab AI using your Google account.'}
                    </p>
                  </div>
                </div>
                <div className="gap-2 flex shrink-0 items-center">
                  {securityOverviewQuery.data?.socialProviders?.google
                    .isConnected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnectProvider('google')}
                      loading={disconnectingProvider === 'google'}
                      className="text-xs h-8 text-destructive hover:text-destructive"
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleConnectProvider('google')}
                      loading={connectingProvider === 'google'}
                      className="text-xs h-8"
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>

              {/* Apple Row */}
              <div className="p-5 sm:flex-row sm:items-center gap-4 flex flex-col justify-between">
                <div className="gap-4 flex items-start">
                  <div className="h-10 w-10 flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-foreground">
                    <svg
                      className="size-5 shrink-0 fill-current text-foreground"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.87-.96.04-2.12.64-2.79 1.43-.59.68-1.11 1.77-1.03 2.83 1.07.08 2.19-.58 2.81-1.39z" />
                    </svg>
                  </div>
                  <div>
                    <div className="gap-2 flex items-center">
                      <h4 className="text-xs font-semibold text-foreground">
                        Apple
                      </h4>
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-medium text-[10px]',
                          securityOverviewQuery.data?.socialProviders?.apple
                            .isConnected
                            ? 'border-success/20 bg-success/10 text-success-text'
                            : 'border-border bg-muted/40 text-muted-foreground',
                        )}
                      >
                        {securityOverviewQuery.data?.socialProviders?.apple
                          .isConnected
                          ? 'Connected'
                          : 'Not connected'}
                      </Badge>
                    </div>
                    <p className="mt-1 max-w-lg text-[11px] text-muted-foreground">
                      {securityOverviewQuery.data?.socialProviders?.apple
                        .isConnected
                        ? `Connected with ${securityOverviewQuery.data.socialProviders.apple.email || 'Apple ID'}.`
                        : 'Sign in to Onetab AI using Sign in with Apple.'}
                    </p>
                  </div>
                </div>
                <div className="gap-2 flex shrink-0 items-center">
                  {securityOverviewQuery.data?.socialProviders?.apple
                    .isConnected ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDisconnectProvider('apple')}
                      loading={disconnectingProvider === 'apple'}
                      className="text-xs h-8 text-destructive hover:text-destructive"
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void handleConnectProvider('apple')}
                      loading={connectingProvider === 'apple'}
                      className="text-xs h-8"
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            </SettingsCard>
          </div>

          {/* 2. AUTHENTICATION FACTORS SECTION */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Authentication Factors
            </h2>
            <SettingsCard divided>
              {/* Authenticator TOTP Row */}
              <div className="p-5 sm:flex-row sm:items-center gap-4 flex flex-col justify-between">
                <div className="gap-4 flex items-start">
                  <div className="h-10 w-10 flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-foreground">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="gap-2 flex items-center">
                      <h4 className="text-xs font-semibold text-foreground">
                        Authenticator App (TOTP)
                      </h4>
                      <Badge
                        variant="outline"
                        className={cn(
                          'font-medium text-[10px]',
                          securityOverviewQuery.data?.twoFactor.isEnabled
                            ? 'border-success/20 bg-success/10 text-success-text'
                            : 'border-border bg-muted/40 text-muted-foreground',
                        )}
                      >
                        {securityOverviewQuery.data?.twoFactor.isEnabled
                          ? 'Configured'
                          : 'Not configured'}
                      </Badge>
                    </div>
                    <p className="mt-1 max-w-lg text-[11px] text-muted-foreground">
                      Use apps like Google Authenticator, 1Password, Authy, or
                      Apple Keychain to generate verification codes.
                    </p>
                  </div>
                </div>
                <div className="gap-2 flex shrink-0 items-center">
                  {securityOverviewQuery.data?.twoFactor.isEnabled ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setDisableTotpModalOpen(true)}
                      className="text-xs h-8 text-destructive hover:text-destructive"
                    >
                      Disable
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleStartTotpSetup}
                      loading={setupTotpMutation.isPending}
                      className="text-xs h-8"
                    >
                      Set up app
                    </Button>
                  )}
                </div>
              </div>

              {/* Passkeys / WebAuthn Row */}
              <div className="p-5 sm:flex-row sm:items-center gap-4 flex flex-col justify-between">
                <div className="gap-4 flex items-start">
                  <div className="h-10 w-10 flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-foreground">
                    <Key className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="gap-2 flex items-center">
                      <h4 className="text-xs font-semibold text-foreground">
                        Passkeys & Security Keys (WebAuthn)
                      </h4>
                      <Badge
                        variant="outline"
                        className="font-medium border-border bg-muted/40 text-[10px] text-muted-foreground"
                      >
                        {webAuthnQuery.data?.length ?? 0} registered
                      </Badge>
                    </div>
                    <p className="mt-1 max-w-lg text-[11px] text-muted-foreground">
                      Sign in seamlessly using biometric hardware (Touch ID,
                      Face ID, Windows Hello) or physical FIDO2 keys.
                    </p>
                    {/* List registered passkeys */}
                    {webAuthnQuery.data && webAuthnQuery.data.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {webAuthnQuery.data.map((key) => (
                          <div
                            key={key.id}
                            className="text-xs p-2 max-w-md flex items-center justify-between rounded-lg border border-border bg-background"
                          >
                            <div className="gap-2 flex items-center">
                              <Key className="h-3.5 w-3.5 text-primary" />
                              <span className="font-medium text-foreground">
                                {key.deviceName || 'Security Key'}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                • Added{' '}
                                {new Date(key.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                void confirm({
                                  title: `Remove the passkey “${
                                    key.deviceName || 'Security Key'
                                  }”?`,
                                  description:
                                    'You can no longer sign in with this passkey. Make sure you have another way in first.',
                                  confirmLabel: 'Remove passkey',
                                  destructive: true,
                                }).then((ok) => {
                                  if (ok) deleteWebAuthnMutation.mutate(key.id);
                                });
                              }}
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddPasskeyModalOpen(true)}
                    disabled={!browserSupportsPasskeys()}
                    title={
                      browserSupportsPasskeys()
                        ? undefined
                        : 'This browser does not support passkeys'
                    }
                    className="text-xs h-8"
                  >
                    Add passkey
                  </Button>
                </div>
              </div>

              {/* Recovery Codes Row */}
              <div className="p-5 sm:flex-row sm:items-center gap-4 flex flex-col justify-between">
                <div className="gap-4 flex items-start">
                  <div className="h-10 w-10 flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-foreground">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="gap-2 flex items-center">
                      <h4 className="text-xs font-semibold text-foreground">
                        Backup Recovery Codes
                      </h4>
                      <Badge
                        variant="outline"
                        className="font-medium border-border bg-muted/40 text-[10px] text-muted-foreground"
                      >
                        Emergency access
                      </Badge>
                    </div>
                    <p className="mt-1 max-w-lg text-[11px] text-muted-foreground">
                      One-time use backup codes for account recovery when your
                      phone or authenticator device is unavailable.
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateRecoveryCodes}
                    loading={regenerateRecoveryMutation.isPending}
                    className="text-xs h-8"
                  >
                    View & Generate codes
                  </Button>
                </div>
              </div>
            </SettingsCard>
          </div>

          {/* 3. ACTIVE SESSIONS SECTION */}
          <div className="space-y-4">
            <div className="sm:flex-row sm:items-center gap-3 flex flex-col justify-between">
              <div>
                <div className="gap-2 flex items-center">
                  <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Active Sessions
                  </h2>
                  <Badge
                    variant="outline"
                    className="font-medium border-primary/20 bg-primary/10 text-[10px] text-primary"
                  >
                    {sessionsQuery.data?.length ?? 1} signed in
                  </Badge>
                </div>
                <p className="text-xs mt-0.5 text-muted-foreground">
                  Devices authenticated with your account. Revoke any
                  unrecognized sessions immediately.
                </p>
              </div>
              {(sessionsQuery.data?.length ?? 0) > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRevokeOtherModalOpen(true)}
                  className="text-xs h-8 border-destructive/30 text-destructive hover:text-destructive"
                >
                  <LogOut className="h-3.5 w-3.5 mr-1.5" />
                  Revoke other sessions
                </Button>
              )}
            </div>

            <SettingsCard divided>
              {sessionsQuery.isLoading ? (
                <div className="p-8 text-xs text-center text-muted-foreground">
                  Loading active sessions...
                </div>
              ) : sessionsQuery.data && sessionsQuery.data.length > 0 ? (
                sessionsQuery.data.map((sess) => {
                  const DeviceIcon =
                    sess.deviceType === 'mobile'
                      ? Smartphone
                      : sess.deviceType === 'tablet'
                        ? Tablet
                        : Laptop;

                  return (
                    <div
                      key={sess.id}
                      className="p-5 sm:flex-row sm:items-center gap-4 flex flex-col justify-between"
                    >
                      <div className="gap-4 flex items-start">
                        <div className="h-10 w-10 flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-foreground">
                          <DeviceIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="gap-2 flex items-center">
                            <h4 className="text-xs font-semibold text-foreground">
                              {sess.browser} on {sess.os}
                            </h4>
                            {sess.isCurrent && (
                              <Badge className="font-semibold bg-primary text-[10px] text-primary-foreground">
                                Current session
                              </Badge>
                            )}
                          </div>
                          <div className="mt-1 gap-2 flex flex-wrap items-center text-[11px] text-muted-foreground">
                            <span>{sess.location}</span>
                            <span>•</span>
                            <span className="font-mono">
                              {sess.ipAddress || '127.0.0.1'}
                            </span>
                            <span>•</span>
                            <span>
                              Signed in{' '}
                              {new Date(sess.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="gap-2 flex shrink-0 items-center">
                        {sess.isCurrent ? (
                          <span className="text-xs px-2 text-muted-foreground italic">
                            This device
                          </span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRevokeModalSession(sess)}
                            className="text-xs h-8 border-border text-destructive hover:text-destructive"
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-xs text-center text-muted-foreground">
                  No active sessions found.
                </div>
              )}
            </SettingsCard>
          </div>

          {/* 4. MATRIX END-TO-END ENCRYPTION & KEY BACKUP */}
          {encryptionSecurityPanel}
        </div>
      )}

      {currentTab === 'danger' && isOwner && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-destructive">
              Danger Zone
            </h1>
            <p className="text-xs mt-1 text-muted-foreground">
              Archiving is reversible. Deletion is not.
            </p>
          </div>

          {/*
            Archive sits above delete deliberately: it answers most of the same
            need — stop this workspace being used — without discarding anything,
            so it should be the one the eye reaches first.
          */}
          {isArchived ? (
            <div className="p-6 space-y-4 rounded-xl border border-border bg-muted/40">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Restore Workspace
                </h3>
                <p className="text-xs mt-1 max-w-lg text-muted-foreground">
                  <strong className="text-foreground">{workspace.name}</strong>{' '}
                  is archived. Everyone can still read it, but nobody can make
                  changes until it is restored.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                loading={setArchived.isPending}
                onClick={() => setArchived.mutate(false)}
                className="text-xs"
              >
                Restore workspace
              </Button>
            </div>
          ) : (
            <div className="p-6 space-y-4 rounded-xl border border-border bg-muted/40">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Archive Workspace
                </h3>
                <p className="text-xs mt-1 max-w-lg text-muted-foreground">
                  Freeze{' '}
                  <strong className="text-foreground">{workspace.name}</strong>.
                  Members keep read access to every channel, document and file,
                  but no one can make changes. Nothing is deleted, and you can
                  restore it at any time.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                loading={setArchived.isPending}
                onClick={() => setArchived.mutate(true)}
                className="text-xs"
              >
                Archive workspace
              </Button>
            </div>
          )}

          <div className="p-6 space-y-4 rounded-xl border border-destructive/30 bg-destructive/5">
            <div>
              <h3 className="text-sm font-semibold text-destructive">
                Delete Workspace
              </h3>
              <p className="text-xs mt-1 max-w-lg text-muted-foreground">
                Permanently delete{' '}
                <strong className="text-foreground">{workspace.name}</strong>,
                including all channels, activity logs, documents, and
                integrations.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              loading={deleteWorkspace.isPending}
              onClick={async () => {
                const ok = await confirm({
                  title: `Delete ${workspace.name}?`,
                  description: `This permanently deletes ${workspace.channelCount} channels and removes ${workspace.memberCount} members.`,
                  destructive: true,
                  requireText: workspace.slug,
                  confirmLabel: 'Delete forever',
                });
                if (ok) deleteWorkspace.mutate(workspace.id);
              }}
              className="text-xs"
            >
              Delete workspace
            </Button>
          </div>
        </div>
      )}

      {/* 1. Change Password Dialog */}
      <Dialog
        open={changePasswordModalOpen}
        onOpenChange={setChangePasswordModalOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a strong new password.
            </DialogDescription>
          </DialogHeader>

          <Form {...passwordForm}>
            <form onSubmit={onPasswordSubmit}>
              <DialogBody className="space-y-4">
                <FormError error={formErrorMessage(changePassword.error)} />

                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">
                        Current password
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="current-password"
                          className="h-9 text-xs"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">
                        New password
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="new-password"
                          className="h-9 text-xs"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">
                        Confirm new password
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="new-password"
                          className="h-9 text-xs"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </DialogBody>

              <DialogFooter>
                <DialogClose asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                </DialogClose>
                <Button
                  type="submit"
                  size="sm"
                  loading={changePassword.isPending}
                  disabled={!passwordForm.formState.isDirty}
                  className="text-xs"
                >
                  Update password
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* 2. TOTP Setup / Verification Dialog */}
      <Dialog open={totpSetupModalOpen} onOpenChange={setTotpSetupModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Up Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              Scan the setup code or enter the key manually into your
              authenticator app.
            </DialogDescription>
          </DialogHeader>

          {totpBackupCodes ? (
            <DialogBody className="space-y-4">
              <div className="p-3 text-xs rounded-lg border border-success/20 bg-success/10 text-success-text">
                Two-factor authentication is now active! Please save these
                emergency recovery codes in a safe place.
              </div>
              <div className="gap-2 p-3 text-xs grid grid-cols-2 rounded-xl border border-border bg-muted/40 text-center font-mono">
                {totpBackupCodes.map((code, idx) => (
                  <div
                    key={idx}
                    className="p-1.5 rounded border border-border/60 bg-background"
                  >
                    {code}
                  </div>
                ))}
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(totpBackupCodes.join('\n'));
                    toast.success('Backup codes copied');
                  }}
                  className="text-xs"
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" />
                  Copy all codes
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setTotpSetupModalOpen(false)}
                  className="text-xs"
                >
                  Done
                </Button>
              </DialogFooter>
            </DialogBody>
          ) : (
            <DialogBody className="space-y-4">
              <div className="p-3 space-y-2 rounded-xl border border-border bg-muted/40">
                <p className="text-xs text-muted-foreground">
                  Manual secret key:
                </p>
                <div className="gap-2 p-2 flex items-center justify-between rounded-lg border border-border bg-background">
                  <code className="text-xs font-mono break-all text-primary select-all">
                    {totpSetupData?.secret || 'Generating secret...'}
                  </code>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (totpSetupData?.secret) {
                        navigator.clipboard.writeText(totpSetupData.secret);
                        setTotpCopiedSecret(true);
                        setTimeout(() => setTotpCopiedSecret(false), 2000);
                        toast.success('Secret copied');
                      }
                    }}
                    className="h-7 px-2 text-xs shrink-0"
                  >
                    {totpCopiedSecret ? (
                      <Check className="h-3.5 w-3.5 text-success" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium block text-foreground">
                  6-Digit Verification Code
                </label>
                <Input
                  value={totpCodeInput}
                  onChange={(e) =>
                    setTotpCodeInput(
                      e.target.value.replace(/\D/g, '').slice(0, 6),
                    )
                  }
                  placeholder="000000"
                  maxLength={6}
                  className="h-10 text-base tracking-widest text-center font-mono"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setTotpSetupModalOpen(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  loading={verifyTotpMutation.isPending}
                  disabled={totpCodeInput.length !== 6}
                  onClick={handleVerifyTotp}
                  className="text-xs"
                >
                  Verify and Enable
                </Button>
              </DialogFooter>
            </DialogBody>
          )}
        </DialogContent>
      </Dialog>

      {/* 3. Disable TOTP Dialog */}
      <Dialog
        open={disableTotpModalOpen}
        onOpenChange={setDisableTotpModalOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication?</DialogTitle>
            <DialogDescription>
              Turning off 2FA reduces your account security. Confirm your
              password to proceed.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium block text-foreground">
                Current Password
              </label>
              <Input
                type="password"
                value={disableTotpPassword}
                onChange={(e) => setDisableTotpPassword(e.target.value)}
                placeholder="Enter password"
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDisableTotpModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                loading={disableTotpMutation.isPending}
                onClick={handleConfirmDisableTotp}
                className="text-xs"
              >
                Disable 2FA
              </Button>
            </DialogFooter>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* 4. Recovery Codes Dialog */}
      <Dialog
        open={recoveryCodesModalOpen}
        onOpenChange={setRecoveryCodesModalOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Backup Recovery Codes</DialogTitle>
            <DialogDescription>
              Each code can only be used once. Store these safely.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="gap-2 p-3 text-xs grid grid-cols-2 rounded-xl border border-border bg-muted/40 text-center font-mono">
              {recoveryCodesList.map((code, idx) => (
                <div
                  key={idx}
                  className="p-1.5 rounded border border-border/60 bg-background"
                >
                  {code}
                </div>
              ))}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(recoveryCodesList.join('\n'));
                  toast.success('Recovery codes copied');
                }}
                className="text-xs"
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" />
                Copy codes
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => setRecoveryCodesModalOpen(false)}
                className="text-xs"
              >
                Done
              </Button>
            </DialogFooter>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* 5. Add Passkey Dialog */}
      <Dialog open={addPasskeyModalOpen} onOpenChange={setAddPasskeyModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register New Passkey</DialogTitle>
            <DialogDescription>
              Name it so you can recognise it later. Your browser will then ask
              you to confirm with your device (Touch ID, Windows Hello, phone)
              or a security key.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium block text-foreground">
                Device / Key Name
              </label>
              <Input
                value={passkeyDeviceName}
                onChange={(e) => setPasskeyDeviceName(e.target.value)}
                placeholder="e.g. MacBook Pro Touch ID, YubiKey 5"
                className="h-9 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAddPasskeyModalOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                loading={registerWebAuthnMutation.isPending}
                onClick={handleRegisterPasskey}
                className="text-xs"
              >
                Register Passkey
              </Button>
            </DialogFooter>
          </DialogBody>
        </DialogContent>
      </Dialog>

      {/* 6. Revoke Single Session Confirmation Dialog */}
      <Dialog
        open={Boolean(revokeModalSession)}
        onOpenChange={(open) => !open && setRevokeModalSession(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke Session?</DialogTitle>
            <DialogDescription>
              This will immediately sign out the session on{' '}
              <strong className="text-foreground">
                {revokeModalSession?.browser} on {revokeModalSession?.os}
              </strong>{' '}
              ({revokeModalSession?.ipAddress || 'Unknown IP'}).
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRevokeModalSession(null)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              loading={revokeSessionMutation.isPending}
              onClick={async () => {
                if (revokeModalSession) {
                  try {
                    await revokeSessionMutation.mutateAsync(
                      revokeModalSession.id,
                    );
                    setRevokeModalSession(null);
                    toast.success('Session revoked successfully');
                  } catch {
                    toast.error('Failed to revoke session');
                  }
                }
              }}
              className="text-xs"
            >
              Revoke session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 7. Revoke Other Sessions Confirmation Dialog */}
      <Dialog
        open={revokeOtherModalOpen}
        onOpenChange={setRevokeOtherModalOpen}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke All Other Sessions?</DialogTitle>
            <DialogDescription>
              This will sign out your account from all other browsers and
              devices. Only your current session will remain active.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setRevokeOtherModalOpen(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              loading={revokeOtherSessionsMutation.isPending}
              onClick={async () => {
                try {
                  await revokeOtherSessionsMutation.mutateAsync();
                  setRevokeOtherModalOpen(false);
                  toast.success('All other sessions revoked successfully');
                } catch {
                  toast.error('Failed to revoke other sessions');
                }
              }}
              className="text-xs"
            >
              Revoke all other sessions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SettingsLayout>
  );
}
