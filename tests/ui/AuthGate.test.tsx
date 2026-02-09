import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AuthGate from "../../apps/ui/components/AuthGate";
import type { LoginPayload } from "../../apps/ui/data/generated";
import { fetchPublicDistricts } from "../../apps/ui/data/apiClient";

jest.mock("../../apps/ui/data/apiClient", () => ({
  fetchPublicDistricts: jest.fn()
}));

describe("AuthGate", () => {
  const fetchPublicDistrictsMock = fetchPublicDistricts as jest.MockedFunction<typeof fetchPublicDistricts>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("loads districts and updates school when expanded", async () => {
    fetchPublicDistrictsMock.mockResolvedValue({
      districts: [
        {
          id: "district-1",
          name: "District One",
          schools: [
            { id: "school-1", districtId: "district-1", name: "Evergreen" },
            { id: "school-2", districtId: "district-1", name: "Maple" }
          ]
        },
        {
          id: "district-2",
          name: "District Two",
          schools: [
            { id: "school-3", districtId: "district-2", name: "Cedar" }
          ]
        }
      ]
    });

    const onLoginFormChange = jest.fn();
    const loginForm: LoginPayload = { email: "", password: "", schoolId: undefined };

    const user = userEvent.setup();

    render(
      <AuthGate
        authStatus="unauthenticated"
        loginForm={loginForm}
        loginError={null}
        isAuthenticating={false}
        onLogin={jest.fn()}
        onLoginFormChange={onLoginFormChange}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(fetchPublicDistrictsMock).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(onLoginFormChange).toHaveBeenCalledWith({
        email: "",
        password: "",
        schoolId: "school-1"
      });
    });

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /add school \(optional\)/i }));
    });

    const [districtSelect] = screen.getAllByRole("combobox") as HTMLSelectElement[];
    await act(async () => {
      await user.selectOptions(districtSelect, "district-2");
    });

    await waitFor(() => {
      const lastCall = onLoginFormChange.mock.calls[onLoginFormChange.mock.calls.length - 1][0];
      expect(lastCall).toEqual({
        email: "",
        password: "",
        schoolId: "school-3"
      });
    });
  });

  it("shows an error when districts fail to load", async () => {
    fetchPublicDistrictsMock.mockRejectedValue(new Error("Network error"));

    const user = userEvent.setup();

    render(
      <AuthGate
        authStatus="unauthenticated"
        loginForm={{ email: "", password: "", schoolId: undefined }}
        loginError={null}
        isAuthenticating={false}
        onLogin={jest.fn()}
        onLoginFormChange={jest.fn()}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(fetchPublicDistrictsMock).toHaveBeenCalled();
    });

    await act(async () => {
      await user.click(screen.getByRole("button", { name: /add school \(optional\)/i }));
    });

    await waitFor(() => {
      expect(screen.getByText("Could not load districts.")).toBeInTheDocument();
    });
  });
});
