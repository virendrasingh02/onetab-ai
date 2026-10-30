import { useTranslation } from '@org/i18n';
import { LanguageSelect } from '@org/ui';
import { useForcesDarkWindowChrome } from '@org/web-desktop';
import { cn } from '@org/utils';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LEGAL_LINKS, type LegalLinks } from './legal-links.js';

const FOOTER_LINKS: { key: keyof LegalLinks; label: string }[] = [
  { key: 'privacy', label: 'Privacy Policy' },
  { key: 'docs', label: 'Docs' },
  { key: 'support', label: 'Support' },
];

export interface AuthLayoutProps {
  title: string;
  subtitle?: ReactNode;
  /** Optional visual above the title (e.g. an avatar or status glyph). */
  hero?: ReactNode;
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
  hero,
  children,
  footer,
  className,
  brandName = 'Onetab AI',
  brandLogoText = 'O',
}: AuthLayoutProps) {
  const { locale, setLocale } = useTranslation();
  // The desktop title strip lives outside this layout's `dark` scope.
  useForcesDarkWindowChrome();

  return (
    <div className="dark px-4 py-5 sm:py-6 flex min-h-full flex-col items-center justify-between bg-background text-foreground selection:bg-primary/25">
      {/* Top Header Bar with centered Brand Emblem */}
      <header className="max-w-4xl px-4 flex w-full items-center justify-center">
        <Link
          to="/"
          className="gap-2 px-2.5 py-1.5 inline-flex items-center rounded-lg transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`${brandName} Home`}
        >
          <div className="size-7 font-bold text-xs flex items-center justify-center rounded-md border border-border bg-surface-raised text-foreground shadow-xs">
            {brandLogoText}
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground">
            {brandName}
          </span>
        </Link>
      </header>

      {/* Main Content Area */}
      <main className="py-6 my-auto flex w-full max-w-[360px] flex-col items-center">
        <div className={cn('w-full', className)}>
          {hero ? <div className="mb-5 flex justify-center">{hero}</div> : null}
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight leading-tight text-center text-foreground">
            {title}
          </h1>

          {subtitle ? (
            <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-center text-balance text-muted-foreground">
              {subtitle}
            </p>
          ) : null}

          <div className="mt-5 w-full">{children}</div>

          {footer ? (
            <div className="mt-4 text-xs leading-normal text-center text-muted-foreground">
              {footer}
            </div>
          ) : null}
        </div>
      </main>

      {/* Bottom Legal Notice & Footer Links */}
      <footer className="pt-4 max-w-md px-2 space-y-2 w-full text-center">
        {LEGAL_LINKS.terms ? (
          <p className="sm:text-xs leading-relaxed text-[11px] text-subtle">
            By proceeding, you acknowledge that you have read, understood, and
            agree to {brandName}&apos;s{' '}
            <a
              href={LEGAL_LINKS.terms}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground underline underline-offset-2 transition-colors hover:text-foreground"
            >
              Terms and Conditions
            </a>
            , including our sign-in and account access policies.
          </p>
        ) : null}

        <div className="sm:text-xs gap-3 sm:gap-4 flex flex-wrap items-center justify-center text-[11px] text-subtle">
          <span>
            © {new Date().getFullYear()} {brandName}
          </span>
          {FOOTER_LINKS.map(({ key, label }) =>
            LEGAL_LINKS[key] ? (
              <a
                key={key}
                href={LEGAL_LINKS[key]}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                {label}
              </a>
            ) : null,
          )}
        </div>

        <div className="pt-1 flex justify-center">
          <LanguageSelect
            value={locale}
            onChange={(code) => setLocale(code)}
            compact
          />
        </div>
      </footer>
    </div>
  );
}
