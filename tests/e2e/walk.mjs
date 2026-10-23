import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const axeSource = fs.readFileSync(require.resolve("axe-core"), "utf8");
const here = path.dirname(fileURLToPath(import.meta.url));
const base = process.env.NOHW_BASE || "http://127.0.0.1:8099/";
const jpeg = process.env.NOHW_JPEG || "/tmp/big-4000x3000.jpg";
const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail: detail || "" });
  if (!ok) console.error("FAIL", name, detail || "");
  else console.log("ok", name);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME || "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"]
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const hosts = new Set();
const pageErrors = [];
page.on("pageerror", (error) => pageErrors.push(String(error)));
page.on("request", (request) => hosts.add(new URL(request.url()).host));

async function clickText(text) {
  await page.waitForFunction((wanted) => [...document.querySelectorAll("button")].some((el) => (el.innerText || "").replace(/\s+/g, " ").includes(wanted)), text);
  const found = await page.$$eval("button", (els, wanted) => {
    const el = els.find((node) => (node.innerText || "").replace(/\s+/g, " ").includes(wanted));
    if (!el) return "";
    el.click();
    return "yes";
  }, text);
  if (!found) throw new Error("missing " + text);
  await page.waitForTimeout(80);
}
async function fresh() {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "domcontentloaded" });
}
async function layout(name) {
  const box = await page.evaluate(() => ({
    dir: document.documentElement.getAttribute("dir"),
    app: (document.querySelector(".app") || {}).getAttribute ? document.querySelector(".app").getAttribute("dir") : "",
    scroll: document.documentElement.scrollWidth,
    inner: window.innerWidth
  }));
  if (box.dir !== "rtl" || box.app !== "rtl" || box.scroll > box.inner + 1) throw new Error(name + " " + JSON.stringify(box));
}
async function openScenario(title) {
  await fresh();
  await clickText("תרחישים");
  await clickText(title);
  await page.locator("[aria-current='true']").click();
  await page.waitForTimeout(80);
}
async function axe(name) {
  await page.evaluate(axeSource);
  const outcome = await page.evaluate(async () => {
    const result = await window.axe.run(document, { resultTypes: ["violations"] });
    return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => item.id + " " + item.help);
  });
  if (outcome.length) throw new Error(outcome.join("; "));
  record("axe " + name, true);
}

try {
  await fresh();
  await layout("start");
  const start = await page.locator("body").innerText();
  if (!start.includes("תרחישים") || !start.includes("נתונים חיים") || !start.includes("דמויות")) throw new Error(start.slice(0, 200));
  record("start hub", true);
  await axe("start");

  await clickText("תרחישים");
  if (await page.locator('[aria-label="נתונים חיים"]').count()) throw new Error("all-schools live data is off the start screen");
  const titles = await page.$$eval("button.scenario strong", (els) => els.map((el) => el.innerText.trim()));
  const doc = fs.readFileSync(path.join(here, "..", "..", "docs", "simple-demo-scenarios.md"), "utf8");
  const missingDoc = titles.filter((title) => title && !doc.includes(title));
  if (!titles.length || missingDoc.length) throw new Error("scenarios " + JSON.stringify({ titles, missingDoc }));
  record("scenario list matches the script", true, String(titles.length));

  for (const title of titles) {
    await openScenario(title);
    await layout(title);
    const role = await page.evaluate(() => document.body.innerText.slice(0, 80));
    if (!role) throw new Error("empty " + title);
    record("scenario " + title, true);
    await page.locator('[aria-label="החלפת דמות"]').click();
    await page.waitForTimeout(60);
    await layout("people " + title);
  }

  await openScenario("הדגמה למנהל/ת – 3 דקות");
  const principal = await page.locator("body").innerText();
  if (!principal.includes("ה'2") || !principal.includes("ד'1") || !principal.includes("פורסם") || !principal.includes("ניהול כיתות") || !principal.includes("%")) throw new Error(principal.slice(0, 400));
  await page.locator('[aria-label="נתונים חיים"]').click();
  await page.waitForTimeout(80);
  const scoped = await page.locator("body").innerText();
  if (!scoped.includes("אלון") || scoped.includes("ברוש")) throw new Error(scoped.slice(0, 300));
  record("principal home and scoped live data", true);
  await axe("principal");

  await openScenario("כיתה או בית ספר אחר לא מופיעים");
  const teacherText = await page.locator("body").innerText();
  if (teacherText.includes("ד'1") || teacherText.includes("ברוש")) throw new Error("teacher saw another class");
  await page.locator('[aria-label="נתונים חיים"]').click();
  const teacherLive = await page.locator("body").innerText();
  if (teacherLive.includes("ברוש") || teacherLive.includes("ד'1")) throw new Error("teacher live " + teacherLive.slice(0, 240));
  record("teacher cannot see another class", true);
  await page.locator('[aria-label="החלפת דמות"]').click();
  await clickText("נועה");
  await page.locator('[aria-label="נתונים חיים"]').click();
  await page.waitForTimeout(80);
  const studentLive = await page.locator("body").innerText();
  if (!studentLive.includes("נועה") || studentLive.includes("תמר") || studentLive.includes("עידו") || studentLive.includes("ברוש")) throw new Error("student live " + studentLive.slice(0, 240));
  record("student live data is only their own", true);
  await page.locator('[aria-label="חזרה"]').click();
  await page.locator('[aria-label="החלפת דמות"]').click();
  await clickText("יעל");
  await page.locator('[aria-label="נתונים חיים"]').click();
  await page.waitForTimeout(80);
  const parentLive = await page.locator("body").innerText();
  if (!parentLive.includes("נועה") || !parentLive.includes("תמר") || parentLive.includes("עידו") || parentLive.includes("ברוש")) throw new Error("parent live " + parentLive.slice(0, 240));
  record("parent live data is only their kids", true);
  await page.locator('[aria-label="חזרה"]').click();
  await page.locator('[aria-label="החלפת דמות"]').click();
  await clickText("דנה");
  if (!(await page.locator("body").innerText()).includes("ה'2") || (await page.locator("body").innerText()).includes("ברוש")) throw new Error("principal scope");
  await page.locator('[aria-label="החלפת דמות"]').click();
  await clickText("יואב");
  const yoav = await page.locator("body").innerText();
  if (!yoav.includes("ו'1") || yoav.includes("אלון")) throw new Error(yoav.slice(0, 200));
  record("principal sees only their school", true);

  await openScenario("מנהל מערכת מוסיף בית ספר");
  const payload = '<img src=x onerror="window.__xss=1">';
  await clickText("הוספה");
  await page.locator('input[name="a"]').fill(payload);
  await page.locator('input[name="b"]').fill("שירי");
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(100);
  const xss = await page.evaluate(() => window.__xss);
  const shown = await page.locator("body").innerText();
  if (xss || !shown.includes(payload)) throw new Error("xss school " + shown.includes(payload) + " " + xss);
  record("xss school name is text", true);
  await page.locator('[aria-label="החלפת דמות"]').click();
  await clickText("נועם");
  await clickText("אלון");
  await clickText("ה'2");
  await page.locator('[aria-label="עריכה"]').first().click();
  await page.locator('input[name="a"]').fill(payload);
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(80);
  if (await page.evaluate(() => window.__xss)) throw new Error("xss kid");
  record("xss student name is text", true);

  await openScenario("המורה לא עדכנה");
  const stale = await page.locator("body").innerText();
  if (!stale.includes("לא עודכן") || stale.includes("אין שיעורים")) throw new Error("stale");
  record("not updated stays not updated", true);
  await page.locator('[aria-label="החלפת דמות"]').click();
  await clickText("מיכל");
  await clickText("לשיעור הבא");
  if (!(await page.locator("body").innerText()).includes("0/5")) throw new Error("progress");
  await clickText("אין שיעורים היום");
  if ((await page.locator("body").innerText()).includes("לא עודכן")) throw new Error("none-day left a gap");
  record("one tap clears the day", true);
  await page.locator('[aria-label="החלפת דמות"]').click();
  await clickText("נועה");
  if (!(await page.locator("body").innerText()).includes("אין שיעורים")) throw new Error("student none");
  record("no homework is distinct from not updated", true);

  await openScenario("מורה מצלמת לוח");
  await clickText("לו״ז שיעורים");
  await layout("timetable");
  await axe("timetable");
  await clickText("שיעור 4");
  await page.locator('input[name="custom"]').fill(payload);
  await page.locator("form button.primary").click();
  await page.waitForTimeout(80);
  if (await page.evaluate(() => window.__xss) || !(await page.locator("body").innerText()).includes(payload)) throw new Error("xss subject");
  record("timetable and xss custom subject", true);
  await page.locator('[aria-label="חזרה"]').click();
  await clickText("לשיעור הבא");
  await clickText("עברית");
  const before = await page.locator("form .play").count();
  await page.locator("#lib").setInputFiles(jpeg);
  await page.waitForFunction(() => {
    const img = document.querySelector("form .thumb img");
    return img && img.complete && img.naturalWidth > 0 && img.naturalWidth <= 1280;
  });
  await clickText("הקלטה");
  await page.waitForSelector("text=מקליט");
  await page.waitForTimeout(400);
  await clickText("עצור");
  await page.waitForSelector("text=נשמר");
  await clickText("הקלטה נוספת");
  await page.waitForTimeout(300);
  await clickText("עצור");
  await page.waitForFunction(() => document.querySelectorAll("form .play").length >= 2);
  const fields = page.locator('input[aria-label="תמלול"]');
  await fields.nth(0).fill(payload);
  await fields.nth(1).fill("שורה שנייה");
  await page.locator('input[name="text"]').fill("שיעורי בית " + payload);
  await clickText("שמור והבא");
  await page.waitForTimeout(150);
  const afterSave = await page.locator("h1").innerText();
  if (afterSave === "עברית") throw new Error("save-next stayed");
  if (await page.evaluate(() => window.__xss)) throw new Error("xss homework");
  record("photos, two recordings, save and next", true, "plays " + before + " heading " + afterSave);
  await page.locator('[aria-label="החלפת דמות"]').click();
  await clickText("נועה");
  await layout("student day");
  if (!(await page.locator("body").innerText()).includes(payload)) throw new Error("student missed transcript");
  record("student sees the transcript text", true);
  await axe("student day");

  await openScenario("הודעה להורים בלבד");
  await clickText("הודעות");
  await clickText("הודעה");
  await page.locator('input[name="text"]').fill(payload);
  await clickText("הורים בלבד");
  await clickText("התראה");
  await clickText("שליחה");
  await page.locator('[aria-label="החלפת דמות"]').click();
  await clickText("נועה");
  await clickText("הודעות");
  const studentMsgs = await page.locator("body").innerText();
  if (studentMsgs.includes("שיחת הורים מחר") || studentMsgs.includes(payload) || !studentMsgs.includes("מבחן ביום")) throw new Error(studentMsgs.slice(0, 300));
  record("student does not see parents-only", true);
  await page.locator('[aria-label="החלפת דמות"]').click();
  await clickText("יעל");
  const parentHome = await page.locator("body").innerText();
  if (!parentHome.includes("התראה")) throw new Error("no banner");
  await clickText("הודעות");
  if (!(await page.locator("body").innerText()).includes("שיחת הורים מחר") || !(await page.locator("body").innerText()).includes(payload)) throw new Error("parent messages");
  record("parent sees the alert and parents-only message", true);
  await axe("messages");

  await openScenario("עדכון והקפצת הודעה");
  await clickText("הודעות");
  const first = await page.locator("article strong").first().innerText();
  if (!first.includes("הטיול")) throw new Error(first);
  await clickText("עריכה");
  await page.locator('input[name="text"]').fill("הטיול נדחה שוב");
  await clickText("שמירה");
  if (!(await page.locator("body").innerText()).includes("עודכן")) throw new Error("edit");
  await clickText("הקפצה");
  await clickText("מחיקה");
  await clickText("ביטול");
  if (!(await page.locator("body").innerText()).includes("להביא ספר")) throw new Error("delete cancel");
  record("edit, bump, and delete cancel", true);

  await openScenario("יום רגיל · 2 מתוך 3 הושלמו");
  await page.locator('[aria-label="הוכן"]').first().click();
  await page.locator('[aria-label="החלפת דמות"]').click();
  await page.locator('[aria-label="חזרה"]').click();
  await clickText("תרחישים");
  await clickText("איפוס");
  await clickText("איפוס");
  await clickText("יום רגיל · 2 מתוך 3 הושלמו");
  await page.locator("[aria-current='true']").click();
  record("scenario reset", true);

  const manifest = await page.evaluate(async (root) => {
    const response = await fetch(new URL("manifest.webmanifest", root));
    const data = await response.json();
    const ready = await navigator.serviceWorker.register("sw.js");
    await navigator.serviceWorker.ready;
    return { name: data.name, dir: data.dir, display: data.display, icons: (data.icons || []).length, scope: ready.scope || "" };
  }, base);
  if (manifest.name !== "שיעורי בית" || manifest.dir !== "rtl" || manifest.icons < 2) throw new Error(JSON.stringify(manifest));
  record("manifest and service worker", true, manifest.scope);
  await page.context().setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  const offline = await page.locator("h1").innerText();
  await page.context().setOffline(false);
  if (!offline) throw new Error("offline empty");
  record("offline after first load", true, offline);

  const foreign = [...hosts].filter((host) => {
    const name = String(host || "").replace(/:\d+$/, "");
    return name && name !== "127.0.0.1" && name !== "localhost";
  });
  if (foreign.length) throw new Error(foreign.join(","));
  record("no third-party requests", true, [...hosts].join(","));
  if (pageErrors.length) throw new Error(pageErrors.join("\n"));
  record("no page errors", true);
} catch (error) {
  record("walk", false, String(error && error.stack || error));
}

let webkit = "skipped";
try {
  const pw = require("playwright-core");
  if (pw.webkit) {
    const kit = await pw.webkit.launch({ headless: true });
    await kit.close();
    webkit = "launched";
  }
} catch (error) {
  webkit = "unavailable";
}
record("webkit", true, webkit);

await browser.close();
const failed = results.filter((item) => !item.ok);
fs.writeFileSync(path.join(here, "results.json"), JSON.stringify({ results, webkit }, null, 2));
console.log(JSON.stringify({ passed: results.filter((item) => item.ok).length, failed: failed.length, webkit }, null, 2));
if (failed.length) process.exit(1);
