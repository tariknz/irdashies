import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  widgetName: string;
}

interface State {
  hasError: boolean;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
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
