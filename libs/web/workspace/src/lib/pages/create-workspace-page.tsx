import { zodResolver } from '@hookform/resolvers/zod';
import {
  Avatar,
  AvatarFallback,
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
  ScrollArea,
  SettingsCard,
  SettingsGroup,
  SettingsIconTile,
  SettingsSectionHeader,
  WorkspaceAvatar,
} from '@org/ui';
import { formErrorMessage, useCurrentUser } from '@org/auth';
import { cn, initials, slugify } from '@org/utils';
import {
  createWorkspaceSchema,
  workspaceLogoError,
  WORKSPACE_LOGO_MIME_TYPES,
  type CreateWorkspaceInput,
} from '@org/validation';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Hash,
  ImagePlus,
  Loader2,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import {
  useCreateWorkspaceFlow,
  useSlugAvailability,
  useSlugSuggestion,
} from '../use-workspaces.js';

const STEPS = [
  {
    id: 1,
    label: 'Workspace',
    heading: 'Workspace details',
    description:
      'This is where your team chats, plans and gets work done. You can change all of this later.',
  },
  {
    id: 2,
    label: 'Invite your team',
    heading: 'Invite your team',
    description:
      'Optional. Add teammates now, or skip and invite them later from settings.',
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
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pre-fill a sensible default so the wizard (and its live preview) start from a
  // real name rather than a placeholder. The field stays fully editable — the
  // slug tracks it until the user touches either one.
  const form = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: 'My Workspace', slug: '' },
    mode: 'onChange',
  });

  // "Virendra's Workspace" from the signed-in user's first name, as soon as it
  // is known and for as long as the user hasn't typed their own name.
  const currentUser = useCurrentUser();
  const firstName = (currentUser?.displayName || currentUser?.name || '')
    .trim()
    .split(/\s+/)[0];
  const nameTouched = form.formState.dirtyFields.name;
  useEffect(() => {
    if (nameTouched || !firstName) return;
    form.setValue('name', `${firstName}'s Workspace`, {
      shouldValidate: true,
    });
  }, [firstName, nameTouched, form]);

  const name = form.watch('name');
  const slug = form.watch('slug');
  const suggestion = useSlugSuggestion(name);
  const availability = useSlugAvailability(slug);
  const slugChecking =
    slug.length >= 3 && (!availability.settled || availability.isFetching);
  const slugTaken =
    slug.length >= 3 &&
    availability.settled &&
    !availability.isFetching &&
    availability.data?.available === false;
  // Only claim "Available" on a real yes from the server — a failed or
  // pending check is not a pass.
  const slugAvailable =
    slug.length >= 3 &&
    availability.settled &&
    !availability.isFetching &&
    availability.data?.available === true;
  const slugCheckFailed =
    slug.length >= 3 &&
    availability.settled &&
    !availability.isFetching &&
    availability.isError;

  // Keep the slug in step with the name until the user edits it manually
  const slugTouched = form.formState.dirtyFields.slug;
  useEffect(() => {
    if (slugTouched) return;
    const suggested = suggestion.data?.slug ?? slugify(name).slice(0, 40).replace(/-+$/, '');
    if (suggested) form.setValue('slug', suggested, { shouldValidate: true });
  }, [name, suggestion.data?.slug, slugTouched, form]);

  // A URL the user never typed should never greet them as "taken": quietly
  // move to the next free one the server offers. Once they've edited it, the
  // choice is theirs and the inline "Use …" button takes over.
  const freeSuggestion = slugTaken ? availability.data?.suggestion : null;
  useEffect(() => {
    if (slugTouched || !freeSuggestion) return;
    form.setValue('slug', freeSuggestion, { shouldValidate: true });
  }, [freeSuggestion, slugTouched, form]);

  const [logoDragging, setLogoDragging] = useState(false);

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

  const handleAddEmails = (emailsToAdd: string[]): number => {
    const validEmails: string[] = [];
    let duplicates = 0;
    let invalids = 0;

    for (const raw of emailsToAdd) {
      const email = raw.trim().toLowerCase();
      if (!email) continue;
      if (!EMAIL_PATTERN.test(email)) {
        invalids++;
        continue;
      }
      if (invitedEmails.includes(email) || validEmails.includes(email)) {
        duplicates++;
        continue;
      }
      validEmails.push(email);
    }

    if (validEmails.length > 0) {
      setInvitedEmails((prev) => [...prev, ...validEmails]);
      setInviteError(null);
      return validEmails.length;
    } else if (duplicates > 0) {
      setInviteError('All identified email addresses are already on the list.');
    } else if (invalids > 0) {
      setInviteError('No valid email addresses were found.');
    }
    return 0;
  };

  const handleAddInvite = () => {
    const trimmed = inviteEmailInput.trim();
    if (!trimmed) return;
    setImportStatus(null);
    const parts = trimmed.split(/[\s,;]+/).filter(Boolean);
    const count = handleAddEmails(parts);
    if (count > 0) {
      setInviteEmailInput('');
      setImportStatus(`Added ${count} email address${count > 1 ? 'es' : ''}.`);
    }
  };

  const handleRemoveInvite = (email: string) => {
    setInvitedEmails(invitedEmails.filter((e) => e !== email));
  };

  const handleClearAllInvites = () => {
    setInvitedEmails([]);
    setImportStatus(null);
    setInviteError(null);
  };

  /*
   * There is no Google OAuth flow (no authorize URL, no callback, no token
   * exchange) anywhere in the codebase. This used to fake an 800ms "connect",
   * then invent `team@<slug>.com` / `engineering@<slug>.com` / … addresses
   * out of the workspace slug and report them as a real directory sync —
   * fabricated invite emails presented as if they came from the customer's
   * own Google Workspace. Until OAuth exists, clicking this only says so; it
   * adds no emails and never flips `googleConnected`.
   */
  const handleFileUpload = (file: File | undefined) => {
    if (!file) return;
    setInviteError(null);
    setImportStatus(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        let text = '';
        if (typeof content === 'string') {
          text = content;
        } else if (content instanceof ArrayBuffer) {
          const uint8 = new Uint8Array(content);
          text = new TextDecoder('utf-8', { fatal: false }).decode(uint8);
        }
        // Extract all email patterns from CSV, TXT, TSV, or XLSX binary dump
        const emailMatches =
          text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi) || [];
        if (emailMatches.length === 0) {
          setInviteError(`No valid email addresses found in "${file.name}".`);
          return;
        }
        const count = handleAddEmails(emailMatches);
        if (count > 0) {
          setImportStatus(
            `Imported ${count} email address${count > 1 ? 'es' : ''} from "${file.name}".`,
          );
        }
      } catch {
        setInviteError(`Failed to parse "${file.name}".`);
      }
    };
    reader.onerror = () => {
      setInviteError(`Failed to read "${file.name}".`);
    };

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleContinue = async () => {
    const isValid = await form.trigger(['name', 'slug']);
    if (!isValid || slugChecking) return;
    if (slugTaken) {
      form.setError('slug', {
        message: 'That workspace URL is already taken.',
      });
      return;
    }
    setCurrentStep(2);
  };

  /** `withInvites: false` is the Skip path — same creation, no invitations. */
  const submit = (withInvites: boolean) =>
    form.handleSubmit(async (values) => {
      try {
        await createWorkspace.mutateAsync({
          ...values,
          logo: logoFile,
          invites: withInvites ? invitedEmails : [],
        });
      } catch (error) {
        // A slug lost to a race since step 1: send the user back to fix it.
        // Anything else is surfaced by <FormError> below.
        const message = formErrorMessage(error);
        if (/already taken|already exists/i.test(message ?? '')) {
          form.setError('slug', { message: 'That workspace URL is already taken.' });
          setCurrentStep(1);
        }
      }
    });

  const result = createWorkspace.data;
  const isBusy = createWorkspace.isPending;

  // Creation succeeded but the logo or the invitations did not. The navigation
  // is held back so the user actually sees why.
  if (result && result.warnings.length > 0) {
    return (
      <div className="p-6 flex min-h-full items-center justify-center bg-background text-foreground">
        <Card className="backdrop-blur shadow-2xl max-w-lg w-full border-border bg-surface/80">
          <CardHeader>
            <CardTitle className="text-lg gap-2 flex items-center text-foreground">
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
                  className="gap-2 p-3 text-xs flex items-start rounded-lg border border-warning/40 bg-warning/10 text-foreground"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
                  {warning}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              className="w-full"
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
  const displayName = name.trim() || 'Your Workspace';
  // Same host prefix the workspace settings URL field shows.
  const host = window.location.host;

  return (
    <div className="selection:text-primary-foreground min-h-full bg-background text-foreground selection:bg-primary">
      <div className="max-w-5xl px-4 py-8 sm:px-6 mx-auto w-full">
        {/* Page header — same title block as the settings screens. */}
        <div className="mb-6 gap-3 flex items-start">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={currentStep === 2 ? 'Back to workspace details' : 'Go back'}
            onClick={() => (currentStep === 2 ? setCurrentStep(1) : navigate(-1))}
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <SettingsSectionHeader
              title="Create a workspace"
              description={`Step ${currentStep} of ${STEPS.length} · ${step.label}`}
              actions={
                <ol
                  aria-label="Workspace setup progress"
                  className="gap-2 hidden sm:flex items-center"
                >
                  {STEPS.map((s) => {
                    const done = s.id < currentStep;
                    const active = s.id === currentStep;
                    return (
                      <li
                        key={s.id}
                        aria-current={active ? 'step' : undefined}
                        className="gap-2 flex items-center"
                      >
                        <span
                          className={cn(
                            'size-5 text-[11px] font-semibold flex shrink-0 items-center justify-center rounded-full border transition-colors',
                            done && 'border-primary bg-primary text-primary-foreground',
                            active && 'border-primary bg-primary/10 text-primary',
                            !done && !active && 'border-border text-muted-foreground',
                          )}
                        >
                          {done ? <Check className="h-3 w-3" /> : s.id}
                        </span>
                        <span
                          className={cn(
                            'text-xs whitespace-nowrap',
                            active
                              ? 'font-medium text-foreground'
                              : 'text-muted-foreground',
                          )}
                        >
                          {s.label}
                        </span>
                        {s.id < STEPS.length && (
                          <span
                            className={cn(
                              'h-px w-8 transition-colors',
                              done ? 'bg-primary' : 'bg-border',
                            )}
                          />
                        )}
                      </li>
                    );
                  })}
                </ol>
              }
            />
          </div>
        </div>

        <div className="lg:grid-cols-12 gap-6 grid grid-cols-1 items-start">
          {/* Form */}
          <div className="lg:col-span-7">
            <SettingsCard>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {step.heading}
                </h2>
                <p className="text-xs mt-1 text-muted-foreground">
                  {step.description}
                </p>
              </div>

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
                  className="space-y-5"
                  noValidate
                >
                  <FormError error={formErrorMessage(createWorkspace.error)} />

                  {/* STEP 1: IDENTITY + LOGO */}
                  {currentStep === 1 && (
                    <div className="space-y-5">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">
                              Workspace name
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                maxLength={60}
                                placeholder="e.g. Acme Corp, Design Team"
                                className="h-9 text-xs"
                                autoFocus
                                onFocus={(event) => event.target.select()}
                              />
                            </FormControl>
                            <FormDescription className="text-[11px] text-muted-foreground">
                              Usually your company or team name.
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="slug"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel className="text-xs font-medium">
                              Workspace URL
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                maxLength={40}
                                spellCheck={false}
                                autoCapitalize="off"
                                autoComplete="off"
                                placeholder="acme-corp"
                                prefix={`${host}/w/`}
                                suffix={
                                  slugChecking ? (
                                    <Loader2 className="animate-spin text-muted-foreground" />
                                  ) : slugTaken ? (
                                    <AlertTriangle className="text-destructive" />
                                  ) : slugAvailable && !fieldState.error ? (
                                    <CheckCircle2 className="text-success" />
                                  ) : null
                                }
                                invalid={slugTaken || undefined}
                                className="h-9 text-xs font-mono"
                                // Same normalisation as the settings URL field.
                                onChange={(event) =>
                                  field.onChange(
                                    event.target.value
                                      .toLowerCase()
                                      .replace(/[^a-z0-9-]/g, '-'),
                                  )
                                }
                              />
                            </FormControl>
                            <FormDescription
                              aria-live="polite"
                              className="gap-1.5 flex flex-wrap items-center text-[11px] text-muted-foreground"
                            >
                              {fieldState.error ? null : slugChecking ? (
                                'Checking availability…'
                              ) : slugTaken ? (
                                <>
                                  <span className="text-destructive">
                                    This URL is already taken.
                                  </span>
                                  {availability.data?.suggestion && (
                                    <button
                                      type="button"
                                      className="font-medium text-primary underline-offset-2 hover:underline"
                                      onClick={() =>
                                        form.setValue(
                                          'slug',
                                          availability.data?.suggestion ?? '',
                                          {
                                            shouldValidate: true,
                                            shouldDirty: true,
                                          },
                                        )
                                      }
                                    >
                                      Use{' '}
                                      <span className="font-mono">
                                        {availability.data.suggestion}
                                      </span>
                                    </button>
                                  )}
                                </>
                              ) : slugCheckFailed ? (
                                <span className="text-warning">
                                  Couldn&apos;t check availability right now —
                                  we&apos;ll confirm when you create it.
                                </span>
                              ) : slugAvailable ? (
                                <span>
                                  <span className="text-success">Available.</span>{' '}
                                  Lowercase letters, numbers and dashes.
                                </span>
                              ) : (
                                'Lowercase letters, numbers and dashes.'
                              )}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Logo — same block as workspace settings, plus drop. */}
                      <div>
                        <p className="text-xs font-medium mb-2 text-foreground">
                          Workspace logo{' '}
                          <span className="font-normal text-muted-foreground">
                            (optional)
                          </span>
                        </p>
                        <div
                          onDragOver={(event) => {
                            event.preventDefault();
                            setLogoDragging(true);
                          }}
                          onDragLeave={() => setLogoDragging(false)}
                          onDrop={(event) => {
                            event.preventDefault();
                            setLogoDragging(false);
                            handleSelectLogo(event.dataTransfer.files?.[0]);
                          }}
                          className={cn(
                            'gap-4 p-4 flex items-center rounded-xl border transition-colors',
                            logoDragging
                              ? 'border-dashed border-primary bg-primary/5'
                              : 'border-border bg-background',
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            className="group relative shrink-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                            aria-label={
                              logoFile
                                ? 'Replace workspace logo'
                                : 'Upload workspace logo'
                            }
                          >
                            <WorkspaceAvatar
                              name={displayName}
                              src={logoPreview}
                              seed={slug || name}
                              size="xl"
                            />
                            <span className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
                              <ImagePlus className="h-5 w-5" />
                            </span>
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="gap-2 flex flex-wrap items-center">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => logoInputRef.current?.click()}
                                className="h-8 text-xs border-border-strong bg-surface-raised text-foreground hover:bg-selected"
                              >
                                <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
                                {logoFile ? 'Replace' : 'Upload image'}
                              </Button>
                              {logoFile && (
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
                            <p className="text-xs mt-1.5 truncate text-muted-foreground">
                              {logoFile
                                ? logoFile.name
                                : 'PNG, JPEG, WebP or GIF · 256×256 px · up to 2 MB · or drop it here'}
                            </p>
                            {logoError && (
                              <p role="alert" className="text-xs mt-1 text-destructive">
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
                          onChange={(event) =>
                            handleSelectLogo(event.target.files?.[0])
                          }
                        />
                      </div>
                    </div>
                  )}

                  {/* STEP 2: INVITES */}
                  {currentStep === 2 && (
                    <div className="space-y-5">
                      <SettingsGroup title="Import from a file">
                        <div className="gap-3.5 p-4 flex flex-wrap items-center justify-between rounded-xl border border-border bg-background">
                          <div className="gap-3.5 min-w-0 flex items-center">
                            <SettingsIconTile>
                              <FileSpreadsheet />
                            </SettingsIconTile>
                            <div className="min-w-0">
                              <h4 className="text-sm font-semibold text-foreground">
                                CSV or Excel file
                              </h4>
                              <p className="text-xs mt-0.5 text-muted-foreground">
                                .csv, .xlsx, .xls, .tsv or .txt — we pick out
                                the email addresses.
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                            className="h-8 text-xs"
                          >
                            <Upload className="h-3.5 w-3.5 mr-1.5" />
                            Import file
                          </Button>
                        </div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".csv,.xlsx,.xls,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e.target.files?.[0])}
                        />
                      </SettingsGroup>

                      <SettingsGroup
                        title="Add by email"
                        description="Paste one address or many, separated by commas or spaces."
                      >
                        <div className="gap-2 flex items-center">
                          <Input
                            type="text"
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
                            placeholder="colleague@company.com, team@company.com"
                            className="h-9 text-xs"
                          />
                          <Button
                            type="button"
                            onClick={handleAddInvite}
                            variant="outline"
                            className="h-9 text-xs shrink-0"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Add
                          </Button>
                        </div>

                        {inviteError && (
                          <p className="text-xs gap-1.5 flex items-center text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            {inviteError}
                          </p>
                        )}

                        {importStatus && (
                          <p className="text-xs gap-1.5 flex items-center text-success">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                            {importStatus}
                          </p>
                        )}

                        {invitedEmails.length > 0 && (
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-muted-foreground">
                                {invitedEmails.length} to invite
                              </p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={handleClearAllInvites}
                                className="text-muted-foreground hover:text-destructive"
                              >
                                Clear all
                              </Button>
                            </div>
                            <ScrollArea
                              className="max-h-36 rounded-xl border border-border bg-background"
                              contentClassName="flex flex-wrap gap-2 p-2"
                            >
                              {invitedEmails.map((email) => (
                                <span
                                  key={email}
                                  className="gap-1.5 px-2.5 py-1 text-xs inline-flex items-center rounded-md border border-border bg-surface text-foreground"
                                >
                                  {email}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveInvite(email)}
                                    className="ml-0.5 text-subtle hover:text-destructive"
                                    aria-label={`Remove ${email}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </ScrollArea>
                          </div>
                        )}
                      </SettingsGroup>

                      <p className="text-[11px] text-muted-foreground">
                        Everyone invited joins as a member. You can invite more
                        people, or change roles, from workspace settings at any
                        time.
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="pt-4 gap-3 flex items-center justify-between border-t border-border/60">
                    {currentStep > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setCurrentStep(1)}
                        disabled={isBusy}
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Back
                      </Button>
                    ) : (
                      <Button
                        asChild
                        variant="ghost"
                        className="h-8 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Link to="/">Cancel</Link>
                      </Button>
                    )}

                    {currentStep === 1 ? (
                      <Button
                        type="submit"
                        disabled={slugChecking || slugTaken}
                        className="h-8 text-xs"
                      >
                        Continue <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    ) : (
                      <div className="gap-2 flex items-center">
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={isBusy}
                          onClick={() => void submit(false)()}
                          className="h-8 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Skip for now
                        </Button>
                        <Button
                          type="submit"
                          loading={isBusy}
                          className="h-8 text-xs"
                        >
                          {invitedEmails.length > 0
                            ? `Invite ${invitedEmails.length} & create`
                            : 'Create workspace'}
                        </Button>
                      </div>
                    )}
                  </div>
                </form>
              </Form>
            </SettingsCard>
          </div>

          {/* Live preview: a miniature of the sidebar this form is building. */}
          <div className="lg:col-span-5 lg:block top-8 sticky hidden">
            <SettingsGroup title="Preview">
              <SettingsCard divided>
                <div className="gap-3 p-4 flex items-center">
                  <WorkspaceAvatar
                    name={displayName}
                    src={logoPreview}
                    seed={slug || name}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <h4 className="text-sm font-semibold truncate text-foreground">
                      {displayName}
                    </h4>
                    <p className="truncate font-mono text-[11px] text-muted-foreground">
                      {host}/w/{slug || '…'}
                    </p>
                  </div>
                </div>

                <div className="p-4 space-y-4">
                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Channels
                    </p>
                    <div className="gap-2 px-2 py-1.5 text-xs flex items-center rounded-md bg-selected font-medium text-foreground">
                      <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                      general
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                      Members · {invitedEmails.length + 1}
                    </p>
                    <div className="gap-2 flex flex-wrap items-center">
                      <Avatar className="h-7 w-7 border border-primary">
                        <AvatarFallback className="text-primary-foreground text-xs font-bold bg-primary">
                          {initials(
                            currentUser?.displayName ||
                              currentUser?.name ||
                              'You',
                          )}
                        </AvatarFallback>
                      </Avatar>
                      {invitedEmails.slice(0, 6).map((email) => (
                        <Avatar
                          key={email}
                          className="h-7 w-7 border border-border-strong"
                        >
                          <AvatarFallback className="font-bold bg-surface-raised text-[10px] text-secondary-foreground">
                            {initials(email)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {invitedEmails.length > 6 && (
                        <span className="h-7 w-7 font-bold flex items-center justify-center rounded-full border border-border-strong bg-surface-raised text-[10px] text-muted-foreground">
                          +{invitedEmails.length - 6}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {invitedEmails.length > 0
                        ? 'You join as owner; invitees join as members.'
                        : 'You join as the owner.'}
                    </p>
                  </div>
                </div>
              </SettingsCard>
            </SettingsGroup>
          </div>
        </div>
      </div>
    </div>
  );
}
