import { zodResolver } from '@hookform/resolvers/zod';
import { formErrorMessage } from '@org/auth';
import { ChannelVisibility } from '@org/types';
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
  Switch,
  Textarea,
} from '@org/ui';
import { slugify } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { createChannelSchema, type CreateChannelInput } from '@org/validation';
import { Hash, Lock } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useCreateChannel } from '../use-channels.js';

export function CreateChannelPage() {
  const { slug, workspaceId } = useCurrentWorkspace();
  const createChannel = useCreateChannel(workspaceId);
  const navigate = useNavigate();

  const form = useForm<CreateChannelInput>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: {
      name: '',
      topic: '',
      description: '',
      visibility: ChannelVisibility.PUBLIC,
    },
  });

  const isPrivate = form.watch('visibility') === ChannelVisibility.PRIVATE;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const channel = await createChannel.mutateAsync(values);
      navigate(`/w/${slug}/c/${channel.slug}`);
    } catch {
      // Rendered by <FormError> / field errors.
    }
  });

  return (
    <div className="max-w-lg p-6 mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create a channel</CardTitle>
          <CardDescription>
            Channels are where a topic gets its own space. They work best when
            organised around a subject.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4" noValidate>
              <FormError error={formErrorMessage(createChannel.error)} />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoFocus
                        placeholder="product-launch"
                        leadingIcon={isPrivate ? <Lock /> : <Hash />}
                        // Normalise as they type so the preview matches the slug.
                        onChange={(event) =>
                          field.onChange(slugify(event.target.value))
                        }
                      />
                    </FormControl>
                    <FormDescription>
                      Lowercase letters, numbers and hyphens.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="topic"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Topic (optional)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ''}
                        placeholder="What is this channel about?"
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
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ''} rows={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <div className="gap-4 p-3 flex items-start justify-between rounded-lg border">
                      <div>
                        <FormLabel>Make private</FormLabel>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Only invited members can find and open this channel.
                          This cannot be undone later.
                        </p>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value === ChannelVisibility.PRIVATE}
                          onCheckedChange={(checked) =>
                            field.onChange(
                              checked
                                ? ChannelVisibility.PRIVATE
                                : ChannelVisibility.PUBLIC,
                            )
                          }
                          aria-label="Make channel private"
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2 flex items-center justify-between">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={
                    form.formState.isSubmitting || createChannel.isPending
                  }
                >
                  Create channel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
