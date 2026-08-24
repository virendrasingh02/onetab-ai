import type { FeatureEvaluation } from '@org/platform';
import { Button, EmptyState } from '@org/ui';
import { Lock } from 'lucide-react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { openExternal } from './desktop-api.js';
import { useFeature } from './use-feature.js';

/**
 * The screen a `FeatureRoute` renders instead of its children — reused
 * outside routing too, wherever a feature is disabled/restricted rather than
 * hidden/redirected.
 */
export function FeatureUnavailableNotice({ evaluation }: { evaluation: FeatureEvaluation }) {
  const fallback = evaluation.fallback;

  return (
    <div className="p-6 grid min-h-full place-items-center">
      <EmptyState
        icon={<Lock />}
        title="This feature isn't available here"
        description={evaluation.reason ?? 'This feature is not available in the current build.'}
        action={
          fallback?.type === 'external' ? (
            <Button onClick={() => void openExternal(fallback.url)}>
              {fallback.label ?? 'Open in browser'}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}

export interface FeatureRouteProps {
  /** A `FEATURE_REGISTRY` id from `@org/platform`. */
  id: string;
  children: ReactNode;
}

/**
 * Route-level enforcement of `@org/platform`'s feature registry — guards a
 * manually-typed URL the same way hiding the nav link guards a click.
 *
 * - `HIDDEN` / `OS_UNSUPPORTED`: the route doesn't exist here — back to `/`.
 * - `WEB_ONLY` with a fallback: redirected to the web-equivalent route.
 * - Any other unavailable state (`DISABLED`, `REQUIRES_PERMISSION`,
 *   `REQUIRES_PLAN`, `STORE_RESTRICTED`, `COMING_SOON`): rendered in place —
 *   the destination is real, just not usable right now, so the reason is
 *   worth showing rather than silently bouncing.
 * - `AVAILABLE` / `EXTERNAL`: renders the route's own content.
 */
export function FeatureRoute({ id, children }: FeatureRouteProps) {
  const evaluation = useFeature(id);

  if (evaluation.state === 'HIDDEN' || evaluation.state === 'OS_UNSUPPORTED') {
    return <Navigate to="/" replace />;
  }

  if (evaluation.state === 'WEB_ONLY' && evaluation.fallback?.type === 'web') {
    return <Navigate to={evaluation.fallback.url} replace />;
  }

  if (!evaluation.available) {
    return <FeatureUnavailableNotice evaluation={evaluation} />;
  }

  return <>{children}</>;
}
