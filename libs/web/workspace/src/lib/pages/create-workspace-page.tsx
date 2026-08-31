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
  ScrollArea,
  WorkspaceAvatar,
} from '@org/ui';
import { formErrorMessage } from '@org/auth';
import { initials, slugify } from '@org/utils';
import {
  createWorkspaceSchema,
  workspaceLogoError,
  WORKSPACE_LOGO_MIME_TYPES,
  type CreateWorkspaceInput,
} from '@org/validation';
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  ImagePlus,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import {
  useCreateWorkspaceFlow,
  useSlugSuggestion,
} from '../use-workspaces.js';

function GoogleIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}

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
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: '', slug: '' },
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
  const handleConnectGoogle = () => {
    setInviteError(null);
    setImportStatus(
      'Google Workspace sync isn’t connected yet — no directory emails were added. Use the CSV/Excel import or add addresses manually for now.',
    );
  };

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
    if (isValid) setCurrentStep(2);
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
  const StepIcon = step.icon;

  return (
    <div className="selection:text-primary-foreground flex min-h-full flex-col justify-between bg-background text-foreground selection:bg-primary">
      <main className="max-w-6xl px-4 py-8 mx-auto flex w-full flex-1 flex-col justify-center">
        {/* Top Back Navigation */}
        <div className="mb-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              if (currentStep === 2) {
                setCurrentStep(1);
              } else {
                navigate(-1);
              }
            }}
            className="gap-2 -ml-2 px-3 flex items-center text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back</span>
          </Button>
        </div>

        <div className="lg:grid-cols-12 gap-8 grid grid-cols-1 items-start">
          {/* Form Side */}
          <div className="lg:col-span-7">
            <Card className="backdrop-blur shadow-2xl border-border bg-surface/80">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl gap-2 flex items-center text-foreground">
                  <StepIcon className="h-5 w-5 text-primary" />
                  {step.label}
                </CardTitle>
                <CardDescription className="text-sm text-muted-foreground">
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
                    <FormError
                      error={formErrorMessage(createWorkspace.error)}
                    />

                    {/* STEP 1: IDENTITY + LOGO */}
                    {currentStep === 1 && (
                      <div className="space-y-5">
                        {/* Logo uploader */}
                        <div>
                          <label className="text-sm font-medium mb-2 block text-foreground">
                            Workspace Logo{' '}
                            <span className="font-normal text-subtle">
                              (Optional)
                            </span>
                          </label>
                          <div className="gap-4 p-4 flex items-center rounded-xl border border-border bg-background">
                            <button
                              type="button"
                              onClick={() => logoInputRef.current?.click()}
                              className="h-16 w-16 relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border-strong bg-surface-raised transition-transform hover:scale-105"
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
                              <div className="gap-2 flex flex-wrap items-center">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => logoInputRef.current?.click()}
                                  className="border-border-strong bg-surface-raised text-foreground hover:bg-selected"
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
                              <FormLabel className="text-foreground">
                                Workspace Name
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="e.g. Acme Corp, Design System Team"
                                  className="border-border bg-background text-foreground focus:border-primary"
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
                              <FormLabel className="text-foreground">
                                Workspace URL Slug
                              </FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input
                                    {...field}
                                    placeholder="acme-corp"
                                    className="pl-3 pr-24 text-sm border-border bg-background font-mono text-foreground focus:border-primary"
                                  />
                                  <span className="right-3 text-xs px-2 py-0.5 rounded absolute top-1/2 -translate-y-1/2 border border-border-strong bg-surface-raised font-mono text-muted-foreground">
                                    .onetab.ai
                                  </span>
                                </div>
                              </FormControl>
                              <FormDescription className="text-xs gap-1.5 pt-1 flex items-center text-muted-foreground">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                                Your workspace will be hosted at:{' '}
                                <code className="font-mono text-primary">
                                  onetab.ai/w/{field.value || 'your-slug'}
                                </code>
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {/* STEP 2: INVITES */}
                    {currentStep === 2 && (
                      <div className="space-y-6">
                        {/* Quick Import Sources */}
                        <div>
                          <label className="text-xs font-semibold tracking-wider mb-2.5 block text-muted-foreground uppercase">
                            Quick Import &amp; Integrations
                          </label>
                          <div className="sm:grid-cols-2 gap-3 grid grid-cols-1">
                            {/* Google Workspace */}
                            <div className="p-3.5 flex flex-col justify-between rounded-xl border border-border bg-background transition-colors hover:border-border-strong">
                              <div className="gap-2.5 mb-3 flex items-start">
                                <div className="p-2 shrink-0 rounded-lg border border-border-strong bg-surface-raised">
                                  <GoogleIcon className="h-4 w-4" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-semibold text-foreground">
                                    Google Workspace
                                  </h4>
                                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                                    Coming soon — no OAuth flow yet
                                  </p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={handleConnectGoogle}
                                className="text-xs font-medium h-8 w-full"
                              >
                                Connect Google Workspace
                              </Button>
                            </div>

                            {/* CSV / Excel / File Import */}
                            <div className="p-3.5 flex flex-col justify-between rounded-xl border border-border bg-background transition-colors hover:border-border-strong">
                              <div className="gap-2.5 mb-3 flex items-start">
                                <div className="p-2 shrink-0 rounded-lg border border-border-strong bg-surface-raised">
                                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-semibold text-foreground">
                                    CSV or Excel File
                                  </h4>
                                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                                    .csv, .xlsx, .xls, .tsv, or .txt
                                  </p>
                                </div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                className="text-xs font-medium h-8 w-full border-border-strong bg-surface-raised hover:bg-selected"
                              >
                                <Upload className="h-3.5 w-3.5 mr-1.5" />
                                Import File
                              </Button>
                            </div>
                          </div>

                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv,.xlsx,.xls,.tsv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                            className="hidden"
                            onChange={(e) =>
                              handleFileUpload(e.target.files?.[0])
                            }
                          />
                        </div>

                        {/* Direct Email / Bulk Paste */}
                        <div className="space-y-3 pt-1">
                          <label className="text-xs font-semibold tracking-wider block text-muted-foreground uppercase">
                            Or Add Manually (Single or Bulk Paste)
                          </label>
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
                              placeholder="colleague@company.com, team@company.com..."
                              className="text-xs border-border bg-background text-foreground focus:border-primary"
                            />
                            <Button
                              type="button"
                              onClick={handleAddInvite}
                              size="sm"
                              className="shrink-0"
                            >
                              <Plus className="h-4 w-4 mr-1" /> Add
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
                            <div className="space-y-2 pt-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-muted-foreground">
                                  Invites to be sent ({invitedEmails.length}):
                                </p>
                                <button
                                  type="button"
                                  onClick={handleClearAllInvites}
                                  className="text-[11px] text-muted-foreground transition-colors hover:text-destructive"
                                >
                                  Clear all
                                </button>
                              </div>
                              <ScrollArea
                                className="max-h-36 rounded-lg border border-border bg-background"
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
                        </div>

                        <p className="text-xs text-muted-foreground">
                          Everyone invited joins as a <strong>member</strong>.
                          You can invite more people, or change roles, from
                          workspace settings at any time.
                        </p>
                      </div>
                    )}

                    {/* Step Navigation Bar */}
                    <div className="pt-4 gap-3 flex items-center justify-between border-t border-border">
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
                        <Button
                          asChild
                          variant="ghost"
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Link to="/">Cancel</Link>
                        </Button>
                      )}

                      {currentStep === 1 ? (
                        <Button
                          type="submit"
                          className="font-medium shadow-lg shadow-primary/30"
                        >
                          Continue <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                      ) : (
                        <div className="gap-2 flex items-center">
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
                            className="text-primary-foreground font-semibold shadow-xl px-6 bg-gradient-to-r from-primary to-primary-hover shadow-primary/25 hover:from-primary hover:to-primary-hover"
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
          <div className="lg:col-span-5 lg:block top-24 sticky hidden">
            <Card className="backdrop-blur shadow-xl overflow-hidden border-border bg-surface/60">
              <div className="px-4 py-3 flex items-center justify-between border-b border-border bg-background/80">
                <div className="gap-2 flex items-center">
                  <div className="h-2.5 w-2.5 rounded-full bg-destructive/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-warning/80" />
                  <div className="h-2.5 w-2.5 rounded-full bg-success/80" />
                </div>
                <span className="gap-1 flex items-center font-mono text-[11px] text-muted-foreground">
                  <Wand2 className="h-3 w-3 text-primary" /> Live Preview
                </span>
              </div>

              <CardContent className="p-4 space-y-4">
                {/* Preview: workspace header, drawn from the form state above. */}
                <div className="p-3 flex items-center justify-between rounded-xl border border-border bg-background">
                  <div className="gap-3 min-w-0 flex items-center">
                    <WorkspaceAvatar
                      name={name || 'Your Workspace'}
                      src={logoPreview}
                      seed={slug || name}
                      size="lg"
                    />
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm max-w-[140px] truncate text-foreground">
                        {name || 'Your Workspace'}
                      </h4>
                      <p className="max-w-[140px] truncate font-mono text-[10px] text-muted-foreground">
                        {slug ? `onetab.ai/w/${slug}` : 'onetab.ai/w/...'}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-primary/40 bg-primary/10 text-[10px] text-primary"
                  >
                    Active
                  </Badge>
                </div>

                {/* Preview: the people this workspace will start with. */}
                <div className="space-y-2 p-3 rounded-xl border border-border/60 bg-background/40">
                  <div className="font-medium flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>TEAM MEMBERS ({invitedEmails.length + 1})</span>
                  </div>
                  <div className="gap-2 flex flex-wrap items-center">
                    <Avatar className="h-7 w-7 border border-primary">
                      <AvatarFallback className="text-primary-foreground text-xs font-bold bg-primary">
                        YOU
                      </AvatarFallback>
                    </Avatar>
                    {invitedEmails.slice(0, 4).map((email) => (
                      <Avatar
                        key={email}
                        className="h-7 w-7 border border-border-strong"
                      >
                        <AvatarFallback className="font-bold bg-surface-raised text-[10px] text-secondary-foreground">
                          {initials(email)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {invitedEmails.length > 4 && (
                      <span className="h-7 w-7 font-bold flex items-center justify-center rounded-full border border-border-strong bg-surface-raised text-[10px] text-muted-foreground">
                        +{invitedEmails.length - 4}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-subtle">
                    Your workspace starts with a{' '}
                    <span className="font-mono">#general</span> channel.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 px-6 text-xs border-t border-border/60 bg-background text-center text-subtle">
        OneTab AI Workspace Onboarding &bull; Crafting collaboration spaces in
        seconds
      </footer>
    </div>
  );
}
