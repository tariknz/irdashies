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
   */
  resetAfterMs?: number;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  private resetTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const { label = 'unknown', resetAfterMs } = this.props;
    logger.error(
      `[ErrorBoundary:${label}] ${error.message}`,
      error.stack,
      info.componentStack
    );

    if (resetAfterMs && this.resetTimer === null) {
      this.resetTimer = setTimeout(() => {
        this.resetTimer = null;
        this.setState({ hasError: false });
      }, resetAfterMs);
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
