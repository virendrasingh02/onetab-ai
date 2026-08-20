import { zodResolver } from '@hookform/resolvers/zod';
import { formErrorMessage } from '@org/auth';
import { ChannelVisibility, type Channel } from '@org/types';
import {
  Button,
  Dialog,
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
  Switch,
  Textarea,
} from '@org/ui';
import { slugify } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { createChannelSchema, type CreateChannelInput } from '@org/validation';
import { Hash, Lock } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useCreateChannel } from '../use-channels.js';

export interface CreateChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Runs instead of the default "open the new channel" navigation — for
   * callers that want to stay where they are.
   */
  onCreated?: (channel: Channel) => void;
}

/**
 * Creates a channel without leaving the page behind the dialog.
 *
 * The name is slugified as it is typed rather than on submit: the field is the
 * only place the eventual URL is visible, so showing anything else there makes
 * the created channel look renamed.
 */
export function CreateChannelDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateChannelDialogProps) {
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

  // Closing abandons the draft, so a reopened dialog starts empty rather than
  // showing the half-filled form from the last attempt.
  useEffect(() => {
    if (!open) {
      form.reset();
      createChannel.reset();
    }
    // `form` and the mutation are stable for the life of the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const isPrivate = form.watch('visibility') === ChannelVisibility.PRIVATE;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const channel = await createChannel.mutateAsync(values);
      onOpenChange(false);
      if (onCreated) {
        onCreated(channel);
      } else {
        navigate(`/w/${slug}/c/${channel.slug}`);
      }
    } catch {
      // Rendered by <FormError> / field errors.
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate>
          <DialogHeader>
            <div className="gap-2 flex items-center">
              <div className="size-8 flex items-center justify-center rounded-lg border border-border bg-surface-raised text-primary">
                {isPrivate ? (
                  <Lock className="size-4" />
                ) : (
                  <Hash className="size-4" />
                )}
              </div>
              <div>
                <DialogTitle>Create a channel</DialogTitle>
                <DialogDescription>
                  Channels work best when they are organised around one subject.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Form {...form}>
            <div className="space-y-4 px-6 py-4">
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
                      <Textarea
                        {...field}
                        value={field.value ?? ''}
                        rows={3}
                        placeholder="What this channel is for, who belongs here, and what to post."
                      />
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
                    <div className="gap-4 p-3 flex items-start justify-between rounded-lg border border-border bg-surface-raised">
                      <div>
                        <FormLabel>Make private</FormLabel>
                        <p className="mt-1 text-[11px] text-muted-foreground">
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
            </div>
          </Form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={form.formState.isSubmitting || createChannel.isPending}
            >
              Create channel
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
