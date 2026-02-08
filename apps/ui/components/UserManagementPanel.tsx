import { motion } from "framer-motion";
import type { Role } from "../data/generated";
import type { AdminInviteRecord, AdminUserRecord, UserManagementScope } from "../data/apiClient";

type InviteDraft = {
  email: string;
  displayName: string;
  role: Role;
};

interface UserManagementPanelProps {
  isOpen: boolean;
  scope: UserManagementScope;
  onScopeChange: (scope: UserManagementScope) => void;
  canUseDistrictScope: boolean;
  canUseSchoolScope: boolean;
  canManageDistricts: boolean;
  districtOptions: { districtId: string; role: Role }[];
  selectedDistrictId: string;
  onSelectDistrict: (districtId: string) => void;
  selectedSchoolName: string;
  isLoading: boolean;
  error: string | null;
  users: AdminUserRecord[];
  invites: AdminInviteRecord[];
  inviteDraft: InviteDraft;
  roleOptions: { value: Role; label: string }[];
  inviteSubmitting: boolean;
  inviteFeedback: string | null;
  onInviteDraftChange: (next: InviteDraft) => void;
  districts: Array<{ id: string; name: string }>;
  districtSchools: Array<{ id: string; districtId: string; name: string }>;
  districtDraft: { id: string; name: string };
  schoolDraft: { id: string; name: string };
  districtSubmitting: boolean;
  schoolSubmitting: boolean;
  onDistrictDraftChange: (next: { id: string; name: string }) => void;
  onSchoolDraftChange: (next: { id: string; name: string }) => void;
  onSaveDistrict: () => void;
  onSaveSchool: () => void;
  onSendInvite: () => void;
  onRefresh: () => void;
  onClose: () => void;
}

const roleLabel = (role: Role) => role.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const formatDateTime = (value: string | null) => {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function UserManagementPanel({
  isOpen,
  scope,
  onScopeChange,
  canUseDistrictScope,
  canUseSchoolScope,
  canManageDistricts,
  districtOptions,
  selectedDistrictId,
  onSelectDistrict,
  selectedSchoolName,
  isLoading,
  error,
  users,
  invites,
  inviteDraft,
  roleOptions,
  inviteSubmitting,
  inviteFeedback,
  onInviteDraftChange,
  districts,
  districtSchools,
  districtDraft,
  schoolDraft,
  districtSubmitting,
  schoolSubmitting,
  onDistrictDraftChange,
  onSchoolDraftChange,
  onSaveDistrict,
  onSaveSchool,
  onSendInvite,
  onRefresh,
  onClose
}: UserManagementPanelProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2, ease: "linear" }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem"
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: "linear" }}
        style={{
          width: "min(980px, 100%)",
          maxHeight: "92vh",
          overflow: "auto",
          background: "#f1f5f9",
          borderRadius: 14,
          border: "1px solid #e2e8f0",
          boxShadow: "0 28px 50px rgba(15, 23, 42, 0.25)",
          padding: "1rem"
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", color: "#0f172a" }}>User management</h2>
            <p style={{ margin: "0.35rem 0 0", fontSize: "0.9rem", color: "#475569" }}>
              Invite users and copy invite links if email delivery fails.
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={onRefresh}
              style={{
                borderRadius: 999,
                border: "1px solid #cbd5e1",
                background: "#f1f5f9",
                color: "#0f172a",
                padding: "0.35rem 0.85rem"
              }}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{
                borderRadius: 999,
                border: "1px solid #cbd5e1",
                background: "#e2e8f0",
                color: "#0f172a",
                padding: "0.35rem 0.85rem"
              }}
            >
              Close
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.85rem" }}>
          <button
            type="button"
            onClick={() => onScopeChange("school")}
            disabled={!canUseSchoolScope}
            style={{
              borderRadius: 999,
              border: "1px solid #cbd5e1",
              background: scope === "school" ? "#0f172a" : "#f1f5f9",
              color: scope === "school" ? "#fff" : "#0f172a",
              padding: "0.32rem 0.8rem",
              cursor: canUseSchoolScope ? "pointer" : "not-allowed",
              opacity: canUseSchoolScope ? 1 : 0.5
            }}
          >
            School scope
          </button>
          <button
            type="button"
            onClick={() => onScopeChange("district")}
            disabled={!canUseDistrictScope}
            style={{
              borderRadius: 999,
              border: "1px solid #cbd5e1",
              background: scope === "district" ? "#0f172a" : "#f1f5f9",
              color: scope === "district" ? "#fff" : "#0f172a",
              padding: "0.32rem 0.8rem",
              cursor: canUseDistrictScope ? "pointer" : "not-allowed",
              opacity: canUseDistrictScope ? 1 : 0.5
            }}
          >
            District scope
          </button>
        </div>

        <div style={{ marginTop: "0.75rem", color: "#475569", fontSize: "0.86rem" }}>
          {scope === "school" ? (
            <span>
              Active school: <strong>{selectedSchoolName}</strong>
            </span>
          ) : (
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.45rem" }}>
              District:
              <select
                value={selectedDistrictId}
                onChange={(event) => onSelectDistrict(event.target.value)}
                style={{
                  border: "1px solid #cbd5e1",
                  borderRadius: 8,
                  padding: "0.25rem 0.45rem"
                }}
              >
                {districtOptions.map((district) => (
                  <option key={district.districtId} value={district.districtId}>
                    {district.districtId} ({roleLabel(district.role)})
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {scope === "district" && (
          <section
            style={{
              marginTop: "0.9rem",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "0.8rem",
              background: "#e2e8f0"
            }}
          >
            <h3 style={{ margin: "0 0 0.65rem", fontSize: "0.98rem", color: "#0f172a" }}>District management</h3>
            <div style={{ display: "grid", gap: "0.55rem", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
              <input
                value={districtDraft.id}
                onChange={(event) => onDistrictDraftChange({ ...districtDraft, id: event.target.value })}
                placeholder="District ID (required to edit)"
                disabled={!canManageDistricts}
                style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "0.5rem 0.65rem" }}
              />
              <input
                value={districtDraft.name}
                onChange={(event) => onDistrictDraftChange({ ...districtDraft, name: event.target.value })}
                placeholder="District name"
                disabled={!canManageDistricts}
                style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "0.5rem 0.65rem" }}
              />
              <button
                type="button"
                onClick={onSaveDistrict}
                disabled={!canManageDistricts || districtSubmitting || !districtDraft.name.trim()}
                style={{
                  borderRadius: 8,
                  border: "none",
                  background: !canManageDistricts || districtSubmitting ? "#94a3b8" : "#0f766e",
                  color: "#fff",
                  fontWeight: 600,
                  padding: "0.5rem 0.75rem",
                  cursor: !canManageDistricts || districtSubmitting ? "not-allowed" : "pointer"
                }}
              >
                {districtSubmitting ? "Saving..." : districtDraft.id.trim() ? "Update district" : "Create district"}
              </button>
            </div>
            <div style={{ marginTop: "0.6rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {districts.map((district) => (
                <button
                  key={district.id}
                  type="button"
                  onClick={() => onDistrictDraftChange({ id: district.id, name: district.name })}
                  style={{
                    borderRadius: 999,
                    border: "1px solid #cbd5e1",
                    background: "#f1f5f9",
                    color: "#334155",
                    padding: "0.22rem 0.62rem",
                    fontSize: "0.78rem"
                  }}
                >
                  {district.name} ({district.id})
                </button>
              ))}
            </div>
          </section>
        )}

        {scope === "district" && (
          <section
            style={{
              marginTop: "0.9rem",
              border: "1px solid #e2e8f0",
              borderRadius: 12,
              padding: "0.8rem",
              background: "#e2e8f0"
            }}
          >
            <h3 style={{ margin: "0 0 0.65rem", fontSize: "0.98rem", color: "#0f172a" }}>School management</h3>
            <div style={{ display: "grid", gap: "0.55rem", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
              <input
                value={schoolDraft.id}
                onChange={(event) => onSchoolDraftChange({ ...schoolDraft, id: event.target.value })}
                placeholder="School ID"
                style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "0.5rem 0.65rem" }}
              />
              <input
                value={schoolDraft.name}
                onChange={(event) => onSchoolDraftChange({ ...schoolDraft, name: event.target.value })}
                placeholder="School name"
                style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "0.5rem 0.65rem" }}
              />
              <button
                type="button"
                onClick={onSaveSchool}
                disabled={schoolSubmitting || !schoolDraft.id.trim() || !schoolDraft.name.trim()}
                style={{
                  borderRadius: 8,
                  border: "none",
                  background: schoolSubmitting ? "#94a3b8" : "#0f766e",
                  color: "#fff",
                  fontWeight: 600,
                  padding: "0.5rem 0.75rem",
                  cursor: schoolSubmitting ? "not-allowed" : "pointer"
                }}
              >
                {schoolSubmitting ? "Saving..." : "Save school"}
              </button>
            </div>
            <div style={{ marginTop: "0.6rem", display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {districtSchools.map((school) => (
                <button
                  key={school.id}
                  type="button"
                  onClick={() => onSchoolDraftChange({ id: school.id, name: school.name })}
                  style={{
                    borderRadius: 999,
                    border: "1px solid #cbd5e1",
                    background: "#f1f5f9",
                    color: "#334155",
                    padding: "0.22rem 0.62rem",
                    fontSize: "0.78rem"
                  }}
                >
                  {school.name} ({school.id})
                </button>
              ))}
            </div>
          </section>
        )}

        <section
          style={{
            marginTop: "0.9rem",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: "0.8rem",
            background: "#e2e8f0"
          }}
        >
          <h3 style={{ margin: "0 0 0.65rem", fontSize: "0.98rem", color: "#0f172a" }}>Send invite</h3>
          <div style={{ display: "grid", gap: "0.55rem", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))" }}>
            <input
              value={inviteDraft.email}
              onChange={(event) => onInviteDraftChange({ ...inviteDraft, email: event.target.value })}
              placeholder="name@school.org"
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "0.5rem 0.65rem" }}
            />
            <input
              value={inviteDraft.displayName}
              onChange={(event) => onInviteDraftChange({ ...inviteDraft, displayName: event.target.value })}
              placeholder="Display name (optional)"
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "0.5rem 0.65rem" }}
            />
            <select
              value={inviteDraft.role}
              onChange={(event) => onInviteDraftChange({ ...inviteDraft, role: event.target.value as Role })}
              style={{ border: "1px solid #cbd5e1", borderRadius: 8, padding: "0.5rem 0.65rem" }}
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onSendInvite}
              disabled={inviteSubmitting || !inviteDraft.email.trim()}
              style={{
                borderRadius: 8,
                border: "none",
                background: inviteSubmitting ? "#94a3b8" : "#2563eb",
                color: "#fff",
                fontWeight: 600,
                padding: "0.5rem 0.75rem",
                cursor: inviteSubmitting ? "not-allowed" : "pointer"
              }}
            >
              {inviteSubmitting ? "Sending..." : "Send invite"}
            </button>
          </div>
          {inviteFeedback && (
            <p style={{ margin: "0.6rem 0 0", color: "#0369a1", fontSize: "0.85rem" }}>{inviteFeedback}</p>
          )}
          {error && <p style={{ margin: "0.6rem 0 0", color: "#b91c1c", fontSize: "0.85rem" }}>{error}</p>}
        </section>

        <section style={{ marginTop: "1rem" }}>
          <h3 style={{ margin: "0 0 0.45rem", fontSize: "0.98rem", color: "#0f172a" }}>
            Users ({users.length})
          </h3>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            {isLoading ? (
              <p style={{ margin: 0, padding: "0.8rem", color: "#475569" }}>Loading users...</p>
            ) : users.length === 0 ? (
              <p style={{ margin: 0, padding: "0.8rem", color: "#475569" }}>No users found for this scope.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {users.map((user) => (
                  <article key={user.id} style={{ padding: "0.7rem 0.8rem", borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
                      <div>
                        <strong style={{ color: "#0f172a" }}>{user.displayName || user.email}</strong>
                        <p style={{ margin: "0.2rem 0 0", color: "#475569", fontSize: "0.85rem" }}>{user.email}</p>
                      </div>
                      <span
                        style={{
                          borderRadius: 999,
                          background: "#e2e8f0",
                          color: "#334155",
                          padding: "0.2rem 0.6rem",
                          fontSize: "0.78rem",
                          height: "fit-content"
                        }}
                      >
                        {user.status}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>

        <section style={{ marginTop: "1rem" }}>
          <h3 style={{ margin: "0 0 0.45rem", fontSize: "0.98rem", color: "#0f172a" }}>
            Invites ({invites.length})
          </h3>
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            {isLoading ? (
              <p style={{ margin: 0, padding: "0.8rem", color: "#475569" }}>Loading invites...</p>
            ) : invites.length === 0 ? (
              <p style={{ margin: 0, padding: "0.8rem", color: "#475569" }}>No invites yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {invites.map((invite) => (
                  <article key={invite.id} style={{ padding: "0.7rem 0.8rem", borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap" }}>
                      <div>
                        <strong style={{ color: "#0f172a" }}>{invite.displayName || invite.email}</strong>
                        <p style={{ margin: "0.2rem 0 0", color: "#475569", fontSize: "0.85rem" }}>{invite.email}</p>
                        <p style={{ margin: "0.2rem 0 0", color: "#475569", fontSize: "0.8rem" }}>
                          Role: {roleLabel(invite.role)}
                        </p>
                        <p style={{ margin: "0.2rem 0 0", color: "#475569", fontSize: "0.8rem" }}>
                          Expires: {formatDateTime(invite.expiresAt)}
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.4rem" }}>
                        <span
                          style={{
                            borderRadius: 999,
                            padding: "0.2rem 0.6rem",
                            fontSize: "0.78rem",
                            background: invite.acceptedAt ? "#dcfce7" : invite.revokedAt ? "#fee2e2" : "#fef3c7",
                            color: invite.acceptedAt ? "#166534" : invite.revokedAt ? "#991b1b" : "#92400e"
                          }}
                        >
                          {invite.acceptedAt ? "Accepted" : invite.revokedAt ? "Revoked" : "Pending"}
                        </span>
                        {invite.inviteUrl && (
                          <button
                            type="button"
                            onClick={() => {
                              const inviteUrl = invite.inviteUrl;
                              if (inviteUrl && navigator?.clipboard?.writeText) {
                                void navigator.clipboard.writeText(inviteUrl);
                              }
                            }}
                            style={{
                              borderRadius: 8,
                              border: "1px solid #cbd5e1",
                              background: "#f1f5f9",
                              color: "#0f172a",
                              padding: "0.25rem 0.55rem",
                              fontSize: "0.78rem"
                            }}
                          >
                            Copy link
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </motion.div>
    </motion.section>
  );
}
