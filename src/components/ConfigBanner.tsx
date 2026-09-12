import { walletConnectMisconfigured } from "../lib/chains";

/**
 * Renders a prominent banner when VITE_WALLETCONNECT_PROJECT_ID is missing or
 * a placeholder value. Capital is read-only so wallet connectivity is optional,
 * but the misconfig is still surfaced for the operator's awareness.
 */
export function ConfigBanner() {
  if (!walletConnectMisconfigured) return null;

  return (
    <div
      role="alert"
      style={{
        background: "#FFFBEB",
        borderBottom: "2px solid var(--color-primary)",
        fontFamily: "var(--font-sans)",
        fontSize: "0.8125rem",
        color: "var(--color-ink)",
        padding: "0.5rem 1.5rem",
        display: "flex",
        alignItems: "center",
        gap: "0.625rem",
        lineHeight: 1.5,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          fontSize: "1rem",
          lineHeight: 1,
        }}
      >
        ⚠
      </span>
      <span>
        <strong style={{ fontWeight: 600 }}>Configuration notice:</strong>{" "}
        <code
          style={{
            fontFamily: "var(--font-mono)",
            background: "rgba(0,0,0,0.06)",
            padding: "0.1em 0.35em",
            borderRadius: "2px",
            fontSize: "0.75rem",
          }}
        >
          VITE_WALLETCONNECT_PROJECT_ID
        </code>{" "}
        is not set. Wallet connect is disabled. Set a real project ID from{" "}
        <a data-insights="navigate-cloudwalletconnectcom/"
          href="https://cloud.walletconnect.com"
          target="_blank"
          rel="noreferrer"
          style={{
            color: "var(--color-primary-hover)",
            textDecoration: "underline",
            textUnderlineOffset: "2px",
          }}
        >
          cloud.walletconnect.com
        </a>{" "}
        to enable it.
      </span>
    </div>
  );
}
