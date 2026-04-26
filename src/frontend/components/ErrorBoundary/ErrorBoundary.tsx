import { Component, ErrorInfo, ReactNode } from 'react';
import logger from '@irdashies/utils/logger';

interface Props {
  children: ReactNode;
  /** Identifier (e.g. widget id, "app") included in logs to locate the failure. */
  label?: string;
  /** Optional fallback UI; defaults to invisible so an overlay stays out of the way. */
  fallback?: ReactNode;
  /**
   * Auto-reset interval in ms. When set, the boundary clears its error state
   * after this delay so transient telemetry-induced errors recover automatically.
   * Resets are capped at maxResets to avoid an infinite loop for irrecoverable
   * errors (e.g. out-of-disk-space).
   */
  resetAfterMs?: number;
  /** Maximum number of auto-resets before giving up. Defaults to 3. */
  maxResets?: number;
}

interface State {
  hasError: boolean;
  resetCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, resetCount: 0 };
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const { label = 'unknown', resetAfterMs, maxResets = 3 } = this.props;
    const { resetCount } = this.state;

    logger.error(
      `[ErrorBoundary:${label}] ${error.message} (attempt ${resetCount + 1}/${maxResets})`,
      error.stack,
      info.componentStack
    );

    const canReset = resetAfterMs && resetCount < maxResets;
    if (canReset && this.resetTimer === null) {
      this.resetTimer = setTimeout(() => {
        this.resetTimer = null;
        this.setState((s) => ({
          hasError: false,
          resetCount: s.resetCount + 1,
        }));
      }, resetAfterMs);
    } else if (!canReset && resetAfterMs) {
      logger.error(
        `[ErrorBoundary:${label}] Giving up after ${maxResets} resets — widget will remain hidden`
      );
    }
  }

  componentWillUnmount() {
    if (this.resetTimer !== null) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
