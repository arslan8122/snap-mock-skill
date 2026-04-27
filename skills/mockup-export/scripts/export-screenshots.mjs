import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs/promises";
import AdmZip from "adm-zip";

async function resolvePort() {
  if (process.env.PORT) return process.env.PORT;
  const pluginData = process.env.CLAUDE_PLUGIN_DATA;
  if (pluginData) {
    try {
      const pidFile = await fs.readFile(path.join(pluginData, "dev.pid"), "utf8");
      const lines = pidFile.split("\n");
      if (lines[1]?.trim()) return lines[1].trim();
    } catch {}
  }
  return "3000";
}

const PORT = await resolvePort();
const URL = process.env.MOCKUP_URL || `http://localhost:${PORT}`;
const OUT_DIR = path.resolve(process.env.OUT_DIR || "./mockups");
const EXPECTED_GENERATED_AT = process.env.BRIEFS_GENERATED_AT || "";

await fs.mkdir(OUT_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  acceptDownloads: true,
  viewport: { width: 1280, height: 1024 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();

console.log(`[export] navigating to ${URL}`);
await page.goto(URL, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);

if (EXPECTED_GENERATED_AT) {
  try {
    await page.waitForFunction(
      (expected) => document.body.getAttribute("data-briefs-generated-at") === expected,
      EXPECTED_GENERATED_AT,
      { timeout: 30_000 }
    );
    console.log(`[export] briefs hydration verified (${EXPECTED_GENERATED_AT})`);
  } catch {
    const got = await page.evaluate(() =>
      document.body.getAttribute("data-briefs-generated-at")
    );
    console.error(
      `[export] briefs hydration timeout: expected=${EXPECTED_GENERATED_AT} got=${got}`
    );
    await browser.close();
    process.exit(2);
  }
}

const button = page.locator('[data-action="export-all-zip"]');
await button.waitFor({ state: "visible", timeout: 30_000 });

console.log("[export] clicking Export ZIP");
const downloadPromise = page.waitForEvent("download", { timeout: 90_000 });
await button.click();
const download = await downloadPromise;

const zipPath = path.join(OUT_DIR, "_bundle.zip");
await download.saveAs(zipPath);
console.log(`[export] saved zip to ${zipPath}`);

const zip = new AdmZip(zipPath);
zip.extractAllTo(OUT_DIR, true);
await fs.unlink(zipPath);

const files = (await fs.readdir(OUT_DIR)).filter((f) => f.endsWith(".png")).sort();
for (const f of files) {
  const stat = await fs.stat(path.join(OUT_DIR, f));
  console.log(`[export] ${f}  ${(stat.size / 1024).toFixed(1)} KB`);
}

await browser.close();
console.log(`[export] done — ${files.length} PNGs in ${OUT_DIR}`);
