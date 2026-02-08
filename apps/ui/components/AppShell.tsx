import { MotionConfig, motion } from "framer-motion";
import type { ReactNode } from "react";

interface AppShellProps {
  banner: ReactNode;
  status: ReactNode;
  content: ReactNode;
  overlays: ReactNode;
}

export default function AppShell({ banner, status, content, overlays }: AppShellProps) {
  return (
    <MotionConfig transition={{ type: "tween", ease: "linear", duration: 0.2 }}>
      <motion.div
        layout="position"
        transition={{ layout: { type: "tween", ease: "linear", duration: 0.2 } }}
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #cbd5e1, #e2e8f0)",
          padding: "clamp(0.75rem, 2.5vw, 2rem)",
          fontFamily: "Inter, system-ui, sans-serif",
          color: "#0f172a"
        }}
      >
        <style>{`
          * {
            transition: background-color 0.2s linear, border-color 0.2s linear, color 0.2s linear,
              box-shadow 0.2s linear, opacity 0.2s linear;
          }
          button, input, select, textarea {
            transition: background-color 0.2s linear, border-color 0.2s linear, color 0.2s linear,
              box-shadow 0.2s linear, opacity 0.2s linear;
          }
        `}</style>
        {banner}
        <motion.div
          layout="position"
          transition={{ layout: { type: "tween", ease: "linear", duration: 0.2 } }}
          style={{ marginTop: "1rem", marginBottom: "1.5rem" }}
        >
          {status}
        </motion.div>
        <motion.div
          layout="position"
          transition={{ layout: { type: "tween", ease: "linear", duration: 0.2 } }}
          style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}
        >
          {content}
        </motion.div>
        {overlays}
      </motion.div>
    </MotionConfig>
  );
}
