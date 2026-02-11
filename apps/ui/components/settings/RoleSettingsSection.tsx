import type { RoleSetting } from "../SettingsPanel";

interface RoleSettingsSectionProps {
  draftRoleSettings: RoleSetting[];
  onChange: (next: RoleSetting[]) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onSave: () => void;
  canSave: boolean;
}

export default function RoleSettingsSection({
  draftRoleSettings,
  onChange,
  onAdd,
  onRemove,
  onSave,
  canSave
}: RoleSettingsSectionProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 88px",
          gap: "0.75rem",
          fontSize: "0.75rem",
          color: "#6b7280",
          paddingLeft: "0.75rem",
          paddingRight: "0.75rem",
          alignItems: "center"
        }}
      >
        <span style={{ textAlign: "center", justifySelf: "center" }}>Role name</span>
        <span />
      </div>
      {draftRoleSettings.map((roleSetting, index) => (
        <div
          key={roleSetting.id}
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 14,
            padding: "0.75rem",
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "1fr 88px"
          }}
        >
          <input
            value={roleSetting.name}
            onChange={(event) => {
              const next = [...draftRoleSettings];
              next[index] = { ...roleSetting, name: event.target.value };
              onChange(next);
            }}
            style={{
              borderRadius: 10,
              border: "1px solid #d1d5db",
              padding: "0.45rem 0.6rem"
            }}
            placeholder="Role name"
          />
          <button
            type="button"
            onClick={() => onRemove(index)}
            style={{
              borderRadius: 999,
              border: "1px solid #fecaca",
              background: "#fee2e2",
              color: "#b91c1c",
              padding: "0.3rem 0.75rem"
            }}
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={onAdd}
        style={{
          alignSelf: "flex-start",
          borderRadius: 999,
          border: "1px solid #cbd5f5",
          background: "#eff6ff",
          color: "#1d4ed8",
          padding: "0.4rem 0.9rem"
        }}
      >
        Add role
      </button>
      <button
        type="button"
        disabled={!canSave}
        onClick={onSave}
        style={{
          alignSelf: "flex-start",
          borderRadius: 999,
          border: "none",
          background: canSave ? "#2563eb" : "#cbd5f5",
          color: "#fff",
          padding: "0.45rem 0.9rem",
          cursor: canSave ? "pointer" : "not-allowed"
        }}
      >
        Save roles
      </button>
    </div>
  );
}
