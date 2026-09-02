import type { ComponentProps } from 'react';
import { cn } from '@org/utils';

export interface SocialAuthButtonsProps extends ComponentProps<'div'> {
  onProviderClick?: (provider: 'google' | 'apple' | 'github') => void;
  disabled?: boolean;
}

export function SocialAuthButtons({
  className,
  onProviderClick,
  disabled = false,
  ...props
}: SocialAuthButtonsProps) {
  return (
    <div className={cn('space-y-2.5 w-full', className)} {...props}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onProviderClick?.('google')}
        className="w-full h-10 px-4 rounded-lg bg-[#121214] hover:bg-zinc-800/80 active:bg-zinc-800 border border-zinc-800/90 hover:border-zinc-700 text-zinc-200 hover:text-white text-xs sm:text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
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
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onProviderClick?.('apple')}
        className="w-full h-10 px-4 rounded-lg bg-[#121214] hover:bg-zinc-800/80 active:bg-zinc-800 border border-zinc-800/90 hover:border-zinc-700 text-zinc-200 hover:text-white text-xs sm:text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="size-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 1.01-2.87-.96.04-2.12.64-2.79 1.43-.59.68-1.11 1.77-1.03 2.83 1.07.08 2.19-.58 2.81-1.39z" />
        </svg>
        <span>Continue with Apple</span>
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onProviderClick?.('github')}
        className="w-full h-10 px-4 rounded-lg bg-[#121214] hover:bg-zinc-800/80 active:bg-zinc-800 border border-zinc-800/90 hover:border-zinc-700 text-zinc-200 hover:text-white text-xs sm:text-sm font-medium transition-all duration-150 flex items-center justify-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <svg className="size-4 shrink-0 fill-current" viewBox="0 0 24 24" aria-hidden="true">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
          />
        </svg>
        <span>Continue with GitHub</span>
      </button>
    </div>
  );
}
