import { test, expect } from "@playwright/test";

test.describe("PIP feature", () => {
  test.beforeEach(async ({ page }) => {
    // Mock documentPictureInPicture API — Playwright's Chromium doesn't have it
    await page.addInitScript(() => {
      (window as any).documentPictureInPicture = {
        requestWindow: () =>
          Promise.resolve({
            document: {
              createElement: (tag: string) => document.createElement(tag),
              head: { appendChild: () => {} },
              documentElement: { classList: { add: () => {} } },
            },
            addEventListener: () => {},
            close: () => {},
          }),
      };
    });
    await page.goto("/");
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("PIP button is visible in scene controls", async ({ page }) => {
    const pipButton = page.getByTitle("Picture in Picture");
    await expect(pipButton).toBeVisible();
  });

  test("clicking PIP button shows placeholder", async ({ page }) => {
    await page.getByTitle("Picture in Picture").click();
    await expect(page.getByText("Canvas is floating")).toBeVisible();
    await expect(page.getByRole("button", { name: /re-dock/i })).toBeVisible();
  });

  test("clicking Re-dock restores the canvas", async ({ page }) => {
    await page.getByTitle("Picture in Picture").click();
    await expect(page.getByText("Canvas is floating")).toBeVisible();

    await page.getByRole("button", { name: /re-dock/i }).click();
    await expect(page.locator("canvas")).toBeVisible();
    await expect(page.getByText("Canvas is floating")).not.toBeVisible();
  });
});
