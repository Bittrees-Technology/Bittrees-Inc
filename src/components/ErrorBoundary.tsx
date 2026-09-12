import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--color-bg)",
            fontFamily: "var(--font-sans)",
            padding: "2rem",
          }}
        >
          <div
            style={{
              maxWidth: "480px",
              width: "100%",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "1.25rem",
            }}
          >
            {/* Bittrees tree mark */}
            <img
              src="/bittrees_logo_tree.png"
              alt="Bittrees"
              width={40}
              height={40}
              style={{ objectFit: "contain", opacity: 0.6 }}
            />

            <div>
              <h1
                style={{
                  fontFamily: "var(--font-serif)",
                  fontSize: "1.375rem",
                  fontWeight: 700,
                  color: "var(--color-ink)",
                  marginBottom: "0.5rem",
                }}
              >
                Something went wrong
              </h1>
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--color-ink-muted)",
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                An unexpected error occurred. Reload the page to continue.
              </p>
            </div>

            <button data-insights="reload-the-page"
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              Reload the page
            </button>

            {this.state.error && (
              <p
                style={{
                  fontSize: "0.6875rem",
                  color: "var(--color-ink-dim)",
                  fontFamily: "var(--font-mono)",
                  background: "var(--color-bg-subtle)",
                  border: "1px solid var(--color-border-light)",
                  borderRadius: "2px",
                  padding: "0.5rem 0.75rem",
                  maxWidth: "100%",
                  wordBreak: "break-word",
                  textAlign: "left",
                  margin: 0,
                }}
              >
                {this.state.error.message}
              </p>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
