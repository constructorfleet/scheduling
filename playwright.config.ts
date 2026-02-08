import { defineConfig } from "@playwright/test";

export default defineConfig({
    testDir: "tests/e2e",
    timeout: 120000,
    expect: {
        timeout: 5000
    },
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    use: {
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
        baseURL: "http://127.0.0.1:4174"
    },
    webServer: [
        {
            command: "NODE_ENV=test npm run test:e2e:server",
            url: "http://127.0.0.1:4174",
            reuseExistingServer: !process.env.CI,
            timeout: 120000
        },
        {
            command: "NODE_ENV=test PORT=4001 npm run api:dev",
            url: "http://127.0.0.1:4001/api/health",
            reuseExistingServer: !process.env.CI,
            timeout: 120000
        }
    ]
});
