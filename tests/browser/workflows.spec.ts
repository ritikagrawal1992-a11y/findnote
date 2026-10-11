import { test, expect } from "@playwright/test";
test("Findnote indexes a new note and renders HTML as literal text", async ({
  page,
}) => {
  await page.goto("/#search");
  await page.getByLabel("Title", { exact: true }).fill("Queue recovery");
  await page
    .getByLabel("Content", { exact: true })
    .fill(
      "Restart consumers after checkpoint validation. <script>window.xss=true</script>",
    );
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(
    page.getByRole("heading", { name: "Queue recovery" }),
  ).toBeVisible();
  await page.getByLabel("Search the knowledge library").fill("checkpoint");
  await expect(page.locator(".document")).toHaveCount(1);
  expect(await page.evaluate(() => "xss" in window)).toBe(false);
  await page.screenshot({
    path: "docs/screenshots/findnote.png",
    fullPage: true,
  });
});
