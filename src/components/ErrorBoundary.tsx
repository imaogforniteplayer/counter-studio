import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * Last line of defence: if something throws while rendering, show what happened
 * instead of a blank page, and offer a way out.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('Tickwell render error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const details = `${error.name}: ${error.message}\n${(error.stack ?? '').split('\n').slice(0, 6).join('\n')}`;
    return (
      <div role="alert" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, background: '#0b0b0e', color: '#f6f3ef', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ maxWidth: 520, width: '100%' }}>
          <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>Something went wrong</h1>
          <p style={{ color: '#a19eac', lineHeight: 1.5 }}>
            Tickwell hit an unexpected problem. Your counters are stored on this device and have not been deleted. Reloading usually fixes it.
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#15151b', padding: 12, borderRadius: 10, fontSize: 12, maxHeight: 180, overflow: 'auto' }}>{details}</pre>
          <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 8, padding: '10px 18px', borderRadius: 999, border: 0, background: '#ff8a3d', color: '#100e14', fontWeight: 600, cursor: 'pointer' }}>
            Reload
          </button>
        </div>
      </div>
    );
  }
}
