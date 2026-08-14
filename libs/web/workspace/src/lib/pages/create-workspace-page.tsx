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
  Input,
  Textarea,
  WorkspaceAvatar,
} from '@org/ui';
import { formErrorMessage } from '@org/auth';
import { IconPicker, useLocalIcon } from '@org/icons';
import { initials, slugify } from '@org/utils';
import {
  createWorkspaceSchema,
  workspaceLogoError,
  WORKSPACE_LOGO_MIME_TYPES,
  type CreateWorkspaceInput,
} from '@org/validation';
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Plus,
  Sparkles,
  Trash2,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { useCreateWorkspaceFlow, useSlugSuggestion } from '../use-workspaces.js';

const STEPS = [
  {
    id: 1,
    label: 'Workspace',
    description: 'Name, URL and logo',
    icon: Building2,
  },
  {
    id: 2,
    label: 'Invite your team',
    description: 'Optional — you can do this later',
    icon: Users,
  },
] as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function CreateWorkspacePage() {
  const navigate = useNavigate();
  const createWorkspace = useCreateWorkspaceFlow();
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);

  // Logo: held locally until the workspace exists to attach it to.
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [invitedEmails, setInvitedEmails] = useState<string[]>([]);
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);

  // No workspace exists to attach an icon to yet, so the choice is held here
  // and posted with the creation itself.
  const iconEditor = useLocalIcon({ icon: 'Rocket', iconColor: '#4EA7FC' });

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

  // Object URLs are a leak if they outlive the file they point at.
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
    // Checked here as well as on the API so a doomed upload never leaves the
    // browser, and the reason lands next to the control that caused it.
    const problem = workspaceLogoError(file);
    setLogoError(problem);
    setLogoFile(problem ? null : file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoError(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  };

  const handleAddInvite = () => {
    const trimmed = inviteEmailInput.trim().toLowerCase();
    if (!trimmed) return;
    if (!EMAIL_PATTERN.test(trimmed)) {
      setInviteError('Enter a valid email address.');
      return;
    }
    if (invitedEmails.includes(trimmed)) {
      setInviteError('That address is already on the list.');
      return;
    }
    setInvitedEmails([...invitedEmails, trimmed]);
    setInviteEmailInput('');
    setInviteError(null);
  };

  const handleRemoveInvite = (email: string) => {
    setInvitedEmails(invitedEmails.filter((e) => e !== email));
  };

  const handleContinue = async () => {
    const isValid = await form.trigger(['name', 'slug', 'description']);
    if (isValid) setCurrentStep(2);
  };

  /** `withInvites: false` is the Skip path — same creation, no invitations. */
  const submit = (withInvites: boolean) =>
    form.handleSubmit(async (values) => {
      try {
        await createWorkspace.mutateAsync({
          ...values,
          ...iconEditor.selection,
          logo: logoFile,
          invites: withInvites ? invitedEmails : [],
        });
      } catch {
        // Surfaced by <FormError> below.
      }
    });

  const result = createWorkspace.data;
  const isBusy = createWorkspace.isPending;

  // Creation succeeded but the logo or the invitations did not. The navigation
  // is held back so the user actually sees why.
  if (result && result.warnings.length > 0) {
    return (
      <div className="min-h-full bg-background text-foreground flex items-center justify-center p-6">
        <Card className="bg-surface/80 border-border backdrop-blur shadow-2xl max-w-lg w-full">
          <CardHeader>
            <CardTitle className="text-lg text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              {result.workspace.name} is ready
            </CardTitle>
            <CardDescription>
              The workspace was created, but a follow-up step did not finish.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {result.warnings.map((warning) => (
                <li
                  key={warning}
                  className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-foreground"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                  {warning}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              className="w-full bg-primary text-white"
              onClick={() => navigate(`/w/${result.workspace.slug}`)}
            >
              Go to workspace <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const step = STEPS[currentStep - 1];
  const StepIcon = step.icon;

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
            <p className="text-xs text-muted-foreground">Create a workspace</p>
          </div>
        </div>

        <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
          <Link to="/">Cancel &amp; Exit</Link>
        </Button>
      </header>

      <main className="max-w-6xl w-full mx-auto px-4 py-8 flex-1 flex flex-col justify-center">
        {/* Two-step progress rail */}
        <ol className="flex items-center gap-3 mb-6 max-w-md">
          {STEPS.map((entry) => {
            const isDone = currentStep > entry.id;
            const isCurrent = currentStep === entry.id;
            return (
              <li key={entry.id} className="flex-1">
                <div
                  className={`h-1 rounded-full transition-colors ${
                    isDone || isCurrent ? 'bg-primary' : 'bg-border'
                  }`}
                />
                <p
                  className={`mt-2 text-[11px] font-medium ${
                    isCurrent ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Step {entry.id} · {entry.label}
                </p>
              </li>
            );
          })}
        </ol>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Form Side */}
          <div className="lg:col-span-7">
            <Card className="bg-surface/80 border-border backdrop-blur shadow-2xl">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl text-foreground flex items-center gap-2">
                  <StepIcon className="h-5 w-5 text-primary" />
                  {step.label}
                </CardTitle>
                <CardDescription className="text-muted-foreground text-sm">
                  {step.description}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <Form {...form}>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (currentStep === 1) {
                        void handleContinue();
                        return;
                      }
                      void submit(true)(event);
                    }}
                    className="space-y-6"
                    noValidate
                  >
                    <FormError error={formErrorMessage(createWorkspace.error)} />

                    {/* STEP 1: IDENTITY + ICON + LOGO */}
                    {currentStep === 1 && (
                      <div className="space-y-5">
                        {/* Icon picker. Held locally and posted with the
                            workspace — see `useLocalIcon` above. Images go
                            through the logo uploader below, which is why the
                            upload tab is off here. */}
                        <div>
                          <label className="text-sm font-medium text-foreground block mb-2">
                            Workspace Icon
                          </label>
                          <div className="flex items-center gap-4 bg-background p-4 rounded-xl border border-border">
                            <IconPicker
                              editor={iconEditor}
                              align="start"
                              allowUpload={false}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">
                                Click the icon to change it
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Choose an icon or emoji and a colour. It appears in
                                the workspace switcher and anywhere this workspace
                                is listed — and you can change it later in settings.
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Logo uploader */}
                        <div>
                          <label className="text-sm font-medium text-foreground block mb-2">
                            Workspace Logo <span className="text-subtle font-normal">(Optional)</span>
                          </label>
                          <div className="flex items-center gap-4 bg-background p-4 rounded-xl border border-border">
                            <button
                              type="button"
                              onClick={() => logoInputRef.current?.click()}
                              className="relative h-16 w-16 shrink-0 rounded-2xl overflow-hidden border border-border-strong bg-surface-raised flex items-center justify-center transition-transform hover:scale-105"
                              aria-label="Upload workspace logo"
                            >
                              {logoPreview ? (
                                <img
                                  src={logoPreview}
                                  alt="Workspace logo preview"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <ImagePlus className="h-6 w-6 text-muted-foreground" />
                              )}
                            </button>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => logoInputRef.current?.click()}
                                  className="bg-surface-raised text-foreground hover:bg-selected border-border-strong"
                                >
                                  <ImagePlus className="h-4 w-4 mr-1" />
                                  {logoFile ? 'Replace' : 'Upload image'}
                                </Button>
                                {logoFile && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    onClick={handleRemoveLogo}
                                    className="text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" /> Remove
                                  </Button>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1.5 truncate">
                                {logoFile
                                  ? logoFile.name
                                  : 'PNG, JPEG, WebP or GIF · up to 2 MB'}
                              </p>
                              {logoError && (
                                <p className="text-xs text-destructive mt-1">{logoError}</p>
                              )}
                            </div>
                          </div>

                          <input
                            ref={logoInputRef}
                            type="file"
                            accept={WORKSPACE_LOGO_MIME_TYPES.join(',')}
                            className="hidden"
                            onChange={(event) =>
                              handleSelectLogo(event.target.files?.[0])
                            }
                          />
                        </div>

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

                    {/* STEP 2: INVITES */}
                    {currentStep === 2 && (
                      <div className="space-y-5">
                        <div className="space-y-3">
                          <label className="text-sm font-medium text-foreground block">
                            Invite people by email
                          </label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="email"
                              value={inviteEmailInput}
                              onChange={(e) => {
                                setInviteEmailInput(e.target.value);
                                setInviteError(null);
                              }}
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
                              <Plus className="h-4 w-4 mr-1" /> Add
                            </Button>
                          </div>
                          {inviteError && (
                            <p className="text-xs text-destructive">{inviteError}</p>
                          )}

                          {invitedEmails.length > 0 && (
                            <div className="space-y-2 pt-1">
                              <p className="text-xs text-muted-foreground font-medium">
                                Invites to be sent ({invitedEmails.length}):
                              </p>
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
                                      aria-label={`Remove ${email}`}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Everyone invited joins as a <strong>member</strong>. You can invite
                          more people, or change roles, from workspace settings at any time.
                        </p>
                      </div>
                    )}

                    {/* Step Navigation Bar */}
                    <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                      {currentStep > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setCurrentStep(1)}
                          disabled={isBusy}
                          className="text-secondary-foreground hover:text-foreground"
                        >
                          <ChevronLeft className="h-4 w-4 mr-1" /> Back
                        </Button>
                      ) : (
                        <Button asChild variant="ghost" className="text-muted-foreground hover:text-foreground">
                          <Link to="/">Cancel</Link>
                        </Button>
                      )}

                      {currentStep === 1 ? (
                        <Button
                          type="submit"
                          className="bg-primary hover:bg-primary text-white font-medium shadow-lg shadow-primary/30"
                        >
                          Continue <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            disabled={isBusy}
                            onClick={() => void submit(false)()}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            Skip &amp; create
                          </Button>
                          <Button
                            type="submit"
                            loading={isBusy}
                            className="bg-gradient-to-r from-primary to-primary-hover hover:from-primary hover:to-primary-hover text-white font-semibold shadow-xl shadow-primary/25 px-6"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            {invitedEmails.length > 0
                              ? `Invite ${invitedEmails.length} & launch`
                              : 'Launch workspace'}
                          </Button>
                        </div>
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
                  <Wand2 className="h-3 w-3 text-primary" /> Live Preview
                </span>
              </div>

              <CardContent className="p-4 space-y-4">
                {/* Preview: workspace header, drawn from the form state above. */}
                <div className="p-3 rounded-xl bg-background border border-border flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <WorkspaceAvatar
                      name={name || 'Your Workspace'}
                      src={logoPreview}
                      icon={iconEditor.icon}
                      iconColor={iconEditor.iconColor}
                      seed={slug || name}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <h4 className="font-semibold text-foreground text-sm truncate max-w-[140px]">
                        {name || 'Your Workspace'}
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                        {slug ? `onetab.ai/w/${slug}` : 'onetab.ai/w/...'}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] border-primary/40 text-primary bg-primary/10">
                    Active
                  </Badge>
                </div>

                {form.watch('description') && (
                  <p className="text-xs text-secondary-foreground italic px-1">
                    {form.watch('description')}
                  </p>
                )}

                {/* Preview: the people this workspace will start with. */}
                <div className="space-y-2 bg-background/40 p-3 rounded-xl border border-border/60">
                  <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                    <span>TEAM MEMBERS ({invitedEmails.length + 1})</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Avatar className="h-7 w-7 border border-primary">
                      <AvatarFallback className="bg-primary text-white text-xs font-bold">YOU</AvatarFallback>
                    </Avatar>
                    {invitedEmails.slice(0, 4).map((email) => (
                      <Avatar key={email} className="h-7 w-7 border border-border-strong">
                        <AvatarFallback className="bg-surface-raised text-secondary-foreground text-[10px] font-bold">
                          {initials(email)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {invitedEmails.length > 4 && (
                      <span className="h-7 w-7 rounded-full bg-surface-raised text-muted-foreground text-[10px] font-bold flex items-center justify-center border border-border-strong">
                        +{invitedEmails.length - 4}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-subtle">
                    Your workspace starts with a <span className="font-mono">#general</span> channel.
                  </p>
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
