import { useEffect, useState } from "react";
import { colors, gradients, shadows } from "../theme";
import { acceptInvite, fetchInviteByToken, type InviteDetails } from "../data/apiClient";

interface InviteAcceptProps {
  token: string;
  onReturnToLogin: () => void;
}

type InviteState =
  | { status: "loading" }
  | { status: "ready"; invite: InviteDetails }
  | { status: "error"; message: string };

export default function InviteAccept({ token, onReturnToLogin }: InviteAcceptProps) {
  const [inviteState, setInviteState] = useState<InviteState>({ status: "loading" });
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setInviteState({ status: "error", message: "Invite token is missing." });
      return;
    }
    let isActive = true;
    const hydrate = async () => {
      try {
        const invite = await fetchInviteByToken(token);
        if (!isActive) return;
        setInviteState({ status: "ready", invite });
        setDisplayName(invite.displayName ?? "");
      } catch (error) {
        if (!isActive) return;
        setInviteState({ status: "error", message: "Invite not found or expired." });
      }
    };
    void hydrate();
    return () => {
      isActive = false;
    };
  }, [token]);

  const handleAcceptInvite = async () => {
    setSubmitError(null);
    if (!password || !confirmPassword) {
      setSubmitError("Enter and confirm a password.");
      return;
    }
    if (password !== confirmPassword) {
      setSubmitError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await acceptInvite({
        token,
        displayName: displayName.trim() || undefined,
        password
      });
      setAccepted(true);
    } catch (error) {
      setSubmitError("Could not accept invite. Please check the link and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (inviteState.status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Inter, sans-serif" }}>
        <p style={{ color: "#334155" }}>Loading invite...</p>
      </div>
    );
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
          width: "min(520px, 100%)",
          background: colors.surface,
          border: `1px solid ${colors.borderSubtle}`,
          borderRadius: 14,
          boxShadow: shadows.card,
          padding: "1.25rem"
        }}
      >
        <h2 style={{ margin: "0 0 0.35rem" }}>Accept invite</h2>
        {inviteState.status === "error" ? (
          <p style={{ margin: 0, color: "#b91c1c", fontSize: "0.95rem" }}>{inviteState.message}</p>
        ) : (
          <>
            <p style={{ margin: "0 0 1rem", color: "#475569", fontSize: "0.9rem" }}>
              You have been invited to join the scheduler. Set your display name and password to activate the account.
            </p>
            <div style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
              <div>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Email</span>
                <div style={{ fontWeight: 600 }}>{inviteState.invite.email}</div>
              </div>
              <div style={{ display: "grid", gap: "0.2rem" }}>
                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Role</span>
                <span>{inviteState.invite.role.replace("_", " ")}</span>
              </div>
              {(inviteState.invite.schoolName || inviteState.invite.districtName) && (
                <div style={{ display: "grid", gap: "0.2rem" }}>
                  <span style={{ fontSize: "0.8rem", color: "#64748b" }}>Scope</span>
                  <span>
                    {inviteState.invite.schoolName
                      ? `School: ${inviteState.invite.schoolName}`
                      : `District: ${inviteState.invite.districtName}`}
                  </span>
                </div>
              )}
            </div>
            {accepted ? (
              <div style={{ display: "grid", gap: "0.6rem" }}>
                <p style={{ margin: 0, color: "#166534", fontSize: "0.95rem" }}>
                  Invite accepted. You can sign in with your new password.
                </p>
                <button
                  type="button"
                  onClick={onReturnToLogin}
                  style={{
                    borderRadius: 999,
                    border: "none",
                    background: "#2563eb",
                    color: "#fff",
                    padding: "0.55rem 1rem",
                    width: "fit-content"
                  }}
                >
                  Go to sign in
                </button>
              </div>
            ) : (
              <>
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>Display name</label>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Jane Doe"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    padding: "0.5rem 0.65rem",
                    marginBottom: "0.65rem"
                  }}
                />
                <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.25rem" }}>Password</label>
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
                {submitError && (
                  <p style={{ color: "#b91c1c", fontSize: "0.85rem", margin: "0.3rem 0 0" }}>{submitError}</p>
                )}
                <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.85rem" }}>
                  <button
                    type="button"
                    onClick={handleAcceptInvite}
                    disabled={submitting}
                    style={{
                      borderRadius: 999,
                      border: "none",
                      background: submitting ? "#94a3b8" : "#2563eb",
                      color: "#fff",
                      padding: "0.55rem 1rem",
                      cursor: submitting ? "not-allowed" : "pointer"
                    }}
                  >
                    {submitting ? "Accepting..." : "Accept invite"}
                  </button>
                  <button
                    type="button"
                    onClick={onReturnToLogin}
                    style={{
                      borderRadius: 999,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      color: "#0f172a",
                      padding: "0.55rem 1rem"
                    }}
                  >
                    Back to sign in
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}
