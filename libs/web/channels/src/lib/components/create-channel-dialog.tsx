import { zodResolver } from '@hookform/resolvers/zod';
import { formErrorMessage } from '@org/auth';
import { ChannelVisibility, type Channel } from '@org/types';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogBody,
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
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Input,
  RadioCardItem,
  RadioGroup,
  Textarea,
} from '@org/ui';
import { cn, slugify } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { createChannelSchema, type CreateChannelInput } from '@org/validation';
import { ChevronRight, Hash, Lock } from 'lucide-react';
import { useEffect, useState } from 'react';
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
  const { slug, workspace, workspaceId } = useCurrentWorkspace();
  const createChannel = useCreateChannel(workspaceId);
  const navigate = useNavigate();

  const form = useForm<CreateChannelInput>({
    resolver: zodResolver(createChannelSchema),
    defaultValues: {
      name: '',
      topic: '',
      description: '',
      welcomeMessage: '',
      visibility: ChannelVisibility.PUBLIC,
    },
  });

  // Closing abandons the draft, so a reopened dialog starts empty rather than
  // showing the half-filled form from the last attempt.
  useEffect(() => {
    if (!open) {
      form.reset();
      createChannel.reset();
      setDetailsOpen(false);
    }
    // `form` and the mutation are stable for the life of the dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const [detailsOpen, setDetailsOpen] = useState(false);
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
            <DialogBody className="space-y-4">
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
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Visibility</FormLabel>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      aria-label="Channel visibility"
                      className="gap-2 sm:grid-cols-2 grid-cols-1"
                    >
                      <RadioCardItem
                        value={ChannelVisibility.PUBLIC}
                        icon={<Hash />}
                        heading="Public"
                        description={`Anyone in ${workspace?.name ?? 'the workspace'} can find and join.`}
                      />
                      <RadioCardItem
                        value={ChannelVisibility.PRIVATE}
                        icon={<Lock />}
                        heading="Private"
                        description="Invite only. Cannot be made public later."
                      />
                    </RadioGroup>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="gap-1.5 text-xs font-medium flex items-center text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <ChevronRight
                      className={cn(
                        'size-3.5 transition-transform',
                        detailsOpen && 'rotate-90',
                      )}
                    />
                    Add topic, description &amp; welcome message
                    <span className="font-normal">(optional)</span>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-3 space-y-4">
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
                    name="welcomeMessage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Welcome message (optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            value={field.value ?? ''}
                            rows={2}
                            placeholder="Shown as the first message when someone opens this channel."
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CollapsibleContent>
              </Collapsible>
            </DialogBody>
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
