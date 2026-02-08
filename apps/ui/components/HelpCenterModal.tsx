import { useEffect } from "react";
import { motion } from "framer-motion";
import { HELP_TOPICS, HELP_TOPICS_BY_ID, HelpTopicId } from "./helpContent";

interface HelpCenterModalProps {
  isOpen: boolean;
  topicId: HelpTopicId;
  onClose: () => void;
  onSelectTopic: (topicId: HelpTopicId) => void;
}

export default function HelpCenterModal({
  isOpen,
  topicId,
  onClose,
  onSelectTopic
}: HelpCenterModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const topic = HELP_TOPICS_BY_ID.get(topicId) ?? HELP_TOPICS[0];

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "linear" }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "1rem",
        zIndex: 60
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ duration: 0.2, ease: "linear" }}
        style={{
          width: "min(980px, 100%)",
          maxHeight: "min(90vh, 880px)",
          background: "#ffffff",
          borderRadius: 18,
          border: "1px solid #e2e8f0",
          boxShadow: "0 30px 60px rgba(15, 23, 42, 0.35)",
          display: "grid",
          gridTemplateColumns: "minmax(230px, 280px) minmax(0, 1fr)",
          overflow: "hidden"
        }}
      >
        <aside
          style={{
            borderRight: "1px solid #e5e7eb",
            background: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            overflow: "auto"
          }}
        >
          <div style={{ padding: "1rem", borderBottom: "1px solid #e5e7eb" }}>
            <h3 style={{ margin: "0 0 0.35rem" }}>Help center</h3>
            <p style={{ margin: 0, color: "#64748b", fontSize: "0.8rem" }}>
              How-tos and examples for scheduling workflows.
            </p>
          </div>
          <div style={{ padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {HELP_TOPICS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => onSelectTopic(entry.id)}
                style={{
                  textAlign: "left",
                  borderRadius: 10,
                  border: "1px solid transparent",
                  background: entry.id === topic.id ? "#e0e7ff" : "transparent",
                  color: entry.id === topic.id ? "#1d4ed8" : "#334155",
                  padding: "0.45rem 0.6rem",
                  fontSize: "0.84rem",
                  fontWeight: entry.id === topic.id ? 700 : 500,
                  cursor: "pointer"
                }}
              >
                {entry.title}
              </button>
            ))}
          </div>
        </aside>

        <article style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
          <header
            style={{
              borderBottom: "1px solid #e5e7eb",
              padding: "0.9rem 1rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.75rem"
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 0.2rem" }}>{topic.title}</h2>
              <p style={{ margin: 0, color: "#475569", fontSize: "0.9rem" }}>{topic.summary}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                borderRadius: 999,
                border: "1px solid #cbd5e1",
                background: "#ffffff",
                color: "#0f172a",
                padding: "0.35rem 0.8rem",
                whiteSpace: "nowrap"
              }}
            >
              Close
            </button>
          </header>
          <div style={{ padding: "1rem", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem" }}>
            <section>
              <h4 style={{ margin: "0 0 0.5rem" }}>How to</h4>
              <ol style={{ margin: 0, paddingLeft: "1.2rem", color: "#334155", display: "grid", gap: "0.35rem" }}>
                {topic.howTo.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
            <section>
              <h4 style={{ margin: "0 0 0.5rem" }}>Examples</h4>
              <ul style={{ margin: 0, paddingLeft: "1.2rem", color: "#334155", display: "grid", gap: "0.35rem" }}>
                {topic.examples.map((example) => (
                  <li key={example}>{example}</li>
                ))}
              </ul>
            </section>
            {topic.related && topic.related.length > 0 && (
              <section>
                <h4 style={{ margin: "0 0 0.5rem" }}>Related topics</h4>
                <div style={{ display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                  {topic.related.map((relatedId) => {
                    const related = HELP_TOPICS_BY_ID.get(relatedId);
                    if (!related) return null;
                    return (
                      <button
                        key={related.id}
                        type="button"
                        onClick={() => onSelectTopic(related.id)}
                        style={{
                          borderRadius: 999,
                          border: "1px solid #cbd5e1",
                          background: "#f8fafc",
                          color: "#1e293b",
                          padding: "0.28rem 0.7rem",
                          fontSize: "0.8rem"
                        }}
                      >
                        {related.title}
                      </button>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        </article>
      </motion.div>
    </motion.section>
  );
}
