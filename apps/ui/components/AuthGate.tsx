import type { LoginPayload } from "../data/generated";
import { colors, gradients, shadows } from "../theme";

interface AuthGateProps {
  authStatus: "loading" | "authenticated" | "unauthenticated";
  loginForm: LoginPayload;
  loginError: string | null;
  isAuthenticating: boolean;
  onLogin: () => void;
  onLoginFormChange: (next: LoginPayload) => void;
}

export default function AuthGate({
  authStatus,
  loginForm,
  loginError,
  isAuthenticating,
  onLogin,
  onLoginFormChange
}: AuthGateProps) {
  if (authStatus === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Inter, sans-serif" }}>
        <p style={{ color: "#334155" }}>Checking session...</p>
      </div>
    );
  }

  if (authStatus !== "unauthenticated") {
    return null;
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: gradients.appBackground,
        padding: "1.5rem",
        fontFamily: "Inter, sans-serif"
      }}
    >
      <section
        style={{
          width: "min(420px, 100%)",
          background: colors.surface,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: 14,
          boxShadow: shadows.card,
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem" }}>Sign in</h2>
        <p style={{ margin: "0 0 1rem", color: "#475569", fontSize: "0.9rem" }}>
          Use your scheduler account to access school schedules.
        </p>
        <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.3rem" }}>Email</label>
        <input
          value={loginForm.email}
          onChange={(event) => onLoginFormChange({ ...loginForm, email: event.target.value })}
          placeholder="name@school.org"
          style={{
            width: "100%",
            boxSizing: "border-box",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            padding: "0.5rem 0.65rem",
            marginBottom: "0.65rem"
          }}
        />
        <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.3rem" }}>Password</label>
        <input
          type="password"
          value={loginForm.password}
          onChange={(event) => onLoginFormChange({ ...loginForm, password: event.target.value })}
          placeholder="••••••••"
          style={{
            width: "100%",
            boxSizing: "border-box",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            padding: "0.5rem 0.65rem",
            marginBottom: "0.65rem"
          }}
        />
        <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.3rem" }}>
          School (optional)
        </label>
        <input
          value={loginForm.schoolId ?? ""}
          onChange={(event) =>
            onLoginFormChange({
              ...loginForm,
              schoolId: event.target.value.trim() === "" ? undefined : event.target.value
            })
          }
          placeholder="school-evergreen"
          style={{
            width: "100%",
            boxSizing: "border-box",
            borderRadius: 8,
            border: "1px solid #cbd5e1",
            padding: "0.5rem 0.65rem"
          }}
        />
        {loginError && <p style={{ color: "#b91c1c", fontSize: "0.85rem", margin: "0.65rem 0 0" }}>{loginError}</p>}
        <button
          type="button"
          onClick={onLogin}
          disabled={isAuthenticating || !loginForm.email || !loginForm.password}
          style={{
            marginTop: "0.9rem",
            width: "100%",
            borderRadius: 999,
            border: "none",
            background: isAuthenticating ? "#94a3b8" : "#2563eb",
            color: "#fff",
            padding: "0.55rem 0.9rem",
            cursor: isAuthenticating ? "not-allowed" : "pointer"
          }}
        >
          {isAuthenticating ? "Signing in..." : "Sign in"}
        </button>
      </section>
    </div>
  );
}
