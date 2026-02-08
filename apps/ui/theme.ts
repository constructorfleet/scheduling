export const colors = {
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#64748b",
  textInverse: "#f8fafc",
  surface: "#f1f5f9",
  surfaceAlt: "#e2e8f0",
  surfaceAccent: "#dbeafe",
  borderSubtle: "#e2e8f0",
  borderDefault: "#cbd5e1",
  borderStrong: "#e5e7eb",
  brandBlue: "#2563eb",
  brandBlueLight: "#bfdbfe",
  brandTeal: "#0f766e",
  danger: "#dc2626",
  dangerText: "#b91c1c",
  dangerSurface: "#fecdd3",
  warningSurface: "#fed7aa",
  infoSurface: "#dbeafe",
  successSurface: "#86efac"
} as const;

export const gradients = {
  appBackground: "linear-gradient(135deg, #cbd5e1, #e2e8f0)",
  bannerBackground:
    "radial-gradient(circle at 80% -20%, rgba(56,189,248,0.35), transparent 50%), radial-gradient(circle at 10% 110%, rgba(16,185,129,0.25), transparent 45%), linear-gradient(150deg, #1e293b 0%, #334155 45%, #475569 100%)",
  bannerGrid:
    "linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)"
} as const;

export const shadows = {
  banner: "0 25px 50px rgba(2, 8, 23, 0.25)",
  card: "0 20px 40px rgba(15, 23, 42, 0.15)",
  modal: "0 24px 48px rgba(15, 23, 42, 0.24)"
} as const;
