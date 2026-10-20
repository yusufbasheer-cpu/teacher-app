import { expect, test, type Page } from "@playwright/test";

const publicRoutes = [
  "/",
  "/login",
  "/signup",
  "/pricing",
  "/about",
  "/faq",
  "/contact",
  "/blog",
  "/privacy",
  "/terms",
];

function collectPageErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("/_next/webpack-hmr")) {
      errors.push(message.text());
    }
  });
  return errors;
}

for (const route of publicRoutes) {
  test(`${route} renders without browser errors or horizontal overflow`, async ({ page }, testInfo) => {
    const errors = collectPageErrors(page);
    const response = await page.goto(route, { waitUntil: "networkidle" });

    expect(response?.status(), `${route} response status`).toBeLessThan(400);
    await expect(page.locator("body")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      `${route} should fit the viewport`,
    ).toBe(true);
    expect(errors, `${route} browser errors`).toEqual([]);

    await page.screenshot({
      path: testInfo.outputPath(`${route === "/" ? "home" : route.slice(1)}.png`),
      fullPage: true,
    });
  });
}

test("authentication forms expose clear labels and validation", async ({ page }) => {
  await page.goto("/signup");
  const declineCookies = page.getByRole("button", { name: "Decline" });
  if (await declineCookies.isVisible()) await declineCookies.click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /create account/i })).toBeVisible();
  await page.getByLabel("Full name", { exact: true }).fill("Test Teacher");
  await page.getByLabel("Email", { exact: true }).fill("teacher@example.com");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: /create account/i }).click();
  await expect(page.getByText(/password needs/i)).toBeVisible();
});

test("protected teacher routes redirect unauthenticated visitors", async ({ page }) => {
  for (const route of ["/dashboard", "/lesson-plan", "/my-lesson-plans", "/settings"]) {
    await page.goto(route);
    await expect(page).toHaveURL(/\/(login|auth)(\?|$)/);
  }
});
