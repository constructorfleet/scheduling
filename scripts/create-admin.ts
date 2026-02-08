import { applyDbEnv } from "../apps/api/src/config";
import { getPrisma, resetPrisma } from "../apps/api/src/db";
import { hashPassword, normalizeEmail, verifyPassword } from "../apps/api/src/auth";

const getArgValue = (name: string) => {
    const prefix = `--${ name }=`;
    const inline = process.argv.find((arg) => arg.startsWith(prefix));
    if (inline) {
        return inline.slice(prefix.length).trim();
    }
    const index = process.argv.findIndex((arg) => arg === `--${ name }`);
    if (index >= 0) {
        const next = process.argv[index + 1];
        if (next && !next.startsWith("--")) {
            return next.trim();
        }
    }
    return "";
};

const getRequiredArg = (name: string) => {
    const value = getArgValue(name);
    if (!value) {
        throw new Error(`Missing required argument --${ name }=...`);
    }
    return value;
};

const createAdmin = async () => {
    const { url } = applyDbEnv();
    if (!url) {
        throw new Error("DATABASE_URL is required.");
    }
    if (url.startsWith("file:")) {
        throw new Error(
            `DATABASE_URL is "${ url }". This project uses PostgreSQL. Set DATABASE_URL (or pass --db-url=...) to your Postgres connection string before running create-admin.`
        );
    }
    const email = normalizeEmail(getRequiredArg("email"));
    const password = getRequiredArg("password");
    const displayName = getArgValue("display-name") || "Administrator";
    const districtId = getArgValue("district-id") || "district-default";
    const districtName = getArgValue("district-name") || "Default District";
    const schoolId = getArgValue("school-id") || "school-default";
    const schoolName = getArgValue("school-name") || "Default School";

    const prisma = getPrisma();
    // eslint-disable-next-line no-console
    console.log(`Using database: ${ url.replace(/:\/\/([^:@]+):([^@]+)@/, "://$1:***@") }`);

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
    if (!verifyPassword(password, user.passwordHash)) {
        throw new Error("Password verification failed after upsert. User credentials were not written correctly.");
    }

    await prisma.districtMembership.upsert({
        where: {
            userId_districtId: {
                userId: user.id,
                districtId: district.id
            }
        },
        update: {
            role: "super_user"
        },
        create: {
            userId: user.id,
            districtId: district.id,
            role: "super_user"
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
            role: "super_user"
        },
        create: {
            userId: user.id,
            schoolId: school.id,
            role: "super_user"
        }
    });

    const persistedUser = await prisma.user.findUnique({ where: { email } });
    if (!persistedUser || !verifyPassword(password, persistedUser.passwordHash)) {
        throw new Error("Persisted user password verification failed. Aborting.");
    }

    // eslint-disable-next-line no-console
    console.log(`Super user ready: ${ email } (school: ${ school.id }, district: ${ district.id })`);
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
