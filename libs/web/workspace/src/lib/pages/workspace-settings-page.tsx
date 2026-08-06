import { zodResolver } from '@hookform/resolvers/zod';
import { http } from '@org/api-client';
import { formErrorMessage } from '@org/auth';
import { useTheme, type Theme } from '@org/design-system';
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Form,
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Label,
  LoadingState,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@org/ui';
import { WorkspaceRole, hasWorkspaceRole } from '@org/types';
import {
  changePasswordSchema,
  updateWorkspaceSchema,
  type ChangePasswordInput,
  type UpdateWorkspaceInput,
} from '@org/validation';
import { useMutation } from '@tanstack/react-query';
import {
  Building2,
  Lock,
  Monitor,
  Moon,
  ShieldAlert,
  Sliders,
  Sun,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  useCurrentWorkspace,
  useDeleteWorkspace,
  useUpdateWorkspace,
} from '../use-workspaces.js';

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function WorkspaceSettingsPage() {
  const { workspace, workspaceId, isLoading } = useCurrentWorkspace();
  const updateWorkspace = useUpdateWorkspace(workspaceId);
  const deleteWorkspace = useDeleteWorkspace();
  const { theme, setTheme } = useTheme();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [passwordChanged, setPasswordChanged] = useState(false);

  // Workspace Update Form
  const workspaceForm = useForm<UpdateWorkspaceInput>({
    resolver: zodResolver(updateWorkspaceSchema),
    values: {
      name: workspace?.name ?? '',
      description: workspace?.description ?? '',
    },
  });

  // Password Change Mutation
  const changePassword = useMutation({
    mutationFn: (input: ChangePasswordInput) =>
      http.post('/auth/change-password', input).then(() => undefined),
    onSuccess: () => setPasswordChanged(true),
  });

  // Password Form
  const passwordForm = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', password: '', confirmPassword: '' },
  });

  if (isLoading || !workspace) return <LoadingState fullPage />;

  const isAdmin = hasWorkspaceRole(workspace.role, WorkspaceRole.ADMIN);
  const isOwner = workspace.role === WorkspaceRole.OWNER;

  const onWorkspaceSubmit = workspaceForm.handleSubmit(async (values) => {
    try {
      await updateWorkspace.mutateAsync(values);
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
    <div className="max-w-4xl space-y-6 p-6 mx-auto">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Workspace settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage workspace profile, appearance, notifications, and security preferences.
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="mb-6 flex flex-wrap gap-1 border-b border-border bg-transparent p-0">
          <TabsTrigger
            value="general"
            className="flex items-center gap-2 rounded-t-lg border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground hover:text-foreground"
          >
            <Building2 className="size-4" />
            General
          </TabsTrigger>
          <TabsTrigger
            value="preferences"
            className="flex items-center gap-2 rounded-t-lg border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground hover:text-foreground"
          >
            <Sliders className="size-4" />
            Appearance & Notifications
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="flex items-center gap-2 rounded-t-lg border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-colors data-[state=active]:border-primary data-[state=active]:bg-background data-[state=active]:text-foreground text-muted-foreground hover:text-foreground"
          >
            <Lock className="size-4" />
            Account Security
          </TabsTrigger>
          {isOwner ? (
            <TabsTrigger
              value="danger"
              className="flex items-center gap-2 rounded-t-lg border-b-2 border-transparent px-4 py-2 text-sm font-medium transition-colors data-[state=active]:border-destructive data-[state=active]:bg-background data-[state=active]:text-destructive text-muted-foreground hover:text-destructive"
            >
              <ShieldAlert className="size-4 text-destructive" />
              Danger Zone
            </TabsTrigger>
          ) : null}
        </TabsList>

        {/* Tab 1: General Settings */}
        <TabsContent value="general" className="space-y-6 outline-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Workspace General Details</CardTitle>
              <CardDescription>
                {isAdmin
                  ? 'Only admins and the owner can update these details.'
                  : 'You need the admin role to change workspace details.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...workspaceForm}>
                <form onSubmit={onWorkspaceSubmit} className="space-y-4" noValidate>
                  <FormError error={formErrorMessage(updateWorkspace.error)} />

                  <FormField
                    control={workspaceForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Workspace Name</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            value={field.value ?? ''}
                            disabled={!isAdmin}
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
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            rows={3}
                            disabled={!isAdmin}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="gap-3 flex items-center pt-1">
                    <span className="text-xs text-muted-foreground">
                      Workspace URL: <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">/w/{workspace.slug}</code>
                    </span>
                  </div>

                  {isAdmin ? (
                    <Button
                      type="submit"
                      loading={updateWorkspace.isPending}
                      disabled={!workspaceForm.formState.isDirty}
                    >
                      Save changes
                    </Button>
                  ) : null}
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Appearance & Notifications */}
        <TabsContent value="preferences" className="space-y-6 outline-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Appearance</CardTitle>
              <CardDescription>
                Applies to this browser session. &ldquo;System&rdquo; follows your operating system setting.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                role="radiogroup"
                aria-label="Theme"
                className="gap-3 grid grid-cols-3 max-w-md"
              >
                {THEME_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  const selected = theme === option.value;
                  return (
                    <button
                      key={option.value}
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setTheme(option.value)}
                      className={
                        selected
                          ? 'gap-2 p-3 text-sm flex flex-col items-center rounded-lg border-2 border-primary bg-selected text-foreground font-medium'
                          : 'gap-2 p-3 text-sm flex flex-col items-center rounded-lg border border-border bg-surface hover:bg-muted text-muted-foreground hover:text-foreground'
                      }
                    >
                      <Icon className="size-4" />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Notifications</CardTitle>
              <CardDescription>
                Manage your alert delivery preferences across this workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { id: 'mentions', label: 'Mentions and replies', checked: true, desc: 'Get notified when someone tags you or replies to your thread' },
                { id: 'invites', label: 'Workspace invitations', checked: true, desc: 'Receive alerts when members join or request access' },
                { id: 'digest', label: 'Weekly digest email', checked: false, desc: 'Get a weekly summary of key activity and channel updates' },
              ].map((row) => (
                <div key={row.id} className="flex items-center justify-between gap-4 py-1">
                  <div>
                    <Label htmlFor={row.id} className="text-sm font-medium">{row.label}</Label>
                    <p className="text-xs text-muted-foreground">{row.desc}</p>
                  </div>
                  <Switch id={row.id} defaultChecked={row.checked} disabled />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Account Security */}
        <TabsContent value="security" className="space-y-6 outline-none">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Change password</CardTitle>
              <CardDescription>
                Update your account password. Changing your password signs out all other active sessions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {passwordChanged ? (
                <div className="mb-4 rounded-md bg-success/10 p-3 text-xs text-success border border-success/20">
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
                        <FormLabel>Current password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            autoComplete="current-password"
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
                        <FormLabel>New password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            autoComplete="new-password"
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
                        <FormLabel>Confirm new password</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="password"
                            autoComplete="new-password"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    loading={changePassword.isPending}
                    disabled={!passwordForm.formState.isDirty}
                  >
                    Update password
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Danger Zone */}
        {isOwner ? (
          <TabsContent value="danger" className="space-y-6 outline-none">
            <Card className="border-destructive/40 bg-destructive/5">
              <CardHeader>
                <CardTitle className="text-base text-destructive">
                  Delete Workspace
                </CardTitle>
                <CardDescription>
                  Permanently remove this workspace and all associated channels, documents, and member permissions. This action cannot be undone.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                  Delete workspace
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>

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
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={confirmText !== workspace.slug}
              loading={deleteWorkspace.isPending}
              onClick={() => deleteWorkspace.mutate(workspace.id)}
            >
              Delete forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
