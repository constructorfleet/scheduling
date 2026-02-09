import { useState } from "react";
import { resetPassword } from "../data/apiClient";
import { colors, gradients, shadows } from "../theme";

interface PasswordResetProps {
  token: string;
  onReturnToLogin: () => void;
}

export default function PasswordReset({ token, onReturnToLogin }: PasswordResetProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitError(null);
    setSubmitSuccess(null);
    if (!password || !confirmPassword) {
      setSubmitError("Enter and confirm a password.");
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match.");
      return;
    }
    if (!token) {
      setSubmitError("Reset token is missing.");
      return;
    }
    setIsSubmitting(true);
    try {
      await resetPassword({ token, password });
      setSubmitSuccess("Password updated. You can sign in now.");
      setPassword("");
      setConfirmPassword("");
    } catch {
      setSubmitError("Could not reset password. Request a new link.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <h2 style={{ margin: "0 0 0.5rem" }}>Reset password</h2>
        <p style={{ margin: "0 0 1rem", color: "#475569", fontSize: "0.9rem" }}>
          Enter a new password to regain access.
        </p>
        <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>New password</label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
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
        <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>Confirm password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
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
        {submitError && <p style={{ color: "#b91c1c", fontSize: "0.85rem" }}>{submitError}</p>}
        {submitSuccess && <p style={{ color: "#166534", fontSize: "0.85rem" }}>{submitSuccess}</p>}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={{
            marginTop: "0.4rem",
            width: "100%",
            borderRadius: 999,
            border: "none",
            background: isSubmitting ? "#94a3b8" : "#2563eb",
            color: "#fff",
            padding: "0.55rem 0.9rem",
            cursor: isSubmitting ? "not-allowed" : "pointer"
          }}
        >
          {isSubmitting ? "Updating..." : "Reset password"}
        </button>
        <button
          type="button"
          onClick={onReturnToLogin}
          style={{
            marginTop: "0.6rem",
            width: "100%",
            borderRadius: 999,
            border: "1px solid #cbd5e1",
            background: colors.surfaceAlt,
            color: "#0f172a",
            padding: "0.5rem 0.9rem",
            cursor: "pointer"
          }}
        >
          Back to sign in
        </button>
      </section>
    </div>
  );
}
