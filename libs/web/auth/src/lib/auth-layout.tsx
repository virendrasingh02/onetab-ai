import { cn } from '@org/utils';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  brandName?: string;
  brandLogoText?: string;
}

/**
 * Centered minimalist auth shell matching the modern dark theme design:
 * - Top centered brand emblem & name
 * - Center content area with title, subtitle, form and social logins
 * - Bottom legal disclaimer and copyright footer links
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  className,
  brandName = 'OneTab AI',
  brandLogoText = 'O',
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col justify-between items-center bg-[#09090b] text-zinc-100 px-4 py-8 sm:py-10 selection:bg-zinc-800 selection:text-white">
      {/* Top Brand Emblem */}
      <header className="pt-2 sm:pt-4 flex items-center justify-center">
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:opacity-90 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-700"
          aria-label={`${brandName} Home`}
        >
          <div className="size-7 rounded-md bg-zinc-800/90 border border-zinc-700/80 flex items-center justify-center font-bold text-xs text-white shadow-xs">
            {brandLogoText}
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">
            {brandName}
          </span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-[380px] my-auto py-8 flex flex-col items-center">
        <div className={cn('w-full', className)}>
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-white text-center leading-tight">
            {title}
          </h1>

          {subtitle ? (
            <p className="mt-2 text-xs sm:text-sm text-zinc-400 text-center text-balance leading-relaxed">
              {subtitle}
            </p>
          ) : null}

          <div className="mt-6 w-full">{children}</div>

          {footer ? (
            <div className="mt-5 text-xs text-center text-zinc-400 leading-normal">
              {footer}
            </div>
          ) : null}
        </div>
      </main>

      {/* Bottom Legal Notice & Footer Links */}
      <footer className="pt-6 pb-2 text-center max-w-md w-full px-2 space-y-2.5">
        <p className="text-[11px] sm:text-xs text-zinc-500 leading-relaxed">
          By proceeding, you acknowledge that you have read, understood, and agree to {brandName}&apos;s{' '}
          <a
            href="#terms"
            className="text-zinc-400 underline underline-offset-2 hover:text-zinc-200 transition-colors"
          >
            Terms and Conditions
          </a>
          , including our sign-in and account access policies.
        </p>

        <div className="text-[11px] sm:text-xs text-zinc-500 flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
          <span>© {new Date().getFullYear()} {brandName}</span>
          <a href="#privacy" className="hover:text-zinc-300 transition-colors">
            Privacy Policy
          </a>
          <a href="#docs" className="hover:text-zinc-300 transition-colors">
            Docs
          </a>
          <a href="#support" className="hover:text-zinc-300 transition-colors">
            Support
          </a>
        </div>
      </footer>
    </div>
  );
}

