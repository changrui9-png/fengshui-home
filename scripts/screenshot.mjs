import { mkdir } from "node:fs/promises";
import puppeteer from "puppeteer-core";

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await mkdir("docs/screenshots", { recursive: true });

async function clickButton(name) {
  await page.evaluate((label) => {
    const button = [...document.querySelectorAll("button")].find((element) => element.textContent?.trim() === label);
    if (!button) throw new Error(`找不到按钮 ${label}`);
    button.click();
  }, name);
}

async function clickText(name) {
  await page.evaluate((label) => {
    const element = [...document.querySelectorAll("label, button, span")].find((node) => node.textContent?.includes(label));
    if (!element) throw new Error(`找不到 ${label}`);
    element.click();
  }, name);
}

await page.setViewport({ width: 1280, height: 900 });
await page.goto("http://127.0.0.1:8787/", { waitUntil: "networkidle0" });
await clickButton("载入完整示例");
await page.waitForFunction(() => document.body.textContent?.includes("示例数据，不是真实住宅"));
await page.screenshot({ path: "docs/screenshots/01-example-materials.png" });
await clickButton("户型");
await page.waitForFunction(() => document.body.textContent?.includes("主卧"));
await page.screenshot({ path: "docs/screenshots/02-plan-desktop.png" });
await clickButton("电梯");
await page.screenshot({ path: "docs/screenshots/03-elevator.png" });
await clickButton("户型");
await clickText("确认房间拓扑");
await clickText("确认朝向");
await clickText("确认家具");
await clickButton("评估");
await clickButton("生成最终评估");
await page.waitForFunction(() => document.body.textContent?.includes("最终评估"));
await page.screenshot({ path: "docs/screenshots/04-report.png" });
await page.setViewport({ width: 390, height: 844 });
await clickButton("户型");
await page.screenshot({ path: "docs/screenshots/05-plan-mobile.png" });
await browser.close();
