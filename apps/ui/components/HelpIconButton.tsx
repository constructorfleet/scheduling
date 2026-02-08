import type { CSSProperties } from "react";

interface HelpIconButtonProps {
  label: string;
  onClick: () => void;
  tone?: "light" | "dark";
  style?: CSSProperties;
}

export default function HelpIconButton({
  label,
  onClick,
  tone = "light",
  style
}: HelpIconButtonProps) {
  const isDark = tone === "dark";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Open help: ${label}`}
      title={`Help: ${label}`}
      style={{
        width: 22,
        height: 22,
        borderRadius: "50%",
        border: isDark ? "1px solid rgba(255,255,255,0.45)" : "1px solid #cbd5e1",
        background: isDark ? "rgba(255,255,255,0.15)" : "#f8fafc",
        color: isDark ? "#f8fafc" : "#1e293b",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "0.8rem",
        fontWeight: 700,
        cursor: "pointer",
        padding: 0,
        lineHeight: 1,
        ...style
      }}
    >
      ?
    </button>
  );
}
