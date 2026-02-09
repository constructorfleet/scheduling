import { useEffect, useMemo, useState } from "react";
import type { LoginPayload } from "../data/generated";
import { fetchPublicDistricts, requestPasswordReset, type PublicDistrictRecord } from "../data/apiClient";
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
  const [showSchoolInput, setShowSchoolInput] = useState(false);
  const [districtOptions, setDistrictOptions] = useState<PublicDistrictRecord[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState(false);
  const [districtsError, setDistrictsError] = useState<string | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [showResetForm, setShowResetForm] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetFeedback, setResetFeedback] = useState<string | null>(null);
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);

  useEffect(() => {
    let isActive = true;
    setDistrictsLoading(true);
    fetchPublicDistricts()
      .then((response) => {
        if (!isActive) return;
        setDistrictOptions(response.districts ?? []);
        setDistrictsError(null);
      })
      .catch(() => {
        if (!isActive) return;
        setDistrictOptions([]);
        setDistrictsError("Could not load districts.");
      })
      .finally(() => {
        if (!isActive) return;
        setDistrictsLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (districtOptions.length === 0) {
      setSelectedDistrictId("");
      return;
    }
    const match = districtOptions.find((district) =>
      district.schools.some((school) => school.id === loginForm.schoolId)
    );
    const nextDistrictId = match?.id ?? districtOptions[0].id;
    setSelectedDistrictId(nextDistrictId);
    const nextDistrict = districtOptions.find((district) => district.id === nextDistrictId);
    const nextSchoolId = nextDistrict?.schools[0]?.id;
    if (!loginForm.schoolId && nextSchoolId) {
      onLoginFormChange({ ...loginForm, schoolId: nextSchoolId });
    }
  }, [districtOptions, loginForm, onLoginFormChange]);

  const handleResetRequest = async () => {
    const email = resetEmail.trim();
    if (!email) {
      setResetError("Enter your email address.");
      setResetFeedback(null);
      return;
    }
    setResetSubmitting(true);
    setResetError(null);
    setResetFeedback(null);
    try {
      await requestPasswordReset(email);
      setResetFeedback("Check your email for a reset link.");
    } catch {
      setResetError("Could not send reset email.");
    } finally {
      setResetSubmitting(false);
    }
  };

  const selectedDistrict = useMemo(
    () => districtOptions.find((district) => district.id === selectedDistrictId),
    [districtOptions, selectedDistrictId]
  );
  const schoolOptions = selectedDistrict?.schools ?? [];
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
        <button
          type="button"
          onClick={() => {
            setShowResetForm((prev) => !prev);
            setResetFeedback(null);
            setResetError(null);
          }}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            border: "none",
            background: "transparent",
            color: "#1d4ed8",
            fontSize: "0.85rem",
            padding: 0,
            marginBottom: "0.5rem",
            cursor: "pointer"
          }}
        >
          {showResetForm ? "Hide password reset" : "Forgot password?"}
        </button>
        {showResetForm && (
          <div style={{ display: "grid", gap: "0.45rem", marginBottom: "0.35rem" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "#475569" }}>Reset email</label>
            <input
              value={resetEmail}
              onChange={(event) => setResetEmail(event.target.value)}
              placeholder="name@school.org"
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                padding: "0.5rem 0.65rem"
              }}
            />
            <button
              type="button"
              onClick={handleResetRequest}
              disabled={resetSubmitting}
              style={{
                borderRadius: 999,
                border: "none",
                background: resetSubmitting ? "#94a3b8" : "#0f766e",
                color: "#fff",
                padding: "0.45rem 0.8rem",
                cursor: resetSubmitting ? "not-allowed" : "pointer",
                width: "100%"
              }}
            >
              {resetSubmitting ? "Sending..." : "Send reset link"}
            </button>
            {resetFeedback && (
              <span style={{ fontSize: "0.75rem", color: "#166534" }}>{resetFeedback}</span>
            )}
            {resetError && <span style={{ fontSize: "0.75rem", color: "#b91c1c" }}>{resetError}</span>}
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowSchoolInput((prev) => !prev)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            border: "none",
            background: "transparent",
            color: "#1d4ed8",
            fontSize: "0.85rem",
            padding: 0,
            marginBottom: "0.35rem",
            cursor: "pointer"
          }}
        >
          <span style={{
            display: "inline-flex",
            transform: showSchoolInput ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 120ms ease"
          }}>
            ▶
          </span>
          Add school (optional)
        </button>
        {showSchoolInput && (
          <div style={{ display: "grid", gap: "0.45rem", marginBottom: "0.35rem" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "#475569" }}>District</label>
            <select
              value={selectedDistrictId}
              onChange={(event) => {
                const nextDistrictId = event.target.value;
                const nextDistrict = districtOptions.find((district) => district.id === nextDistrictId);
                const nextSchoolId = nextDistrict?.schools[0]?.id;
                setSelectedDistrictId(nextDistrictId);
                onLoginFormChange({
                  ...loginForm,
                  schoolId: nextSchoolId
                });
              }}
              disabled={districtsLoading || districtOptions.length === 0}
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                padding: "0.5rem 0.65rem"
              }}
            >
              {districtsLoading && <option value="">Loading districts...</option>}
              {!districtsLoading && districtOptions.length === 0 && (
                <option value="">No districts available</option>
              )}
              {!districtsLoading &&
                districtOptions.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
            </select>
            <label style={{ display: "block", fontSize: "0.8rem", color: "#475569" }}>School</label>
            <select
              value={loginForm.schoolId ?? ""}
              onChange={(event) =>
                onLoginFormChange({
                  ...loginForm,
                  schoolId: event.target.value || undefined
                })
              }
              disabled={districtsLoading || schoolOptions.length === 0}
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: 8,
                border: "1px solid #cbd5e1",
                padding: "0.5rem 0.65rem",
                background: schoolOptions.length === 0 || districtsLoading ? "#f8fafc" : "#fff"
              }}
            >
              {districtsLoading && <option value="">Loading schools...</option>}
              {!districtsLoading && schoolOptions.length === 0 && (
                <option value="">No schools available</option>
              )}
              {!districtsLoading &&
                schoolOptions.map((school) => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
            </select>
            {districtsError && (
              <span style={{ fontSize: "0.75rem", color: "#b91c1c" }}>{districtsError}</span>
            )}
          </div>
        )}
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
