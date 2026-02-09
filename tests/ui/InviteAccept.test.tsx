import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import InviteAccept from "../../apps/ui/components/InviteAccept";
import * as apiClient from "../../apps/ui/data/apiClient";

jest.mock("../../apps/ui/data/apiClient");

describe("InviteAccept", () => {
  const fetchInviteByTokenMock = apiClient.fetchInviteByToken as jest.MockedFunction<
    typeof apiClient.fetchInviteByToken
  >;
  const acceptInviteMock = apiClient.acceptInvite as jest.MockedFunction<typeof apiClient.acceptInvite>;

  beforeEach(() => {
    jest.clearAllMocks();
    fetchInviteByTokenMock.mockResolvedValue({
      email: "teacher@example.com",
      displayName: "Teacher",
      role: "school_user",
      districtId: "district-1",
      districtName: "District",
      schoolId: "school-1",
      schoolName: "Evergreen",
      expiresAt: new Date().toISOString()
    });
    acceptInviteMock.mockResolvedValue({ ok: true });
  });

  it("calls onReturnToLogin after accepting invite", async () => {
    const user = userEvent.setup();
    const onReturnToLogin = jest.fn();

    render(<InviteAccept token="invite-token" onReturnToLogin={onReturnToLogin} />);

    await screen.findByRole("button", { name: /Accept invite/i });

    const passwordFields = screen.getAllByPlaceholderText("••••••••");

    await act(async () => {
      await user.type(passwordFields[0], "Secret123!");
      await user.type(passwordFields[1], "Secret123!");
    });

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /Accept invite/i }));
    });

    expect(await screen.findByText(/Invite accepted/i)).toBeInTheDocument();

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /Go to sign in/i }));
    });

    expect(onReturnToLogin).toHaveBeenCalled();
  });
});
