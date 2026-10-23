// Phone e2e (390x844) with synthetic data only. Usage: node server.mjs & node tests/e2e.mjs [outDir]
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.BASE || "http://localhost:8787/";
const OUT = process.argv[2] || "/workspace/nohw-v1-shots";
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/usr/bin/google-chrome", headless: true });
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "he-IL", timezoneId: "Asia/Jerusalem" };
const shot = async (p, name) => { await p.addStyleTag({ content: ".tabs,.top{position:static!important}#toast{display:none}" }); await p.screenshot({ path: path.join(OUT, name), fullPage: true }); };
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("✓", m); };

// ---- guardian A ----
const A = await browser.newContext(phone);
const a = await A.newPage();
a.on("pageerror", (e) => console.log("pageerror A", e.message));
await a.goto(BASE + "#settings");
await a.fill("#meName2", "אבא");
await a.fill("#child", "יעל · ד'2");
await a.click("[data-act=saveProfile]");
await a.click("[data-act=demoTT]");
await a.click("[data-act=newFamily]");
const code = (await a.textContent("#famCode")).trim();
ok(/^[A-Z2-9]{8}$/.test(code), "family code created");

// 1) paste a synthetic forwarded post
await a.goto(BASE + "#add");
await a.click("[data-act=demoPaste]");
await a.selectOption("#sender", "teacher");
await a.click("[data-act=extract]");
await a.waitForSelector("#extractOut h2");
const added = await a.textContent("#extractOut h2");
ok(/נוספו [1-9]/.test(added), "paste extracted items: " + added);
await shot(a, "1-paste-extract.png");

// 2) simulate Android share target (WhatsApp -> Share -> app): multipart POST handled by the service worker
await a.waitForFunction(() => navigator.serviceWorker.getRegistration().then((r) => !!r?.active), null, { timeout: 15000 });
if (!(await a.evaluate(() => !!navigator.serviceWorker.controller))) await a.reload();
await a.waitForFunction(() => !!navigator.serviceWorker.controller);
const img = fs.readFileSync(new URL("../seed/notebook-1.jpg", import.meta.url)).toString("base64");
const status = await a.evaluate(async (b64) => {
  const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const fd = new FormData();
  fd.append("text", "שיעורי בית בחשבון: עמוד 52 תרגילים 1-3 לשיעור הבא");
  fd.append("media", new File([bin], "IMG-0001.jpg", { type: "image/jpeg" }));
  const r = await fetch("./share-target", { method: "POST", body: fd, redirect: "manual" });
  return r.type === "opaqueredirect" ? 303 : r.status;
}, img);
ok(status === 303 || status === 200, "share-target POST accepted by service worker");
await a.goto(BASE + "?share=1#add");
await a.waitForFunction(() => document.querySelector("#extractOut h2"), null, { timeout: 15000 });
await a.waitForSelector(".thumbs img");
ok(true, "shared text + photo landed and was extracted: " + (await a.textContent("#extractOut h2")));
await shot(a, "2-share-target-photo.png");

// 3) load the synthetic class posts and open tonight
await a.goto(BASE + "#settings");
await a.click("[data-act=seed]");
await a.waitForFunction(() => location.hash === "#tonight" && document.querySelectorAll(".card").length > 8);
await a.waitForTimeout(500);
const pick = (sel) => a.evaluate((s) => { const c = document.querySelector(s); return { id: c.dataset.id, text: c.querySelector(".txt").textContent.trim() }; }, sel);
const { id: bringId, text: bringText } = await pick(".card.bring");
await a.click(`[data-id="${bringId}"] input[type=checkbox]`);
await a.waitForFunction((t) => [...document.querySelectorAll(".card.done .txt")].some((x) => x.textContent.trim() === t), bringText);
const { id: hwId, text: hwText } = await pick(".card.homework");
await a.click(`[data-id="${hwId}"] input[type=checkbox]`);
await a.waitForFunction((t) => [...document.querySelectorAll(".card.done .txt")].some((x) => x.textContent.trim() === t), hwText);
await a.waitForTimeout(1500);
await a.evaluate(() => window.scrollTo(0, 0));
await shot(a, "3-tonight-guardian-A.png");

// ---- guardian B joins through the family link ----
const B = await browser.newContext(phone);
const b = await B.newPage();
b.on("pageerror", (e) => console.log("pageerror B", e.message));
await b.goto(BASE + "?family=" + code + "#tonight");
await b.fill("#meName", "אמא");
await b.click("[data-act=setMe]");
await b.waitForFunction((t) => [...document.querySelectorAll(".card.done .txt")].some((x) => x.textContent.trim() === t), bringText, { timeout: 15000 });
const doneBy = await b.locator(".card.done .by").first().textContent();
ok(doneBy.includes("אבא"), "guardian B sees A's check: " + doneBy.trim());
ok(await b.evaluate((t) => [...document.querySelectorAll(".card.done .txt")].some((x) => x.textContent.trim() === t), hwText), "homework done state synced too");
// B handles the parent action; A should see it
const actId = await b.evaluate(() => document.querySelector(".card.action").dataset.id);
await b.click(`[data-id="${actId}"] input[type=checkbox]`);
await b.waitForTimeout(1200);
await shot(b, "4-tonight-guardian-B.png");
await a.reload();
await a.waitForFunction(() => [...document.querySelectorAll(".card.action .by")].some((x) => x.textContent.includes("אמא")), null, { timeout: 15000 });
ok(true, "guardian A sees B's 'handled' on the parent action");

// morning view sanity (no screenshot needed)
await a.goto(BASE + "#morning");
ok((await a.locator(".daybar").count()) === 1, "morning view renders");
await browser.close();
console.log("screenshots in", OUT);
