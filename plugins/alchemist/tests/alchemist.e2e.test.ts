import { expect, test } from "@rstest/playwright";

test("plays a responsive standalone experiment", async ({ page, serve }) => {
  const server = await serve("./dist/index.html");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(server.url);

  await expect(page.locator("h1")).toHaveText("Alchemist");
  expect(await page.locator("img, svg").count()).toBe(0);
  await expect(page.getByRole("heading", { name: "Reaction" })).toBeVisible();
  expect(await page.locator("[data-recipe]").count()).toBe(0);
  expect(await page.locator("[data-element]").count()).toBe(0);
  expect(await page.locator(".alchemist-game-actions").count()).toBe(0);
  expect(
    /\b(?:Now|Next|Hold)\b/.test(await page.locator("body").innerText()),
  ).toBe(false);
  await expect(page.getByText("H → K", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Start" }).click();
  const canvas = page.getByTestId("game-canvas");
  await expect(canvas).toBeVisible();
  const desktopCanvas = await canvas.boundingBox();
  expect(desktopCanvas).not.toBeNull();
  expect(desktopCanvas?.width ?? Infinity).toBeLessThanOrEqual(370);
  expect(desktopCanvas?.width ?? 0).toBeGreaterThanOrEqual(360);
  expect(
    (desktopCanvas?.height ?? 0) / (desktopCanvas?.width ?? 1),
  ).toBeCloseTo(496 / 336, 2);
  expect(
    Math.abs(
      (desktopCanvas?.x ?? 0) +
        (desktopCanvas?.width ?? 0) / 2 -
        1440 / 2,
    ),
  ).toBeLessThan(3);
  const firstTool = page.locator("[data-tool]").first();
  const secondTool = page.locator("[data-tool]").nth(1);
  const toolBox = await firstTool.boundingBox();
  const secondToolBox = await secondTool.boundingBox();
  expect(toolBox?.height ?? Infinity).toBeLessThanOrEqual(60);
  expect(Math.abs((toolBox?.x ?? 0) - (secondToolBox?.x ?? 0))).toBeLessThan(1);
  expect(secondToolBox?.y ?? 0).toBeGreaterThan(
    (toolBox?.y ?? 0) + (toolBox?.height ?? 0),
  );
  expect((toolBox?.x ?? Infinity) + (toolBox?.width ?? 0)).toBeLessThanOrEqual(
    desktopCanvas?.x ?? 0,
  );
  expect(
    await firstTool.evaluate(
      (element) => getComputedStyle(element).borderTopWidth,
    ),
  ).toBe("0px");

  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("heading", { name: "Paused" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Resume" })).toBeVisible();
  await expect(page.getByRole("button", { name: "New run" })).toBeVisible();
  await expect(page.getByRole("button", { name: /sound/i })).toBeVisible();
  expect(
    /\bHold\b/.test(await page.locator("body").innerText()),
  ).toBe(false);
  await page.getByRole("button", { name: "Resume" }).click();

  await canvas.click({ position: { x: 210, y: 60 } });
  await page.waitForTimeout(950);
  await canvas.click({ position: { x: 210, y: 60 } });
  await expect(page.locator("[data-highest-symbol]")).toHaveText("C", {
    timeout: 5_000,
  });

  for (const viewport of [
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    expect(hasHorizontalOverflow).toBe(false);
    await expect(canvas).toBeVisible();
  }
});

test("opens and closes the MolVis plugin modal", async ({ page, serve }) => {
  const server = await serve("./dist/index.html");
  await page.goto(server.url);

  await page.evaluate(async () => {
    const loadPlugin = new Function("return import('/plugin.js')") as () => Promise<{
      default: {
        activate(api: unknown): void;
        deactivate(api: unknown): void;
      };
    }>;
    const plugin = (await loadPlugin()).default;
    let open: (() => void) | undefined;
    const values = new Map<string, string>();
    const api = {
      pluginId: "com.molcrafts.alchemist",
      log: { info() {}, warn() {}, error() {} },
      storage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
      commands: {
        register(
          _name: string,
          command: () => void,
          _options: unknown,
        ) {
          open = command;
        },
      },
    };
    plugin.activate(api);
    open?.();
    Object.assign(window, { __alchemistPlugin: plugin, __alchemistApi: api });
  });

  const dialog = page.getByRole("dialog", { name: "Alchemist game" });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator("h1")).toHaveText("Alchemist");
  await dialog.getByRole("button", { name: "Start" }).click();
  await dialog.getByRole("button", { name: "Pause" }).click();
  await dialog.getByRole("button", { name: "Close Alchemist" }).click();
  await expect(dialog).toBeHidden();
});
