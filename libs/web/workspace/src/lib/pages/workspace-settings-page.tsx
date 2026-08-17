import { zodResolver } from '@hookform/resolvers/zod';
import { http, userApi } from '@org/api-client';
import { formErrorMessage, useAuthStore, useCurrentUser } from '@org/auth';
import { useTheme } from '@org/design-system';
import { WorkspaceIconPicker } from '@org/icons';
import {
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
} from '@org/ui';
import { describeTimezone, getSystemTimezone, initials } from '@org/utils';
import { WorkspaceRole, hasWorkspaceRole } from '@org/types';
import {
  changePasswordSchema,
  updateProfileSchema,
  updateWorkspaceSchema,
  type ChangePasswordInput,
  type UpdateProfileInput,
  type UpdateWorkspaceInput,
} from '@org/validation';
import { useMutation } from '@tanstack/react-query';
import {
  Moon,
  Sun,
  Monitor,
  CheckCircle2,
  Upload,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useSearchParams } from 'react-router-dom';
import { DesktopSettingsCard } from '@org/web-desktop';
import { SlackNotionImportView } from '@org/web-integrations';
import {
  useCurrentWorkspace,
  useDeleteWorkspace,
  useUpdateWorkspace,
} from '../use-workspaces.js';
import { SettingsLayout } from '../settings-layout.js';

export function WorkspaceSettingsPage() {
  const { workspace, workspaceId, isLoading } = useCurrentWorkspace();
  const updateWorkspace = useUpdateWorkspace(workspaceId);
  const deleteWorkspace = useDeleteWorkspace();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const user = useCurrentUser();
  const setUser = useAuthStore((state) => state.setUser);
  /* The zone this device is in — offered as the default and used to point out
     when the saved profile disagrees with where the user actually is. */
  const systemTimezone = getSystemTimezone();

  const isImportExportRoute =
    location.pathname.endsWith('/import-export') ||
    location.pathname.endsWith('/integrations/import');

  const currentTab = isImportExportRoute
    ? 'import-export'
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
  const [pointerCursors, setPointerCursors] = useState(false);
  const [underlineLinks, setUnderlineLinks] = useState(false);

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

  // Notifications States
  const [notifyMentions, setNotifyMentions] = useState(true);
  const [notifyInvites, setNotifyInvites] = useState(true);
  const [notifyDigest, setNotifyDigest] = useState(false);
  const [notifyAgentAlerts, setNotifyAgentAlerts] = useState(true);
  const [notifyDesktopPush, setNotifyDesktopPush] = useState(true);
  const [notifyChannelScope, setNotifyChannelScope] = useState('all');

  // Work Tools Feature States
  const [defaultChannel, setDefaultChannel] = useState('general');
  const [allowPublicCreation, setAllowPublicCreation] = useState(true);
  const [allowPrivateCreation, setAllowPrivateCreation] = useState(true);
  const [archiveInactiveDays, setArchiveInactiveDays] = useState('90');
  const [encryptedDM, setEncryptedDM] = useState(true);
  const [readReceipts, setReadReceipts] = useState(true);

  const [kanbanDefaultView, setKanbanDefaultView] = useState('board');
  const [showTaskAge, setShowTaskAge] = useState(true);
  const [enableWipLimits, setEnableWipLimits] = useState(false);
  const [autoArchiveCompleted, setAutoArchiveCompleted] = useState('30');

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
  const [passwordChanged, setPasswordChanged] = useState(false);

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
      description: workspace?.description ?? '',
      avatarUrl: workspace?.avatarUrl ?? '',
    },
  });

  // Password Change Mutation & Form
  const changePassword = useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      http.post('/auth/change-password', input).then(() => undefined),
    onSuccess: () => setPasswordChanged(true),
  });

  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  });

  if (isLoading || !workspace) return <LoadingState fullPage />;

  const isAdmin = hasWorkspaceRole(workspace.role, WorkspaceRole.ADMIN);
  const isOwner = workspace.role === WorkspaceRole.OWNER;

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

  const onWorkspaceSubmit = workspaceForm.handleSubmit(async (values) => {
    try {
      await updateWorkspace.mutateAsync({
        ...values,
        avatarUrl: values.avatarUrl || null,
      });
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

  return (
    <SettingsLayout activeTab={currentTab} onTabChange={handleTabChange}>
      {/* ---------------- SECTION 1: PREFERENCES ---------------- */}
      {currentTab === 'preferences' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Preferences</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Customize app appearance, default home views, and keyboard interaction.
            </p>
          </div>

          {/* Subsection: General */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
              General
            </h3>
            <div className="bg-card rounded-xl border border-border/70 shadow-2xs divide-y divide-border/40 overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Default home view</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Select which view to display when launching Onetab-AI
                  </p>
                </div>
                <Select value={homeView} onValueChange={setHomeView}>
                  <SelectTrigger className="w-52 h-8 text-xs bg-muted/30 border-border/60">
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

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Display names</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Select how names are displayed across the interface
                  </p>
                </div>
                <Select value={displayNamePref} onValueChange={setDisplayNamePref}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-muted/30 border-border/60">
                    <SelectValue placeholder="Username" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="username" className="text-xs">Username</SelectItem>
                    <SelectItem value="fullname" className="text-xs">Full name</SelectItem>
                    <SelectItem value="displayname" className="text-xs">Display name</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">First day of the week</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Used for date pickers and schedule views
                  </p>
                </div>
                <Select value={firstDay} onValueChange={setFirstDay}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-muted/30 border-border/60">
                    <SelectValue placeholder="Monday" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monday" className="text-xs">Monday</SelectItem>
                    <SelectItem value="sunday" className="text-xs">Sunday</SelectItem>
                    <SelectItem value="saturday" className="text-xs">Saturday</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Convert text emoticons into emojis</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Strings like <code className="bg-muted px-1 rounded text-[10px]">:)</code> will be converted to 😄
                  </p>
                </div>
                <Switch checked={convertEmojis} onCheckedChange={setConvertEmojis} />
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Send comments on...</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Choose which key press is used to submit messages and comments
                  </p>
                </div>
                <Select value={sendShortcut} onValueChange={setSendShortcut}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-muted/30 border-border/60">
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
            <div className="bg-card rounded-xl border border-border/70 shadow-2xs divide-y divide-border/40 overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">App sidebar</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Customize sidebar item visibility, ordering, and badge style
                  </p>
                </div>
                <Button variant="outline" size="sm" className="h-8 text-xs px-3">
                  Customize
                </Button>
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Font size</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Adjust the size of text across the app
                  </p>
                </div>
                <Select value={fontSize} onValueChange={setFontSize}>
                  <SelectTrigger className="w-32 h-8 text-xs bg-muted/30 border-border/60">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default" className="text-xs">Default</SelectItem>
                    <SelectItem value="compact" className="text-xs">Compact</SelectItem>
                    <SelectItem value="large" className="text-xs">Large</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Use pointer cursors</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Change the cursor to a pointer when hovering over interactive elements
                  </p>
                </div>
                <Switch checked={pointerCursors} onCheckedChange={setPointerCursors} />
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Underline links</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Always underline links in text content
                  </p>
                </div>
                <Switch checked={underlineLinks} onCheckedChange={setUnderlineLinks} />
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
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
                    <Sun className="size-3.5 text-amber-500" />
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
                    <Moon className="size-3.5 text-indigo-400" />
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
        </div>
      )}

      {/* ---------------- SECTION 2: PROFILE ---------------- */}
      {currentTab === 'profile' && user && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Profile & Details</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Manage your member avatar, display identity, and timezone.
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border/70 shadow-2xs p-6 space-y-6">
            <div className="flex items-center gap-5 pb-6 border-b border-border/40">
              <UserAvatar
                name={user.displayName ?? user.name}
                src={profileForm.watch('avatarUrl') || user.avatarUrl}
                seed={user.id}
                size="xl"
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
                  it was created with, and the times other people saw against
                  this member were whatever that happened to be.
                */}
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
                        <FormDescription className="text-[11px] text-muted-foreground mt-1">
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <span>Your local time is</span>
                            <LocalTime
                              timezone={zone}
                              showOffset
                              className="font-medium text-foreground"
                            />
                            <span>·</span>
                            <span>
                              {zone === systemTimezone
                                ? 'matches this device'
                                : `this device is set to ${describeTimezone(systemTimezone)}`}
                            </span>
                          </span>
                          <span className="mt-1 block">
                            Used for the clock in the header, for the local time
                            teammates see beside your name, and for scheduling.
                          </span>
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />

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
        </div>
      )}

      {/* ---------------- SECTION 3: NOTIFICATIONS ---------------- */}
      {currentTab === 'notifications' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Notifications & Alerts</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Configure alert triggers, notification delivery channels, and email digests.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-muted-foreground tracking-wide uppercase px-1">
              Delivery Channels
            </h3>
            <div className="bg-card rounded-xl border border-border/70 shadow-2xs divide-y divide-border/40 overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Mentions and thread replies</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Get notified when tagged or when a thread you follow has updates</p>
                </div>
                <Switch checked={notifyMentions} onCheckedChange={setNotifyMentions} />
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Workspace invitations & requests</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Receive alerts when new members request to join the workspace</p>
                </div>
                <Switch checked={notifyInvites} onCheckedChange={setNotifyInvites} />
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">AI Agent task completion alerts</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Receive high-priority alerts when background AI tasks finish</p>
                </div>
                <Switch checked={notifyAgentAlerts} onCheckedChange={setNotifyAgentAlerts} />
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Desktop push notifications</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Send native operating system notifications</p>
                </div>
                <Switch checked={notifyDesktopPush} onCheckedChange={setNotifyDesktopPush} />
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Channel activity scope</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Filter volume of activity notifications</p>
                </div>
                <Select value={notifyChannelScope} onValueChange={setNotifyChannelScope}>
                  <SelectTrigger className="w-36 h-8 text-xs bg-muted/30 border-border/60">
                    <SelectValue placeholder="All activity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All activity</SelectItem>
                    <SelectItem value="mentions" className="text-xs">Mentions only</SelectItem>
                    <SelectItem value="nothing" className="text-xs">Nothing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Weekly email digest</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Receive a summary of key weekly accomplishments and updates</p>
                </div>
                <Switch checked={notifyDigest} onCheckedChange={setNotifyDigest} />
              </div>
            </div>
          </div>
        </div>
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
            <div className="bg-card rounded-xl border border-border/70 shadow-2xs divide-y divide-border/40 overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Primary AI Model</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Select the main LLM powering chat, code assistance, and agent workflows
                  </p>
                </div>
                <Select value={defaultModel} onValueChange={setDefaultModel}>
                  <SelectTrigger className="w-56 h-8 text-xs bg-muted/30 border-border/60">
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

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Creativity / Temperature</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Control LLM randomness and precision</p>
                </div>
                <Select value={tempSetting} onValueChange={setTempSetting}>
                  <SelectTrigger className="w-40 h-8 text-xs bg-muted/30 border-border/60">
                    <SelectValue placeholder="Balanced" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="balanced" className="text-xs">Balanced (0.7)</SelectItem>
                    <SelectItem value="precise" className="text-xs">Precise (0.2)</SelectItem>
                    <SelectItem value="creative" className="text-xs">Creative (1.0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Context Window Size</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Maximum token length retained during conversations</p>
                </div>
                <Select value={contextWindow} onValueChange={setContextWindow}>
                  <SelectTrigger className="w-40 h-8 text-xs bg-muted/30 border-border/60">
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
            <div className="bg-card rounded-xl border border-border/70 shadow-2xs divide-y divide-border/40 overflow-hidden">
              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Auto-approve Agent Code Execution</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Allow agents to run shell and code commands automatically</p>
                </div>
                <Switch checked={agentAutoApprove} onCheckedChange={setAgentAutoApprove} />
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Web Search & Browsing Access</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Enable subagents to fetch live web content and documentation</p>
                </div>
                <Switch checked={allowWebSearch} onCheckedChange={setAllowWebSearch} />
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Workspace File Modification</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Permit AI agents to edit codebase files directly</p>
                </div>
                <Switch checked={allowFileSystem} onCheckedChange={setAllowFileSystem} />
              </div>

              <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">Max Agent Loop Turn Limit</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Maximum iteration steps per single task prompt</p>
                </div>
                <Select value={maxTurns} onValueChange={setMaxTurns}>
                  <SelectTrigger className="w-32 h-8 text-xs bg-muted/30 border-border/60">
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
            <div className="bg-card rounded-xl border border-border/70 shadow-2xs p-4 space-y-3">
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

          <div className="bg-card rounded-xl border border-border/70 shadow-2xs divide-y divide-border/40 overflow-hidden">
            {[
              { id: 'code-reviewer', name: 'Code Reviewer Agent', desc: 'Analyzes pull requests and identifies lint or security defects', active: true },
              { id: 'support-bot', name: 'Customer Support Bot', desc: 'Answers member questions using documentation context', active: true },
              { id: 'doc-summarizer', name: 'Doc Summarizer Agent', desc: 'Generates daily summaries of channel messages and notes', active: false },
            ].map((agent) => (
              <div key={agent.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
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

          <div className="bg-card rounded-xl border border-border/70 shadow-2xs p-6 space-y-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">Custom API Keys</h3>
            <div className="space-y-3">
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

          <div className="bg-card rounded-xl border border-border/70 shadow-2xs divide-y divide-border/40 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">GitHub PR Event Webhook</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Trigger automation workflows on incoming GitHub pull requests</p>
              </div>
              <Switch checked={githubPRWebhook} onCheckedChange={setGithubPRWebhook} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Channel Message Keywords Trigger</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Fire workflows when specific key phrases appear in channels</p>
              </div>
              <Switch checked={channelTrigger} onCheckedChange={setChannelTrigger} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Max Concurrent Workflow Runs</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Limit parallel execution capacity</p>
              </div>
              <Select value={maxConcurrentRuns} onValueChange={setMaxConcurrentRuns}>
                <SelectTrigger className="w-36 h-8 text-xs bg-muted/30 border-border/60">
                  <SelectValue placeholder="5 runs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5" className="text-xs">5 parallel runs</SelectItem>
                  <SelectItem value="10" className="text-xs">10 parallel runs</SelectItem>
                  <SelectItem value="1" className="text-xs">1 parallel run</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
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

          <div className="bg-card rounded-xl border border-border/70 shadow-2xs divide-y divide-border/40 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Default Join Channel</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Channel automatically joined by new workspace members</p>
              </div>
              <Select value={defaultChannel} onValueChange={setDefaultChannel}>
                <SelectTrigger className="w-36 h-8 text-xs bg-muted/30 border-border/60">
                  <SelectValue placeholder="#general" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general" className="text-xs">#general</SelectItem>
                  <SelectItem value="announcements" className="text-xs">#announcements</SelectItem>
                  <SelectItem value="random" className="text-xs">#random</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Allow Public Channel Creation</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Regular members can create public channels</p>
              </div>
              <Switch checked={allowPublicCreation} onCheckedChange={setAllowPublicCreation} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Allow Private Channel Creation</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Regular members can create private invite-only channels</p>
              </div>
              <Switch checked={allowPrivateCreation} onCheckedChange={setAllowPrivateCreation} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Auto-archive Inactive Channels</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Archive channels after a period of zero activity</p>
              </div>
              <Select value={archiveInactiveDays} onValueChange={setArchiveInactiveDays}>
                <SelectTrigger className="w-32 h-8 text-xs bg-muted/30 border-border/60">
                  <SelectValue placeholder="90 days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90" className="text-xs">90 days</SelectItem>
                  <SelectItem value="30" className="text-xs">30 days</SelectItem>
                  <SelectItem value="never" className="text-xs">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Direct Message End-to-End Encryption</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Encrypt DM content between 1-on-1 team members</p>
              </div>
              <Switch checked={encryptedDM} onCheckedChange={setEncryptedDM} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Direct Message Read Receipts</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Show when messages have been seen by recipient</p>
              </div>
              <Switch checked={readReceipts} onCheckedChange={setReadReceipts} />
            </div>
          </div>
        </div>
      )}

      {currentTab === 'kanban-tasks' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Tasks & Kanban</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Board columns, task priority tags, and automated archiving rules.
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border/70 shadow-2xs divide-y divide-border/40 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Default Task Layout</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Select default view when opening project tasks</p>
              </div>
              <Select value={kanbanDefaultView} onValueChange={setKanbanDefaultView}>
                <SelectTrigger className="w-36 h-8 text-xs bg-muted/30 border-border/60">
                  <SelectValue placeholder="Board" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="board" className="text-xs">Kanban Board</SelectItem>
                  <SelectItem value="list" className="text-xs">Task List</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Show Task Age Indicator</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Display time elapsed since task creation on cards</p>
              </div>
              <Switch checked={showTaskAge} onCheckedChange={setShowTaskAge} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Enable WIP Limits per Column</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Restrict maximum active tasks per board status column</p>
              </div>
              <Switch checked={enableWipLimits} onCheckedChange={setEnableWipLimits} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Auto-archive Completed Tasks</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Move completed tasks to archive after set duration</p>
              </div>
              <Select value={autoArchiveCompleted} onValueChange={setAutoArchiveCompleted}>
                <SelectTrigger className="w-32 h-8 text-xs bg-muted/30 border-border/60">
                  <SelectValue placeholder="30 days" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30" className="text-xs">30 days</SelectItem>
                  <SelectItem value="7" className="text-xs">7 days</SelectItem>
                  <SelectItem value="never" className="text-xs">Never</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {currentTab === 'documents' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Notes & Documents</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Document editor preferences, auto-save, and Markdown syntax themes.
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border/70 shadow-2xs divide-y divide-border/40 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Auto-save Drafts</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Automatically save document edits as you type</p>
              </div>
              <Switch checked={docAutoSave} onCheckedChange={setDocAutoSave} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Grammar & Spellcheck Assistance</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Highlight spelling defects and grammar suggestions in editor</p>
              </div>
              <Switch checked={grammarAssistance} onCheckedChange={setGrammarAssistance} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Code Syntax Highlighting Theme</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Theme used for code snippets inside document blocks</p>
              </div>
              <Select value={codeSyntaxTheme} onValueChange={setCodeSyntaxTheme}>
                <SelectTrigger className="w-40 h-8 text-xs bg-muted/30 border-border/60">
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

          <div className="bg-card rounded-xl border border-border/70 shadow-2xs p-6 space-y-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">Workspace Storage Used</span>
              <span className="text-muted-foreground font-mono">12.4 GB / 50.0 GB</span>
            </div>
            <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
              <div className="bg-primary h-full w-[25%] rounded-full transition-all" />
            </div>
          </div>

          <div className="bg-card rounded-xl border border-border/70 shadow-2xs divide-y divide-border/40 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">High Quality Video & Media Previews</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Generate high-res video thumbnails and audio waveform previews</p>
              </div>
              <Switch checked={highQualityVideo} onCheckedChange={setHighQualityVideo} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">File Retention Policy</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Duration to keep deleted files in workspace trash</p>
              </div>
              <Select value={fileRetention} onValueChange={setFileRetention}>
                <SelectTrigger className="w-32 h-8 text-xs bg-muted/30 border-border/60">
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

          <div className="bg-card rounded-xl border border-border/70 shadow-2xs divide-y divide-border/40 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Google Calendar Sync</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Synchronize schedule events with your Google Calendar</p>
              </div>
              <Switch checked={googleCalendarSync} onCheckedChange={setGoogleCalendarSync} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Default Meeting Room Provider</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Provider used when generating instant meeting links</p>
              </div>
              <Select value={meetingProvider} onValueChange={setMeetingProvider}>
                <SelectTrigger className="w-44 h-8 text-xs bg-muted/30 border-border/60">
                  <SelectValue placeholder="Onetab Meet" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="onetab-meet" className="text-xs">Onetab Native Meet</SelectItem>
                  <SelectItem value="google-meet" className="text-xs">Google Meet</SelectItem>
                  <SelectItem value="zoom" className="text-xs">Zoom Meetings</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
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

          <div className="bg-card rounded-xl border border-border/70 shadow-2xs divide-y divide-border/40 overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
              <div>
                <h4 className="text-xs font-medium text-foreground">Track Member Online Status</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5">Show active presence indicators across channel list</p>
              </div>
              <Switch checked={trackOnlineStatus} onCheckedChange={setTrackOnlineStatus} />
            </div>

            <div className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
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

          <div className="bg-card rounded-xl border border-border/70 shadow-2xs divide-y divide-border/40 overflow-hidden">
            {[
              { id: 'slack', name: 'Slack Integration', desc: 'Sync channel messages and notifications', connected: true },
              { id: 'notion', name: 'Notion Workspace', desc: 'Import and sync Notion documents', connected: true },
              { id: 'github', name: 'GitHub OAuth', desc: 'Pull request reviews and commit triggers', connected: true },
              { id: 'google', name: 'Google Workspace', desc: 'Calendar sync and Drive attachment previews', connected: false },
            ].map((item) => (
              <div key={item.id} className="p-4 flex items-center justify-between gap-4 hover:bg-muted/10 transition-colors">
                <div>
                  <h4 className="text-xs font-medium text-foreground">{item.name}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                {item.connected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded font-medium">
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

          <div className="bg-card rounded-xl border border-border/70 shadow-2xs p-6">
            <SlackNotionImportView embedded />
          </div>
        </div>
      )}

      {/* ---------------- SECTION 8: WORKSPACE ADMIN ---------------- */}
      {currentTab === 'general' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">General Settings</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Manage your workspace name, description, and public URL slug.
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border/70 shadow-2xs p-6 space-y-6">
            <div className="flex items-center gap-5 pb-6 border-b border-border/40">
              <WorkspaceAvatar
                name={workspaceForm.watch('name') || workspace.name}
                src={workspaceForm.watch('avatarUrl') || workspace.avatarUrl}
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
                  Workspace Avatar & Logo — displays image when set or single letter initial &quot;{initials(workspaceForm.watch('name') || workspace.name)}&quot;.
                </p>
              </div>
            </div>

            {/*
              The icon saves on selection rather than with the form below it —
              it is a one-click choice, and the picker already shows the result.
            */}
            <div className="flex items-start gap-4 pb-6 border-b border-border/40">
              <WorkspaceIconPicker workspace={workspace} align="start" />
              <div className="space-y-1 pt-1">
                <h3 className="text-sm font-semibold text-foreground">Workspace Icon</h3>
                <p className="text-xs text-muted-foreground max-w-md">
                  Pick an icon or emoji and a colour. It shows in the workspace
                  switcher and anywhere this workspace is listed — an uploaded
                  logo, set below, takes precedence over it.
                  {isAdmin
                    ? ' Changes save as soon as you choose.'
                    : ' Only admins can change it.'}
                </p>
              </div>
            </div>

            <Form {...workspaceForm}>
              <form onSubmit={onWorkspaceSubmit} className="space-y-4 max-w-xl" noValidate>
                <FormError error={formErrorMessage(updateWorkspace.error)} />

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
                          disabled={!isAdmin}
                          className="h-9 text-xs"
                        />
                      </FormControl>
                      <FormMessage />
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
                          disabled={!isAdmin}
                          className="text-xs"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={workspaceForm.control}
                  name="avatarUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Workspace Avatar Image</FormLabel>
                      <div className="flex items-center gap-3">
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            disabled={!isAdmin}
                            placeholder="Image URL (https://...) or upload an image"
                            className="h-9 text-xs font-mono flex-1"
                          />
                        </FormControl>
                        {isAdmin ? (
                          <>
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
                                        workspaceForm.setValue('avatarUrl', evt.target.result as string, {
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
                                  workspaceForm.setValue('avatarUrl', '', { shouldDirty: true })
                                }
                              >
                                <Trash2 className="size-3.5 mr-1" />
                                Remove
                              </Button>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                      <FormDescription className="text-[11px] text-muted-foreground mt-1">
                        Upload a logo image file or paste an image URL. If removed, fallback displays single letter initial &quot;{initials(workspaceForm.watch('name') || workspace.name)}&quot;.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="text-xs text-muted-foreground flex items-center gap-2 pt-1">
                  <span>Workspace URL:</span>
                  <code className="bg-muted px-2 py-0.5 rounded font-mono text-[11px] text-foreground">
                    /w/{workspace.slug}
                  </code>
                </div>

                {isAdmin ? (
                  <div className="pt-2">
                    <Button
                      type="submit"
                      size="sm"
                      loading={updateWorkspace.isPending}
                      disabled={!workspaceForm.formState.isDirty}
                      className="text-xs"
                    >
                      Save changes
                    </Button>
                  </div>
                ) : null}
              </form>
            </Form>
          </div>
        </div>
      )}

      {currentTab === 'security' && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground">Account Security</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Manage credentials, authentication, and active user sessions.
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border/70 shadow-2xs p-6 space-y-6">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wide">
              Change Password
            </h3>

            {passwordChanged ? (
              <div className="p-3 text-xs rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                Password updated successfully. Other active sessions have been signed out.
              </div>
            ) : null}

            <Form {...passwordForm}>
              <form onSubmit={onPasswordSubmit} className="space-y-4 max-w-md" noValidate>
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

                <div className="pt-2">
                  <Button
                    type="submit"
                    size="sm"
                    loading={changePassword.isPending}
                    disabled={!passwordForm.formState.isDirty}
                    className="text-xs"
                  >
                    Update password
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      )}

      {currentTab === 'danger' && isOwner && (
        <div className="space-y-8">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-destructive">Danger Zone</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Irreversible workspace deletion and ownership actions.
            </p>
          </div>

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
    </SettingsLayout>
  );
}
