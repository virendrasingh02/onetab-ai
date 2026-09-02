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
import { useLocation, useSearchParams } from 'react-router-dom';
import { AppDownloadCard, DesktopSettingsCard, PlatformDiagnosticsLink, notify } from '@org/web-desktop';
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
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

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

  const isImportExportRoute =
    location.pathname.endsWith('/import-export') ||
    location.pathname.endsWith('/integrations/import');
  const isMembersRoute = location.pathname.endsWith('/members');
  const isInvitationsRoute = location.pathname.endsWith('/invitations');
  const isAnalyticsRoute = location.pathname.includes('/analytics');
  const isBillingRoute =
    location.pathname.endsWith('/billing') ||
    location.pathname.endsWith('/plans');
  const isProfileRoute = location.pathname.endsWith('/profile');
  const isPreferencesRoute = location.pathname.endsWith('/preferences');

  const currentTab = isImportExportRoute
    ? 'import-export'
    : isMembersRoute
      ? 'members'
      : isInvitationsRoute
        ? 'invitations'
        : isAnalyticsRoute
          ? 'analytics'
          : isBillingRoute
            ? 'billing'
            : isProfileRoute
              ? 'profile'
              : isPreferencesRoute
                ? 'preferences'
                : searchParams.get('tab') || searchParams.get('section') || 'preferences';

  const handleTabChange = (val: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', val);
        return next;
      },
      { replace: true }
    );
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
    'You are Antigravity AI, an intelligent collaborative assistant designed for software development and workspace productivity.'
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
  const [testSoundPlaying, setTestSoundPlaying] = useState<FocusSoundType | null>(null);

  // Timezone & Regional Preferences States
  const [timeFormatPref, setTimeFormatPref] = useState<'12h' | '24h'>('12h');
  const [dateFormatPref, setDateFormatPref] = useState<'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'>('MM/DD/YYYY');
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
  const [totpSetupData, setTotpSetupData] = useState<TotpSetupResponse | null>(null);
  const [totpCodeInput, setTotpCodeInput] = useState('');
  const [totpBackupCodes, setTotpBackupCodes] = useState<string[] | null>(null);
  const [totpCopiedSecret, setTotpCopiedSecret] = useState(false);
  const [recoveryCodesModalOpen, setRecoveryCodesModalOpen] = useState(false);
  const [recoveryCodesList, setRecoveryCodesList] = useState<string[]>([]);
  const [revokeModalSession, setRevokeModalSession] = useState<UserSessionDto | null>(null);
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
    : logoPreview ?? (workspace?.avatarUrl || null);

  const isLogoChanged =
    logoFile !== null || (isLogoRemoved && Boolean(workspace?.avatarUrl));
  const isWorkspaceDirty =
    workspaceForm.formState.isDirty || isLogoChanged;

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
    } catch (err) {
      toast.error('Failed to initiate 2FA setup');
    }
  };

  const handleVerifyTotp = async () => {
    if (!totpCodeInput || totpCodeInput.trim().length !== 6) {
      toast.error('Please enter a valid 6-digit verification code');
      return;
    }
    try {
      const res = await verifyTotpMutation.mutateAsync({ code: totpCodeInput.trim() });
      setTotpBackupCodes(res.backupCodes);
      toast.success('Two-factor authentication enabled!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid code. Please try again.');
    }
  };

  const handleConfirmDisableTotp = async () => {
    try {
      await disableTotpMutation.mutateAsync({ currentPassword: disableTotpPassword });
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
      toast.error(err?.response?.data?.message || 'Failed to generate recovery codes');
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
    } catch (err) {
      toast.error('Failed to register passkey');
    }
  };

  return (
    <SettingsLayout activeTab={currentTab} onTabChange={handleTabChange}>
      {/* ---------------- SECTION 1: APPEARANCE & PREFERENCES ---------------- */}
      {(currentTab === 'appearance' || currentTab === 'preferences' || currentTab === 'theme') && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Appearance & Preferences</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Customize app themes, color palette, default home views, and keyboard interaction.
            </p>
          </div>

          {themePanel}

          {/* Subsection: General */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
              General
            </h3>
            <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Default home view</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Select which view to display when launching Onetab-AI
                  </p>
                </div>
                <Select value={homeView} onValueChange={setHomeView}>
                  <SelectTrigger className="w-52 h-8 text-xs bg-surface border-border">
                    <SelectValue placeholder="Select view" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="agent" className="text-xs">AI Chat & Agent (default)</SelectItem>
                    <SelectItem value="dashboard" className="text-xs">Dashboard Overview</SelectItem>
                    <SelectItem value="kanban" className="text-xs">Tasks & Kanban</SelectItem>
                    <SelectItem value="docs" className="text-xs">Notes & Documents</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Display names</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Select how names are displayed across the interface
                  </p>
                </div>
                <Select value={displayNamePref} onValueChange={setDisplayNamePref}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-surface border-border">
                    <SelectValue placeholder="Username" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="username" className="text-xs">Username</SelectItem>
                    <SelectItem value="fullname" className="text-xs">Full name</SelectItem>
                    <SelectItem value="displayname" className="text-xs">Display name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">First day of the week</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Used for date pickers and schedule views
                  </p>
                </div>
                <Select value={firstDay} onValueChange={setFirstDay}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-surface border-border">
                    <SelectValue placeholder="Monday" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monday" className="text-xs">Monday</SelectItem>
                    <SelectItem value="sunday" className="text-xs">Sunday</SelectItem>
                    <SelectItem value="saturday" className="text-xs">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Convert text emoticons into emojis</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Strings like <code className="bg-muted px-1 rounded text-[10px]">:)</code> will be converted to 😄
                  </p>
                </div>
                <Switch checked={convertEmojis} onCheckedChange={setConvertEmojis} />
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Send comments on...</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Choose which key press is used to submit messages and comments
                  </p>
                </div>
                <Select value={sendShortcut} onValueChange={setSendShortcut}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-surface border-border">
                    <SelectValue placeholder="Ctrl+Enter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ctrl-enter" className="text-xs">Ctrl+Enter</SelectItem>
                    <SelectItem value="enter" className="text-xs">Enter</SelectItem>
                    <SelectItem value="cmd-enter" className="text-xs">Cmd+Enter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Subsection: Interface and theme */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
              Interface and theme
            </h3>
            <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">App sidebar</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Customize sidebar item visibility, ordering, and activity
                    indicator (dot / badge) style
                  </p>
                </div>
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
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Font size</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Adjust the size of text across the app
                  </p>
                </div>
                <Select value={fontSize} onValueChange={setFontSize}>
                  <SelectTrigger className="w-32 h-8 text-xs bg-surface border-border">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default" className="text-xs">Default</SelectItem>
                    <SelectItem value="compact" className="text-xs">Compact</SelectItem>
                    <SelectItem value="large" className="text-xs">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">

                <div>
                  <h4 className="text-xs font-medium text-foreground">Interface theme</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Select your preferred appearance theme
                  </p>
                </div>
                <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-lg border border-border/50">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      theme === 'light'
                        ? 'bg-background text-foreground shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Sun className="size-3.5 text-accent-amber" />
                    <span>Light</span>
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      theme === 'dark'
                        ? 'bg-background text-foreground shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Moon className="size-3.5 text-accent-indigo" />
                    <span>Dark</span>
                  </button>
                  <button
                    onClick={() => setTheme('system')}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      theme === 'system'
                        ? 'bg-background text-foreground shadow-2xs font-semibold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Monitor className="size-3.5 text-muted-foreground" />
                    <span>System</span>
                  </button>
                </div>
              </div>
            </div>
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
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Profile & Details</h1>
              <p className="text-xs text-muted-foreground mt-1">
                Manage your personal identity, status, focus preferences, and working hours.
              </p>
            </div>

            {profilePanel ?? (
              <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/40">
              <div className="flex items-center gap-5">
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
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                  <span className="inline-block text-[10px] bg-primary/10 text-primary px-2.5 py-0.5 rounded-full font-semibold">
                    {workspace.role}
                  </span>
                </div>
              </div>

              {/* Quick Status & Focus Mode controls */}
              <div className="flex items-center gap-2">
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
              <div className="flex items-center justify-between p-3 rounded-xl border border-primary/25 bg-primary/5 text-xs text-foreground">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-lg">{user.statusEmoji || '💬'}</span>
                  <div className="min-w-0">
                    <span className="font-semibold block truncate">
                      {user.statusText}
                    </span>
                    {user.statusExpiresAt && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Clock className="size-3" />
                        Clears {new Date(user.statusExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
              <form onSubmit={onProfileSubmit} className="space-y-4 max-w-xl" noValidate>
                <FormError error={formErrorMessage(updateProfile.error)} />

                <FormField
                  control={profileForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Full name</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ''} className="h-9 text-xs" />
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
                      <FormLabel className="text-xs font-medium">Display name</FormLabel>
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
                      <FormLabel className="text-xs font-medium">Bio</FormLabel>
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
                      <FormLabel className="text-xs font-medium">Avatar Image</FormLabel>
                      <div className="flex items-center gap-3">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            placeholder="Image URL (https://...) or upload an image"
                            className="h-9 text-xs font-mono flex-1"
                          />
                        </FormControl>
                        <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-border rounded-md hover:bg-accent transition-colors shrink-0">
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
                                    profileForm.setValue('avatarUrl', evt.target.result as string, {
                                      shouldDirty: true,
                                    });
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
                            className="h-9 text-xs text-destructive hover:text-destructive px-2.5"
                            onClick={() =>
                              profileForm.setValue('avatarUrl', '', { shouldDirty: true })
                            }
                          >
                            <Trash2 className="size-3.5 mr-1" />
                            Remove
                          </Button>
                        ) : null}
                      </div>
                      <FormDescription className="text-[11px] text-muted-foreground mt-1">
                        Upload an image file or paste an image URL. If removed, fallback displays single letter initial &quot;{initials(profileForm.watch('name') || user.name)}&quot;.
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Region / Country Picker */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">
                        Region & Country
                      </label>
                      {(() => {
                        const currentTz = profileForm.watch('timezone') || systemTimezone;
                        const currentRegion = getRegionForTimezone(currentTz);

                        return (
                          <RegionSelect
                            value={currentRegion.code}
                            onChange={(region: RegionInfo) => {
                              profileForm.setValue('timezone', region.defaultTimezone, {
                                shouldDirty: true,
                              });
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
                            <FormLabel className="text-xs font-medium">Timezone</FormLabel>
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
                              Used for team time synchronization and scheduling.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        );
                      }}
                    />
                  </div>

                  {/* Live Time & Working Hours Preview Card */}
                  {(() => {
                    const currentTz = profileForm.watch('timezone') || systemTimezone;
                    const region = getRegionForTimezone(currentTz);
                    const workStatus = getWorkingHoursStatus(currentTz);

                    return (
                      <div className="p-3.5 rounded-xl border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl leading-none">{region.flag}</span>
                          <div>
                            <div className="font-semibold text-foreground flex items-center gap-2">
                              <span>{region.name}</span>
                              <span className="text-[10px] text-muted-foreground font-normal">
                                ({describeTimezone(currentTz)})
                              </span>
                            </div>
                            <div className="text-[11px] text-muted-foreground mt-0.5">
                              {currentTz === systemTimezone
                                ? '✓ Matches this device'
                                : `Device timezone: ${describeTimezone(systemTimezone)}`}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end sm:self-auto">
                          <span
                            className={cn(
                              'text-[11px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1',
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
                              className="font-mono font-bold text-foreground text-sm"
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
          </div>
        )}

        {/* Subsection: Region & Timezone */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
            Regional & Timezone Settings
          </h3>
          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Region Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-foreground block">
                    Region & Country
                  </label>
                  {(() => {
                    const currentTz = profileForm.watch('timezone') || systemTimezone;
                    const currentRegion = getRegionForTimezone(currentTz);

                    return (
                      <RegionSelect
                        value={currentRegion.code}
                        onChange={(region: RegionInfo) => {
                          profileForm.setValue('timezone', region.defaultTimezone, {
                            shouldDirty: true,
                          });
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
                  <label className="text-xs font-medium text-foreground block">
                    Timezone (IANA)
                  </label>
                  {(() => {
                    const zone = profileForm.watch('timezone') || systemTimezone;
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
                const currentTz = profileForm.watch('timezone') || systemTimezone;
                const region = getRegionForTimezone(currentTz);
                const workStatus = getWorkingHoursStatus(currentTz);

                return (
                  <div className="p-4 rounded-xl border border-border bg-surface flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl leading-none">{region.flag}</span>
                      <div>
                        <div className="font-semibold text-foreground flex items-center gap-2">
                          <span className="text-sm">{region.name}</span>
                          <span className="text-[11px] text-muted-foreground font-mono">
                            {describeTimezone(currentTz)}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {currentTz === systemTimezone
                            ? '✓ Synchronized with this computer'
                            : `Device timezone: ${describeTimezone(systemTimezone)}`}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto">
                      <span
                        className={cn(
                          'text-xs font-medium px-2.5 py-1 rounded-full flex items-center gap-1.5',
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
                          className="font-mono font-bold text-foreground text-base"
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between pt-2 border-t border-border/40">
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
                  Reset to device timezone ({describeTimezone(systemTimezone)})
                </Button>

                <Button
                  type="button"
                  size="sm"
                  loading={updateProfile.isPending}
                  disabled={!profileForm.formState.isDirty}
                  onClick={profileForm.handleSubmit((data) => updateProfile.mutate(data))}
                  className="text-xs"
                >
                  Save timezone changes
                </Button>
              </div>
            </div>
          </div>

          {/* Subsection: Date & Time Formatting */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
              Date & Time Formats
            </h3>
            <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Time display format</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Choose 12-hour AM/PM or 24-hour military clock
                  </p>
                </div>
                <Select value={timeFormatPref} onValueChange={(v: '12h' | '24h') => setTimeFormatPref(v)}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-surface border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h" className="text-xs">12-hour (2:30 PM)</SelectItem>
                    <SelectItem value="24h" className="text-xs">24-hour (14:30)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Date display format</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Preferred order for calendar dates
                  </p>
                </div>
                <Select value={dateFormatPref} onValueChange={(v: 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD') => setDateFormatPref(v)}>
                  <SelectTrigger className="w-44 h-8 text-xs bg-surface border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MM/DD/YYYY" className="text-xs">MM/DD/YYYY (US)</SelectItem>
                    <SelectItem value="DD/MM/YYYY" className="text-xs">DD/MM/YYYY (UK/EU/IN)</SelectItem>
                    <SelectItem value="YYYY-MM-DD" className="text-xs">YYYY-MM-DD (ISO)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Subsection: Working Hours */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
              Working Hours & Schedule
            </h3>
            <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Daily working hours</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Lets teammates know when you are actively at your desk
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Select value={workStartHour} onValueChange={setWorkStartHour}>
                    <SelectTrigger className="w-24 h-8 text-xs bg-surface border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="08:00" className="text-xs">08:00 AM</SelectItem>
                      <SelectItem value="09:00" className="text-xs">09:00 AM</SelectItem>
                      <SelectItem value="10:00" className="text-xs">10:00 AM</SelectItem>
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">to</span>
                  <Select value={workEndHour} onValueChange={setWorkEndHour}>
                    <SelectTrigger className="w-24 h-8 text-xs bg-surface border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="17:00" className="text-xs">05:00 PM</SelectItem>
                      <SelectItem value="18:00" className="text-xs">06:00 PM</SelectItem>
                      <SelectItem value="19:00" className="text-xs">07:00 PM</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Working days</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Active days of the week
                  </p>
                </div>
                <Select value={workdays} onValueChange={setWorkdays}>
                  <SelectTrigger className="w-40 h-8 text-xs bg-surface border-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mon-fri" className="text-xs">Monday – Friday</SelectItem>
                    <SelectItem value="mon-sat" className="text-xs">Monday – Saturday</SelectItem>
                    <SelectItem value="sun-thu" className="text-xs">Sunday – Thursday</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

        {/* Subsection: Slack Status */}
        <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
              Slack-Style Status
            </h3>
            <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-6 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border bg-surface">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{user.statusEmoji || '💬'}</span>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">
                      {user.statusText || 'No active status'}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {user.statusExpiresAt
                        ? `Clears automatically at ${new Date(user.statusExpiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                        : 'Visible to all teammates across channels and direct messages'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
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
                <label className="text-xs font-medium text-foreground block">
                  Quick 1-Click Status Presets
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
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
                        userApi.updateStatus({
                          statusText: preset.text,
                          statusEmoji: preset.emoji,
                          statusExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                        }).then((updated) => {
                          setUser(updated);
                        });
                      }}
                      className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-surface hover:border-primary/40 hover:bg-accent/50 text-xs text-foreground text-left transition-all"
                    >
                      <span className="text-base leading-none">{preset.emoji}</span>
                      <span className="truncate font-medium">{preset.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Subsection: Focus Mode & Pomodoro */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
              Focus Mode & Ambient Zen Audio
            </h3>
            <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-6 space-y-6">
              {/* Active Session Bar or Launch Trigger */}
              {focusStore.isActive ? (
                <div className="p-4 rounded-xl border border-primary/40 bg-primary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-mono font-bold text-sm">
                      {Math.floor(focusStore.remainingSeconds / 60)}m
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-2">
                        <span>Active Focus Session</span>
                        <span className="text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-bold">
                          {focusStore.isPaused ? 'PAUSED' : 'IN PROGRESS'}
                        </span>
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {focusStore.taskObjective || 'Deep work session'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
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
                      <h4 className="text-xs font-semibold text-foreground">Launch a Focus Session</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Blocks distractions, generates ambient focus audio, and updates your Slack status.
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
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
                        className="p-3.5 rounded-xl border border-border bg-surface hover:border-primary/50 hover:bg-accent/40 text-left transition-all space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-lg">{opt.icon}</span>
                          <span className="font-mono text-xs font-bold text-primary">{opt.minutes}m</span>
                        </div>
                        <div className="text-xs font-semibold text-foreground">{opt.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Ambient Audio Synthesizer */}
              <div className="space-y-3 pt-4 border-t border-border/40">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Volume2 className="size-3.5 text-primary" />
                      Ambient Audio Soundscape
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Native Web Audio synthesized noise and alpha wave beat generators.
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
                      className="h-7 text-xs text-destructive gap-1"
                    >
                      <VolumeX className="size-3" />
                      Stop Audio
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                  {FOCUS_SOUND_OPTIONS.filter((s) => s.id !== 'none').map((sound) => {
                    const isTesting = testSoundPlaying === sound.id;
                    const isSelected = focusStore.soundType === sound.id;

                    return (
                      <div
                        key={sound.id}
                        className={cn(
                          'p-3 rounded-xl border flex items-center justify-between gap-2 text-xs transition-all',
                          isSelected
                            ? 'border-primary/50 bg-primary/5'
                            : 'border-border bg-surface hover:bg-accent/30',
                        )}
                      >
                        <div
                          className="flex items-center gap-2 cursor-pointer truncate flex-1"
                          onClick={() => focusStore.setSound(sound.id)}
                        >
                          <span className="text-base">{sound.icon}</span>
                          <span className="font-medium text-foreground truncate">{sound.name}</span>
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
                              focusAudio.play(sound.id, focusStore.soundVolume);
                              setTestSoundPlaying(sound.id);
                            }
                          }}
                          className="size-7 shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          {isTesting ? <Pause className="size-3.5 text-primary" /> : <Play className="size-3.5" />}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- SECTION: CHAT & MESSAGING ---------------- */}
      {currentTab === 'chat' && <ChatSettingsPanel />}

      {/* ---------------- SECTION 3: NOTIFICATIONS ---------------- */}
      {currentTab === 'notifications' && (
        <div className="space-y-10">
          {/* Main Reference Header */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
              Notification settings
            </h1>
            <p className="text-xs sm:text-sm text-zinc-400">
              Choose how workspace updates reach you.
            </p>
          </div>

          {/* 1. Primary Notification Delivery Channels (matching reference design) */}
          <div className="space-y-3">
            {/* Inbox */}
            <div className="bg-[#121214] border border-zinc-800/90 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-colors hover:border-zinc-700/80">
              <div className="flex items-center gap-3.5">
                <div className="size-9 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-200 shrink-0">
                  <Inbox className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Inbox</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Approvals, handoffs, and follow-ups.
                  </p>
                </div>
              </div>

              <Select value={notifyChannelScope} onValueChange={setNotifyChannelScope}>
                <SelectTrigger className="w-32 h-8 text-xs bg-[#18181b] border-zinc-700/60 text-zinc-200 rounded-lg">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent className="bg-[#18181b] border-zinc-800 text-zinc-200">
                  <SelectItem value="all" className="text-xs">Default (All)</SelectItem>
                  <SelectItem value="mentions" className="text-xs">Mentions only</SelectItem>
                  <SelectItem value="nothing" className="text-xs">Off</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Email */}
            <div className="bg-[#121214] border border-zinc-800/90 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-colors hover:border-zinc-700/80">
              <div className="flex items-center gap-3.5">
                <div className="size-9 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-200 shrink-0">
                  <Mail className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Email</span>
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
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 hover:bg-emerald-900/60 transition-colors cursor-pointer"
                    >
                      {testNotifSent ? 'Sample sent!' : 'Send sample'}
                    </button>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Digests and direct alerts.
                  </p>
                </div>
              </div>

              <Select
                value={notifyDigest ? 'weekly' : 'default'}
                onValueChange={(val) => setNotifyDigest(val === 'weekly')}
              >
                <SelectTrigger className="w-32 h-8 text-xs bg-[#18181b] border-zinc-700/60 text-zinc-200 rounded-lg">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent className="bg-[#18181b] border-zinc-800 text-zinc-200">
                  <SelectItem value="default" className="text-xs">Default</SelectItem>
                  <SelectItem value="weekly" className="text-xs">Weekly digest</SelectItem>
                  <SelectItem value="off" className="text-xs">Off</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Browser */}
            <div className="bg-[#121214] border border-zinc-800/90 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 transition-colors hover:border-zinc-700/80">
              <div className="flex items-center gap-3.5">
                <div className="size-9 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-200 shrink-0">
                  <Monitor className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">Browser</span>
                    {notifBarState.permission === 'granted' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                        Active
                      </span>
                    )}
                    {notifBarState.permission === 'denied' && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-rose-950/80 text-rose-400 border border-rose-800/60">
                        Blocked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">
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
                  className="h-8 px-3 text-xs bg-[#18181b] border-zinc-700/60 text-zinc-200 hover:text-white hover:bg-zinc-800 rounded-lg shrink-0"
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
                  <Bell className="size-3.5 mr-1 text-zinc-400" />
                  <span>Send Test Alert</span>
                </Button>
              ) : notifBarState.permission === 'denied' ? (
                <span className="text-xs text-zinc-500 italic shrink-0">
                  Unblock in browser
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs bg-[#18181b] border-zinc-700/60 text-zinc-200 hover:text-white hover:bg-zinc-800 rounded-lg shrink-0"
                  onClick={() => void notifBarState.requestPermission()}
                >
                  <span>Enable notifications</span>
                </Button>
              )}
            </div>

            {/* Mobile & Smart Notifications */}
            <div className="bg-[#121214] border border-zinc-800/90 rounded-2xl p-4 sm:p-5 space-y-4 transition-colors hover:border-zinc-700/80">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="size-9 rounded-xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-200 shrink-0">
                    <Smartphone className="size-4.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white">Mobile</span>
                      <button
                        type="button"
                        onClick={async () => {
                          await notify({
                            title: 'Mobile Preview',
                            body: 'Sarah replied to your thread in #engineering',
                          });
                        }}
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-purple-950/80 text-purple-400 border border-purple-800/60 hover:bg-purple-900/60 transition-colors cursor-pointer"
                      >
                        Show example
                      </button>
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Away-from-desk delivery.
                    </p>
                  </div>
                </div>

                <Select value="muted" onValueChange={() => undefined}>
                  <SelectTrigger className="w-32 h-8 text-xs bg-[#18181b] border-zinc-700/60 text-zinc-200 rounded-lg">
                    <SelectValue placeholder="Muted" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181b] border-zinc-800 text-zinc-200">
                    <SelectItem value="muted" className="text-xs">Muted</SelectItem>
                    <SelectItem value="default" className="text-xs">Default</SelectItem>
                    <SelectItem value="all" className="text-xs">All activity</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Sub-row: Smart notifications */}
              <div className="pt-3 border-t border-zinc-800/60 flex items-center justify-between gap-4 pl-12">
                <div>
                  <h4 className="text-xs font-medium text-white">Smart notifications</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">
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
          <div className="border-t border-zinc-800/80 pt-8">
            <NotificationDisplaySettingsPanel workspaceId={workspaceId} />
          </div>
        </div>
      )}




      {/* ---------------- SECTION: APPS & DOWNLOADS ---------------- */}
      {currentTab === 'downloads' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Apps & Downloads
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              Download native OneTab AI applications for desktop and mobile devices.
            </p>
          </div>

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
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">AI Models & Persona</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Configure primary LLM engines, agent execution permissions, and workspace prompts.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
              Model & Reasoning
            </h3>
            <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Primary AI Model</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Select the main LLM powering chat, code assistance, and agent workflows
                  </p>
                </div>
                <Select value={defaultModel} onValueChange={setDefaultModel}>
                  <SelectTrigger className="w-56 h-8 text-xs bg-surface border-border">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o" className="text-xs">GPT-4o (Default Recommended)</SelectItem>
                    <SelectItem value="claude-3-5-sonnet" className="text-xs">Claude 3.5 Sonnet</SelectItem>
                    <SelectItem value="gemini-1-5-pro" className="text-xs">Gemini 1.5 Pro</SelectItem>
                    <SelectItem value="deepseek-r1" className="text-xs">DeepSeek R1</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Creativity / Temperature</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Control LLM randomness and precision</p>
                </div>
                <Select value={tempSetting} onValueChange={setTempSetting}>
                  <SelectTrigger className="w-40 h-8 text-xs bg-surface border-border">
                    <SelectValue placeholder="Balanced" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced" className="text-xs">Balanced (0.7)</SelectItem>
                    <SelectItem value="precise" className="text-xs">Precise (0.2)</SelectItem>
                    <SelectItem value="creative" className="text-xs">Creative (1.0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Context Window Size</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Maximum token length retained during conversations</p>
                </div>
                <Select value={contextWindow} onValueChange={setContextWindow}>
                  <SelectTrigger className="w-40 h-8 text-xs bg-surface border-border">
                    <SelectValue placeholder="128k Tokens" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="128k" className="text-xs">128k Tokens (Default)</SelectItem>
                    <SelectItem value="200k" className="text-xs">200k Tokens</SelectItem>
                    <SelectItem value="32k" className="text-xs">32k Tokens</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
              Autonomous Agent Permissions
            </h3>
            <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Auto-approve Agent Code Execution</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Allow agents to run shell and code commands automatically</p>
                </div>
                <Switch checked={agentAutoApprove} onCheckedChange={setAgentAutoApprove} />
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Web Search & Browsing Access</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Enable subagents to fetch live web content and documentation</p>
                </div>
                <Switch checked={allowWebSearch} onCheckedChange={setAllowWebSearch} />
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Workspace File Modification</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Permit AI agents to edit codebase files directly</p>
                </div>
                <Switch checked={allowFileSystem} onCheckedChange={setAllowFileSystem} />
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Max Agent Loop Turn Limit</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Maximum iteration steps per single task prompt</p>
                </div>
                <Select value={maxTurns} onValueChange={setMaxTurns}>
                  <SelectTrigger className="w-32 h-8 text-xs bg-surface border-border">
                    <SelectValue placeholder="25 turns" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25" className="text-xs">25 turns</SelectItem>
                    <SelectItem value="50" className="text-xs">50 turns</SelectItem>
                    <SelectItem value="10" className="text-xs">10 turns</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
              Workspace System Persona
            </h3>
            <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-4 space-y-3">
              <Textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={3}
                className="text-xs font-mono"
              />
              <p className="text-[11px] text-muted-foreground">
                This system prompt is injected into all AI chat sessions within this workspace.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- SECTION 5: AGENT MARKETPLACE & AUTOMATIONS ---------------- */}
      {currentTab === 'agent-marketplace' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Agent Marketplace & Tools</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Manage active AI agents, custom MCP tools, and external API keys.
            </p>
          </div>

          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
            {[
              { id: 'code-reviewer', name: 'Code Reviewer Agent', desc: 'Analyzes pull requests and identifies lint or security defects', active: true },
              { id: 'support-bot', name: 'Customer Support Bot', desc: 'Answers member questions using documentation context', active: true },
              { id: 'doc-summarizer', name: 'Doc Summarizer Agent', desc: 'Generates daily summaries of channel messages and notes', active: false },
            ].map((agent) => (
              <div key={agent.id} className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">{agent.name}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{agent.desc}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Button variant="outline" size="sm" className="h-7 text-[11px] px-2.5">
                    Configure
                  </Button>
                  <Switch defaultChecked={agent.active} />
                </div>
              </div>
            ))}
          </div>

          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-6 space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Custom API Keys</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-foreground">NVIDIA API Key (Default Provider)</label>
                <Input type="password" value="nvapi-••••••••••••••••" readOnly className="h-8 text-xs font-mono mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">OpenAI API Key</label>
                <Input type="password" value="sk-proj-••••••••••••••••" readOnly className="h-8 text-xs font-mono mt-1" />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">Anthropic API Key</label>
                <Input type="password" value="sk-ant-••••••••••••••••" readOnly className="h-8 text-xs font-mono mt-1" />
              </div>
            </div>
          </div>
        </div>
      )}

      {currentTab === 'automations' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Workflow Automations</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Configure event triggers, webhooks, and multi-step workflow execution logs.
            </p>
          </div>

          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">GitHub PR Event Webhook</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Trigger automation workflows on incoming GitHub pull requests</p>
              </div>
              <Switch checked={githubPRWebhook} onCheckedChange={setGithubPRWebhook} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Channel Message Keywords Trigger</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Fire workflows when specific key phrases appear in channels</p>
              </div>
              <Switch checked={channelTrigger} onCheckedChange={setChannelTrigger} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Max Concurrent Workflow Runs</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Limit parallel execution capacity</p>
              </div>
              <Select value={maxConcurrentRuns} onValueChange={setMaxConcurrentRuns}>
                <SelectTrigger className="w-36 h-8 text-xs bg-surface border-border">
                  <SelectValue placeholder="5 runs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5" className="text-xs">5 parallel runs</SelectItem>
                  <SelectItem value="10" className="text-xs">10 parallel runs</SelectItem>
                  <SelectItem value="1" className="text-xs">1 parallel run</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Auto-retry failed workflow steps</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Retry failed HTTP steps up to 3 times automatically</p>
              </div>
              <Switch checked={retryFailedSteps} onCheckedChange={setRetryFailedSteps} />
            </div>
          </div>
        </div>
      )}

      {/* ---------------- SECTION 6: WORK TOOLS ---------------- */}
      {currentTab === 'channels' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Channels & DMs</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Configure default channels, member creation rules, and message privacy.
            </p>
          </div>

          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Default Join Channel</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Channel automatically joined by new workspace members</p>
              </div>
              <Select value={defaultChannel} onValueChange={setDefaultChannel}>
                <SelectTrigger className="w-36 h-8 text-xs bg-surface border-border">
                  <SelectValue placeholder="#general" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general" className="text-xs">#general</SelectItem>
                  <SelectItem value="announcements" className="text-xs">#announcements</SelectItem>
                  <SelectItem value="random" className="text-xs">#random</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Allow Public Channel Creation</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Regular members can create public channels</p>
              </div>
              <Switch checked={allowPublicCreation} onCheckedChange={setAllowPublicCreation} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Allow Private Channel Creation</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Regular members can create private invite-only channels</p>
              </div>
              <Switch checked={allowPrivateCreation} onCheckedChange={setAllowPrivateCreation} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Auto-archive Inactive Channels</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Archive channels after a period of zero activity</p>
              </div>
              <Select value={archiveInactiveDays} onValueChange={setArchiveInactiveDays}>
                <SelectTrigger className="w-32 h-8 text-xs bg-surface border-border">
                  <SelectValue placeholder="90 days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90" className="text-xs">90 days</SelectItem>
                  <SelectItem value="30" className="text-xs">30 days</SelectItem>
                  <SelectItem value="never" className="text-xs">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Direct Message End-to-End Encryption</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Encrypt DM content between 1-on-1 team members</p>
              </div>
              <Switch checked={encryptedDM} onCheckedChange={setEncryptedDM} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Direct Message Read Receipts</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Show when messages have been seen by recipient</p>
              </div>
              <Switch checked={readReceipts} onCheckedChange={setReadReceipts} />
            </div>
          </div>
        </div>
      )}

      {currentTab === 'kanban-tasks' && kanbanPanel}

      {currentTab === 'documents' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Notes & Documents</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Document editor preferences, auto-save, and Markdown syntax themes.
            </p>
          </div>

          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Auto-save Drafts</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Automatically save document edits as you type</p>
              </div>
              <Switch checked={docAutoSave} onCheckedChange={setDocAutoSave} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Grammar & Spellcheck Assistance</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Highlight spelling defects and grammar suggestions in editor</p>
              </div>
              <Switch checked={grammarAssistance} onCheckedChange={setGrammarAssistance} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Code Syntax Highlighting Theme</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Theme used for code snippets inside document blocks</p>
              </div>
              <Select value={codeSyntaxTheme} onValueChange={setCodeSyntaxTheme}>
                <SelectTrigger className="w-40 h-8 text-xs bg-surface border-border">
                  <SelectValue placeholder="Github Dark" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="github-dark" className="text-xs">Github Dark</SelectItem>
                  <SelectItem value="one-dark" className="text-xs">One Dark</SelectItem>
                  <SelectItem value="dracula" className="text-xs">Dracula</SelectItem>
                  <SelectItem value="vs-light" className="text-xs">VS Light</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {currentTab === 'files' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Files & Storage</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Workspace storage allocation, high quality media previews, and retention.
            </p>
          </div>

          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-6 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">Workspace Storage Used</span>
              <span className="text-muted-foreground font-mono">12.4 GB / 50.0 GB</span>
            </div>
            <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
              <div className="bg-primary h-full w-[25%] rounded-full transition-all" />
            </div>
          </div>

          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">High Quality Video & Media Previews</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Generate high-res video thumbnails and audio waveform previews</p>
              </div>
              <Switch checked={highQualityVideo} onCheckedChange={setHighQualityVideo} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">File Retention Policy</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Duration to keep deleted files in workspace trash</p>
              </div>
              <Select value={fileRetention} onValueChange={setFileRetention}>
                <SelectTrigger className="w-32 h-8 text-xs bg-surface border-border">
                  <SelectValue placeholder="Forever" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="forever" className="text-xs">Forever</SelectItem>
                  <SelectItem value="1year" className="text-xs">1 Year</SelectItem>
                  <SelectItem value="6months" className="text-xs">6 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {currentTab === 'schedule' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Schedule & Meetings</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Configure calendar integrations, default meeting provider, and auto-record settings.
            </p>
          </div>

          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Google Calendar Sync</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Synchronize schedule events with your Google Calendar</p>
              </div>
              <Switch checked={googleCalendarSync} onCheckedChange={setGoogleCalendarSync} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Default Meeting Room Provider</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Provider used when generating instant meeting links</p>
              </div>
              <Select value={meetingProvider} onValueChange={setMeetingProvider}>
                <SelectTrigger className="w-44 h-8 text-xs bg-surface border-border">
                  <SelectValue placeholder="Onetab Meet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onetab-meet" className="text-xs">Onetab Native Meet</SelectItem>
                  <SelectItem value="google-meet" className="text-xs">Google Meet</SelectItem>
                  <SelectItem value="zoom" className="text-xs">Zoom Meetings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Auto-record Team Meetings</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Automatically save video transcript and recording to workspace docs</p>
              </div>
              <Switch checked={autoRecordMeetings} onCheckedChange={setAutoRecordMeetings} />
            </div>
          </div>
        </div>
      )}

      {currentTab === 'pulse' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Pulse Activity Feed</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Configure online status tracking and workspace activity event filters.
            </p>
          </div>

          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Track Member Online Status</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Show active presence indicators across channel list</p>
              </div>
              <Switch checked={trackOnlineStatus} onCheckedChange={setTrackOnlineStatus} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Include GitHub Commit Events in Pulse</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Display code commit events inside workspace pulse feed</p>
              </div>
              <Switch checked={trackCommitsInPulse} onCheckedChange={setTrackCommitsInPulse} />
            </div>
          </div>
        </div>
      )}

      {/* ---------------- SECTION 7: INTEGRATIONS & IMPORT ---------------- */}
      {currentTab === 'integrations' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Integration Hub</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Connect external web services, OAuth providers, and dev tools.
            </p>
          </div>

          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
            {[
              { id: 'slack', name: 'Slack Integration', desc: 'Sync channel messages and notifications', connected: true },
              { id: 'notion', name: 'Notion Workspace', desc: 'Import and sync Notion documents', connected: true },
              { id: 'github', name: 'GitHub OAuth', desc: 'Pull request reviews and commit triggers', connected: true },
              { id: 'google', name: 'Google Workspace', desc: 'Calendar sync and Drive attachment previews', connected: false },
            ].map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between gap-4 hover:bg-accent/40 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">{item.name}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                {item.connected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-success-text bg-success/10 px-2 py-0.5 rounded font-medium">
                    <CheckCircle2 className="size-3" />
                    Connected
                  </span>
                ) : (
                  <Button variant="outline" size="sm" className="h-7 text-xs px-2.5">
                    Connect
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {currentTab === 'import-export' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Import & Export</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Migrate channels, messages, and documents from Slack or Notion.
            </p>
          </div>

          <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-6">
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
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Workspace General Settings</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Configure your workspace identity, branding, and core preferences.
            </p>
          </div>

          <Form {...workspaceForm}>
            <form onSubmit={onWorkspaceSubmit} className="space-y-8" noValidate>
              <FormError error={formErrorMessage(updateWorkspace.error)} />

              {/* CARD 1: Workspace Details */}
              <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-6 space-y-6">
                <div className="flex items-center gap-5 pb-6 border-b border-border/40">
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
                      Workspace Details — identity, branding logo, and contact info.
                    </p>
                  </div>
                </div>

                {/* Workspace Logo Upload */}
                <div>
                  <label className="text-xs font-medium text-foreground mb-2 block">
                    Workspace Logo <span className="font-normal text-muted-foreground">(Optional)</span>
                  </label>
                  <div className="gap-4 p-4 flex items-center rounded-xl border border-border bg-background max-w-xl">
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
                            className="border-border-strong bg-surface-raised text-foreground hover:bg-selected h-8 text-xs"
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
                              className="text-muted-foreground hover:text-destructive h-8 text-xs"
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
                        <p className="text-xs mt-1 text-destructive">{logoError}</p>
                      )}
                    </div>
                  </div>

                  <input
                    ref={logoInputRef}
                    type="file"
                    accept={WORKSPACE_LOGO_MIME_TYPES.join(',')}
                    className="hidden"
                    disabled={!isAdmin}
                    onChange={(event) => handleSelectLogo(event.target.files?.[0])}
                  />
                </div>

                <div className="max-w-xl space-y-5">
                  <FormField
                    control={workspaceForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Workspace Name</FormLabel>
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
                    <label className="text-xs font-medium text-foreground block">
                      Workspace URL
                    </label>
                    <div className="relative">
                      <Input
                        value={workspace.slug}
                        readOnly
                        disabled
                        className="pl-3 pr-24 text-xs border-border bg-background/50 font-mono text-foreground select-all"
                      />
                      <span className="right-3 text-[11px] px-2 py-0.5 rounded absolute top-1/2 -translate-y-1/2 border border-border-strong bg-surface-raised font-mono text-muted-foreground">
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
                        className="h-6 px-2 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
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
                        <FormLabel className="text-xs font-medium">Support / Contact Email</FormLabel>
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
                          Contact address displayed to invited members and helpdesk notifications.
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
                        <FormLabel className="text-xs font-medium">Workspace Accent Color</FormLabel>
                        <FormControl>
                          <div className="flex flex-wrap items-center gap-2.5 pt-1">
                            {[
                              { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-600' },
                              { id: 'blue', label: 'Blue', bg: 'bg-blue-600' },
                              { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-600' },
                              { id: 'amber', label: 'Amber', bg: 'bg-amber-600' },
                              { id: 'rose', label: 'Rose', bg: 'bg-rose-600' },
                              { id: 'purple', label: 'Purple', bg: 'bg-purple-600' },
                              { id: 'cyan', label: 'Cyan', bg: 'bg-cyan-600' },
                            ].map((col) => {
                              const isSelected = (field.value || 'indigo') === col.id;
                              return (
                                <button
                                  key={col.id}
                                  type="button"
                                  disabled={!isAdmin}
                                  onClick={() => field.onChange(col.id)}
                                  className={cn(
                                    'h-7 w-7 rounded-full flex items-center justify-center transition-all',
                                    col.bg,
                                    isSelected
                                      ? 'ring-2 ring-offset-2 ring-foreground/60 scale-110'
                                      : 'opacity-80 hover:opacity-100 hover:scale-105'
                                  )}
                                  aria-label={col.label}
                                  title={col.label}
                                >
                                  {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                                </button>
                              );
                            })}
                          </div>
                        </FormControl>
                        <FormDescription className="text-[11px]">
                          Primary brand tone used in sidebar accents, buttons, and highlights.
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={workspaceForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Description</FormLabel>
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
              </div>

              {/* CARD 2: Workspace Preferences */}
              <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Workspace Preferences
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Customize default navigation and sharing capabilities across your team.
                  </p>
                </div>

                <div className="max-w-xl space-y-5">
                  <FormField
                    control={workspaceForm.control}
                    name="defaultLandingView"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium">Default Landing View</FormLabel>
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
                            <SelectItem value="home">Workspace Home (Dashboard)</SelectItem>
                            <SelectItem value="projects">Projects & Sprints</SelectItem>
                            <SelectItem value="tasks">Kanban Tasks</SelectItem>
                            <SelectItem value="chat">Chat Channels</SelectItem>
                            <SelectItem value="docs">Documents & Knowledge Base</SelectItem>
                            <SelectItem value="meetings">Video Meetings</SelectItem>
                            <SelectItem value="agents">AI Agents & Workflows</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription className="text-[11px]">
                          The initial view members see upon switching to or opening this workspace.
                        </FormDescription>
                      </FormItem>
                    )}
                  />

                  <div className="pt-2 border-t border-border/40 space-y-4">
                    <FormField
                      control={workspaceForm.control}
                      name="allowExternalSharing"
                      render={({ field }) => (
                        <FormItem className="flex items-center justify-between rounded-xl border border-border p-4 bg-background">
                          <div className="space-y-0.5 pr-4">
                            <FormLabel className="text-xs font-medium cursor-pointer">
                              External Public Sharing
                            </FormLabel>
                            <FormDescription className="text-[11px]">
                              Allow members to create view-only public links for documents, canvases, and roadmaps.
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
                        <FormItem className="flex items-center justify-between rounded-xl border border-border p-4 bg-background">
                          <div className="space-y-0.5 pr-4">
                            <FormLabel className="text-xs font-medium cursor-pointer">
                              AI Project Recaps & Activity Digest
                            </FormLabel>
                            <FormDescription className="text-[11px]">
                              Automatically generate weekly AI project progress digests and action item summaries.
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
              </div>
            </form>
          </Form>
        </div>
      )}

      {/* ---------------- SECTION 9: ACCOUNT SECURITY ---------------- */}
      {currentTab === 'security' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Account Security & Access</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Manage authentication credentials, two-factor factors, and active sessions across your devices.
            </p>
          </div>

          {/* 1. SIGN-IN SECURITY CARDS */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Sign-In Security
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Password Card */}
              <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                      <Lock className="h-4 w-4" />
                    </div>
                    <Badge variant="outline" className="text-[10px] uppercase font-semibold text-emerald-600 bg-emerald-500/10 border-emerald-500/20">
                      Strong
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Password</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Last changed on{' '}
                      {securityOverviewQuery.data?.password.lastChangedAt
                        ? new Date(securityOverviewQuery.data.password.lastChangedAt).toLocaleDateString()
                        : 'Recently'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setChangePasswordModalOpen(true)}
                  className="w-full text-xs h-8"
                >
                  Change password
                </Button>
              </div>

              {/* Single Sign-On (SSO) Card */}
              <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-500">
                      <Globe className="h-4 w-4" />
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] uppercase font-semibold',
                        securityOverviewQuery.data?.sso.isConnected
                          ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-muted-foreground bg-muted/40 border-border'
                      )}
                    >
                      {securityOverviewQuery.data?.sso.isConnected ? 'Connected' : 'Not Connected'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Single Sign-On (SSO)</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
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
                  className="w-full text-xs h-8 text-muted-foreground"
                >
                  Manage SSO in Enterprise
                </Button>
              </div>

              {/* 2FA Status Card */}
              <div className="bg-surface-inset rounded-2xl border border-border shadow-xs p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                      <Shield className="h-4 w-4" />
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px] uppercase font-semibold',
                        securityOverviewQuery.data?.twoFactor.isEnabled
                          ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                          : 'text-amber-600 bg-amber-500/10 border-amber-500/20'
                      )}
                    >
                      {securityOverviewQuery.data?.twoFactor.isEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">Two-Factor Authentication</h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
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
                    className="w-full text-xs h-8 text-destructive hover:text-destructive"
                  >
                    Disable 2FA
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartTotpSetup}
                    loading={setupTotpMutation.isPending}
                    className="w-full text-xs h-8"
                  >
                    Set up 2FA
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* 2. AUTHENTICATION FACTORS SECTION */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Authentication Factors
            </h2>
            <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
              {/* Authenticator TOTP Row */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-surface-raised border border-border flex shrink-0 items-center justify-center text-foreground">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-foreground">Authenticator App (TOTP)</h4>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px] font-medium',
                          securityOverviewQuery.data?.twoFactor.isEnabled
                            ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                            : 'text-muted-foreground bg-muted/40 border-border'
                        )}
                      >
                        {securityOverviewQuery.data?.twoFactor.isEnabled ? 'Configured' : 'Not configured'}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-lg">
                      Use apps like Google Authenticator, 1Password, Authy, or Apple Keychain to generate verification codes.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
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
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-surface-raised border border-border flex shrink-0 items-center justify-center text-foreground">
                    <Key className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-foreground">Passkeys & Security Keys (WebAuthn)</h4>
                      <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground bg-muted/40 border-border">
                        {webAuthnQuery.data?.length ?? 0} registered
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-lg">
                      Sign in seamlessly using biometric hardware (Touch ID, Face ID, Windows Hello) or physical FIDO2 keys.
                    </p>
                    {/* List registered passkeys */}
                    {webAuthnQuery.data && webAuthnQuery.data.length > 0 && (
                      <div className="mt-3 space-y-2">
                        {webAuthnQuery.data.map((key) => (
                          <div key={key.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-background border border-border max-w-md">
                            <div className="flex items-center gap-2">
                              <Key className="h-3.5 w-3.5 text-primary" />
                              <span className="font-medium text-foreground">{key.deviceName || 'Security Key'}</span>
                              <span className="text-[10px] text-muted-foreground">
                                • Added {new Date(key.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteWebAuthnMutation.mutate(key.id)}
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
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-surface-raised border border-border flex shrink-0 items-center justify-center text-foreground">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-semibold text-foreground">Backup Recovery Codes</h4>
                      <Badge variant="outline" className="text-[10px] font-medium text-muted-foreground bg-muted/40 border-border">
                        Emergency access
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 max-w-lg">
                      One-time use backup codes for account recovery when your phone or authenticator device is unavailable.
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
            </div>
          </div>

          {/* 3. ACTIVE SESSIONS SECTION */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Active Sessions
                  </h2>
                  <Badge variant="outline" className="text-[10px] font-medium text-primary bg-primary/10 border-primary/20">
                    {sessionsQuery.data?.length ?? 1} signed in
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Devices authenticated with your account. Revoke any unrecognized sessions immediately.
                </p>
              </div>
              {(sessionsQuery.data?.length ?? 0) > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRevokeOtherModalOpen(true)}
                  className="text-xs h-8 text-destructive hover:text-destructive border-destructive/30"
                >
                  <LogOut className="h-3.5 w-3.5 mr-1.5" />
                  Revoke other sessions
                </Button>
              )}
            </div>

            <div className="bg-surface-inset rounded-2xl border border-border shadow-xs divide-y divide-border/40 overflow-hidden">
              {sessionsQuery.isLoading ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Loading active sessions...</div>
              ) : sessionsQuery.data && sessionsQuery.data.length > 0 ? (
                sessionsQuery.data.map((sess) => {
                  const DeviceIcon =
                    sess.deviceType === 'mobile'
                      ? Smartphone
                      : sess.deviceType === 'tablet'
                      ? Tablet
                      : Laptop;

                  return (
                    <div key={sess.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-xl bg-surface-raised border border-border flex shrink-0 items-center justify-center text-foreground">
                          <DeviceIcon className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-semibold text-foreground">
                              {sess.browser} on {sess.os}
                            </h4>
                            {sess.isCurrent && (
                              <Badge className="text-[10px] bg-primary text-primary-foreground font-semibold">
                                Current session
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                            <span>{sess.location}</span>
                            <span>•</span>
                            <span className="font-mono">{sess.ipAddress || '127.0.0.1'}</span>
                            <span>•</span>
                            <span>Signed in {new Date(sess.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                        {sess.isCurrent ? (
                          <span className="text-xs text-muted-foreground italic px-2">This device</span>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRevokeModalSession(sess)}
                            className="text-xs h-8 text-destructive hover:text-destructive border-border"
                          >
                            Revoke
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">No active sessions found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {currentTab === 'danger' && isOwner && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-destructive">Danger Zone</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Archiving is reversible. Deletion is not.
            </p>
          </div>

          {/*
            Archive sits above delete deliberately: it answers most of the same
            need — stop this workspace being used — without discarding anything,
            so it should be the one the eye reaches first.
          */}
          {isArchived ? (
            <div className="bg-muted/40 border border-border rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Restore Workspace
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-lg">
                  <strong className="text-foreground">{workspace.name}</strong> is
                  archived. Everyone can still read it, but nobody can make
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
            <div className="bg-muted/40 border border-border rounded-xl p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  Archive Workspace
                </h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-lg">
                  Freeze <strong className="text-foreground">{workspace.name}</strong>.
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

          <div className="bg-destructive/5 border border-destructive/30 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-destructive">Delete Workspace</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-lg">
                Permanently delete <strong className="text-foreground">{workspace.name}</strong>,
                including all channels, activity logs, documents, and integrations.
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
              This permanently deletes {workspace.channelCount} channels and removes{' '}
              {workspace.memberCount} members. Type the workspace slug to confirm.
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
      <Dialog open={changePasswordModalOpen} onOpenChange={setChangePasswordModalOpen}>
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
                    <FormLabel className="text-xs font-medium">Current password</FormLabel>
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
                    <FormLabel className="text-xs font-medium">New password</FormLabel>
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
                    <FormLabel className="text-xs font-medium">Confirm new password</FormLabel>
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
                  <Button type="button" variant="ghost" size="sm" className="text-xs">
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
              Scan the setup code or enter the key manually into your authenticator app.
            </DialogDescription>
          </DialogHeader>

          {totpBackupCodes ? (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 text-xs">
                Two-factor authentication is now active! Please save these emergency recovery codes in a safe place.
              </div>
              <div className="grid grid-cols-2 gap-2 p-3 bg-muted/40 rounded-xl border border-border font-mono text-xs text-center">
                {totpBackupCodes.map((code, idx) => (
                  <div key={idx} className="p-1.5 bg-background rounded border border-border/60">
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
              <div className="p-3 bg-muted/40 rounded-xl border border-border space-y-2">
                <p className="text-xs text-muted-foreground">
                  Manual secret key:
                </p>
                <div className="flex items-center justify-between gap-2 p-2 bg-background rounded-lg border border-border">
                  <code className="font-mono text-xs text-primary select-all break-all">
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
                    {totpCopiedSecret ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground block">
                  6-Digit Verification Code
                </label>
                <Input
                  value={totpCodeInput}
                  onChange={(e) => setTotpCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="h-10 text-center font-mono text-base tracking-widest"
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
      <Dialog open={disableTotpModalOpen} onOpenChange={setDisableTotpModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Disable Two-Factor Authentication?</DialogTitle>
            <DialogDescription>
              Turning off 2FA reduces your account security. Confirm your password to proceed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground block">
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
      <Dialog open={recoveryCodesModalOpen} onOpenChange={setRecoveryCodesModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Backup Recovery Codes</DialogTitle>
            <DialogDescription>
              Each code can only be used once. Store these safely.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-2 p-3 bg-muted/40 rounded-xl border border-border font-mono text-xs text-center">
              {recoveryCodesList.map((code, idx) => (
                <div key={idx} className="p-1.5 bg-background rounded border border-border/60">
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
              Assign a recognizable device name for this biometric or physical key.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground block">
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
                    await revokeSessionMutation.mutateAsync(revokeModalSession.id);
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
      <Dialog open={revokeOtherModalOpen} onOpenChange={setRevokeOtherModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke All Other Sessions?</DialogTitle>
            <DialogDescription>
              This will sign out your account from all other browsers and devices. Only your current session will remain active.
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
