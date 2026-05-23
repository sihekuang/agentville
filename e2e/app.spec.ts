import { test, expect } from "@playwright/test";

test.describe("AgentVille", () => {
  test("renders the app with header and scene", async ({ page }) => {
    await page.goto("/");

    // Header renders
    await expect(page.locator("h1")).toHaveText("AgentVille");

    // Theme buttons are visible
    await expect(page.getByRole("button", { name: "Office" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Farm" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Workshop" })).toBeVisible();

    // Agent count shows (even if 0)
    await expect(page.locator("text=agents")).toBeVisible();

    // Canvas exists (PixiJS scene)
    await expect(page.locator("canvas")).toBeVisible();
  });

  test("theme buttons switch the active theme", async ({ page }) => {
    await page.goto("/");

    // Office is selected by default (has bg-indigo-600 class)
    const officeBtn = page.getByRole("button", { name: "Office" });
    await expect(officeBtn).toHaveClass(/bg-indigo-600/);

    // Click Farm
    await page.getByRole("button", { name: "Farm" }).click();
    const farmBtn = page.getByRole("button", { name: "Farm" });
    await expect(farmBtn).toHaveClass(/bg-indigo-600/);
    // Office should no longer be active
    await expect(officeBtn).not.toHaveClass(/bg-indigo-600/);

    // Click Workshop
    await page.getByRole("button", { name: "Workshop" }).click();
    const workshopBtn = page.getByRole("button", { name: "Workshop" });
    await expect(workshopBtn).toHaveClass(/bg-indigo-600/);
  });

  test("side panel does not show when no agent is selected", async ({ page }) => {
    await page.goto("/");

    // Side panel should not be visible (no agent selected)
    // The side panel renders null when no agent is selected,
    // so there should be no "Session Info" or "Current Activity" text
    await expect(page.locator("text=Current Activity")).not.toBeVisible();
    await expect(page.locator("text=Session Info")).not.toBeVisible();
  });

  test("streaming API endpoint responds", async ({ page, baseURL }) => {
    // Navigate first so page.evaluate has a proper origin
    await page.goto("/");

    const streamUrl = `${baseURL}/api/agents/stream`;

    // Use page.evaluate with an AbortController so we don't wait for the
    // never-ending stream body — we only need status + headers.
    const result = await page.evaluate(async (url: string) => {
      const controller = new AbortController();
      const res = await fetch(url, { signal: controller.signal });
      const status = res.status;
      const contentType = res.headers.get("content-type");
      controller.abort();
      return { status, contentType };
    }, streamUrl);

    expect(result.status).toBe(200);
    expect(result.contentType).toContain("text/plain");
  });
});
