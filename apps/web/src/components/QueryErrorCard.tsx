import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  error: Error | null;
}

/**
 * Isolates Suspense/query failures so one Axios "Network Error" does not
 * bubble to the router defaultErrorComponent and blank the whole Pulse page.
 */
export class QueryErrorCard extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Dashboard widget error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">
            {this.props.title || 'Failed to load'}
          </p>
          <pre className="mt-2 max-h-24 overflow-auto font-mono text-xs text-muted-foreground">
            {this.state.error.message}
          </pre>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => this.setState({ error: null })}
          >
            Retry
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
