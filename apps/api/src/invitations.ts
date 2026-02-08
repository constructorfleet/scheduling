const getInviteBaseUrl = () => {
  const configured = process.env.INVITE_BASE_URL?.trim();
  if (configured) {
    return configured;
  }
  const uiBase = process.env.UI_BASE_URL?.trim();
  if (uiBase) {
    return `${uiBase.replace(/\/$/, "")}/invite`;
  }
  return "http://localhost:5173/invite";
};

export const buildInviteUrl = (token: string) => {
  const base = getInviteBaseUrl();
  const separator = base.includes("?") ? "&" : "?";
  return `${base}${separator}token=${encodeURIComponent(token)}`;
};

type SendInviteEmailPayload = {
  to: string;
  invitedByName: string;
  inviteUrl: string;
  roleLabel: string;
  scopeLabel: string;
};

type InviteDelivery = {
  method: "webhook" | "log";
};

export const sendInviteEmail = async ({
  to,
  invitedByName,
  inviteUrl,
  roleLabel,
  scopeLabel
}: SendInviteEmailPayload): Promise<InviteDelivery> => {
  const subject = "You were invited to Daycare Scheduler";
  const text = [
    `You have been invited by ${invitedByName}.`,
    `Role: ${roleLabel}`,
    `Scope: ${scopeLabel}`,
    "",
    `Set up your account: ${inviteUrl}`
  ].join("\n");
  const webhookUrl = process.env.INVITE_EMAIL_WEBHOOK_URL?.trim();

  if (webhookUrl) {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        to,
        subject,
        text
      })
    });
    return { method: "webhook" };
  }

  // eslint-disable-next-line no-console
  console.log(`[invite-email] to=${to} subject="${subject}" body="${text}"`);
  return { method: "log" };
};
