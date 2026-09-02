import { zodResolver } from '@hookform/resolvers/zod';
import { http, userApi } from '@org/api-client';
import { formErrorMessage, useAuthStore, useCurrentUser } from '@org/auth';
import { useTheme } from '@org/design-system';
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
  LoadingState,
  LocalTime,
  RegionSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  TimezoneSelect,
  UserAvatar,
  WorkspaceAvatar,
  toast,
  useFocusStore,
  useSidebarCustomizerStore,
  FOCUS_SOUND_OPTIONS,
  FOCUS_DURATION_OPTIONS,
  focusAudio,
  type FocusSoundType,
} from '@org/ui';
import {
  cn,
  describeTimezone,
  getRegionForTimezone,
  getSystemTimezone,
  getWorkingHoursStatus,
  initials,
  type RegionInfo,
} from '@org/utils';
import {
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
import { useMutation } from '@tanstack/react-query';
import {
  Bell,
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
  Inbox,
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
  Lock,
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
  notify,
} from '@org/web-desktop';
import { useNotificationPermissionBar } from '@org/notifications';
import {
  useCurrentWorkspace,
  useDeleteWorkspace,
  useSetWorkspaceArchived,
  useUpdateWorkspace,
  useUploadWorkspaceLogo,
  useRemoveWorkspaceLogo,
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
} from '../use-workspaces.js';
import { SettingsLayout } from '../settings-layout.js';
import { WorkspaceMembersSettings } from '../components/workspace-members-settings.js';
import { WorkspaceBillingSettings } from '../components/workspace-billing-settings.js';
import { WorkspaceCompanyAnalytics } from '../components/workspace-company-analytics.js';
import { UpgradePlanBanner } from '../components/upgrade-plan-banner.js';
import { AIProvidersSettings } from '../components/ai-providers-settings.js';
import { EnterpriseCustomLLMSettings } from '../components/enterprise-custom-llm-settings.js';
import { ChatSettingsPanel } from '../components/chat-settings-panel.js';
import { NotificationDisplaySettingsPanel } from '../components/notification-display-settings-panel.js';
import {
  SettingsCard,
  SettingsRow,
  SettingsSectionHeader,
} from '../components/settings-primitives.js';

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
}

export function WorkspaceSettingsPage({
  importPanel,
  kanbanPanel,
  themePanel,
  profilePanel,
}: WorkspaceSettingsPageProps = {}) {
  const { workspace, workspaceId, isLoading } = useCurrentWorkspace();
  const updateWorkspace = useUpdateWorkspace(workspaceId);
  const uploadLogo = useUploadWorkspaceLogo(workspaceId);
  const removeLogo = useRemoveWorkspaceLogo(workspaceId);
  const deleteWorkspace = useDeleteWorkspace();
  const setArchived = useSetWorkspaceArchived(workspaceId);
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { workspaceSlug, section: routeSection } = useParams<{
    workspaceSlug: string;
    section: string;
  }>();
  const [searchParams] = useSearchParams();

  // Logo & slug states for General Settings
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [isLogoRemoved, setIsLogoRemoved] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);
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
    plans: 'billing',
    'timezone-region': 'profile',
    'focus-status': 'profile',
    'integrations/import': 'import-export',
  };
  const rawSection =
    routeSection ||
    searchParams.get('tab') ||
    searchParams.get('section') ||
    'appearance';
  const currentTab = SECTION_ALIASES[rawSection] ?? rawSection;

  const handleTabChange = (val: string) => {
    if (!workspaceSlug) return;
    navigate(`/w/${workspaceSlug}/settings/${val}`);
  };

  // Preference Settings States
  const [homeView, setHomeView] = useState('agent');
  const [displayNamePref, setDisplayNamePref] = useState('username');
  const [firstDay, setFirstDay] = useState('monday');
  const [convertEmojis, setConvertEmojis] = useState(true);
  const [sendShortcut, setSendShortcut] = useState('ctrl-enter');
  const [fontSize, setFontSize] = useState('default');

  // AI & Persona Settings States
  const [defaultModel, setDefaultModel] = useState('gpt-4o');
  const [tempSetting, setTempSetting] = useState('balanced');
  const [contextWindow, setContextWindow] = useState('128k');
  const [agentAutoApprove, setAgentAutoApprove] = useState(true);
  const [allowWebSearch, setAllowWebSearch] = useState(true);
  const [allowFileSystem, setAllowFileSystem] = useState(true);
  const [maxTurns, setMaxTurns] = useState('25');
  const [systemPrompt, setSystemPrompt] = useState(
    'You are Antigravity AI, an intelligent collaborative assistant designed for software development and workspace productivity.',
  );

  // Notifications States. Per-category toggles (mentions / invites / agent
  // alerts) now live in <NotificationDisplaySettingsPanel>, which is backed by
  // the notification-preferences API.
  const [notifyDigest, setNotifyDigest] = useState(false);
  const [notifyDesktopPush, setNotifyDesktopPush] = useState(true);
  const [notifyChannelScope, setNotifyChannelScope] = useState('all');
  const [testNotifSending, setTestNotifSending] = useState(false);
  const [testNotifSent, setTestNotifSent] = useState(false);
  const notifBarState = useNotificationPermissionBar();

  // Work Tools Feature States
  const [defaultChannel, setDefaultChannel] = useState('general');
  const [allowPublicCreation, setAllowPublicCreation] = useState(true);
  const [allowPrivateCreation, setAllowPrivateCreation] = useState(true);
  const [archiveInactiveDays, setArchiveInactiveDays] = useState('90');
  const [encryptedDM, setEncryptedDM] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);

  const [docAutoSave, setDocAutoSave] = useState(true);
  const [grammarAssistance, setGrammarAssistance] = useState(true);
  const [codeSyntaxTheme, setCodeSyntaxTheme] = useState('github-dark');

  const [highQualityVideo, setHighQualityVideo] = useState(true);
  const [fileRetention, setFileRetention] = useState('forever');

  const [googleCalendarSync, setGoogleCalendarSync] = useState(true);
  const [meetingProvider, setMeetingProvider] = useState('onetab-meet');
  const [autoRecordMeetings, setAutoRecordMeetings] = useState(false);

  const [trackOnlineStatus, setTrackOnlineStatus] = useState(true);
  const [trackCommitsInPulse, setTrackCommitsInPulse] = useState(true);

  // Workflow Automations States
  const [githubPRWebhook, setGithubPRWebhook] = useState(true);
  const [channelTrigger, setChannelTrigger] = useState(true);
  const [maxConcurrentRuns, setMaxConcurrentRuns] = useState('5');
  const [retryFailedSteps, setRetryFailedSteps] = useState(true);

  // Dialog & Notification States
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const openStatusModal = useFocusStore((s) => s.openStatusModal);
  const openFocusModal = useFocusStore((s) => s.openFocusModal);
  const focusStore = useFocusStore();
  const [testSoundPlaying, setTestSoundPlaying] =
    useState<FocusSoundType | null>(null);

  // Timezone & Regional Preferences States
  const [timeFormatPref, setTimeFormatPref] = useState<'12h' | '24h'>('12h');
  const [dateFormatPref, setDateFormatPref] = useState<
    'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
  >('MM/DD/YYYY');
  const [workStartHour, setWorkStartHour] = useState('09:00');
  const [workEndHour, setWorkEndHour] = useState('18:00');
  const [workdays, setWorkdays] = useState('mon-fri');

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

  // Workspace Update Form
  const workspaceForm = useForm<UpdateWorkspaceInput>({
    resolver: zodResolver(updateWorkspaceSchema),
    values: {
      name: workspace?.name ?? '',
      slug: workspace?.slug ?? '',
      description: workspace?.description ?? '',
      avatarUrl: workspace?.avatarUrl ?? '',
      supportEmail: workspace?.supportEmail ?? '',
      accentColor: workspace?.accentColor ?? 'indigo',
      defaultLandingView: (workspace?.defaultLandingView as any) ?? 'home',
      allowExternalSharing: workspace?.allowExternalSharing ?? true,
      aiProjectRecaps: workspace?.aiProjectRecaps ?? true,
    },
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

  if (isLoading || !workspace) return <LoadingState fullPage />;

  const isAdmin = hasWorkspaceRole(workspace.role, WorkspaceRole.ADMIN);
  const isOwner = workspace.role === WorkspaceRole.OWNER;
  const isArchived = workspace.status === WorkspaceStatus.ARCHIVED;

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

  const onWorkspaceSubmit = workspaceForm.handleSubmit(async (values) => {
    try {
      if (isLogoRemoved && workspace?.avatarUrl) {
        await removeLogo.mutateAsync();
        setIsLogoRemoved(false);
      } else if (logoFile) {
        await uploadLogo.mutateAsync(logoFile);
        setLogoFile(null);
      }

      if (workspaceForm.formState.isDirty) {
        await updateWorkspace.mutateAsync({
          name: values.name,
          slug: values.slug || undefined,
          description: values.description || null,
          supportEmail: values.supportEmail || null,
          accentColor: values.accentColor || null,
          defaultLandingView: values.defaultLandingView || 'home',
          allowExternalSharing: values.allowExternalSharing,
          aiProjectRecaps: values.aiProjectRecaps,
        });
      }

      toast.success('Workspace settings updated successfully');
    } catch {
      // Rendered by <FormError>.
    }
  });

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
    const name = passkeyDeviceName.trim() || 'Security Key / Device Passkey';
    const fakeCredentialId = `cred_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const fakePublicKey = `pk_${Math.random().toString(36).slice(2, 16)}`;

    try {
      await registerWebAuthnMutation.mutateAsync({
        credentialId: fakeCredentialId,
        publicKey: fakePublicKey,
        deviceName: name,
        transports: ['internal', 'hybrid', 'usb'],
      });
      setAddPasskeyModalOpen(false);
      setPasskeyDeviceName('');
      toast.success('Passkey added successfully');
    } catch {
      toast.error('Failed to register passkey');
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

      {/* ---------------- SECTION 2: PROFILE, STATUS & REGION ---------------- */}
      {(currentTab === 'profile' ||
        currentTab === 'timezone-region' ||
        currentTab === 'focus-status') &&
        user && (
          <div className="space-y-8">
            <SettingsSectionHeader
              title={<>Profile & Details</>}
              description={
                <>
                  Manage your personal identity, status, focus preferences, and
                  working hours.
                </>
              }
            />

            {profilePanel ?? (
              <SettingsCard>
                <div className="sm:flex-row sm:items-center gap-4 pb-6 flex flex-col justify-between border-b border-border/40">
                  <div className="gap-5 flex items-center">
                    <UserAvatar
                      name={user.displayName ?? user.name}
                      src={profileForm.watch('avatarUrl') || user.avatarUrl}
                      seed={user.id}
                      size="xl"
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
                            {new Date(user.statusExpiresAt).toLocaleTimeString(
                              [],
                              { hour: '2-digit', minute: '2-digit' },
                            )}
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
                    <FormError error={formErrorMessage(updateProfile.error)} />

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
                            {initials(profileForm.watch('name') || user.name)}
                            &quot;.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/*
                  The timezone was in the form's values and in the API contract
                  all along, but had no control — so every account kept whatever
                {/* Timezone & Region Settings */}
                    <div className="space-y-4 pt-2 border-t border-border/50">
                      <div className="sm:grid-cols-2 gap-4 grid grid-cols-1">
                        {/* Region / Country Picker */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium text-foreground">
                            Region & Country
                          </label>
                          {(() => {
                            const currentTz =
                              profileForm.watch('timezone') || systemTimezone;
                            const currentRegion =
                              getRegionForTimezone(currentTz);

                            return (
                              <RegionSelect
                                value={currentRegion.code}
                                onChange={(region: RegionInfo) => {
                                  profileForm.setValue(
                                    'timezone',
                                    region.defaultTimezone,
                                    {
                                      shouldDirty: true,
                                    },
                                  );
                                }}
                              />
                            );
                          })()}
                          <p className="text-[11px] text-muted-foreground">
                            Sets country flag and regional formatting defaults.
                          </p>
                        </div>

                        {/* Timezone Picker */}
                        <FormField
                          control={profileForm.control}
                          name="timezone"
                          render={({ field }) => {
                            const zone = field.value || systemTimezone;
                            return (
                              <FormItem>
                                <FormLabel className="text-xs font-medium">
                                  Timezone
                                </FormLabel>
                                <FormControl>
                                  <TimezoneSelect
                                    value={zone}
                                    onChange={(next) =>
                                      profileForm.setValue('timezone', next, {
                                        shouldDirty: true,
                                      })
                                    }
                                  />
                                </FormControl>
                                <FormDescription className="text-[11px] text-muted-foreground">
                                  Used for team time synchronization and
                                  scheduling.
                                </FormDescription>
                                <FormMessage />
                              </FormItem>
                            );
                          }}
                        />
                      </div>

                      {/* Live Time & Working Hours Preview Card */}
                      {(() => {
                        const currentTz =
                          profileForm.watch('timezone') || systemTimezone;
                        const region = getRegionForTimezone(currentTz);
                        const workStatus = getWorkingHoursStatus(currentTz);

                        return (
                          <div className="p-3.5 sm:flex-row sm:items-center gap-3 text-xs flex flex-col justify-between rounded-xl border border-border bg-surface">
                            <div className="gap-2.5 flex items-center">
                              <span className="text-2xl leading-none">
                                {region.flag}
                              </span>
                              <div>
                                <div className="font-semibold gap-2 flex items-center text-foreground">
                                  <span>{region.name}</span>
                                  <span className="font-normal text-[10px] text-muted-foreground">
                                    ({describeTimezone(currentTz)})
                                  </span>
                                </div>
                                <div className="mt-0.5 text-[11px] text-muted-foreground">
                                  {currentTz === systemTimezone
                                    ? '✓ Matches this device'
                                    : `Device timezone: ${describeTimezone(systemTimezone)}`}
                                </div>
                              </div>
                            </div>

                            <div className="gap-3 sm:self-auto flex items-center self-end">
                              <span
                                className={cn(
                                  'font-medium px-2 py-0.5 gap-1 flex items-center rounded-full text-[11px]',
                                  workStatus.status === 'working'
                                    ? 'bg-success/15 text-success'
                                    : workStatus.status === 'sleeping'
                                      ? 'bg-muted text-muted-foreground'
                                      : 'bg-warning/15 text-warning',
                                )}
                              >
                                <span>{workStatus.icon}</span>
                                <span>{workStatus.label}</span>
                              </span>

                              <div className="text-right">
                                <LocalTime
                                  timezone={currentTz}
                                  showOffset
                                  className="font-bold text-sm font-mono text-foreground"
                                />
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

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
            )}

            {/* Subsection: Region & Timezone */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
                Regional & Timezone Settings
              </h3>
              <SettingsCard>
                <div className="sm:grid-cols-2 gap-5 grid grid-cols-1">
                  {/* Region Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium block text-foreground">
                      Region & Country
                    </label>
                    {(() => {
                      const currentTz =
                        profileForm.watch('timezone') || systemTimezone;
                      const currentRegion = getRegionForTimezone(currentTz);

                      return (
                        <RegionSelect
                          value={currentRegion.code}
                          onChange={(region: RegionInfo) => {
                            profileForm.setValue(
                              'timezone',
                              region.defaultTimezone,
                              {
                                shouldDirty: true,
                              },
                            );
                          }}
                        />
                      );
                    })()}
                    <p className="text-[11px] text-muted-foreground">
                      Determines country flag and regional default settings.
                    </p>
                  </div>

                  {/* Timezone Selector */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium block text-foreground">
                      Timezone (IANA)
                    </label>
                    {(() => {
                      const zone =
                        profileForm.watch('timezone') || systemTimezone;
                      return (
                        <TimezoneSelect
                          value={zone}
                          onChange={(next) =>
                            profileForm.setValue('timezone', next, {
                              shouldDirty: true,
                            })
                          }
                        />
                      );
                    })()}
                    <p className="text-[11px] text-muted-foreground">
                      Used for schedule coordination and header clock.
                    </p>
                  </div>
                </div>

                {/* Live Preview Card */}
                {(() => {
                  const currentTz =
                    profileForm.watch('timezone') || systemTimezone;
                  const region = getRegionForTimezone(currentTz);
                  const workStatus = getWorkingHoursStatus(currentTz);

                  return (
                    <div className="p-4 sm:flex-row sm:items-center gap-4 text-xs flex flex-col justify-between rounded-xl border border-border bg-surface">
                      <div className="gap-3 flex items-center">
                        <span className="text-3xl leading-none">
                          {region.flag}
                        </span>
                        <div>
                          <div className="font-semibold gap-2 flex items-center text-foreground">
                            <span className="text-sm">{region.name}</span>
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {describeTimezone(currentTz)}
                            </span>
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {currentTz === systemTimezone
                              ? '✓ Synchronized with this computer'
                              : `Device timezone: ${describeTimezone(systemTimezone)}`}
                          </div>
                        </div>
                      </div>

                      <div className="gap-3 sm:self-auto flex items-center self-end">
                        <span
                          className={cn(
                            'text-xs font-medium px-2.5 py-1 gap-1.5 flex items-center rounded-full',
                            workStatus.status === 'working'
                              ? 'bg-success/15 text-success'
                              : workStatus.status === 'sleeping'
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-warning/15 text-warning',
                          )}
                        >
                          <span>{workStatus.icon}</span>
                          <span>{workStatus.label}</span>
                        </span>

                        <div className="text-right">
                          <LocalTime
                            timezone={currentTz}
                            showOffset
                            className="font-bold text-base font-mono text-foreground"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div className="pt-2 flex items-center justify-between border-t border-border/40">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      profileForm.setValue('timezone', systemTimezone, {
                        shouldDirty: true,
                      })
                    }
                    className="text-xs"
                  >
                    Reset to device timezone ({describeTimezone(systemTimezone)}
                    )
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    loading={updateProfile.isPending}
                    disabled={!profileForm.formState.isDirty}
                    onClick={profileForm.handleSubmit((data) =>
                      updateProfile.mutate(data),
                    )}
                    className="text-xs"
                  >
                    Save timezone changes
                  </Button>
                </div>
              </SettingsCard>
            </div>

            {/* Subsection: Date & Time Formatting */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
                Date & Time Formats
              </h3>
              <SettingsCard divided>
                <SettingsRow
                  title={<>Time display format</>}
                  description={
                    <>Choose 12-hour AM/PM or 24-hour military clock</>
                  }
                >
                  <Select
                    value={timeFormatPref}
                    onValueChange={(v: '12h' | '24h') => setTimeFormatPref(v)}
                  >
                    <SelectTrigger className="w-36 h-8 text-xs border-border bg-surface">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="12h" className="text-xs">
                        12-hour (2:30 PM)
                      </SelectItem>
                      <SelectItem value="24h" className="text-xs">
                        24-hour (14:30)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>

                <SettingsRow
                  title={<>Date display format</>}
                  description={<>Preferred order for calendar dates</>}
                >
                  <Select
                    value={dateFormatPref}
                    onValueChange={(
                      v: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD',
                    ) => setDateFormatPref(v)}
                  >
                    <SelectTrigger className="w-44 h-8 text-xs border-border bg-surface">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MM/DD/YYYY" className="text-xs">
                        MM/DD/YYYY (US)
                      </SelectItem>
                      <SelectItem value="DD/MM/YYYY" className="text-xs">
                        DD/MM/YYYY (UK/EU/IN)
                      </SelectItem>
                      <SelectItem value="YYYY-MM-DD" className="text-xs">
                        YYYY-MM-DD (ISO)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>
              </SettingsCard>
            </div>

            {/* Subsection: Working Hours */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
                Working Hours & Schedule
              </h3>
              <SettingsCard divided>
                <SettingsRow
                  title={<>Daily working hours</>}
                  description={
                    <>Lets teammates know when you are actively at your desk</>
                  }
                >
                  <div className="gap-2 text-xs flex items-center">
                    <Select
                      value={workStartHour}
                      onValueChange={setWorkStartHour}
                    >
                      <SelectTrigger className="w-24 h-8 text-xs border-border bg-surface">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="08:00" className="text-xs">
                          08:00 AM
                        </SelectItem>
                        <SelectItem value="09:00" className="text-xs">
                          09:00 AM
                        </SelectItem>
                        <SelectItem value="10:00" className="text-xs">
                          10:00 AM
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-muted-foreground">to</span>
                    <Select value={workEndHour} onValueChange={setWorkEndHour}>
                      <SelectTrigger className="w-24 h-8 text-xs border-border bg-surface">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="17:00" className="text-xs">
                          05:00 PM
                        </SelectItem>
                        <SelectItem value="18:00" className="text-xs">
                          06:00 PM
                        </SelectItem>
                        <SelectItem value="19:00" className="text-xs">
                          07:00 PM
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </SettingsRow>

                <SettingsRow
                  title={<>Working days</>}
                  description={<>Active days of the week</>}
                >
                  <Select value={workdays} onValueChange={setWorkdays}>
                    <SelectTrigger className="w-40 h-8 text-xs border-border bg-surface">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mon-fri" className="text-xs">
                        Monday – Friday
                      </SelectItem>
                      <SelectItem value="mon-sat" className="text-xs">
                        Monday – Saturday
                      </SelectItem>
                      <SelectItem value="sun-thu" className="text-xs">
                        Sunday – Thursday
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </SettingsRow>
              </SettingsCard>
            </div>

            {/* Subsection: Slack Status */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
                Slack-Style Status
              </h3>
              <div className="p-6 space-y-5 rounded-2xl border border-border bg-surface-inset shadow-xs">
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
            title={<>Notifications & Alerts</>}
            description={<>Choose how workspace updates reach you.</>}
          />

          {/* 1. Primary Notification Delivery Channels (matching reference design) */}
          <div className="space-y-3">
            {/* Inbox */}
            <div className="p-4 sm:p-5 gap-4 flex items-center justify-between rounded-xl border border-border bg-surface transition-colors hover:bg-accent/40">
              <div className="gap-3.5 flex items-center">
                <div className="size-9 flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface-inset text-muted-foreground">
                  <Inbox className="size-4.5" />
                </div>
                <div>
                  <div className="gap-2 flex items-center">
                    <span className="text-sm font-semibold text-foreground">
                      Inbox
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 text-muted-foreground">
                    Approvals, handoffs, and follow-ups.
                  </p>
                </div>
              </div>

              <Select
                value={notifyChannelScope}
                onValueChange={setNotifyChannelScope}
              >
                <SelectTrigger className="w-32 h-8 text-xs border-border bg-surface">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Default (All)
                  </SelectItem>
                  <SelectItem value="mentions" className="text-xs">
                    Mentions only
                  </SelectItem>
                  <SelectItem value="nothing" className="text-xs">
                    Off
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Email */}
            <div className="p-4 sm:p-5 gap-4 flex items-center justify-between rounded-xl border border-border bg-surface transition-colors hover:bg-accent/40">
              <div className="gap-3.5 flex items-center">
                <div className="size-9 flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface-inset text-muted-foreground">
                  <Mail className="size-4.5" />
                </div>
                <div>
                  <div className="gap-2 flex items-center">
                    <span className="text-sm font-semibold text-foreground">
                      Email
                    </span>
                    <button
                      type="button"
                      disabled={testNotifSending}
                      onClick={async () => {
                        setTestNotifSending(true);
                        await notify({
                          title: 'OneTab AI Sample Digest',
                          body: 'Sample email digest: 3 new mentions, 1 task completed.',
                        });
                        setTestNotifSending(false);
                        setTestNotifSent(true);
                        setTimeout(() => setTestNotifSent(false), 3000);
                      }}
                      className="px-2 py-0.5 font-medium cursor-pointer rounded-full border border-success/30 bg-success/10 text-[10px] text-success-text transition-colors hover:bg-success/20"
                    >
                      {testNotifSent ? 'Sample sent!' : 'Send sample'}
                    </button>
                  </div>
                  <p className="text-xs mt-0.5 text-muted-foreground">
                    Digests and direct alerts.
                  </p>
                </div>
              </div>

              <Select
                value={notifyDigest ? 'weekly' : 'default'}
                onValueChange={(val) => setNotifyDigest(val === 'weekly')}
              >
                <SelectTrigger className="w-32 h-8 text-xs border-border bg-surface">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default" className="text-xs">
                    Default
                  </SelectItem>
                  <SelectItem value="weekly" className="text-xs">
                    Weekly digest
                  </SelectItem>
                  <SelectItem value="off" className="text-xs">
                    Off
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Browser */}
            <div className="p-4 sm:p-5 gap-4 flex items-center justify-between rounded-xl border border-border bg-surface transition-colors hover:bg-accent/40">
              <div className="gap-3.5 flex items-center">
                <div className="size-9 flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface-inset text-muted-foreground">
                  <Monitor className="size-4.5" />
                </div>
                <div>
                  <div className="gap-2 flex items-center">
                    <span className="text-sm font-semibold text-foreground">
                      Browser
                    </span>
                    {notifBarState.permission === 'granted' && (
                      <span className="px-2 py-0.5 font-medium rounded-full border border-success/30 bg-success/10 text-[10px] text-success-text">
                        Active
                      </span>
                    )}
                    {notifBarState.permission === 'denied' && (
                      <span className="px-2 py-0.5 font-medium rounded-full border border-destructive/30 bg-destructive/10 text-[10px] text-destructive-text">
                        Blocked
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5 text-muted-foreground">
                    {notifBarState.permission === 'granted'
                      ? 'Desktop push notifications are enabled and active.'
                      : notifBarState.permission === 'denied'
                        ? 'Notifications blocked in browser permissions.'
                        : 'Desktop banners stay off until enabled.'}
                  </p>
                </div>
              </div>

              {notifBarState.permission === 'granted' ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs shrink-0"
                  disabled={testNotifSending}
                  onClick={async () => {
                    setTestNotifSending(true);
                    await notify({
                      title: 'OneTab AI Test Alert',
                      body: 'Desktop notifications are working seamlessly!',
                    });
                    setTestNotifSending(false);
                  }}
                >
                  <Bell className="size-3.5 mr-1 text-muted-foreground" />
                  <span>Send Test Alert</span>
                </Button>
              ) : notifBarState.permission === 'denied' ? (
                <span className="text-xs shrink-0 text-muted-foreground italic">
                  Unblock in browser
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs shrink-0"
                  onClick={() => void notifBarState.requestPermission()}
                >
                  <span>Enable notifications</span>
                </Button>
              )}
            </div>

            {/* Mobile & Smart Notifications */}
            <div className="p-4 sm:p-5 space-y-4 rounded-xl border border-border bg-surface transition-colors">
              <div className="gap-4 flex items-center justify-between">
                <div className="gap-3.5 flex items-center">
                  <div className="size-9 flex shrink-0 items-center justify-center rounded-lg border border-border bg-surface-inset text-muted-foreground">
                    <Smartphone className="size-4.5" />
                  </div>
                  <div>
                    <div className="gap-2 flex items-center">
                      <span className="text-sm font-semibold text-foreground">
                        Mobile
                      </span>
                      <button
                        type="button"
                        onClick={async () => {
                          await notify({
                            title: 'Mobile Preview',
                            body: 'Sarah replied to your thread in #engineering',
                          });
                        }}
                        className="px-2 py-0.5 font-medium cursor-pointer rounded-full border border-accent-violet/30 bg-accent-violet-soft text-[10px] text-accent-violet transition-colors hover:bg-accent-violet/20"
                      >
                        Show example
                      </button>
                    </div>
                    <p className="text-xs mt-0.5 text-muted-foreground">
                      Away-from-desk delivery.
                    </p>
                  </div>
                </div>

                <Select value="muted" onValueChange={() => undefined}>
                  <SelectTrigger className="w-32 h-8 text-xs border-border bg-surface">
                    <SelectValue placeholder="Muted" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="muted" className="text-xs">
                      Muted
                    </SelectItem>
                    <SelectItem value="default" className="text-xs">
                      Default
                    </SelectItem>
                    <SelectItem value="all" className="text-xs">
                      All activity
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sub-row: Smart notifications */}
              <div className="pt-3 gap-4 pl-12 flex items-center justify-between border-t border-border/60">
                <div>
                  <h4 className="text-xs font-medium text-foreground">
                    Smart notifications
                  </h4>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Pause phone alerts while desktop stays active.
                  </p>
                </div>
                <Switch
                  checked={notifyDesktopPush}
                  onCheckedChange={setNotifyDesktopPush}
                />
              </div>
            </div>
          </div>

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
                Download native OneTab AI applications for desktop and mobile
                devices.
              </>
            }
          />

          <AppDownloadCard workspaceId={workspaceId} />
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
                Configure primary LLM engines, agent execution permissions, and
                workspace prompts.
              </>
            }
          />

          <div className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
              Model & Reasoning
            </h3>
            <SettingsCard divided>
              <SettingsRow
                title={<>Primary AI Model</>}
                description={
                  <>
                    Select the main LLM powering chat, code assistance, and
                    agent workflows
                  </>
                }
              >
                <Select value={defaultModel} onValueChange={setDefaultModel}>
                  <SelectTrigger className="w-56 h-8 text-xs border-border bg-surface">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o" className="text-xs">
                      GPT-4o (Default Recommended)
                    </SelectItem>
                    <SelectItem value="claude-3-5-sonnet" className="text-xs">
                      Claude 3.5 Sonnet
                    </SelectItem>
                    <SelectItem value="gemini-1-5-pro" className="text-xs">
                      Gemini 1.5 Pro
                    </SelectItem>
                    <SelectItem value="deepseek-r1" className="text-xs">
                      DeepSeek R1
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>

              <SettingsRow
                title={<>Creativity / Temperature</>}
                description={<>Control LLM randomness and precision</>}
              >
                <Select value={tempSetting} onValueChange={setTempSetting}>
                  <SelectTrigger className="w-40 h-8 text-xs border-border bg-surface">
                    <SelectValue placeholder="Balanced" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced" className="text-xs">
                      Balanced (0.7)
                    </SelectItem>
                    <SelectItem value="precise" className="text-xs">
                      Precise (0.2)
                    </SelectItem>
                    <SelectItem value="creative" className="text-xs">
                      Creative (1.0)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>

              <SettingsRow
                title={<>Context Window Size</>}
                description={
                  <>Maximum token length retained during conversations</>
                }
              >
                <Select value={contextWindow} onValueChange={setContextWindow}>
                  <SelectTrigger className="w-40 h-8 text-xs border-border bg-surface">
                    <SelectValue placeholder="128k Tokens" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="128k" className="text-xs">
                      128k Tokens (Default)
                    </SelectItem>
                    <SelectItem value="200k" className="text-xs">
                      200k Tokens
                    </SelectItem>
                    <SelectItem value="32k" className="text-xs">
                      32k Tokens
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>
            </SettingsCard>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
              Autonomous Agent Permissions
            </h3>
            <SettingsCard divided>
              <SettingsRow
                title={<>Auto-approve Agent Code Execution</>}
                description={
                  <>Allow agents to run shell and code commands automatically</>
                }
              >
                <Switch
                  checked={agentAutoApprove}
                  onCheckedChange={setAgentAutoApprove}
                />
              </SettingsRow>

              <SettingsRow
                title={<>Web Search & Browsing Access</>}
                description={
                  <>
                    Enable subagents to fetch live web content and documentation
                  </>
                }
              >
                <Switch
                  checked={allowWebSearch}
                  onCheckedChange={setAllowWebSearch}
                />
              </SettingsRow>

              <SettingsRow
                title={<>Workspace File Modification</>}
                description={
                  <>Permit AI agents to edit codebase files directly</>
                }
              >
                <Switch
                  checked={allowFileSystem}
                  onCheckedChange={setAllowFileSystem}
                />
              </SettingsRow>

              <SettingsRow
                title={<>Max Agent Loop Turn Limit</>}
                description={
                  <>Maximum iteration steps per single task prompt</>
                }
              >
                <Select value={maxTurns} onValueChange={setMaxTurns}>
                  <SelectTrigger className="w-32 h-8 text-xs border-border bg-surface">
                    <SelectValue placeholder="25 turns" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25" className="text-xs">
                      25 turns
                    </SelectItem>
                    <SelectItem value="50" className="text-xs">
                      50 turns
                    </SelectItem>
                    <SelectItem value="10" className="text-xs">
                      10 turns
                    </SelectItem>
                  </SelectContent>
                </Select>
              </SettingsRow>
            </SettingsCard>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold tracking-wide px-1 text-muted-foreground uppercase">
              Workspace System Persona
            </h3>
            <div className="p-4 space-y-3 rounded-2xl border border-border bg-surface-inset shadow-xs">
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={3}
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                This system prompt is injected into all AI chat sessions within
                this workspace.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- SECTION 5: AGENT MARKETPLACE & AUTOMATIONS ---------------- */}
      {currentTab === 'agent-marketplace' && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Agent Marketplace & Tools</>}
            description={
              <>
                Manage active AI agents, custom MCP tools, and external API
                keys.
              </>
            }
          />

          <SettingsCard divided>
            {[
              {
                id: 'code-reviewer',
                name: 'Code Reviewer Agent',
                desc: 'Analyzes pull requests and identifies lint or security defects',
                active: true,
              },
              {
                id: 'support-bot',
                name: 'Customer Support Bot',
                desc: 'Answers member questions using documentation context',
                active: true,
              },
              {
                id: 'doc-summarizer',
                name: 'Doc Summarizer Agent',
                desc: 'Generates daily summaries of channel messages and notes',
                active: false,
              },
            ].map((agent) => (
              <SettingsRow
                key={agent.id}
                title={agent.name}
                description={agent.desc}
              >
                <div className="gap-3 flex items-center">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2.5 text-[11px]"
                  >
                    Configure
                  </Button>
                  <Switch defaultChecked={agent.active} />
                </div>
              </SettingsRow>
            ))}
          </SettingsCard>

          <div className="p-6 space-y-4 rounded-2xl border border-border bg-surface-inset shadow-xs">
            <h3 className="text-xs font-semibold tracking-wide text-foreground uppercase">
              Custom API Keys
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground">
                  NVIDIA API Key (Default Provider)
                </label>
                <Input
                  type="password"
                  value="nvapi-••••••••••••••••"
                  readOnly
                  className="h-8 text-xs mt-1 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">
                  OpenAI API Key
                </label>
                <Input
                  type="password"
                  value="sk-proj-••••••••••••••••"
                  readOnly
                  className="h-8 text-xs mt-1 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">
                  Anthropic API Key
                </label>
                <Input
                  type="password"
                  value="sk-ant-••••••••••••••••"
                  readOnly
                  className="h-8 text-xs mt-1 font-mono"
                />
              </div>
            </div>
          </div>
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
              />
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
                Configure default channels, member creation rules, and message
                privacy.
              </>
            }
          />

          <SettingsCard divided>
            <SettingsRow
              title={<>Default Join Channel</>}
              description={
                <>Channel automatically joined by new workspace members</>
              }
            >
              <Select value={defaultChannel} onValueChange={setDefaultChannel}>
                <SelectTrigger className="w-36 h-8 text-xs border-border bg-surface">
                  <SelectValue placeholder="#general" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general" className="text-xs">
                    #general
                  </SelectItem>
                  <SelectItem value="announcements" className="text-xs">
                    #announcements
                  </SelectItem>
                  <SelectItem value="random" className="text-xs">
                    #random
                  </SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            <SettingsRow
              title={<>Allow Public Channel Creation</>}
              description={<>Regular members can create public channels</>}
            >
              <Switch
                checked={allowPublicCreation}
                onCheckedChange={setAllowPublicCreation}
              />
            </SettingsRow>

            <SettingsRow
              title={<>Allow Private Channel Creation</>}
              description={
                <>Regular members can create private invite-only channels</>
              }
            >
              <Switch
                checked={allowPrivateCreation}
                onCheckedChange={setAllowPrivateCreation}
              />
            </SettingsRow>

            <SettingsRow
              title={<>Auto-archive Inactive Channels</>}
              description={
                <>Archive channels after a period of zero activity</>
              }
            >
              <Select
                value={archiveInactiveDays}
                onValueChange={setArchiveInactiveDays}
              >
                <SelectTrigger className="w-32 h-8 text-xs border-border bg-surface">
                  <SelectValue placeholder="90 days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90" className="text-xs">
                    90 days
                  </SelectItem>
                  <SelectItem value="30" className="text-xs">
                    30 days
                  </SelectItem>
                  <SelectItem value="never" className="text-xs">
                    Never
                  </SelectItem>
                </SelectContent>
              </Select>
            </SettingsRow>

            <SettingsRow
              title={<>Direct Message End-to-End Encryption</>}
              description={<>Encrypt DM content between 1-on-1 team members</>}
            >
              <Switch checked={encryptedDM} onCheckedChange={setEncryptedDM} />
            </SettingsRow>

            <SettingsRow
              title={<>Direct Message Read Receipts</>}
              description={<>Show when messages have been seen by recipient</>}
            >
              <Switch
                checked={readReceipts}
                onCheckedChange={setReadReceipts}
              />
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

          <div className="p-6 space-y-4 rounded-2xl border border-border bg-surface-inset shadow-xs">
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
                <>Synchronize schedule events with your Google Calendar</>
              }
            >
              <Switch
                checked={googleCalendarSync}
                onCheckedChange={setGoogleCalendarSync}
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

      {currentTab === 'pulse' && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Pulse Activity Feed</>}
            description={
              <>
                Configure online status tracking and workspace activity event
                filters.
              </>
            }
          />

          <SettingsCard divided>
            <SettingsRow
              title={<>Track Member Online Status</>}
              description={
                <>Show active presence indicators across channel list</>
              }
            >
              <Switch
                checked={trackOnlineStatus}
                onCheckedChange={setTrackOnlineStatus}
              />
            </SettingsRow>

            <SettingsRow
              title={<>Include GitHub Commit Events in Pulse</>}
              description={
                <>Display code commit events inside workspace pulse feed</>
              }
            >
              <Switch
                checked={trackCommitsInPulse}
                onCheckedChange={setTrackCommitsInPulse}
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
              </>
            }
          />

          <SettingsCard divided>
            {[
              {
                id: 'slack',
                name: 'Slack Integration',
                desc: 'Sync channel messages and notifications',
                connected: true,
              },
              {
                id: 'notion',
                name: 'Notion Workspace',
                desc: 'Import and sync Notion documents',
                connected: true,
              },
              {
                id: 'github',
                name: 'GitHub OAuth',
                desc: 'Pull request reviews and commit triggers',
                connected: true,
              },
              {
                id: 'google',
                name: 'Google Workspace',
                desc: 'Calendar sync and Drive attachment previews',
                connected: false,
              },
            ].map((item) => (
              <SettingsRow
                key={item.id}
                title={item.name}
                description={item.desc}
              >
                {item.connected ? (
                  <span className="gap-1 px-2 py-0.5 rounded font-medium inline-flex items-center bg-success/10 text-[11px] text-success-text">
                    <CheckCircle2 className="size-3" />
                    Connected
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs px-2.5"
                  >
                    Connect
                  </Button>
                )}
              </SettingsRow>
            ))}
          </SettingsCard>
        </div>
      )}

      {currentTab === 'import-export' && (
        <div className="space-y-8">
          <SettingsSectionHeader
            title={<>Import & Export</>}
            description={
              <>
                Migrate channels, messages, and documents from Slack or Notion.
              </>
            }
          />

          <div className="p-6 rounded-2xl border border-border bg-surface-inset shadow-xs">
            {importPanel}
          </div>
        </div>
      )}

      {/* ---------------- SECTION 8: WORKSPACE ADMIN ---------------- */}
      {(currentTab === 'members' || currentTab === 'invitations') && (
        <WorkspaceMembersSettings
          workspaceId={workspaceId}
          workspaceSlug={workspace?.slug}
          workspaceName={workspace?.name}
          workspaceRole={workspace?.role}
          onNavigateToTab={handleTabChange}
        />
      )}

      {(currentTab === 'billing' || currentTab === 'plans') && (
        <WorkspaceBillingSettings
          totalMembers={1}
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
            currentPlan="starter"
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
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Workspace URL Slug */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium block text-foreground">
                      Workspace URL
                    </label>
                    <div className="relative">
                      <Input
                        value={workspace.slug}
                        readOnly
                        disabled
                        className="pl-3 pr-24 text-xs border-border bg-background/50 font-mono text-foreground select-all"
                      />
                      <span className="right-3 px-2 py-0.5 rounded absolute top-1/2 -translate-y-1/2 border border-border-strong bg-surface-raised font-mono text-[11px] text-muted-foreground">
                        .onetab.ai
                      </span>
                    </div>
                    <div className="text-xs gap-2 pt-1 flex items-center justify-between text-muted-foreground">
                      <span className="gap-1.5 flex items-center">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                        Your workspace is hosted at:{' '}
                        <code className="font-mono text-primary">
                          onetab.ai/w/{workspace.slug}
                        </code>
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

                  {/* Accent Color / Branding */}
                  <FormField
                    control={workspaceForm.control}
                    name="accentColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">
                          Workspace Accent Color
                        </FormLabel>
                        <FormControl>
                          <div className="gap-2.5 pt-1 flex flex-wrap items-center">
                            {[
                              {
                                id: 'indigo',
                                label: 'Indigo',
                                bg: 'bg-indigo-600',
                              },
                              { id: 'blue', label: 'Blue', bg: 'bg-blue-600' },
                              {
                                id: 'emerald',
                                label: 'Emerald',
                                bg: 'bg-emerald-600',
                              },
                              {
                                id: 'amber',
                                label: 'Amber',
                                bg: 'bg-amber-600',
                              },
                              { id: 'rose', label: 'Rose', bg: 'bg-rose-600' },
                              {
                                id: 'purple',
                                label: 'Purple',
                                bg: 'bg-purple-600',
                              },
                              { id: 'cyan', label: 'Cyan', bg: 'bg-cyan-600' },
                            ].map((col) => {
                              const isSelected =
                                (field.value || 'indigo') === col.id;
                              return (
                                <button
                                  key={col.id}
                                  type="button"
                                  disabled={!isAdmin}
                                  onClick={() => field.onChange(col.id)}
                                  className={cn(
                                    'h-7 w-7 flex items-center justify-center rounded-full transition-all',
                                    col.bg,
                                    isSelected
                                      ? 'scale-110 ring-2 ring-foreground/60 ring-offset-2'
                                      : 'opacity-80 hover:scale-105 hover:opacity-100',
                                  )}
                                  aria-label={col.label}
                                  title={col.label}
                                >
                                  {isSelected && (
                                    <Check className="h-3.5 w-3.5 text-white" />
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </FormControl>
                        <FormDescription className="text-[11px]">
                          Primary brand tone used in sidebar accents, buttons,
                          and highlights.
                        </FormDescription>
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

                {isAdmin ? (
                  <div className="pt-2">
                    <Button
                      type="submit"
                      size="sm"
                      loading={
                        updateWorkspace.isPending ||
                        uploadLogo.isPending ||
                        removeLogo.isPending
                      }
                      disabled={!isWorkspaceDirty}
                      className="text-xs font-medium"
                    >
                      Save changes
                    </Button>
                  </div>
                ) : null}
              </SettingsCard>
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

          {/* 1. SIGN-IN SECURITY CARDS */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Sign-In Security
            </h2>
            <div className="md:grid-cols-3 gap-4 grid grid-cols-1">
              {/* Password Card */}
              <div className="p-5 space-y-4 flex flex-col justify-between rounded-2xl border border-border bg-surface-inset shadow-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Lock className="h-4 w-4" />
                    </div>
                    <Badge
                      variant="outline"
                      className="font-semibold text-emerald-600 bg-emerald-500/10 border-emerald-500/20 text-[10px] uppercase"
                    >
                      Strong
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">
                      Password
                    </h4>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Last changed on{' '}
                      {securityOverviewQuery.data?.password.lastChangedAt
                        ? new Date(
                            securityOverviewQuery.data.password.lastChangedAt,
                          ).toLocaleDateString()
                        : 'Recently'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChangePasswordModalOpen(true)}
                  className="text-xs h-8 w-full"
                >
                  Change password
                </Button>
              </div>

              {/* Single Sign-On (SSO) Card */}
              <div className="p-5 space-y-4 flex flex-col justify-between rounded-2xl border border-border bg-surface-inset shadow-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-8 w-8 bg-indigo-500/10 text-indigo-500 flex items-center justify-center rounded-lg">
                      <Globe className="h-4 w-4" />
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'font-semibold text-[10px] uppercase',
                        securityOverviewQuery.data?.sso.isConnected
                          ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                          : 'border-border bg-muted/40 text-muted-foreground',
                      )}
                    >
                      {securityOverviewQuery.data?.sso.isConnected
                        ? 'Connected'
                        : 'Not Connected'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">
                      Single Sign-On (SSO)
                    </h4>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {securityOverviewQuery.data?.sso.isConnected
                        ? `Connected via ${securityOverviewQuery.data.sso.providerType || 'Enterprise SAML/OIDC'}`
                        : 'Organization identity provider sign-in'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTabChange('members')}
                  className="text-xs h-8 w-full text-muted-foreground"
                >
                  Manage SSO in Enterprise
                </Button>
              </div>

              {/* 2FA Status Card */}
              <div className="p-5 space-y-4 flex flex-col justify-between rounded-2xl border border-border bg-surface-inset shadow-xs">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-8 w-8 bg-amber-500/10 text-amber-500 flex items-center justify-center rounded-lg">
                      <Shield className="h-4 w-4" />
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'font-semibold text-[10px] uppercase',
                        securityOverviewQuery.data?.twoFactor.isEnabled
                          ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-amber-600 bg-amber-500/10 border-amber-500/20',
                      )}
                    >
                      {securityOverviewQuery.data?.twoFactor.isEnabled
                        ? 'Enabled'
                        : 'Disabled'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">
                      Two-Factor Authentication
                    </h4>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {securityOverviewQuery.data?.twoFactor.isEnabled
                        ? 'Enforced with authenticator app'
                        : 'Add a second layer of defense'}
                    </p>
                  </div>
                </div>
                {securityOverviewQuery.data?.twoFactor.isEnabled ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisableTotpModalOpen(true)}
                    className="text-xs h-8 w-full text-destructive hover:text-destructive"
                  >
                    Disable 2FA
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartTotpSetup}
                    loading={setupTotpMutation.isPending}
                    className="text-xs h-8 w-full"
                  >
                    Set up 2FA
                  </Button>
                )}
              </div>
            </div>
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
                            ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
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
                              onClick={() =>
                                deleteWebAuthnMutation.mutate(key.id)
                              }
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
              onClick={() => setConfirmOpen(true)}
              className="text-xs"
            >
              Delete workspace
            </Button>
          </div>
        </div>
      )}

      {/* Delete Workspace Confirmation Dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {workspace.name}?</DialogTitle>
            <DialogDescription>
              This permanently deletes {workspace.channelCount} channels and
              removes {workspace.memberCount} members. Type the workspace slug
              to confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-2">
            <Input
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder={workspace.slug}
              aria-label={`Type ${workspace.slug} to confirm`}
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost" size="sm" className="text-xs">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              disabled={confirmText !== workspace.slug}
              loading={deleteWorkspace.isPending}
              onClick={() => deleteWorkspace.mutate(workspace.id)}
              className="text-xs"
            >
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <form onSubmit={onPasswordSubmit} className="space-y-4 pt-2">
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

              <DialogFooter className="pt-3">
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
            <div className="space-y-4 pt-2">
              <div className="p-3 border-emerald-500/20 bg-emerald-500/10 text-emerald-700 text-xs rounded-lg border">
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
            </div>
          ) : (
            <div className="space-y-4 pt-2">
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
            </div>
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

          <div className="space-y-4 pt-2">
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
          </div>
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

          <div className="space-y-4 pt-2">
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
          </div>
        </DialogContent>
      </Dialog>

      {/* 5. Add Passkey Dialog */}
      <Dialog open={addPasskeyModalOpen} onOpenChange={setAddPasskeyModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Register New Passkey</DialogTitle>
            <DialogDescription>
              Assign a recognizable device name for this biometric or physical
              key.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
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
          </div>
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
