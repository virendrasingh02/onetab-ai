import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './error-state.js';

export interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback. Receives the error and a reset callback. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Reported to the monitoring pipeline. */
  onError?: (error: Error, info: ErrorInfo) => void;
  /** Changing any value here resets the boundary — pass the route key. */
  resetKeys?: unknown[];
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-phase errors in its subtree.
 *
 * Must stay a class component: React exposes no hook equivalent of
 * `componentDidCatch`. Place one at the app root and one per route so a single
 * failing panel cannot blank the whole workspace.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    this.props.onError?.(error, info);
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  override componentDidUpdate(prev: ErrorBoundaryProps) {
    const { resetKeys } = this.props;
    if (!this.state.error || !resetKeys || !prev.resetKeys) return;

    const changed =
      resetKeys.length !== prev.resetKeys.length ||
      resetKeys.some((key, i) => !Object.is(key, prev.resetKeys?.[i]));

    if (changed) this.reset();
  }

  reset = () => this.setState({ error: null });

  override render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <ErrorState
        fullPage
        title="This section failed to load"
        description="An unexpected error occurred while rendering. You can retry, or reload the page if the problem persists."
        onRetry={this.reset}
        detail={
          import.meta.env?.DEV ? `${error.message}\n\n${error.stack ?? ''}` : undefined
        }
      />
    );
  }
}
