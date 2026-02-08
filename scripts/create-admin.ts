import { applyDbEnv } from "../apps/api/src/config";
import { getPrisma, resetPrisma } from "../apps/api/src/db";
import { hashPassword, normalizeEmail } from "../apps/api/src/auth";

const getArgValue = (name: string) => {
    const prefix = `--${ name }=`;
    const value = process.argv.find((arg) => arg.startsWith(prefix));
    return value ? value.slice(prefix.length).trim() : "";
};

const getRequiredArg = (name: string) => {
    const value = getArgValue(name);
    if (!value) {
        throw new Error(`Missing required argument --${ name }=...`);
    }
    return value;
};

const createAdmin = async () => {
    applyDbEnv();
    const email = normalizeEmail(getRequiredArg("email"));
    const password = getRequiredArg("password");
    const displayName = getArgValue("display-name") || "Administrator";
    const districtId = getArgValue("district-id") || "district-default";
    const districtName = getArgValue("district-name") || "Default District";
    const schoolId = getArgValue("school-id") || "school-default";
    const schoolName = getArgValue("school-name") || "Default School";

    const prisma = getPrisma();

    const district = await prisma.district.upsert({
        where: { id: districtId },
        update: {
            name: districtName
        },
        create: {
            id: districtId,
            name: districtName
        }
    });

    const school = await prisma.school.upsert({
        where: { id: schoolId },
        update: {
            name: schoolName,
            districtId: district.id
        },
        create: {
            id: schoolId,
            districtId: district.id,
            name: schoolName,
            closedDays: [],
            openerCount: 0,
            closerCount: 0,
            minimumMedicalDelegated: 0,
            requireCurrentCpr: false
        }
    });

    const user = await prisma.user.upsert({
        where: { email },
        update: {
            displayName,
            passwordHash: hashPassword(password),
            isSuperUser: true,
            status: "active"
        },
        create: {
            email,
            displayName,
            passwordHash: hashPassword(password),
            isSuperUser: true,
            status: "active"
        }
    });

    await prisma.districtMembership.upsert({
        where: {
            userId_districtId: {
                userId: user.id,
                districtId: district.id
            }
        },
        update: {
            role: "district_admin"
        },
        create: {
            userId: user.id,
            districtId: district.id,
            role: "district_admin"
        }
    });

    await prisma.schoolMembership.upsert({
        where: {
            userId_schoolId: {
                userId: user.id,
                schoolId: school.id
            }
        },
        update: {
            role: "school_admin"
        },
        create: {
            userId: user.id,
            schoolId: school.id,
            role: "school_admin"
        }
    });

    // eslint-disable-next-line no-console
    console.log(`Admin user ready: ${ email } (school: ${ school.id })`);
};

createAdmin()
    .catch((error: unknown) => {
        // eslint-disable-next-line no-console
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await resetPrisma();
    });
