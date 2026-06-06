"use client";

import * as Sentry from "@sentry/nextjs";
import { Component, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Shown when the boundary catches an error. Defaults to a generic card. */
  fallback?: ReactNode;
};

type State = { hasError: boolean; eventId: string | null };

/**
 * Catches React render errors, reports them to Sentry, and renders a graceful
 * fallback instead of a blank screen.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomeFeature />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, eventId: null };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true, eventId: null };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    const eventId = Sentry.captureException(error, {
      extra: { componentStack: info.componentStack },
    });
    this.setState({ eventId: eventId ?? null });
  }

  handleRetry = () => {
    this.setState({ hasError: false, eventId: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) return this.props.fallback;

    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <p className="text-xl">⚠️</p>
        <h2 className="mt-3 text-base font-semibold text-slate-900">
          Something went wrong
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          This section encountered an unexpected error.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={this.handleRetry}
            className="rounded-xl bg-[#00C6A7] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0A8F7A]"
          >
            Try again
          </button>
          {this.state.eventId ? (
            <button
              type="button"
              onClick={() =>
                Sentry.showReportDialog({ eventId: this.state.eventId! })
              }
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Report issue
            </button>
          ) : null}
        </div>
      </div>
    );
  }
}
