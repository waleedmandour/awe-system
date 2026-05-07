'use client';

import React, { Component, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional fallback UI — if provided, replaces the default error screen */
  fallback?: ReactNode;
  /** Optional callback invoked when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  showDetails: boolean;
}

/**
 * React Error Boundary that catches runtime errors in the component tree and
 * displays a friendly fallback screen instead of a white crash page.
 *
 * Compatible with Next.js App Router ('use client').
 * Uses Tailwind CSS styled with the SQU green/gold theme.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
  }

  /** Reset the boundary so children can re-render from scratch. */
  handleReset = (): void => {
    this.setState({ hasError: false, error: null, errorInfo: null, showDetails: false });
  };

  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use a custom fallback if one was provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[400px] items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-green-200 bg-white p-8 text-center shadow-lg dark:border-green-900 dark:bg-gray-900">
            {/* Icon */}
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950">
              <AlertTriangle className="h-9 w-9 text-green-700 dark:text-green-400" />
            </div>

            {/* Title */}
            <h2 className="mb-2 text-xl font-bold text-gray-900 dark:text-gray-100">
              Something went wrong
            </h2>

            {/* Description */}
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">
              An unexpected error occurred. Please try again or reload the page.
            </p>

            {/* Try Again button */}
            <button
              onClick={this.handleReset}
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-green-700 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:bg-green-600 dark:hover:bg-green-700 dark:focus:ring-offset-gray-900"
            >
              <RotateCcw className="h-4 w-4" />
              Try Again
            </button>

            {/* Collapsible error details */}
            {this.state.error && (
              <div className="mt-6">
                <button
                  onClick={this.toggleDetails}
                  className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-gray-400 transition-colors hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {this.state.showDetails ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" /> Hide details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" /> Show details
                    </>
                  )}
                </button>

                {this.state.showDetails && (
                  <div className="mt-3 cursor-text rounded-lg bg-gray-50 p-4 text-left dark:bg-gray-800">
                    <p className="mb-2 break-words font-mono text-xs text-red-600 dark:text-red-400">
                      {this.state.error.toString()}
                    </p>
                    {this.state.errorInfo?.componentStack && (
                      <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
