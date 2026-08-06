import type { Accent } from '@org/design-system';
import { cn } from '@org/utils';
import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps, ReactNode } from 'react';
import { accentClasses } from './accent.js';

/* ---------------------------------------------------------------- Page ---- */

const pageVariants = cva('flex min-h-full flex-col', {
  variants: {
    width: {
      /** Dense tools and boards that want the whole viewport. */
      full: 'w-full',
      /** Reading-width screens: settings, documents, forms. */
      prose: 'max-w-3xl mx-auto w-full',
      /** The default for dashboards and list screens. */
      wide: 'max-w-7xl mx-auto w-full',
    },
    padding: {
      none: '',
      md: 'px-6 py-6',
      lg: 'px-8 py-8',
    },
  },
  defaultVariants: { width: 'wide', padding: 'md' },
});

export interface PageProps
  extends ComponentProps<'div'>, VariantProps<typeof pageVariants> {}

/**
 * The standard content container for a routed screen.
 *
 * Deliberately uses `min-h-full` rather than `min-h-screen`: these render
 * inside the app shell's scrolling `<main>`, and a viewport-height floor there
 * produces a second scrollbar. It also sets no background — the shell owns the
 * canvas, so screens inherit the theme instead of pinning their own.
 */
export function Page({ className, width, padding, ...props }: PageProps) {
  return (
    <div
      data-slot="page"
      className={cn(pageVariants({ width, padding }), className)}
      {...props}
    />
  );
}

/* ---------------------------------------------------------- PageHeader ---- */

export interface PageHeaderProps extends Omit<
  ComponentProps<'header'>,
  'title'
> {
  title: ReactNode;
  description?: ReactNode;
  /** Lucide icon element. Tinted with `accent` and placed in a soft chip. */
  icon?: ReactNode;
  accent?: Accent;
  /** Buttons and controls, right-aligned on wide viewports. */
  actions?: ReactNode;
  /** Breadcrumb or back link rendered above the title. */
  eyebrow?: ReactNode;
  /** Tabs or filters rendered below, flush with the header's bottom border. */
  toolbar?: ReactNode;
}

/**
 * The title block every screen opens with.
 *
 * Renders a single `<h1>` so each route has exactly one top-level heading —
 * the hand-rolled headers this replaces each declared their own, and several
 * nested a second `<h1>` inside the page body.
 */
export function PageHeader({
  title,
  description,
  icon,
  accent,
  actions,
  eyebrow,
  toolbar,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      data-slot="page-header"
      className={cn('mb-6', className)}
      {...props}
    >
      {eyebrow ? <div className="mb-2">{eyebrow}</div> : null}

      <div className="gap-x-4 gap-y-3 flex flex-wrap items-start justify-between">
        <div className="min-w-0 gap-3 flex items-start">
          {icon ? (
            <span
              aria-hidden
              className={cn(
                'mt-0.5 size-9 [&_svg]:size-5 flex shrink-0 items-center justify-center rounded-lg',
                accent
                  ? accentClasses[accent].soft
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {icon}
            </span>
          ) : null}

          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight truncate text-foreground">
              {title}
            </h1>
            {description ? (
              <p className="mt-1 text-sm text-pretty text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div className="gap-2 flex shrink-0 flex-wrap items-center">
            {actions}
          </div>
        ) : null}
      </div>

      {toolbar ? <div className="mt-4">{toolbar}</div> : null}
    </header>
  );
}

/* --------------------------------------------------------- PageSection ---- */

export interface PageSectionProps extends Omit<
  ComponentProps<'section'>,
  'title'
> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

/** A titled band within a page. Its heading is an `<h2>`, below the page `<h1>`. */
export function PageSection({
  title,
  description,
  actions,
  className,
  children,
  ...props
}: PageSectionProps) {
  return (
    <section
      data-slot="page-section"
      className={cn('mb-6', className)}
      {...props}
    >
      {title || actions ? (
        <div className="mb-3 gap-2 flex flex-wrap items-end justify-between">
          <div>
            {title ? (
              <h2 className="text-sm font-semibold text-foreground">{title}</h2>
            ) : null}
            {description ? (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {description}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="gap-2 flex items-center">{actions}</div>
          ) : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------- Toolbar ---- */

/** A horizontal control strip. `role="toolbar"` groups the controls for AT. */
export function Toolbar({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="toolbar"
      role="toolbar"
      className={cn('gap-2 flex flex-wrap items-center', className)}
      {...props}
    />
  );
}
