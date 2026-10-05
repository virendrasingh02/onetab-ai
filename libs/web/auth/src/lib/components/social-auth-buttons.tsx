import { useState, type ComponentProps } from 'react';
import { authApi } from '@org/api-client';
import { toast } from '@org/ui';
import { cn } from '@org/utils';
import { Loader2 } from 'lucide-react';
import { trackAuthEvent } from '../auth-analytics.js';

export interface SocialAuthButtonsProps extends ComponentProps<'div'> {
  onProviderClick?: (provider: 'google' | 'apple') => void;
  disabled?: boolean;
  isDesktopHandoff?: boolean;
  handoffState?: string | null;
  handoffChallenge?: string | null;
  returnTo?: string | null;
  invitationToken?: string | null;
  mode?: 'login' | 'register';
}

export function SocialAuthButtons({
  className,
  onProviderClick,
  disabled = false,
  isDesktopHandoff,
  handoffState,
  handoffChallenge,
  returnTo,
  invitationToken,
  mode = 'login',
  ...props
}: SocialAuthButtonsProps) {
  const [loadingProvider, setLoadingProvider] = useState<'google' | 'apple' | null>(null);

  const handleProviderSelect = async (provider: 'google' | 'apple') => {
    if (disabled || loadingProvider) return;

    if (onProviderClick) {
      onProviderClick(provider);
      return;
    }

    setLoadingProvider(provider);
    trackAuthEvent(provider === 'google' ? 'auth_google_started' : 'auth_apple_started', {
      method: provider,
      hasReturnTo: Boolean(returnTo),
    });

    try {
      const queryParams = {
        returnTo: returnTo || undefined,
        desktop: isDesktopHandoff ? ('true' as const) : undefined,
        state: handoffState || undefined,
        code_challenge: handoffChallenge || undefined,
        code_challenge_method: handoffChallenge ? 'S256' : undefined,
        invitationToken: invitationToken || undefined,
      };

      const { url } =
        provider === 'google'
          ? await authApi.getGoogleAuthUrl(queryParams)
          : await authApi.getAppleAuthUrl(queryParams);

      window.location.href = url;
    } catch (err: any) {
      setLoadingProvider(null);
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        `Could not connect to ${provider === 'google' ? 'Google' : 'Apple'}. Please try again.`;

      trackAuthEvent(provider === 'google' ? 'auth_google_failed' : 'auth_apple_failed', {
        method: provider,
        errorCode: 'provider_init_failed',
      });

      toast.error(errorMessage);
    }
  };

  const isGoogleLoading = loadingProvider === 'google';
  const isAppleLoading = loadingProvider === 'apple';
  const isAnyLoading = Boolean(loadingProvider);

  return (
    <div className={cn('space-y-2.5 w-full', className)} {...props}>
      {/* Google Button */}
      <button
        type="button"
        disabled={disabled || isAnyLoading}
        onClick={() => void handleProviderSelect('google')}
        aria-label="Continue with Google"
        aria-busy={isGoogleLoading}
        className={cn(
          'w-full h-10 px-4 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150',
          'flex items-center justify-center gap-2.5',
          'bg-background hover:bg-accent text-foreground border border-input shadow-xs',
          'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {isGoogleLoading ? (
          <>
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
            <span>Connecting to Google…</span>
          </>
        ) : (
          <>
            <svg className="size-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.97 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continue with Google</span>
          </>
        )}
      </button>

      {/* Apple Button */}
      <button
        type="button"
        disabled={disabled || isAnyLoading}
        onClick={() => void handleProviderSelect('apple')}
        aria-label="Continue with Apple"
        aria-busy={isAppleLoading}
        className={cn(
          'w-full h-10 px-4 rounded-lg text-xs sm:text-sm font-medium transition-all duration-150',
          'flex items-center justify-center gap-2.5',
          'bg-background hover:bg-accent text-foreground border border-input shadow-xs',
          'focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
          'disabled:opacity-50 disabled:cursor-not-allowed',
        )}
      >
        {isAppleLoading ? (
          <>
            <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" aria-hidden="true" />
            <span>Connecting to Apple…</span>
          </>
        ) : (
          <>
            <svg className="size-4 shrink-0 fill-current text-foreground" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.87-.96.04-2.12.64-2.79 1.43-.59.68-1.11 1.77-1.03 2.83 1.07.08 2.19-.58 2.81-1.39z" />
            </svg>
            <span>Continue with Apple</span>
          </>
        )}
      </button>
    </div>
  );
}
