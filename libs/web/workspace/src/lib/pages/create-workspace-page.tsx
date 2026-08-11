import { zodResolver } from '@hookform/resolvers/zod';
import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Form,
  FormControl,
  FormDescription,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  IconPickerPopover,
  IconRenderer,
  Input,
  Textarea,
} from '@org/ui';
import { formErrorMessage } from '@org/auth';
import { slugify } from '@org/utils';
import {
  createWorkspaceSchema,
  type CreateWorkspaceInput,
} from '@org/validation';
import {
  Building2,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Copy,
  Hash,
  Paintbrush,
  Plus,
  Rocket,
  Sparkles,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useCreateWorkspace, useSlugSuggestion } from '../use-workspaces.js';

// Pre-defined workspace presets with starter channels and styling
interface WorkspacePreset {
  id: string;
  name: string;
  tagline: string;
  icon: string;
  color: string;
  badge: string;
  defaultChannels: string[];
}

const WORKSPACE_PRESETS: WorkspacePreset[] = [
  {
    id: 'engineering',
    name: 'Product & Engineering',
    tagline: 'Built for dev teams, release tracking, and bug triage.',
    icon: 'Laptop',
    color: '#3B82F6',
    badge: 'Tech & Dev',
    defaultChannels: ['general', 'dev-team', 'releases', 'bug-triage', 'standup'],
  },
  {
    id: 'design',
    name: 'Design & Creative',
    tagline: 'Ideal for design critiques, brand assets, and user feedback.',
    icon: 'Paintbrush',
    color: '#EC4899',
    badge: 'Creative',
    defaultChannels: ['general', 'design-system', 'critique', 'brand-assets', 'inspiration'],
  },
  {
    id: 'growth',
    name: 'Sales & Marketing',
    tagline: 'Tailored for pipeline tracking, campaigns, and customer wins.',
    icon: 'TrendingUp',
    color: '#10B981',
    badge: 'Growth',
    defaultChannels: ['general', 'leads', 'campaigns', 'customer-wins', 'announcements'],
  },
  {
    id: 'operations',
    name: 'Operations & Strategy',
    tagline: 'Perfect for project roadmaps, team syncs, and company ops.',
    icon: 'Zap',
    color: '#8B5CF6',
    badge: 'Operations',
    defaultChannels: ['general', 'announcements', 'roadmap', 'team-sync', 'ops'],
  },
  {
    id: 'custom',
    name: 'Custom Workspace',
    tagline: 'Start with a blank canvas and customize every detail.',
    icon: 'Building2',
    color: '#6366F1',
    badge: 'Flexible',
    defaultChannels: ['general', 'random'],
  },
];

const STEPS = [
  { id: 1, label: 'Identity', description: 'Workspace name & URL' },
  { id: 2, label: 'Team Type', description: 'Choose a starter preset' },
  { id: 3, label: 'Customization', description: 'Icon & starter channels' },
  { id: 4, label: 'Invites', description: 'Add your team members' },
  { id: 5, label: 'Launch', description: 'Review & create workspace' },
];

export function CreateWorkspacePage() {
  const createWorkspace = useCreateWorkspace();
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Wizard Customization States
  const [selectedPreset, setSelectedPreset] = useState<WorkspacePreset>(WORKSPACE_PRESETS[0]);
  const [iconName, setIconName] = useState<string>('Laptop');
  const [iconColor, setIconColor] = useState<string>('#3B82F6');
  const [channels, setChannels] = useState<string[]>(WORKSPACE_PRESETS[0].defaultChannels);
  const [newChannelInput, setNewChannelInput] = useState<string>('');
  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
  const [inviteEmailInput, setInviteEmailInput] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const form = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: '', slug: '', description: '' },
    mode: 'onChange',
  });

  const name = form.watch('name');
  const slug = form.watch('slug');
  const suggestion = useSlugSuggestion(name);

  // Keep the slug in step with the name until the user edits it manually
  const slugTouched = form.formState.dirtyFields.slug;
  useEffect(() => {
    if (slugTouched) return;
    const suggested = suggestion.data?.slug ?? slugify(name);
    if (suggested) form.setValue('slug', suggested, { shouldValidate: true });
  }, [name, suggestion.data?.slug, slugTouched, form]);

  // Handle Preset Switch
  const handleSelectPreset = (preset: WorkspacePreset) => {
    setSelectedPreset(preset);
    setIconName(preset.icon);
    setIconColor(preset.color);
    setChannels(preset.defaultChannels);
  };

  // Channel Management
  const handleAddChannel = () => {
    const trimmed = slugify(newChannelInput.trim());
    if (trimmed && !channels.includes(trimmed)) {
      setChannels([...channels, trimmed]);
      setNewChannelInput('');
    }
  };

  const handleRemoveChannel = (channelToRemove: string) => {
    if (channels.length <= 1) return; // Keep at least one channel
    setChannels(channels.filter((c) => c !== channelToRemove));
  };

  // Team Email Management
  const handleAddInvite = () => {
    const trimmed = inviteEmailInput.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (trimmed && emailRegex.test(trimmed) && !invitedEmails.includes(trimmed)) {
      setInvitedEmails([...invitedEmails, trimmed]);
      setInviteEmailInput('');
    }
  };

  const handleRemoveInvite = (emailToRemove: string) => {
    setInvitedEmails(invitedEmails.filter((e) => e !== emailToRemove));
  };

  const handleCopyInviteLink = () => {
    const url = `https://onetab.ai/invite/${slug || 'workspace'}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Step Navigation Validation
  const handleNextStep = async () => {
    if (currentStep === 1) {
      const isValid = await form.trigger(['name', 'slug']);
      if (!isValid) return;
    }
    if (currentStep < STEPS.length) {
      setCurrentStep((prev) => prev + 1);
    }
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
    }
  };

  const onSubmit = form.handleSubmit(async (values) => {
    if (currentStep < STEPS.length) {
      await handleNextStep();
      return;
    }
    try {
      await createWorkspace.mutateAsync(values);
    } catch {
      // Error handles visually in <FormError>
    }
  });

  return (
    <div className="min-h-full bg-background text-foreground flex flex-col justify-between selection:bg-primary selection:text-white">
      {/* Top Header */}
      <header className="border-b border-border/80 bg-surface/60 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-primary to-primary-hover flex items-center justify-center text-white font-bold shadow-lg shadow-primary/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="font-semibold text-foreground text-sm tracking-tight">OneTab AI</h1>
            <p className="text-xs text-muted-foreground">Workspace Onboarding Wizard</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
            <Link to="/">Cancel & Exit</Link>
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl w-full mx-auto px-4 py-8 flex-1 flex flex-col justify-center">
        {/* Wizard Form Layout (Form Left + Live Preview Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Side */}
          <div className="lg:col-span-7">
            <Card className="bg-surface/80 border-border backdrop-blur shadow-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-foreground flex items-center gap-2">
                  {currentStep === 1 && <Building2 className="h-5 w-5 text-primary" />}
                  {currentStep === 2 && <Wand2 className="h-5 w-5 text-primary" />}
                  {currentStep === 3 && <Paintbrush className="h-5 w-5 text-primary" />}
                  {currentStep === 4 && <Users className="h-5 w-5 text-primary" />}
                  {currentStep === 5 && <Rocket className="h-5 w-5 text-primary" />}
                  {STEPS[currentStep - 1].label}
                </CardTitle>
                <CardDescription className="text-muted-foreground text-sm">
                  {STEPS[currentStep - 1].description}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <Form {...form}>
                  <form onSubmit={onSubmit} className="space-y-6" noValidate>
                    <FormError error={formErrorMessage(createWorkspace.error)} />

                    {/* STEP 1: IDENTITY */}
                    {currentStep === 1 && (
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Workspace Name</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="e.g. Acme Corp, Design System Team"
                                  className="bg-background border-border text-foreground focus:border-primary"
                                  autoFocus
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="slug"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Workspace URL Slug</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    {...field}
                                    placeholder="acme-corp"
                                    className="bg-background border-border text-foreground pl-3 pr-24 focus:border-primary font-mono text-sm"
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono px-2 py-0.5 rounded bg-surface-raised text-muted-foreground border border-border-strong">
                                    .onetab.ai
                                  </span>
                                </div>
                              </FormControl>
                              <FormDescription className="text-xs text-muted-foreground flex items-center gap-1.5 pt-1">
                                <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                                Your workspace will be hosted at: <code className="text-primary font-mono">onetab.ai/w/{field.value || 'your-slug'}</code>
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="description"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-foreground">Description <span className="text-subtle font-normal">(Optional)</span></FormLabel>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  rows={3}
                                  placeholder="What is this workspace for? (e.g., Central hub for team updates, docs, and chat)"
                                  className="bg-background border-border text-foreground focus:border-primary"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* STEP 2: TEAM TYPE PRESETS */}
                    {currentStep === 2 && (
                      <div className="space-y-4">
                        <label className="text-sm font-medium text-foreground block">Select a workspace template</label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {WORKSPACE_PRESETS.map((preset) => {
                            const isSelected = selectedPreset.id === preset.id;
                            return (
                              <div
                                key={preset.id}
                                onClick={() => handleSelectPreset(preset)}
                                className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                                  isSelected
                                    ? 'border-primary bg-primary/10 text-foreground ring-2 ring-ring/40'
                                    : 'border-border bg-background/60 text-secondary-foreground hover:border-border-strong hover:bg-background'
                                }`}
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <div
                                    className="h-10 w-10 rounded-lg flex items-center justify-center text-white shadow-md"
                                    style={{ backgroundColor: preset.color }}
                                  >
                                    <IconRenderer icon={preset.icon} className="h-5 w-5" />
                                  </div>
                                  <Badge
                                    variant="neutral"
                                    className="text-[10px] bg-surface-raised text-secondary-foreground border-border-strong"
                                  >
                                    {preset.badge}
                                  </Badge>
                                </div>
                                <div>
                                  <h3 className="font-medium text-sm text-foreground">{preset.name}</h3>
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{preset.tagline}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* STEP 3: BRANDING & CHANNELS */}
                    {currentStep === 3 && (
                      <div className="space-y-6">
                        {/* Icon & Color Customizer */}
                        <div>
                          <label className="text-sm font-medium text-foreground block mb-2">Workspace Icon & Accent Color</label>
                          <div className="flex items-center gap-4 bg-background p-4 rounded-xl border border-border">
                            <IconPickerPopover
                              icon={iconName}
                              iconColor={iconColor}
                              onSelectIcon={(selectedIcon, selectedColor) => {
                                setIconName(selectedIcon);
                                if (selectedColor) setIconColor(selectedColor);
                              }}
                              trigger={
                                <button
                                  type="button"
                                  className="h-14 w-14 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform hover:scale-105"
                                  style={{ backgroundColor: iconColor }}
                                >
                                  <IconRenderer icon={iconName} className="h-7 w-7" />
                                </button>
                              }
                            />

                            <div>
                              <p className="text-sm font-medium text-foreground">Click icon to customize</p>
                              <p className="text-xs text-muted-foreground">Choose from icons and curated theme colors</p>
                            </div>
                          </div>
                        </div>

                        {/* Starter Channels Customizer */}
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-foreground block">Starter Channels</label>
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle font-mono text-xs">#</span>
                              <Input
                                value={newChannelInput}
                                onChange={(e) => setNewChannelInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddChannel();
                                  }
                                }}
                                placeholder="add-custom-channel"
                                className="bg-background border-border text-foreground pl-7 text-xs focus:border-primary"
                              />
                            </div>
                            <Button
                              type="button"
                              onClick={handleAddChannel}
                              size="sm"
                              variant="outline"
                              className="bg-surface-raised text-foreground hover:bg-selected border-border-strong"
                            >
                              <Plus className="h-4 w-4 mr-1" /> Add
                            </Button>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-1">
                            {channels.map((ch) => (
                              <span
                                key={ch}
                                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-background border border-border text-secondary-foreground"
                              >
                                <Hash className="h-3 w-3 text-primary" />
                                {ch}
                                {channels.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveChannel(ch)}
                                    className="hover:text-destructive text-subtle transition-colors"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* STEP 4: TEAM INVITES */}
                    {currentStep === 4 && (
                      <div className="space-y-6">
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-foreground block">Invite Team Members via Email</label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="email"
                              value={inviteEmailInput}
                              onChange={(e) => setInviteEmailInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddInvite();
                                }
                              }}
                              placeholder="colleague@company.com"
                              className="bg-background border-border text-foreground text-xs focus:border-primary"
                            />
                            <Button
                              type="button"
                              onClick={handleAddInvite}
                              size="sm"
                              className="bg-primary hover:bg-primary text-white"
                            >
                              <Plus className="h-4 w-4 mr-1" /> Add Email
                            </Button>
                          </div>

                          {/* Invited Emails List */}
                          {invitedEmails.length > 0 && (
                            <div className="space-y-2 pt-2">
                              <p className="text-xs text-muted-foreground font-medium">Invites to be sent ({invitedEmails.length}):</p>
                              <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-background rounded-lg border border-border">
                                {invitedEmails.map((email) => (
                                  <span
                                    key={email}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs bg-surface border border-border text-foreground"
                                  >
                                    {email}
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveInvite(email)}
                                      className="hover:text-destructive text-subtle"
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="p-4 rounded-xl bg-background/60 border border-border flex items-center justify-between">
                          <div>
                            <h4 className="text-xs font-medium text-foreground">Shareable Workspace Invite Link</h4>
                            <p className="text-[11px] text-muted-foreground">Share this link directly with your team</p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleCopyInviteLink}
                            className="bg-surface border-border-strong text-foreground hover:bg-surface-raised"
                          >
                            {copiedLink ? <Check className="h-3.5 w-3.5 mr-1 text-success" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
                            {copiedLink ? 'Copied!' : 'Copy Link'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* STEP 5: REVIEW & LAUNCH */}
                    {currentStep === 5 && (
                      <div className="space-y-4">
                        <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 space-y-3">
                          <div className="flex items-center gap-3">
                            <div
                              className="h-12 w-12 rounded-xl flex items-center justify-center text-white shadow-lg"
                              style={{ backgroundColor: iconColor }}
                            >
                              <IconRenderer icon={iconName} className="h-6 w-6" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground text-base">{name || 'Untitled Workspace'}</h3>
                              <p className="text-xs text-primary font-mono">onetab.ai/w/{slug || 'workspace'}</p>
                            </div>
                          </div>

                          <p className="text-xs text-secondary-foreground italic">
                            {form.getValues('description') || 'No description provided.'}
                          </p>

                          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/80 text-center text-xs">
                            <div className="bg-background/60 p-2 rounded-lg border border-border">
                              <span className="block font-bold text-foreground">{selectedPreset.badge}</span>
                              <span className="text-[10px] text-muted-foreground">Template</span>
                            </div>
                            <div className="bg-background/60 p-2 rounded-lg border border-border">
                              <span className="block font-bold text-foreground">{channels.length}</span>
                              <span className="text-[10px] text-muted-foreground">Channels</span>
                            </div>
                            <div className="bg-background/60 p-2 rounded-lg border border-border">
                              <span className="block font-bold text-foreground">{invitedEmails.length + 1}</span>
                              <span className="text-[10px] text-muted-foreground">Members</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                          Click <strong>Create Workspace</strong> to launch your new workspace instantly.
                        </p>
                      </div>
                    )}

                    {/* Step Navigation Bar */}
                    <div className="pt-4 border-t border-border flex items-center justify-between">
                      {currentStep > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={handlePrevStep}
                          className="text-secondary-foreground hover:text-white"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" /> Back
                        </Button>
                      ) : (
                        <Button asChild variant="ghost" className="text-muted-foreground hover:text-foreground">
                          <Link to="/">Cancel</Link>
                        </Button>
                      )}

                      {currentStep < STEPS.length ? (
                        <Button
                          type="button"
                          onClick={handleNextStep}
                          className="bg-primary hover:bg-primary text-white font-medium shadow-lg shadow-primary/30"
                        >
                          Continue <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      ) : (
                        <Button
                          type="submit"
                          loading={form.formState.isSubmitting || createWorkspace.isPending}
                          className="bg-gradient-to-r from-primary to-primary-hover hover:from-primary hover:to-primary-hover text-white font-semibold shadow-xl shadow-primary/25 px-6"
                        >
                          <Sparkles className="h-4 w-4 mr-2" /> Launch Workspace
                        </Button>
                      )}
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Live Preview Side Panel */}
          <div className="lg:col-span-5 hidden lg:block sticky top-24">
            <Card className="bg-surface/60 border-border backdrop-blur shadow-xl overflow-hidden">
              <div className="bg-background/80 px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2.5 w-2.5 rounded-full bg-destructive/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-warning/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-success/80" />
                </div>
                <span className="text-[11px] font-mono text-muted-foreground flex items-center gap-1">
                  <Wand2 className="h-3 w-3 text-primary" /> Live Sidebar Preview
                </span>
              </div>

              <CardContent className="p-4 space-y-4">
                {/* Mock Workspace Sidebar Header */}
                <div className="p-3 rounded-xl bg-background border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow"
                      style={{ backgroundColor: iconColor }}
                    >
                      <IconRenderer icon={iconName} className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground text-sm truncate max-w-[140px]">
                        {name || 'Your Workspace'}
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                        {slug ? `${slug}.onetab.ai` : 'onetab.ai/w/...'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/10">
                    Active
                  </Badge>
                </div>

                {/* Mock Channel List */}
                <div className="space-y-1 bg-background/40 p-3 rounded-xl border border-border/60">
                  <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-2">
                    <span>CHANNELS ({channels.length})</span>
                    <Plus className="h-3 w-3 opacity-60" />
                  </div>
                  {channels.slice(0, 5).map((ch) => (
                    <div
                      key={ch}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-secondary-foreground hover:bg-surface-raised/60 font-mono"
                    >
                      <Hash className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="truncate">{ch}</span>
                    </div>
                  ))}
                  {channels.length > 5 && (
                    <p className="text-[10px] text-subtle italic pl-2.5">+ {channels.length - 5} more channels</p>
                  )}
                </div>

                {/* Mock Direct Messages & Team */}
                <div className="space-y-2 bg-background/40 p-3 rounded-xl border border-border/60">
                  <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span>TEAM MEMBERS ({invitedEmails.length + 1})</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7 border border-primary">
                      <AvatarFallback className="bg-primary text-white text-xs font-bold">YOU</AvatarFallback>
                    </Avatar>
                    {invitedEmails.slice(0, 3).map((email) => (
                      <Avatar key={email} className="h-7 w-7 border border-border-strong">
                        <AvatarFallback className="bg-surface-raised text-secondary-foreground text-[10px] font-bold">
                          {email.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {invitedEmails.length > 3 && (
                      <span className="h-7 w-7 rounded-full bg-surface-raised text-muted-foreground text-[10px] font-bold flex items-center justify-center border border-border-strong">
                        +{invitedEmails.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-background py-4 px-6 text-center text-xs text-subtle">
        OneTab AI Workspace Onboarding &bull; Crafting collaboration spaces in seconds
      </footer>
    </div>
  );
}


