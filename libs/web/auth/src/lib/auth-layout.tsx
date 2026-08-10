import { cn } from '@org/utils';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

/**
 * Split shell for the unauthenticated routes: a branded panel on the left
 * (desktop only) and the form on the right. The form column is centred and
 * width-capped so it stays readable on ultrawide displays.
 */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  className,
}: AuthLayoutProps) {
  return (
    <div className="lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] grid min-h-full">
      <aside className="p-10 lg:flex relative hidden flex-col justify-between overflow-hidden bg-sidebar text-sidebar-foreground">
        {/* Decorative wash — purely presentational, hidden from AT. */}
        <div
          aria-hidden
          className="-top-24 -left-16 size-80 blur-3xl pointer-events-none absolute rounded-full bg-primary/25"
        />
        <div
          aria-hidden
          className="-right-20 bottom-0 size-96 blur-3xl pointer-events-none absolute rounded-full bg-info/20"
        />

        <Link to="/" className="gap-2.5 relative flex items-center">
          <span className="size-8 font-semibold flex items-center justify-center rounded-lg bg-primary text-primary-foreground">
            O
          </span>
          <span className="text-base font-semibold tracking-tight">
            OneTab AI
          </span>
        </Link>

        <div className="max-w-md relative">
          <p className="text-2xl leading-snug font-semibold text-balance">
            One place for your team&apos;s channels, files and decisions.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-sidebar-muted">
            Organise work into workspaces and channels, bring the right people
            in, and keep everything discoverable.
          </p>
        </div>

        <p className="text-xs relative text-sidebar-muted">
          © {new Date().getFullYear()} OneTab AI
        </p>
      </aside>

      <main className="px-6 py-12 flex items-center justify-center">
        <div className={cn('max-w-sm w-full', className)}>
          <div className="mb-8 lg:hidden">
            <span className="size-9 font-semibold flex items-center justify-center rounded-lg bg-primary text-primary-foreground">
              O
            </span>
          </div>

          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? (
            <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
          ) : null}

          <div className="mt-7">{children}</div>

          {footer ? (
            <div className="mt-6 text-sm text-center text-muted-foreground">
              {footer}
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
