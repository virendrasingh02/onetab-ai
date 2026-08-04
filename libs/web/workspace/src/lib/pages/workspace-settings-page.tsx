import { zodResolver } from '@hookform/resolvers/zod';
import { formErrorMessage } from '@org/auth';
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
  LoadingState,
  Textarea,
} from '@org/ui';
import { WorkspaceRole, hasWorkspaceRole } from '@org/types';
import {
  updateWorkspaceSchema,
  type UpdateWorkspaceInput,
} from '@org/validation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  useCurrentWorkspace,
  useDeleteWorkspace,
  useUpdateWorkspace,
} from '../use-workspaces.js';

export function WorkspaceSettingsPage() {
  const { workspace, workspaceId, isLoading } = useCurrentWorkspace();
  const updateWorkspace = useUpdateWorkspace(workspaceId);
  const deleteWorkspace = useDeleteWorkspace();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const form = useForm<UpdateWorkspaceInput>({
    resolver: zodResolver(updateWorkspaceSchema),
    values: {
      name: workspace?.name ?? '',
      description: workspace?.description ?? '',
    },
  });

  if (isLoading || !workspace) return <LoadingState fullPage />;

  const isAdmin = hasWorkspaceRole(workspace.role, WorkspaceRole.ADMIN);
  const isOwner = workspace.role === WorkspaceRole.OWNER;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await updateWorkspace.mutateAsync(values);
    } catch {
      // Rendered by <FormError>.
    }
  });

  return (
    <div className="max-w-2xl space-y-6 p-6 mx-auto">
      <div>
        <h2 className="text-lg font-semibold">Workspace settings</h2>
        <p className="text-sm text-muted-foreground">
          Manage how this workspace appears to its members.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">General</CardTitle>
          <CardDescription>
            {isAdmin
              ? 'Only admins and the owner can change these.'
              : 'You need the admin role to change these.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <FormError error={formErrorMessage(updateWorkspace.error)} />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
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
                control={form.control}
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

              <div className="gap-3 flex items-center">
                <span className="text-sm text-muted-foreground">
                  URL: <code className="font-mono">/w/{workspace.slug}</code>
                </span>
              </div>

              {isAdmin ? (
                <Button
                  type="submit"
                  loading={updateWorkspace.isPending}
                  disabled={!form.formState.isDirty}
                >
                  Save changes
                </Button>
              ) : null}
            </form>
          </Form>
        </CardContent>
      </Card>

      {isOwner ? (
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">
              Danger zone
            </CardTitle>
            <CardDescription>
              Deleting a workspace removes its channels, members and files. This
              cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
              Delete workspace
            </Button>
          </CardContent>
        </Card>
      ) : null}

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
              // Typing the exact slug is the guard against an accidental click.
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
