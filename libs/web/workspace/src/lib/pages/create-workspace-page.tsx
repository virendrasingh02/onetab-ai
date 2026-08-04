import { zodResolver } from '@hookform/resolvers/zod';
import {
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
} from '@org/ui';
import { formErrorMessage } from '@org/auth';
import { slugify } from '@org/utils';
import {
  createWorkspaceSchema,
  type CreateWorkspaceInput,
} from '@org/validation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { useCreateWorkspace, useSlugSuggestion } from '../use-workspaces.js';

export function CreateWorkspacePage() {
  const createWorkspace = useCreateWorkspace();

  const form = useForm<CreateWorkspaceInput>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: '', slug: '', description: '' },
  });

  const name = form.watch('name');
  const suggestion = useSlugSuggestion(name);

  // Keep the slug in step with the name until the user edits it themselves.
  const slugTouched = form.formState.dirtyFields.slug;
  useEffect(() => {
    if (slugTouched) return;
    const suggested = suggestion.data?.slug ?? slugify(name);
    if (suggested) form.setValue('slug', suggested, { shouldValidate: false });
  }, [name, suggestion.data?.slug, slugTouched, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createWorkspace.mutateAsync(values);
    } catch {
      // Rendered by <FormError> / field errors.
    }
  });

  return (
    <div className="max-w-lg px-6 py-12 mx-auto flex min-h-dvh flex-col justify-center">
      <Card>
        <CardHeader>
          <CardTitle>Create a workspace</CardTitle>
          <CardDescription>
            A workspace is where your team&apos;s channels, members and files
            live.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <FormError error={formErrorMessage(createWorkspace.error)} />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workspace name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Acme Corp" autoFocus />
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
                    <FormLabel>Workspace URL</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="acme-corp" />
                    </FormControl>
                    <FormDescription>
                      onetab.ai/w/{field.value || 'your-workspace'}
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
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={3}
                        placeholder="What is this workspace for?"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2 flex items-center justify-between">
                <Button asChild variant="ghost" size="sm">
                  <Link to="/">Cancel</Link>
                </Button>
                <Button
                  type="submit"
                  loading={
                    form.formState.isSubmitting || createWorkspace.isPending
                  }
                >
                  Create workspace
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
