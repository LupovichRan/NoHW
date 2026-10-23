const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../simple/logic.js");
const G = require("../simple/setup.js");

const today = "2026-10-23";
const admin = { role: "admin" };

assert.deepEqual(G.parseList("ד׳1-ד׳3"), ["ד׳1", "ד׳2", "ד׳3"]);
assert.deepEqual(G.parseList("ד׳1 - ד׳3"), ["ד׳1", "ד׳2", "ד׳3"]);
assert.deepEqual(G.parseList("נועה, עומר\nיעל"), ["נועה", "עומר", "יעל"]);
assert.deepEqual(G.parseList("דנה כהן"), ["דנה כהן"]);
assert.deepEqual(G.templateSlots("ד׳1"), S.SUBJECTS.slice(0, 4));
assert.deepEqual(G.templateSlots("א1"), S.SUBJECTS.slice(0, 3));
assert.deepEqual(G.templateSlots("ה'2"), S.SUBJECTS.slice());

const empty = S.emptyState();
const snap = JSON.stringify(empty);
let step = G.guide(empty, admin, null, "", { today: today, intent: "setup-school" });
assert.match(step.text, /איך קוראים לבית הספר/);
assert.equal(step.confirm, null);
step = G.guide(empty, admin, step.session, "דקל", { today: today });
assert.match(step.text, /מי המנהל/);
const backed = G.guide(empty, admin, step.session, "", { today: today, back: true });
assert.match(backed.text, /איך קוראים לבית הספר/);
step = G.guide(empty, admin, backed.session, "דקל", { today: today });
step = G.guide(empty, admin, step.session, "רן אור", { today: today });
assert.equal(step.confirm.action, "add-school");
assert.deepEqual(step.confirm.payload, { schoolName: "דקל", principalName: "רן אור" });
assert.equal(JSON.stringify(empty), snap);

const xss = S.emptyState();
let named = G.guide(xss, admin, null, "", { today: today, intent: "setup-school" });
named = G.guide(xss, admin, named.session, "<img src=x>", { today: today });
named = G.guide(xss, admin, named.session, "רן", { today: today });
assert.equal(named.text.includes("<img src=x>"), true);
assert.equal(named.text.includes("&lt;"), false);
assert.equal(xss.schools.length, 0);

const code = S.addPrincipal(empty, admin, step.confirm.payload, function () { return 0.1; });
assert.equal(empty.schools[0].name, "דקל");
assert.equal(empty.schools[0].principalName, "רן אור");
const adminList = G.checklist(empty, admin, { today: today });
assert.equal(adminList.complete, true);
assert.deepEqual(adminList.progress, { done: 1, total: 1 });

const schoolId = empty.schools[0].id;
const principal = { role: "principal", code: code };
assert.equal(S.identify(empty, code).role, "principal");
const whoP = { role: "principal", schoolId: schoolId };
const deniedSchool = G.guide(empty, whoP, null, "", { today: today, intent: "setup-school" });
assert.equal(deniedSchool.forbidden, true);
assert.equal(deniedSchool.confirm, null);
assert.equal(deniedSchool.text, "אין הרשאה");
assert.throws(function () {
  S.addPrincipal(empty, principal, { schoolName: "אחר", principalName: "מישהו" }, Math.random);
}, /forbidden/);

const beforeClasses = JSON.stringify(empty);
let classes = G.guide(empty, whoP, null, "", { today: today, intent: "setup-classes" });
classes = G.guide(empty, whoP, classes.session, "ד׳1-ד׳3", { today: today });
assert.equal(classes.confirm.title, "להוסיף 3 כיתות?");
assert.deepEqual(classes.confirm.payload.names, ["ד׳1", "ד׳2", "ד׳3"]);
assert.equal(JSON.stringify(empty), beforeClasses);
const declined = G.guide(empty, whoP, classes.session, "", { today: today, declined: true });
assert.match(declined.text, /לא שיניתי/);
assert.equal(empty.schools[0].classrooms.length, 0);
classes.confirm.payload.names.forEach(function (name) {
  S.addClassroom(empty, principal, { schoolId: schoolId, className: name, teacherName: "" }, Math.random);
});
assert.equal(empty.schools[0].classrooms.length, 3);
assert.equal(empty.schools[0].classrooms.every(function (room) { return room.teacherName === ""; }), true);
let progress = G.checklist(empty, whoP, { today: today, people: [] });
assert.deepEqual(progress.progress, { done: 1, total: 3 });
assert.equal(progress.complete, false);
assert.equal(progress.items.find(function (item) { return item.id === "teachers"; }).done, false);

const room = empty.schools[0].classrooms[0];
const teacherActor = { role: "teacher", code: room.teacherCode };
const whoT = { role: "teacher", classId: room.id, schoolId: schoolId };
const deniedClass = G.guide(empty, whoT, null, "", { today: today, intent: "setup-classes" });
assert.equal(deniedClass.forbidden, true);
assert.equal(deniedClass.confirm, null);
assert.throws(function () {
  S.addClassroom(empty, teacherActor, { className: "ו׳1", teacherName: "א" }, Math.random);
}, /forbidden/);

let assign = G.guide(empty, whoP, null, "", { today: today, intent: "setup-teacher" });
assign = G.guide(empty, whoP, assign.session, "class:" + room.id, { today: today });
assign = G.guide(empty, whoP, assign.session, "מיכל אביב", { today: today });
assert.equal(assign.confirm.action, "assign-teacher");
assert.equal(room.teacherName, "");
S.rename(empty, principal, { kind: "class", id: room.id, name: room.name, extra: "מיכל אביב" });
assert.equal(room.teacherName, "מיכל אביב");

assert.deepEqual(G.checklist(empty, whoT, { today: today, people: [] }).progress, { done: 0, total: 4 });
const template = G.guide(empty, whoT, null, "", { today: today, intent: "setup-timetable" });
assert.equal(template.confirm.action, "template");
assert.equal(template.confirm.payload.slots.length, 4);
assert.equal(room.timetable, undefined);
template.confirm.payload.slots.forEach(function (subject, lesson) {
  for (let day = 0; day <= 5; day++) S.setSlot(empty, teacherActor, { classId: room.id, day: day, lesson: lesson, subject: subject });
});
assert.equal(G.checklist(empty, whoT, { today: today, people: [] }).items.find(function (item) { return item.id === "timetable"; }).done, true);

let kids = G.guide(empty, whoT, null, "", { today: today, intent: "setup-kids" });
kids = G.guide(empty, whoT, kids.session, "נועה, עומר", { today: today });
assert.equal(kids.confirm.title, "להוסיף 2 ילדים?");
assert.equal(room.kids.length, 0);
kids.confirm.payload.names.forEach(function (name) {
  S.addKid(empty, teacherActor, { classId: room.id, firstName: name }, Math.random);
});
assert.deepEqual(room.kids.map(function (kid) { return kid.firstName; }), ["נועה", "עומר"]);

const people = [];
let parent = G.guide(empty, whoT, null, "", { today: today, intent: "setup-parents", people: people });
parent = G.guide(empty, whoT, parent.session, "kid:" + room.kids[0].id, { today: today, people: people });
parent = G.guide(empty, whoT, parent.session, "יעל ברק", { today: today, people: people });
assert.equal(parent.confirm.action, "add-parent");
assert.equal(parent.confirm.payload.parentName, "יעל ברק");
assert.equal(people.length, 0);
room.kids.forEach(function (kid, index) {
  people.push({ id: "par-" + kid.id, role: "parent", name: index ? "אביגיל" : "יעל ברק", kidIds: [kid.id] });
});
const ready = G.guide(empty, whoT, null, "", { today: today, intent: "setup-parents", people: people });
assert.match(ready.text, /יש הורה/);

let face = G.guide(empty, whoT, null, "", { today: today, intent: "setup-avatar", people: people });
face = G.guide(empty, whoT, face.session, "face:fox", { today: today, people: people });
face = G.guide(empty, whoT, face.session, "שועל הכיתה", { today: today, people: people });
assert.equal(face.confirm.payload.face, "fox");
assert.equal(face.confirm.payload.name, "שועל הכיתה");
S.setHelper(empty, teacherActor, face.confirm.payload);
const done = G.checklist(empty, whoT, { today: today, people: people });
assert.equal(done.complete, true);
assert.deepEqual(done.progress, { done: 4, total: 4 });

const zero = G.checklist(S.emptyState(), { role: "principal", schoolId: "missing" }, { today: today });
assert.deepEqual(zero.progress, { done: 0, total: 3 });
assert.equal(G.checklist(empty, { role: "student", kidId: room.kids[0].id }, { today: today }).progress.total, 0);

const health = G.guide(empty, admin, null, "", { today: today, intent: "setup-health" });
assert.match(health.text, /בתי ספר 1/);
assert.match(health.text, /כיתות 3/);
assert.match(health.text, /מורים 1/);
assert.match(health.text, /ילדים 2/);
assert.equal(health.confirm, null);
const attention = G.guide(empty, admin, null, "", { today: today, intent: "setup-attention" });
assert.match(attention.text, /אין פרסום השבוע/);
const gap = G.guide(empty, whoT, null, "", { today: today, intent: "setup-gap" });
assert.match(gap.text, /חסר היום/);
const note = G.guide(empty, whoP, null, "", { today: today, intent: "setup-note" });
assert.equal(note.confirm, null);
assert.match(note.text, /טיוטה/);
const none = G.guide(empty, whoT, null, "", { today: today, intent: "setup-none" });
assert.equal(none.confirm.title, "לסמן אין שיעורים להיום?");
assert.equal(G.guide(empty, whoT, none.session, "", { today: today, back: true }).text, "בסדר.");

const src = fs.readFileSync(path.join(__dirname, "..", "simple", "setup.js"), "utf8");
assert.equal(/fetch\s*\(/.test(src), false);
assert.equal(/XMLHttpRequest|WebSocket/.test(src), false);
const app = fs.readFileSync(path.join(__dirname, "..", "simple", "app.js"), "utf8");
assert.match(app, /choice === "yes" && setupPending/);
assert.match(app, /text\.textContent = line/);
const sw = fs.readFileSync(path.join(__dirname, "..", "simple", "sw.js"), "utf8");
assert.match(sw, /setup\.js/);
assert.match(sw, /nohw-simple-v22/);

console.log("setup ok");
