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
    return result.violations.filter((item) => item.impact === "serious" || item.impact === "critical").map((item) => item.id + " " + item.help + " " + (item.nodes[0] ? item.nodes[0].target.join(" ") + " " + item.nodes[0].html : ""));
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

  await openScenario("יום רגיל · 2 מתוך 3 הושלמו");
  await page.locator('header [aria-label="תמונת פרופיל"]').click();
  await page.waitForSelector("text=📷 צלם");
  if (!(await page.locator("body").innerText()).includes("מהגלריה") || !(await page.locator("body").innerText()).includes("הסר")) throw new Error("sheet");
  await page.screenshot({ path: "/opt/cursor/artifacts/avatar_sheet.png" });
  await layout("avatar sheet");
  await axe("avatar sheet");
  const chooserPromise = page.waitForEvent("filechooser");
  await page.locator("button", { hasText: "מהגלריה" }).click();
  await (await chooserPromise).setFiles(jpeg);
  await page.waitForFunction(() => {
    const img = document.querySelector("header .face img");
    return img && img.complete && img.naturalWidth === 256;
  });
  record("set own profile photo", true);
  await page.locator('header [aria-label="תמונת פרופיל"]').click();
  await clickText("הסר");
  await page.waitForFunction(() => !document.querySelector("header .face img"));
  const fallback = await page.locator("header .face").innerText();
  if (!fallback.trim()) throw new Error("emoji fallback empty");
  record("remove profile photo falls back to emoji", true);
  await page.locator('[aria-label="החלפת דמות"]').click();
  await clickText("מיכל");
  await clickText("תלמידים");
  if (!(await page.locator('.card [aria-label="תמונת פרופיל"]').count())) throw new Error("teacher cannot open a student's photo");
  await page.locator('.card [aria-label="תמונת פרופיל"]').first().click();
  await page.locator("#face").setInputFiles(jpeg);
  await page.waitForSelector(".card .face img");
  record("teacher sets a student's photo", true);
  await page.locator('.card [aria-label="תמונת פרופיל"]').nth(1).click();
  await page.locator("#face").setInputFiles(jpeg);
  await page.locator('[aria-label="החלפת דמות"]').click();
  await clickText("נועה");
  await page.locator('header [aria-label="תמונת פרופיל"]').click();
  await page.locator("#face").setInputFiles(jpeg);
  await page.waitForSelector("header .face img");
  if (await page.locator('.card [aria-label="תמונת פרופיל"]').count()) throw new Error("student can edit another photo");
  await page.locator('[aria-label="החלפת דמות"]').click();
  const faces = await page.locator(".person img").count();
  if (faces < 2) throw new Error("picker photos " + faces);
  await page.screenshot({ path: "/opt/cursor/artifacts/avatar_picker.png" });
  await layout("avatar picker");
  await axe("avatar picker");
  record("profile photos show on the character picker", true);

  await openScenario("שיחה עם עוזר הכיתה");
  const fab = page.locator(".helperfab");
  if ((await fab.count()) !== 1) throw new Error("student fab");
  await page.emulateMedia({ reducedMotion: "reduce" });
  const still = await page.locator(".helperfab .eye").first().evaluate((el) => getComputedStyle(el).animationName);
  if (still !== "none") throw new Error("reduced motion " + still);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const digest = await page.locator(".digest").innerText();
  if (!digest.includes("עמ׳ 18") || !digest.includes("קריאה") || !digest.includes("כתיב") || !digest.includes("מבחן ביום א׳")) throw new Error(digest);
  if (digest.includes("שיחת הורים") || digest.includes("עומר") || digest.includes("סיימתי")) throw new Error(digest);
  const badge = Number(await page.locator(".ping").innerText());
  if (!(badge > 0)) throw new Error("badge " + badge);
  await page.locator(".digest").screenshot({ path: "/opt/cursor/artifacts/digest_student.png" });
  await fab.click();
  await page.waitForSelector(".chatsheet");
  if (await page.locator("[data-act='helper-face']").count()) throw new Error("student can restyle the helper");
  const hint = await page.locator(".chatsheet .hint").innerText();
  if (!hint.includes("דיבור") && !hint.includes("שירות דיבור")) throw new Error(hint);
  await clickText("מה יש למחר?");
  const tomorrow = await page.locator(".bubble.bot").last().innerText();
  if (!tomorrow.includes("עמ׳ 18") || !tomorrow.includes("קריאה") || tomorrow.includes("שיחת הורים")) throw new Error(tomorrow);
  if (!(await page.locator(".bubble.bot img").count())) throw new Error("missing homework photo");
  if (!(await page.locator('.bubble.bot [aria-label="השמעה"]').count())) throw new Error("missing voice button");
  await page.screenshot({ path: "/opt/cursor/artifacts/helper_student.png" });
  await layout("helper student");
  await axe("helper student");
  await page.locator('.askbox input[name="q"]').fill('<img src=x onerror="window.__xss=1">');
  await clickText("שאל");
  const typed = await page.evaluate(() => {
    const mine = [...document.querySelectorAll(".bubble.me")];
    const last = mine[mine.length - 1];
    return {
      flag: window.__xss || "",
      images: document.querySelectorAll(".bubble.me img").length,
      text: last ? last.textContent : ""
    };
  });
  if (typed.flag || typed.images || !typed.text.includes("<img")) throw new Error(JSON.stringify(typed));
  const stored = await page.evaluate(() => localStorage.getItem("nohw-simple-demo") || "");
  if (stored.includes("__xss") || stored.includes("onerror")) throw new Error("chat was stored");
  await page.locator('.askbox input[name="q"]').fill("מה נשאר לעומר");
  await clickText("שאל");
  const denied = await page.locator(".bubble.bot").last().innerText();
  if (!denied.includes("אני יודע רק מה שקשור לכיתה") || denied.includes("עומר")) throw new Error(denied);
  await clickText("מה המורה שלחה?");
  const sent = await page.locator(".bubble.bot").last().innerText();
  if (!sent.includes("מבחן ביום א׳") || sent.includes("שיחת הורים")) throw new Error(sent);
  record("student helper answers stay inside the class", true);

  await page.locator('[aria-label="סגירה"]').click();
  if (await page.locator(".ping").count()) throw new Error("badge stayed after the digest was seen");
  await page.context().grantPermissions(["notifications"]);
  await fab.click();
  await clickText("תזכורות");
  if (!(await page.locator(".remindset .hint").innerText()).includes("דורשת שרת")) throw new Error("missing reminder note");
  await clickText("הצג עכשיו");
  await page.locator('[aria-label="סגירה"]').click();
  await page.waitForSelector(".remindbar");
  await page.waitForSelector(".sysnote");
  const banner = await page.locator(".remindbar").innerText();
  if (!banner.includes("כתיב") || banner.includes("עומר") || banner.includes("נשלח")) throw new Error(banner);
  await page.locator(".remindbar").screenshot({ path: "/opt/cursor/artifacts/reminder_banner.png" });
  await page.locator(".sysnote").screenshot({ path: "/opt/cursor/artifacts/reminder_notification.png" });
  const notes = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const list = typeof reg.getNotifications === "function" ? await reg.getNotifications() : [];
    return list.map((item) => item.body || "");
  });
  if (!notes.some((item) => item.includes("כתיב"))) throw new Error("notification " + notes.join("|"));
  record("evening reminder banner and notification", true);
  await fab.click();
  await page.locator('.askbox input[name="q"]').fill("תזכיר לי ב-18:00 על חשבון");
  await clickText("שאל");
  const reminded = await page.locator(".bubble.bot").last().innerText();
  if (!reminded.includes("18:00") || !reminded.includes("חשבון")) throw new Error(reminded);
  const reminderStore = await page.evaluate(() => ({
    assist: localStorage.getItem("nohw-simple-assist") || "",
    demo: localStorage.getItem("nohw-simple-demo") || ""
  }));
  if (!reminderStore.assist.includes("18:00") || !reminderStore.assist.includes("חשבון") || reminderStore.demo.includes("תזכיר לי")) throw new Error("reminder storage");
  await page.locator('.askbox input[name="q"]').fill('תזכיר לי ב-18:00 על <img src=x onerror="window.__xss=1">');
  await clickText("שאל");
  const remindedXss = await page.evaluate(() => {
    const last = [...document.querySelectorAll(".bubble.bot")].pop();
    return { flag: window.__xss || "", images: last ? last.querySelectorAll("img").length : -1, text: last ? last.textContent : "" };
  });
  if (remindedXss.flag || remindedXss.images || !remindedXss.text.includes("<img")) throw new Error(JSON.stringify(remindedXss));
  record("custom reminder stays text", true);

  await page.locator('[aria-label="סגירה"]').click();
  await page.locator('[aria-label="החלפת דמות"]').click();
  await clickText("יעל");
  if ((await fab.count()) !== 1) throw new Error("parent fab");
  const parentDigest = await page.locator(".digest").innerText();
  if (!parentDigest.includes("נועה") || !parentDigest.includes("שיחת הורים") || parentDigest.includes("עומר")) throw new Error(parentDigest);
  await page.locator(".digest").screenshot({ path: "/opt/cursor/artifacts/digest_parent.png" });
  await fab.click();
  await clickText("מה המצב?");
  const parentStatus = await page.locator(".bubble.bot").last().innerText();
  if (!parentStatus.includes("נועה") || parentStatus.includes("עומר")) throw new Error(parentStatus);
  await clickText("מה נשלח?");
  const parentNote = await page.locator(".bubble.bot").last().innerText();
  if (!parentNote.includes("שיחת הורים ביום ג׳") || !parentNote.includes("מבחן ביום א׳")) throw new Error(parentNote);
  await page.screenshot({ path: "/opt/cursor/artifacts/helper_parent.png" });
  await layout("helper parent");
  await axe("helper parent");
  record("parent helper includes their kid and parents-only notes", true);

  await page.locator('[aria-label="סגירה"]').click();
  await page.locator('[aria-label="החלפת דמות"]').click();
  await clickText("מיכל");
  const teacherDigest = await page.locator(".digest").innerText();
  if (!teacherDigest.includes("מקצוע אחד לא עודכן") || !teacherDigest.includes("אנגלית") || !teacherDigest.includes("נועה") || !teacherDigest.includes("עומר") || !teacherDigest.includes("סיימתי")) throw new Error(teacherDigest);
  await page.locator(".digest").screenshot({ path: "/opt/cursor/artifacts/digest_teacher.png" });
  await fab.click();
  if ((await page.locator("[data-act='helper-face']").count()) < 4) throw new Error("teacher cannot set the face");
  await clickText("מה עוד לא פורסם?");
  const unposted = await page.locator(".bubble.bot").last().innerText();
  if (!unposted.includes("אנגלית")) throw new Error(unposted);
  await clickText("מי עוד לא סיים?");
  const waiting = await page.locator(".bubble.bot").last().innerText();
  if (!waiting.includes("נועה") || !waiting.includes("עומר")) throw new Error(waiting);
  await page.screenshot({ path: "/opt/cursor/artifacts/helper_teacher.png" });
  await clickText("נסח תזכורת");
  await clickText("פתח בטיוטה");
  const draft = await page.locator('input[name="text"]').inputValue();
  if (!draft.includes("תזכורת") || !draft.includes("עומר") || !draft.includes("נועה")) throw new Error(draft);
  if ((await page.locator("body").innerText()).includes("נשלח")) throw new Error("draft was sent");
  record("teacher helper drafts a reminder without sending", true);

  await page.locator('[aria-label="החלפת דמות"]').click();
  await clickText("דנה");
  if ((await fab.count()) !== 1) throw new Error("principal home helper");
  const schoolDigest = await page.locator(".digest").innerText();
  if (!schoolDigest.includes("לא עודכן") || !schoolDigest.includes("הוכן") || schoolDigest.includes("נועה") || schoolDigest.includes("עומר")) throw new Error(schoolDigest);
  await clickText("ה'2");
  if ((await fab.count()) !== 1) throw new Error("principal drill-down fab");
  await fab.click();
  await clickText("מה מצב הכיתה?");
  const klass = await page.locator(".bubble.bot").last().innerText();
  if (!klass.includes("פורסם") || !klass.includes("הוכן") || klass.includes("נועה") || klass.includes("עומר")) throw new Error(klass);
  await layout("helper principal");
  await axe("helper principal");
  record("principal helper reports the class without child names", true);

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
