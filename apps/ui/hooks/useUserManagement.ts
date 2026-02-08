import { useEffect, useMemo, useState } from "react";
import type { Role } from "../data/generated";
import type { UserManagementScope } from "../data/apiClient";
import {
    createAdminDistrict,
    fetchAdminDistricts,
    fetchDistrictSchools,
    fetchDistrictInvites,
    fetchDistrictUsers,
    fetchSchoolInvites,
    fetchSchoolUsers,
    inviteDistrictUser,
    inviteSchoolUser,
    isApiErrorStatus,
    updateAdminDistrict,
    upsertDistrictSchool
} from "../data/apiClient";

type DistrictMembership = {
    districtId: string;
    role: Role;
};

type InviteDraft = {
    email: string;
    displayName: string;
    role: Role;
};

interface UseUserManagementArgs {
    canManageUsers: boolean;
    canManageDistricts: boolean;
    canUseDistrictScope: boolean;
    canUseSchoolScope: boolean;
    selectedSchoolId: string;
    districtMemberships: DistrictMembership[];
    onPermissionError: (message: string) => void;
}

export const useUserManagement = ({
    canManageUsers,
    canManageDistricts,
    canUseDistrictScope,
    canUseSchoolScope,
    selectedSchoolId,
    districtMemberships,
    onPermissionError
}: UseUserManagementArgs) => {
    const [ showUserManagement, setShowUserManagement ] = useState(false);
    const [ userManagementScope, setUserManagementScope ] = useState<UserManagementScope>("school");
    const [ selectedDistrictId, setSelectedDistrictId ] = useState("");
    const [ managedUsers, setManagedUsers ] = useState<
        Array<{ id: string; email: string; displayName: string; status: string; }>
    >([]);
    const [ managedInvites, setManagedInvites ] = useState<
        Array<{
            id: string;
            email: string;
            displayName: string | null;
            role: Role;
            districtId?: string | null;
            districtName?: string | null;
            schoolId?: string | null;
            schoolName?: string | null;
            invitedBy?: { id: string; email: string; displayName: string; } | null;
            createdAt: string;
            expiresAt: string;
            acceptedAt: string | null;
            revokedAt: string | null;
            inviteUrl: string | null;
        }>
    >([]);
    const [ userManagementLoading, setUserManagementLoading ] = useState(false);
    const [ userManagementError, setUserManagementError ] = useState<string | null>(null);
    const [ inviteSubmitting, setInviteSubmitting ] = useState(false);
    const [ inviteFeedback, setInviteFeedback ] = useState<string | null>(null);
    const [ inviteDraft, setInviteDraft ] = useState<InviteDraft>({
        email: "",
        displayName: "",
        role: "school_user"
    });
    const [ districts, setDistricts ] = useState<Array<{ id: string; name: string; }>>([]);
    const [ districtSchools, setDistrictSchools ] = useState<Array<{ id: string; districtId: string; name: string; }>>([]);
    const [ districtDraft, setDistrictDraft ] = useState<{ id: string; name: string; }>({ id: "", name: "" });
    const [ schoolDraft, setSchoolDraft ] = useState<{ id: string; name: string; }>({ id: "", name: "" });
    const [ districtSubmitting, setDistrictSubmitting ] = useState(false);
    const [ schoolSubmitting, setSchoolSubmitting ] = useState(false);

    useEffect(() => {
        if (!selectedDistrictId && districtMemberships.length > 0) {
            setSelectedDistrictId(districtMemberships[ 0 ].districtId);
        }
    }, [ selectedDistrictId, districtMemberships ]);

    useEffect(() => {
        if (showUserManagement && !canManageUsers) {
            setShowUserManagement(false);
        }
    }, [ showUserManagement, canManageUsers ]);

    const districtRoleOptions: { value: Role; label: string; }[] = [
        { value: "district_admin", label: "District Admin" },
        { value: "district_user", label: "District User" }
    ];
    const schoolRoleOptions: { value: Role; label: string; }[] = [
        { value: "school_admin", label: "School Admin" },
        { value: "school_user", label: "School User" },
        { value: "school_viewer", label: "School Viewer" }
    ];
    const inviteRoleOptions = useMemo(
        () => (userManagementScope === "district" ? districtRoleOptions : schoolRoleOptions),
        [ userManagementScope ]
    );

    useEffect(() => {
        setInviteDraft((current) => {
            const nextRole = inviteRoleOptions.some((option) => option.value === current.role)
                ? current.role
                : inviteRoleOptions[ 0 ]?.value ?? "school_user";
            return { ...current, role: nextRole };
        });
    }, [ inviteRoleOptions ]);

    const refreshUserManagement = async () => {
        if (!showUserManagement || !canManageUsers) {
            return;
        }
        setUserManagementLoading(true);
        setUserManagementError(null);
        try {
            if (canManageDistricts) {
                const districtsResponse = await fetchAdminDistricts();
                setDistricts(districtsResponse?.districts ?? []);
            }
            if (userManagementScope === "district") {
                if (!selectedDistrictId) {
                    setManagedUsers([]);
                    setManagedInvites([]);
                    return;
                }
                const [ usersResponse, invitesResponse ] = await Promise.all([
                    fetchDistrictUsers(selectedDistrictId),
                    fetchDistrictInvites(selectedDistrictId)
                ]);
                setManagedUsers(usersResponse?.users ?? []);
                setManagedInvites(invitesResponse?.invites ?? []);
                const schoolsResponse = await fetchDistrictSchools(selectedDistrictId);
                setDistrictSchools(schoolsResponse?.schools ?? []);
            } else {
                const [ usersResponse, invitesResponse ] = await Promise.all([
                    fetchSchoolUsers(selectedSchoolId),
                    fetchSchoolInvites(selectedSchoolId)
                ]);
                setManagedUsers(usersResponse?.users ?? []);
                setManagedInvites(invitesResponse?.invites ?? []);
            }
        } catch (error) {
            if (isApiErrorStatus(error, 403)) {
                setUserManagementError("You do not have permission for this user scope.");
            } else {
                setUserManagementError("Could not load users and invites.");
            }
        } finally {
            setUserManagementLoading(false);
        }
    };

    useEffect(() => {
        if (!showUserManagement) {
            return;
        }
        void refreshUserManagement();
    }, [ showUserManagement, userManagementScope, selectedSchoolId, selectedDistrictId, canManageUsers ]);

    useEffect(() => {
        if (!showUserManagement) {
            return;
        }
        if (userManagementScope === "district" && !canUseDistrictScope && canUseSchoolScope) {
            setUserManagementScope("school");
        }
        if (userManagementScope === "school" && !canUseSchoolScope && canUseDistrictScope) {
            setUserManagementScope("district");
        }
    }, [ showUserManagement, userManagementScope, canUseDistrictScope, canUseSchoolScope ]);

    const handleSendUserInvite = async () => {
        if (!canManageUsers) {
            setUserManagementError("You do not have permission to invite users.");
            return;
        }
        const email = inviteDraft.email.trim();
        if (!email) {
            setUserManagementError("Email is required.");
            return;
        }
        if (userManagementScope === "district" && !selectedDistrictId) {
            setUserManagementError("Select a district.");
            return;
        }
        setInviteSubmitting(true);
        setUserManagementError(null);
        setInviteFeedback(null);
        try {
            const payload = {
                email,
                displayName: inviteDraft.displayName.trim() || undefined,
                role: inviteDraft.role
            };
            const response =
                userManagementScope === "district"
                    ? await inviteDistrictUser(selectedDistrictId, payload)
                    : await inviteSchoolUser(selectedSchoolId, payload);
            if (response?.invite) {
                setManagedInvites((prev) => [ response.invite, ...prev.filter((invite) => invite.id !== response.invite.id) ]);
                setInviteFeedback(
                    response.invite.inviteUrl
                        ? `Invite ready. Share this link if needed: ${ response.invite.inviteUrl }`
                        : "Invite sent."
                );
            }
            setInviteDraft((current) => ({ ...current, email: "", displayName: "" }));
            await refreshUserManagement();
        } catch (error) {
            if (isApiErrorStatus(error, 400)) {
                setUserManagementError("Invalid invite details. Check email and role.");
            } else if (isApiErrorStatus(error, 403)) {
                setUserManagementError("You do not have permission to invite users in this scope.");
            } else {
                setUserManagementError("Could not send invite.");
            }
        } finally {
            setInviteSubmitting(false);
        }
    };

    const toggleUserManagement = () => {
        if (!canManageUsers) {
            onPermissionError("You do not have permission to manage users for this school.");
            return;
        }
        setUserManagementScope(canUseSchoolScope ? "school" : "district");
        setShowUserManagement((prev) => !prev);
    };

    const handleSaveDistrict = async () => {
        if (!canManageDistricts) {
            setUserManagementError("Only super users can manage districts.");
            return;
        }
        const districtId = districtDraft.id.trim();
        const districtName = districtDraft.name.trim();
        if (!districtName) {
            setUserManagementError("District name is required.");
            return;
        }
        setDistrictSubmitting(true);
        setUserManagementError(null);
        try {
            if (districtId) {
                await updateAdminDistrict(districtId, { name: districtName });
            } else {
                await createAdminDistrict({ name: districtName });
            }
            setDistrictDraft({ id: "", name: "" });
            await refreshUserManagement();
            setInviteFeedback("District saved.");
        } catch (error) {
            if (isApiErrorStatus(error, 403)) {
                setUserManagementError("Only super users can manage districts.");
            } else {
                setUserManagementError("Could not save district.");
            }
        } finally {
            setDistrictSubmitting(false);
        }
    };

    const handleSaveSchool = async () => {
        const schoolId = schoolDraft.id.trim();
        const schoolName = schoolDraft.name.trim();
        if (!selectedDistrictId) {
            setUserManagementError("Select a district first.");
            return;
        }
        if (!schoolId || !schoolName) {
            setUserManagementError("School ID and name are required.");
            return;
        }
        setSchoolSubmitting(true);
        setUserManagementError(null);
        try {
            await upsertDistrictSchool(selectedDistrictId, schoolId, { name: schoolName });
            setSchoolDraft({ id: "", name: "" });
            await refreshUserManagement();
            setInviteFeedback("School saved.");
        } catch (error) {
            if (isApiErrorStatus(error, 403)) {
                setUserManagementError("You do not have permission to manage schools in this district.");
            } else {
                setUserManagementError("Could not save school.");
            }
        } finally {
            setSchoolSubmitting(false);
        }
    };

    return {
        showUserManagement,
        setShowUserManagement,
        userManagementScope,
        setUserManagementScope,
        selectedDistrictId,
        setSelectedDistrictId,
        managedUsers,
        managedInvites,
        userManagementLoading,
        userManagementError,
        inviteSubmitting,
        inviteFeedback,
        inviteDraft,
        setInviteDraft,
        inviteRoleOptions,
        districts,
        districtSchools,
        districtDraft,
        setDistrictDraft,
        schoolDraft,
        setSchoolDraft,
        districtSubmitting,
        schoolSubmitting,
        refreshUserManagement,
        handleSendUserInvite,
        toggleUserManagement,
        handleSaveDistrict,
        handleSaveSchool
    };
};
