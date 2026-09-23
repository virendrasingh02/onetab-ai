import { zodResolver } from '@hookform/resolvers/zod';
import type { MagicLinkRequestResponse } from '@org/api-client';
import {
  Button,
  Form,
  FormControl,
  FormError,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
} from '@org/ui';
import {
  magicLinkRequestSchema,
  type MagicLinkRequestInput,
} from '@org/validation';
import { ArrowRight, KeyRound, Mail, MailCheck, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { trackAuthEvent } from '../auth-analytics.js';
import {
  formErrorMessage,
  useRequestMagicLink,
  useResendMagicLink,
} from '../use-auth.js';

/** Matches the API's per-account cooldown — resending sooner sends nothing. */
const RESEND_COOLDOWN_SECONDS = 30;

const emailDomain = (email: string) => email.split('@')[1];

export interface MagicLinkPanelProps {
  /** Carries over whatever the user already typed into the password form. */
  initialEmail?: string;
  onUsePassword: () => void;
  /** Lets the page retitle itself once the link is on its way. */
  onSentChange?: (sent: boolean) => void;
}

/**
 * Passwordless sign-in: collect an address, email a single-use link, then offer
 * resend / change address. The "sent" screen follows the forgot-password page —
 * it never claims an account exists, because the API never says.
 */
export function MagicLinkPanel({
  initialEmail = '',
  onUsePassword,
  onSentChange,
}: MagicLinkPanelProps) {
  const request = useRequestMagicLink();
  const resend = useResendMagicLink();
  const [sent, setSent] = useState<{
    email: string;
    response: MagicLinkRequestResponse;
  } | null>(null);
  const [cooldown, setCooldown] = useState(0);

  const form = useForm<MagicLinkRequestInput>({
    resolver: zodResolver(magicLinkRequestSchema),
    defaultValues: { email: initialEmail },
  });

  useEffect(() => {
    onSentChange?.(sent !== null);
  }, [sent, onSentChange]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const onSubmit = form.handleSubmit(async (values) => {
    trackAuthEvent('auth_magic_link_requested', {
      method: 'magic_link',
      emailDomain: emailDomain(values.email),
    });
    try {
      const response = await request.mutateAsync(values);
      trackAuthEvent('auth_magic_link_sent', {
        method: 'magic_link',
        emailDomain: emailDomain(values.email),
      });
      setSent({ email: values.email, response });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      // Surfaced by <FormError>.
    }
  });

  const handleResend = async () => {
    if (!sent || cooldown > 0) return;
    try {
      const response = await resend.mutateAsync({ email: sent.email });
      trackAuthEvent('auth_magic_link_sent', {
        method: 'magic_link',
        emailDomain: emailDomain(sent.email),
      });
      setSent({ email: sent.email, response });
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch {
      // Surfaced by <FormError>.
    }
  };

  const passwordFallback = (
    <button
      type="button"
      onClick={onUsePassword}
      className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
    >
      <KeyRound className="size-3.5" />
      <span>Sign in with password instead</span>
    </button>
  );

  if (sent) {
    const { devToken, expiresInMinutes } = sent.response;
    return (
      <div className="gap-4 flex flex-col items-center text-center" aria-live="polite">
        <div className="size-12 flex items-center justify-center rounded-full bg-surface-raised border border-border text-success-text">
          <MailCheck className="size-6" />
        </div>

        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            If an account exists for
          </p>
          <p className="text-sm font-semibold text-foreground break-all">
            {sent.email}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
            we have sent it a sign-in link. The link expires in{' '}
            {expiresInMinutes} minutes and can only be used once.
          </p>
        </div>

        {devToken ? (
          <div className="p-3 w-full rounded-lg bg-surface border border-border text-left">
            <p className="mb-1 text-[11px] font-medium text-muted-foreground">
              Development only:
            </p>
            <Link
              to={`/auth/magic-link/verify?token=${encodeURIComponent(devToken)}`}
              className="text-[11px] font-mono break-all text-foreground hover:underline"
            >
              /auth/magic-link/verify?token={devToken}
            </Link>
          </div>
        ) : null}

        <FormError error={formErrorMessage(resend.error)} />

        <div className="w-full space-y-2">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="w-full"
            disabled={cooldown > 0}
            loading={resend.isPending}
            onClick={() => void handleResend()}
            leadingIcon={<RotateCw className="size-3.5" />}
          >
            {cooldown > 0 ? `Resend available in ${cooldown}s` : 'Resend link'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="md"
            className="w-full"
            onClick={() => {
              setSent(null);
              setCooldown(0);
              request.reset();
              resend.reset();
            }}
          >
            Use a different email
          </Button>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Can&apos;t find it? Check your spam folder, or resend the link.
        </p>

        <div className="pt-3 w-full border-t border-border">{passwordFallback}</div>
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        <FormError error={formErrorMessage(request.error)} />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem className="space-y-1 text-left">
              <FormLabel className="text-xs">Work Email</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="your@company.com"
                  leadingIcon={<Mail />}
                />
              </FormControl>
              <FormMessage className="text-[11px]" />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          size="md"
          className="w-full mt-1"
          loading={form.formState.isSubmitting || request.isPending}
          trailingIcon={<ArrowRight className="size-3.5" />}
        >
          Email me a sign-in link
        </Button>

        <div className="pt-1 text-center">{passwordFallback}</div>
      </form>
    </Form>
  );
}
