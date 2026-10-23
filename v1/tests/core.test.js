import test from "node:test";
import assert from "node:assert/strict";
import { extractRules, postsFromExport, dateHints, nextSchoolDay, unzipText } from "../lib/core.js";
import { mergeDocs, newCode, CODE_RE } from "../lib/merge.js";
import { DEMO_TIMETABLE, demoPosts } from "../seed/synthetic.js";

const tt = DEMO_TIMETABLE; // Sun..Fri
const FRI = "2026-10-23", SUN = "2026-10-25";
const types = (r) => r.items.map((i) => i.type).sort().join(",");

test("tomorrow from Friday is Sunday", () => assert.equal(nextSchoolDay(FRI, tt), SUN));

test("teacher timetable post -> timetable + bring + homework, due tomorrow", () => {
  const r = extractRules({ sender: "teacher", date: FRI, text: demoPosts(FRI)[0].text }, { timetable: tt });
  const t = r.items.find((i) => i.type === "timetable");
  assert.equal(t.due, SUN);
  assert.deepEqual(t.extra.lessons, ["שפה", "חשבון", "אנגלית", "תורה"]);
  assert.ok(r.items.filter((i) => i.type === "bring").length >= 4);
  assert.ok(r.items.some((i) => i.type === "homework" && i.subject === "חשבון"));
});

test("multi-point parent post -> bring+notice, action due Thursday", () => {
  const r = extractRules({ sender: "teacher", date: FRI, text: demoPosts(FRI)[1].text }, { timetable: tt });
  assert.match(types(r), /action/); assert.match(types(r), /bring/); assert.match(types(r), /notice/);
  assert.equal(r.items.find((i) => i.type === "action").due, "2026-10-29");
});

test("time change", () => {
  const r = extractRules({ sender: "teacher", date: FRI, text: "*עדכון חשוב:* אסיפת ההורים ביום שלישי תתקיים בשעה 18:00 במקום 17:00." }, { timetable: tt });
  assert.equal(r.items[0].type, "change"); assert.equal(r.items[0].due, "2026-10-27");
});

test("kid caption with child spelling and 'next lesson' resolves via timetable", () => {
  const r = extractRules({ sender: "student", date: FRI, photos: 1, text: "חשבון אמוד 52 סהיף 3 לשיעור הבא" }, { timetable: tt });
  assert.equal(r.items[0].type, "homework"); assert.equal(r.items[0].subject, "חשבון"); assert.equal(r.items[0].due, SUN); assert.equal(r.items[0].needsConfirm, false);
});

test("lesson-note photo is dropped; uncaptioned photo needs confirmation; greeting ignored", () => {
  assert.equal(extractRules({ date: FRI, photos: 2, text: "אנגלית" }, { timetable: tt }).kind, "lesson_notes");
  const c = extractRules({ date: FRI, photos: 1, text: "" }, { timetable: tt });
  assert.equal(c.items[0].needsConfirm, true);
  assert.equal(extractRules({ date: FRI, text: "מזל טוב לנועה ליום הולדתה! 🎉" }).kind, "social");
});

test("homework without subject asks instead of guessing", () => {
  const r = extractRules({ sender: "student", date: FRI, text: "עמודים 30-31 לסים בבית" }, { timetable: tt });
  assert.equal(r.items[0].needsConfirm, true);
});

test("explicit dates", () => {
  assert.deepEqual(dateHints("להגיש עד ליום ראשון ה-18.10.26").find((h) => h.hint === "explicit"), { hint: "explicit", day: 18, month: 10, year: 2026 });
  const r = extractRules({ sender: "teacher", date: "2026-10-08", text: "את המשימה יש להגיש עד ליום ראשון ה-18.10.26." }, { timetable: tt });
  assert.equal(r.items[0].due, "2026-10-18");
});

test("WhatsApp export: Android + iOS lines, photo burst linked to caption", () => {
  const txt = [
    "22.10.2026, 12:40 - ילד א: IMG-1.jpg (קובץ מצורף)",
    "22.10.2026, 12:40 - ילד א: IMG-2.jpg (קובץ מצורף)",
    "22.10.2026, 12:41 - ילד א: עמודים 10-11 בהנדסה",
    "22.10.2026, 16:00 - המורה דנה: מחר יש להביא כובע",
    "ובקבוק מים",
  ].join("\n");
  const p = postsFromExport(txt);
  assert.equal(p.length, 2); assert.equal(p[0].photos, 2); assert.equal(p[0].sender, "student"); assert.equal(p[1].sender, "teacher");
  assert.match(p[1].text, /בקבוק/);
  const ios = postsFromExport("[22/10/2026, 16:00:01] Dana: מחר יש להביא כובע");
  assert.equal(ios[0].date, "2026-10-22");
});

test("zip reader (stored + deflate)", async () => {
  const { execSync } = await import("node:child_process");
  const fs = await import("node:fs");
  fs.mkdirSync("/tmp/nohwzip", { recursive: true });
  fs.writeFileSync("/tmp/nohwzip/chat.txt", "22.10.2026, 16:00 - מורה: מחר יש להביא כובע\n".repeat(20));
  execSync(`python3 -c "import zipfile;z=zipfile.ZipFile('/tmp/nohwzip/a.zip','w',zipfile.ZIP_DEFLATED);z.write('/tmp/nohwzip/chat.txt','WhatsApp Chat.txt');z.close()"`);
  const t = await unzipText(fs.readFileSync("/tmp/nohwzip/a.zip"));
  assert.match(t, /להביא כובע/);
});

test("family merge: last writer wins per item; codes", () => {
  const a = { meta: { u: 1 }, items: { x: { id: "x", u: 1, done: null } } };
  const b = { meta: { u: 2, child: "y" }, items: { x: { id: "x", u: 5, done: { by: "אבא" } }, z: { id: "z", u: 1 } } };
  const m = mergeDocs(a, b);
  assert.equal(m.items.x.done.by, "אבא"); assert.ok(m.items.z); assert.equal(m.meta.child, "y");
  assert.equal(mergeDocs(m, a).items.x.done.by, "אבא");
  assert.match(newCode(), CODE_RE);
});
