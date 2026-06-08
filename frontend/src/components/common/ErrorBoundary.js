import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info.componentStack);
  }

  // Soft reset — no full page reload
  handleRetry = () => this.setState({ hasError: false, error: null });
  handleReload = () => window.location.reload();

  render() {
    if (!this.state.hasError) return this.props.children;

    // Inline variant — used inside Layout so sidebar stays visible
    if (this.props.inline) {
      return (
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <div className="w-12 h-12 mb-4 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
            <span className="text-xl">⚠️</span>
          </div>
          <p className="font-semibold text-slate-800 dark:text-white mb-1">This page ran into a problem</p>
          <p className="text-sm text-slate-500 dark:text-gray-400 mb-5 max-w-xs">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <div className="flex gap-2">
            <button onClick={this.handleRetry} className="btn-primary">Try Again</button>
            <button onClick={this.handleReload} className="btn-secondary">Reload App</button>
          </div>
        </div>
      );
    }

    // Full-screen variant — app-level fallback
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50 dark:bg-navy-950">
        <div className="max-w-md w-full text-center bg-white dark:bg-navy-900 border border-slate-200 dark:border-navy-700 rounded-2xl shadow-xl p-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-lg font-semibold text-slate-900 dark:text-white">Something went wrong</h1>
          <p className="text-sm text-slate-500 dark:text-gray-400 mt-2">
            An unexpected error occurred. Try recovering without a full reload first.
          </p>
          <div className="flex flex-col gap-2 mt-6">
            <button onClick={this.handleRetry} className="btn-primary w-full">Try Again</button>
            <button onClick={this.handleReload} className="btn-secondary w-full">Reload App</button>
          </div>
        </div>
      </div>
    );
  }
}
