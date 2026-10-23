const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../simple/logic.js");
const D = require("../simple/demo.js");
const A = require("../simple/assistant.js");

const today = "2026-10-23";
const tomorrow = "2026-10-25";
assert.equal(S.nextSchoolDay(today), tomorrow);
assert.equal(S.nextSchoolDay("2026-10-22"), today);
assert.equal(S.nextSchoolDay("2026-10-24"), tomorrow);
assert.equal(S.nextSchoolDay(""), "");

const source = fs.readFileSync(path.join(__dirname, "..", "simple", "assistant.js"), "utf8");
assert.equal(/fetch\s*\(|XMLHttpRequest|WebSocket|api[_-]?key|openai|anthropic/i.test(source), false);
const app = fs.readFileSync(path.join(__dirname, "..", "simple", "app.js"), "utf8");
assert.match(app, /textContent/);
assert.match(app, /paintChat/);
assert.equal(/localStorage\.setItem\([\s\S]{0,120}chatLog/.test(app), false);

const pack = D.scenarioById("helper", today);
const state = pack.state;
const room = state.schools[0].classrooms[0];
assert.deepEqual(S.helperOf(room), { face: "fox", name: "שועל הכיתה" });
assert.deepEqual(S.helperOf({}), { face: "sun", name: "עוזר הכיתה" });

function who(id) {
  return pack.people.find((item) => item.id === id);
}
const noa = who("s-k-noa");
const yael = who("par-yael");
const michal = who("t-c-h2");
const dana = who("p-s-alon");
const admin = who("admin");

assert.deepEqual(A.chips("student").map((item) => item.label), ["מה יש למחר?", "מה נשאר לי?", "מה המורה שלחה?", "איזה שיעורים מחר?", "איך הרצף שלי?"]);
assert.deepEqual(A.chips("parent").map((item) => item.label), ["מה המצב?", "מה עוד לא הוכן?", "מה נשלח?", "סיכום השבוע"]);
assert.deepEqual(A.chips("teacher").map((item) => item.label), ["מה עוד לא פורסם?", "מי עוד לא סיים?", "מה שלחתי?", "נסח תזכורת"]);
assert.deepEqual(A.chips("principal").map((item) => item.label), ["מה מצב הכיתה?"]);
assert.deepEqual(A.chips("admin"), A.chips("principal"));

const phrases = {
  student: [
    ["tomorrow-lessons", "איזה שיעורים מחר?"],
    ["tomorrow-lessons", "אילו שיעורים יש מחר"],
    ["tomorrow-lessons", "מה במערכת מחר"],
    ["tomorrow-work", "מה יש למחר?"],
    ["tomorrow-work", "שיעורי בית למחר"],
    ["tomorrow-work", "מה יש מחר"],
    ["left", "מה נשאר לי?"],
    ["left", "מה עוד לא סיימתי"],
    ["messages", "מה המורה שלחה?"],
    ["messages", "אילו הודעות שלחה המורה"],
    ["streak", "איך הרצף שלי?"],
    ["streak", "כמה הרצף שלי"]
  ],
  parent: [
    ["status", "מה המצב?"],
    ["status", "איך הולך עם השיעורים"],
    ["left", "מה עוד לא הוכן?"],
    ["left", "מה נשאר להכין"],
    ["messages", "מה נשלח?"],
    ["messages", "יש הודעות חדשות?"],
    ["week", "סיכום השבוע"],
    ["week", "מה היה השבוע"]
  ],
  teacher: [
    ["remind", "נסח תזכורת"],
    ["remind", "תנסח לי תזכורת"],
    ["unposted", "מה עוד לא פורסם?"],
    ["unposted", "מה עוד לא פורסם היום"],
    ["unfinished", "מי עוד לא סיים?"],
    ["unfinished", "מי לא סיים"],
    ["messages", "מה שלחתי?"],
    ["messages", "הודעות ששלחתי"]
  ],
  principal: [
    ["status", "מה מצב הכיתה?"],
    ["status", "מה המצב היום"]
  ]
};
for (const [role, rows] of Object.entries(phrases)) {
  for (const [intent, text] of rows) assert.equal(A.match(role, text), intent, role + " " + text);
}
assert.equal(A.match("admin", "סטטוס הכיתה"), "status");
assert.equal(A.match("student", "מי עוד לא סיים"), "");
assert.equal(A.match("student", "ספר לי בדיחה"), "");

function ask(person, extra) {
  return A.ask(state, Object.assign({ classId: room.id }, person), Object.assign({ today }, extra));
}

const work = ask(noa, { intent: "tomorrow-work" });
assert.equal(work.intent, "tomorrow-work");
assert.match(work.text, /עמ׳ 18/);
assert.match(work.text, /קריאה/);
assert.match(work.text, /מדעים: לא עודכן/);
assert.equal(work.text.includes("עומר"), false);
assert.equal(work.text.includes("שיחת הורים"), false);
assert.equal(work.photos.length, 1);
assert.match(work.photos[0].src, /^data:image\//);
assert.equal(work.voices.length, 1);
assert.equal(work.voices[0].text, "עמ׳ שמונה עשרה");
assert.equal(ask(noa, { text: "שיעורי בית למחר" }).text, work.text);

const lessons = ask(noa, { text: "איזה שיעורים מחר?" });
assert.match(lessons.text, /חשבון/);
assert.match(lessons.text, /עברית/);
assert.match(lessons.text, /מדעים/);
assert.equal(lessons.text.includes("אנגלית"), false);

const left = ask(noa, { text: "מה נשאר לי?" });
assert.match(left.text, /עברית: כתיב/);
assert.equal(left.text.includes("עמ׳ 12"), false);
assert.equal(left.text.includes("עומר"), false);

const note = ask(noa, { text: "מה המורה שלחה?" });
assert.match(note.text, /מבחן ביום א׳/);
assert.equal(note.text.includes("שיחת הורים"), false);
assert.equal(note.text.includes("סיימתי"), false);
assert.equal(note.photos.length, 0);
assert.equal(S.messagesFor(room, "student").some((item) => item.text === "סיימתי את החשבון"), false);
assert.equal(S.messagesFor(room, "teacher").some((item) => item.from === "student" && item.kidId === "k-omer"), true);
assert.equal(S.messagesFor(room, "parent", { kidId: "k-omer" }).some((item) => item.text === "סיימתי את החשבון"), true);

const streak = ask(noa, { text: "איך הרצף שלי?" });
assert.match(streak.text, /הרצף שלך: 2/);
assert.match(streak.text, /היום הוכנו 1 מתוך 2/);

const other = ask(noa, { text: "מה נשאר לעומר" });
assert.equal(other.intent, "");
assert.equal(other.text, A.FALLBACK);
assert.equal(other.text.includes("עומר"), false);
assert.equal(other.photos.length, 0);
assert.equal(ask(noa, { text: "מי עוד לא סיים" }).text, A.FALLBACK);
assert.equal(ask(noa, { intent: "left", text: "עומר" }).text, A.FALLBACK);

const status = ask(yael, { text: "מה המצב?" });
assert.match(status.text, /נועה:/);
assert.match(status.text, /עמ׳ 12/);
assert.match(status.text, /הוכן/);
assert.match(status.text, /כתיב/);
assert.equal(status.text.includes("עומר"), false);
const parentLeft = ask(yael, { text: "מה עוד לא הוכן?" });
assert.match(parentLeft.text, /כתיב/);
assert.equal(parentLeft.text.includes("עומר"), false);
const parentNote = ask(yael, { text: "מה נשלח?" });
assert.match(parentNote.text, /מבחן ביום א׳/);
assert.match(parentNote.text, /שיחת הורים ביום ג׳/);
assert.equal(parentNote.photos.length, 1);
const week = ask(yael, { text: "סיכום השבוע" });
assert.match(week.text, /נועה השבוע: 3 הוכנו מתוך 4/);
assert.equal(ask(yael, { text: "מה המצב של עומר" }).text, A.FALLBACK);

const missing = ask(michal, { text: "מה עוד לא פורסם?" });
assert.match(missing.text, /אנגלית/);
assert.equal(missing.text.includes("חשבון"), false);
const waiting = ask(michal, { text: "מי עוד לא סיים?" });
assert.match(waiting.text, /נועה: עברית/);
assert.match(waiting.text, /עומר: חשבון, עברית/);
const sent = ask(michal, { text: "מה שלחתי?" });
assert.match(sent.text, /מבחן ביום א׳/);
assert.match(sent.text, /שיחת הורים ביום ג׳/);
const draft = ask(michal, { text: "נסח תזכורת" });
assert.match(draft.text, /ידנית/);
assert.match(draft.draft, /^תזכורת: עוד לא הוכן — נועה: עברית; עומר: חשבון, עברית\.$/);
assert.equal(draft.text.includes(draft.draft), true);

const klass = ask(Object.assign({ classId: room.id }, dana), { text: "מה מצב הכיתה?" });
assert.match(klass.text, /ה'2 היום/);
assert.match(klass.text, /פורסם 2/);
assert.match(klass.text, /לא עודכן 1/);
assert.match(klass.text, /אין שיעורים 1/);
assert.match(klass.text, /הוכן 1 מתוך 4/);
assert.equal(klass.text.includes("נועה"), false);
assert.equal(klass.text.includes("עומר"), false);
assert.equal(ask(Object.assign({ classId: room.id }, admin), { intent: "status" }).text, klass.text);
const schoolAsk = A.ask(state, dana, { text: "מה מצב הכיתה?", today });
assert.equal(schoolAsk.intent, "status");
assert.match(schoolAsk.text, /מקצוע אחד לא עודכן/);
assert.match(schoolAsk.text, /25%/);
assert.equal(schoolAsk.text.includes("נועה"), false);
assert.equal(schoolAsk.text.includes("עומר"), false);

const unknown = ask(noa, { text: "תכתוב לי שיר" });
assert.equal(unknown.text, "אני יודע רק מה שקשור לכיתה 😊");
assert.equal(unknown.chips.length, 5);
assert.equal(unknown.draft, "");

const payload = '<img src=x onerror="window.__xss=1">';
const dirty = JSON.parse(JSON.stringify(state));
dirty.schools[0].classrooms[0].homework[tomorrow]["חשבון"].text = payload;
const leaked = A.ask(dirty, noa, { intent: "tomorrow-work", today });
assert.equal(leaked.text.includes(payload), true);
assert.equal(leaked.text.includes("&lt;"), false);
assert.equal(typeof leaked.text, "string");

const studentActor = D.personActor(state, noa);
const teacherActor = D.personActor(state, michal);
assert.throws(() => S.setHelper(state, studentActor, { classId: room.id, face: "moon", name: "<b>רע</b>" }), /forbidden/);
const named = S.setHelper(state, teacherActor, { classId: room.id, face: "nope", name: "<script>alert(1)</script> שם ארוך מדי" });
assert.equal(named.face, "fox");
assert.equal(named.name.length <= 24, true);
assert.equal(named.name.includes("<script>"), true);
assert.deepEqual(room.helper, named);
const parentActor = D.personActor(state, yael);
assert.equal(parentActor.role, "parent");
assert.throws(() => S.setHelper(state, { role: "parent" }, { classId: room.id, name: "הורה" }), /forbidden/);

const imported = S.emptyState();
S.importPack(imported, { v: 1, schools: [{ id: "s", name: "אלון", principalName: "דנה", classrooms: [{ id: "c", name: "ה'2", teacherName: "מ", helper: { face: "javascript:alert(1)", name: "<img src=x onerror=alert(1)>" }, kids: [] }] }] });
assert.equal(imported.schools[0].classrooms[0].helper.face, "sun");
assert.equal(imported.schools[0].classrooms[0].helper.name.includes("<img"), true);
const round = S.packFor(state, "student", D.findKid(state, "k-noa").kid.kidCode);
assert.equal(round.schools[0].classrooms[0].helper.face, "fox");
assert.equal(JSON.stringify(round).includes("profile"), false);

const two = D.scenarioById("two", today);
const yaelTwo = two.people.find((item) => item.id === "par-yael");
const both = A.ask(two.state, yaelTwo, { intent: "status", today });
assert.match(both.text, /נועה:/);
assert.match(both.text, /תמר:/);
assert.equal(both.text.includes("עידו"), false);

function personWho(item) {
  return { role: item.role, classId: item.classId || "", schoolId: item.schoolId || "", kidId: item.kidId || "", kidIds: item.kidIds || [] };
}
const studentCard = A.digest(state, personWho(noa), { today });
assert.deepEqual(studentCard.items.map((item) => item.id), ["tomorrow", "left", "messages"]);
assert.match(studentCard.items[0].text, /עמ׳ 18/);
assert.match(studentCard.items[0].text, /קריאה/);
assert.match(studentCard.items[0].text, /חשבון/);
assert.equal(studentCard.items[0].photos.length, 1);
assert.deepEqual(studentCard.items[1].progress, { done: 1, total: 2 });
assert.match(studentCard.items[1].text, /כתיב/);
assert.match(studentCard.items[2].text, /מבחן ביום א׳/);
const studentBlob = JSON.stringify(studentCard);
assert.equal(studentBlob.includes("עומר"), false);
assert.equal(studentBlob.includes("שיחת הורים"), false);
assert.equal(studentBlob.includes("סיימתי"), false);
assert.equal(studentCard.items.some((item) => item.id === "cheer"), false);

const doneCopy = JSON.parse(JSON.stringify(state));
doneCopy.schools[0].classrooms[0].kids[0].done[today]["עברית"] = true;
const cheered = A.digest(doneCopy, personWho(noa), { today });
assert.equal(cheered.items.some((item) => item.id === "left"), false);
assert.match(cheered.items.find((item) => item.id === "cheer").text, /כל הכבוד, הכול הוכן היום/);
assert.deepEqual(cheered.items.find((item) => item.id === "cheer").progress, { done: 2, total: 2 });
assert.equal(A.reminderDue(doneCopy, personWho(noa), { today, time: "17:00" }), null);
assert.equal(A.reminderDue(doneCopy, personWho(yael), { today, time: "19:00" }), null);

const parentCard = A.digest(state, personWho(yael), { today });
assert.deepEqual(parentCard.items.map((item) => item.id), ["kid:k-noa:status", "kid:k-noa:tomorrow", "kid:k-noa:messages", "kid:k-noa:week"]);
assert.match(parentCard.items[0].text, /נועה: הוכנו 1 מתוך 2/);
assert.match(parentCard.items[1].text, /קריאה/);
assert.match(parentCard.items[2].text, /מבחן ביום א׳/);
assert.match(parentCard.items[2].text, /שיחת הורים ביום ג׳/);
assert.match(parentCard.items[3].text, /נועה השבוע: 3 הוכנו מתוך 4/);
assert.equal(JSON.stringify(parentCard).includes("עומר"), false);
assert.equal(JSON.stringify(parentCard).includes("סיימתי"), false);

const teacherCard = A.digest(state, personWho(michal), { today });
assert.deepEqual(teacherCard.items.map((item) => item.id), ["unposted", "unfinished", "replies", "draft"]);
assert.equal(teacherCard.items[0].title, "מקצוע אחד לא עודכן");
assert.match(teacherCard.items[0].text, /אנגלית/);
assert.equal(teacherCard.items[0].text.includes("חשבון"), false);
assert.match(teacherCard.items[1].text, /נועה: עברית/);
assert.match(teacherCard.items[1].text, /עומר: חשבון, עברית/);
assert.match(teacherCard.items[2].text, /סיימתי את החשבון/);
assert.match(teacherCard.items[3].text, /^תזכורת: עוד לא הוכן — נועה: עברית; עומר: חשבון, עברית\.$/);
const twoSubjects = JSON.parse(JSON.stringify(state));
delete twoSubjects.schools[0].classrooms[0].homework[today]["מדעים"];
const wider = A.digest(twoSubjects, personWho(michal), { today });
assert.equal(wider.items[0].title, "2 מקצועות לא עודכנו");
assert.match(wider.items[0].text, /אנגלית/);
assert.match(wider.items[0].text, /מדעים/);

const principalCard = A.digest(state, personWho(dana), { today });
assert.match(principalCard.items.map((item) => item.title).join(" "), /ה'2/);
assert.match(principalCard.items.map((item) => item.text).join("\n"), /מקצוע אחד לא עודכן/);
assert.match(principalCard.items.map((item) => item.text).join("\n"), /הוכן 25% \(1 מתוך 4\)/);
assert.equal(JSON.stringify(principalCard).includes("נועה"), false);
assert.equal(JSON.stringify(principalCard).includes("עומר"), false);
const adminCard = A.digest(state, personWho(admin), { today });
assert.match(adminCard.items[0].text, /אלון: מקצוע אחד לא עודכן/);
assert.equal(JSON.stringify(adminCard).includes("נועה"), false);

const studentDue = A.reminderDue(state, personWho(noa), { today, time: "17:00" });
assert.match(studentDue.body, /כתיב/);
assert.equal(studentDue.body.includes("עומר"), false);
assert.equal(studentDue.id, "student:" + today + ":17:00");
const parentDue = A.reminderDue(state, personWho(yael), { today, time: "19:00" });
assert.match(parentDue.body, /נועה/);
assert.match(parentDue.body, /כתיב/);
assert.equal(parentDue.body.includes("עומר"), false);
const teacherDue = A.reminderDue(state, personWho(michal), { today, time: "15:00" });
assert.match(teacherDue.body, /אנגלית/);
assert.equal(teacherDue.body.includes("נשלח"), false);
const postedCopy = JSON.parse(JSON.stringify(state));
postedCopy.schools[0].classrooms[0].homework[today]["אנגלית"] = { mode: "post", text: "עמוד" };
assert.equal(A.reminderDue(postedCopy, personWho(michal), { today, time: "15:00" }), null);
postedCopy.schools[0].classrooms[0].homework[today]["אנגלית"] = { mode: "none" };
assert.equal(A.reminderDue(postedCopy, personWho(michal), { today, time: "15:00" }), null);

assert.deepEqual(A.defaults("student"), { on: true, time: "17:00" });
assert.deepEqual(A.defaults("parent"), { on: true, time: "19:00" });
assert.deepEqual(A.defaults("teacher"), { on: true, time: "15:00" });
assert.equal(A.defaults("principal"), null);
assert.deepEqual(A.parseWhen("תזכיר לי ב-18:00 על חשבון"), { time: "18:00", about: "חשבון" });
assert.deepEqual(A.parseWhen("תזכירי לי בשעה 9:05 על עברית"), { time: "09:05", about: "עברית" });
assert.deepEqual(A.parseWhen("remind me at 18:00 about math"), { time: "18:00", about: "math" });
assert.equal(A.parseWhen("נסח תזכורת"), null);
assert.equal(A.parseWhen("תזכיר לי ב-24:00 על חשבון"), null);
const custom = A.ask(state, noa, { text: "תזכיר לי ב-18:00 על חשבון", today });
assert.equal(custom.intent, "custom-remind");
assert.equal(custom.text, "אזכיר לך ב-18:00 על חשבון.");
assert.deepEqual(custom.reminder, { time: "18:00", about: "חשבון" });
assert.equal(ask(michal, { text: "נסח תזכורת" }).intent, "remind");
const customXss = A.ask(state, noa, { text: "תזכיר לי ב-18:00 על <img src=x>", today });
assert.equal(customXss.text.includes("<img"), true);
assert.equal(customXss.text.includes("&lt;"), false);
const clock = new Date(2026, 9, 23, 16, 0, 0);
assert.equal(A.delayUntil(clock, "17:00"), 60 * 60 * 1000);
assert.equal(A.delayUntil(clock, "15:00") < 0, true);
const freshSeen = A.markSeen(studentCard.items, {});
assert.equal(A.unreadCount(studentCard.items, {}), studentCard.items.length);
assert.equal(A.unreadCount(studentCard.items, freshSeen), 0);
assert.equal(A.unreadCount([{ id: "left", text: "אחר" }], freshSeen), 1);

const replyPack = S.emptyState();
S.importPack(replyPack, { v: 1, schools: [{ id: "s", name: "אלון", principalName: "דנה", classrooms: [{ id: "c", name: "ה'2", teacherName: "מ", messages: [{ id: "m", text: "סיימתי", from: "student", kidId: "<b>k</b>", audience: "class", at: 1 }], kids: [] }] }] });
const importedReply = replyPack.schools[0].classrooms[0].messages[0];
assert.equal(importedReply.from, "student");
assert.equal(importedReply.kidId.includes("<b>"), true);
assert.equal(S.messagesFor(replyPack.schools[0].classrooms[0], "student").length, 0);

const sw = fs.readFileSync(path.join(__dirname, "..", "simple", "sw.js"), "utf8");
assert.match(sw, /nohw-simple-v18/);
assert.match(sw, /setup\.js/);
assert.match(sw, /showNotification/);
assert.match(app, /digest-go/);
assert.match(app, /nohw-simple-assist/);
assert.match(app, /textContent/);
assert.match(app, /he-IL/);
assert.match(app, /className = "turn "/);
assert.match(app, /typing/);
assert.equal(/localStorage\.setItem\([\s\S]{0,80}chatLog/.test(app), false);

console.log("assist ok");
