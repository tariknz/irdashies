import { Component, type ReactNode } from 'react';
import logger from '@irdashies/utils/logger';

interface Props {
  children: ReactNode;
  widgetName: string;
  /**
   * Rendered instead of the default placeholder when the subtree throws. Pass
   * `null` for headless children, where a visible placeholder would inject a
   * stray box into the layout.
   */
  fallback?: ReactNode;
  /**
   * Retry the subtree this long after a throw, mirroring the app's
   * `ErrorBoundary resetAfterMs` convention in OverlayContainer. Without it
   * the boundary latches on the first error for the life of the page — fatal
   * for headless updaters, whose failure is otherwise invisible.
   */
  resetAfterMs?: number;
}

interface State {
  hasError: boolean;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };
  private resetTimer: ReturnType<typeof setTimeout> | undefined;

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    logger.error(`[preview] ${this.props.widgetName} failed to render`, error);
    if (this.props.resetAfterMs !== undefined && !this.resetTimer) {
      this.resetTimer = setTimeout(() => {
        this.resetTimer = undefined;
        this.setState({ hasError: false });
      }, this.props.resetAfterMs);
    }
  }

  componentWillUnmount() {
    if (this.resetTimer) clearTimeout(this.resetTimer);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) return this.props.fallback;
      return (
        <div className="flex items-center justify-center h-full bg-slate-900/60 rounded-sm border border-slate-800/50 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-bold">
            {this.props.widgetName} preview unavailable
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
