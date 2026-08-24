import type { ReactNode } from 'react';
import { useCapabilities, isFeatureAvailable } from './capabilities.js';
import type { DesktopCapabilities } from './desktop-api.js';

export interface FeatureGateProps {
  /** Feature or capability key to check */
  feature: keyof DesktopCapabilities | string;
  /** Component or element to render when the feature is unavailable */
  fallback?: ReactNode;
  /** Content to render when the feature is available */
  children: ReactNode;
}

/**
 * Conditionally renders UI elements based on actual runtime desktop/web capabilities.
 *
 * Prevents exposing fake, broken, or unsupported desktop features to users.
 */
export function FeatureGate({
  feature,
  fallback = null,
  children,
}: FeatureGateProps) {
  const capabilities = useCapabilities();
  const available = isFeatureAvailable(feature, capabilities);

  if (!available) {
    return fallback ? <>{fallback}</> : null;
  }

  return <>{children}</>;
}
