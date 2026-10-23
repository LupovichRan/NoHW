const assert = require("node:assert/strict");
const S = require("../simple/logic.js");

const ALPHABET = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
function rng() {
  let i = 7;
  return () => ((i = (i * 17 + 3) % 997) + 1) / 998;
}
const random = rng();

const first = S.generateCode(random);
const second = S.generateCode(random);
assert.match(first, ALPHABET);
assert.match(second, ALPHABET);
assert.notEqual(first, second);
assert.doesNotMatch(first + second, /[01OILol]/);

const state = S.emptyState();
const admin = { role: "admin" };
const date = "2026-10-23";
assert.throws(() => S.addPrincipal(state, { role: "teacher", code: "AAAAAA" }, { schoolName: "אלון", principalName: "דנה" }, random), /forbidden/);
assert.throws(() => S.addClassroom(state, admin, { className: "ה'2", teacherName: "מיכל" }, random), /forbidden/);

const principalCode = S.addPrincipal(state, admin, { schoolName: "אלון", principalName: "דנה" }, random);
assert.match(principalCode, ALPHABET);
const principal = { role: "principal", code: principalCode };
assert.throws(() => S.addPrincipal(state, principal, { schoolName: "אחר", principalName: "רן" }, random), /forbidden/);
assert.throws(() => S.addKid(state, principal, { firstName: "נועה" }, random), /forbidden/);

const teacherCode = S.addClassroom(state, principal, { className: "ה'2", teacherName: "מיכל" }, random);
assert.match(teacherCode, ALPHABET);
const teacher = { role: "teacher", code: teacherCode };
assert.throws(() => S.addClassroom(state, teacher, { className: "ו'1", teacherName: "יוסי" }, random), /forbidden/);
assert.throws(() => S.addPrincipal(state, teacher, { schoolName: "אחר", principalName: "רן" }, random), /forbidden/);
assert.throws(() => S.setHomework(state, principal, { date, subject: "חשבון", mode: "none" }), /forbidden/);

const kid = S.addKid(state, teacher, { firstName: "נועה" }, random);
assert.match(kid.kidCode, ALPHABET);
assert.match(kid.parentCode, ALPHABET);
assert.notEqual(kid.kidCode, kid.parentCode);
assert.notEqual(kid.kidCode, teacherCode);
const student = { role: "student", code: kid.kidCode };
const parent = { role: "parent", code: kid.parentCode };
assert.throws(() => S.addKid(state, student, { firstName: "עומר" }, random), /forbidden/);
assert.throws(() => S.addKid(state, parent, { firstName: "עומר" }, random), /forbidden/);
assert.throws(() => S.addClassroom(state, student, { className: "א'1", teacherName: "א" }, random), /forbidden/);
assert.throws(() => S.setHomework(state, student, { date, subject: "חשבון", mode: "none" }), /forbidden/);
assert.throws(() => S.setHomework(state, parent, { date, subject: "חשבון", mode: "post", text: "עמ׳ 1" }), /forbidden/);

assert.equal(S.statusOf(undefined), "not-updated");
assert.equal(S.statusOf({ mode: "none" }), "no-homework");
assert.equal(S.statusOf({ mode: "post", text: "x" }), "posted");
assert.equal(S.statusOf({ mode: "whatever" }), "not-updated");
assert.notEqual(S.statusOf(undefined), "no-homework");

let day = S.dayFor(state, student, date);
assert.equal(day.length, S.SUBJECTS.length);
for (const row of day) {
  assert.equal(row.status, "not-updated");
  assert.notEqual(row.status, "no-homework");
}
S.setHomework(state, teacher, { date, subject: "עברית", mode: "none" });
S.setHomework(state, teacher, { date, subject: "אנגלית", mode: "post", text: "עמ׳ 4" });
day = S.dayFor(state, student, date);
const by = Object.fromEntries(day.map((row) => [row.subject, row]));
assert.equal(by["חשבון"].status, "not-updated");
assert.equal(by["עברית"].status, "no-homework");
assert.equal(by["אנגלית"].status, "posted");
assert.equal(by["אנגלית"].text, "עמ׳ 4");
assert.notEqual(by["חשבון"].status, "no-homework");
assert.notEqual(by["מדעים"].status, "no-homework");
assert.throws(() => S.markDone(state, student, { date, subject: "חשבון", done: true }), /forbidden/);
assert.throws(() => S.markDone(state, student, { date, subject: "עברית", done: true }), /forbidden/);
assert.throws(() => S.markDone(state, parent, { date, subject: "אנגלית", done: true }), /forbidden/);
assert.throws(() => S.markDone(state, teacher, { date, subject: "אנגלית", done: true }), /forbidden/);
S.markDone(state, student, { date, subject: "אנגלית", done: true });
const parentDay = S.dayFor(state, parent, date);
assert.equal(parentDay.find((row) => row.subject === "אנגלית").done, true);
assert.equal(parentDay.find((row) => row.subject === "אנגלית").status, "posted");
assert.equal(parentDay.find((row) => row.subject === "עברית").status, "no-homework");
assert.equal(parentDay.find((row) => row.subject === "חשבון").status, "not-updated");
assert.equal(parentDay.find((row) => row.subject === "עברית").done, false);

assert.equal(S.identify(state, principalCode).role, "principal");
assert.equal(S.identify(state, teacherCode).role, "teacher");
assert.equal(S.identify(state, kid.kidCode).role, "student");
assert.equal(S.identify(state, kid.parentCode).role, "parent");
assert.equal(S.identify(state, "zzzzzz"), null);

const other = S.addKid(state, teacher, { firstName: "עומר" }, random);
assert.notEqual(other.kidCode, kid.kidCode);
assert.notEqual(other.parentCode, kid.parentCode);

const parentPack = S.decodePack(S.encodePack(S.packFor(state, "parent", kid.parentCode)));
assert.equal(parentPack.role, "parent");
assert.equal(parentPack.code, kid.parentCode);
assert.equal(parentPack.schools[0].principalCode, "");
assert.equal(parentPack.schools[0].classrooms[0].teacherCode, "");
assert.equal(parentPack.schools[0].classrooms[0].kids.length, 1);
assert.equal(parentPack.schools[0].classrooms[0].kids[0].firstName, "נועה");
assert.equal(parentPack.schools[0].classrooms[0].kids[0].kidCode, "");
assert.equal(parentPack.schools[0].classrooms[0].kids[0].parentCode, kid.parentCode);

const imported = S.emptyState();
const who = S.importPack(imported, parentPack);
assert.equal(who.role, "parent");
assert.equal(who.code, kid.parentCode);
assert.equal(imported.schools.length, 1);
assert.equal(imported.schools[0].name, "אלון");
assert.equal(imported.schools[0].classrooms[0].name, "ה'2");
assert.equal(S.identify(imported, kid.parentCode).role, "parent");
assert.equal(S.identify(imported, teacherCode), null);
assert.equal(S.identify(imported, principalCode), null);
assert.equal(S.identify(imported, kid.kidCode), null);
const importedDay = S.dayFor(imported, parent, date);
assert.equal(importedDay.find((row) => row.subject === "אנגלית").done, true);
assert.equal(importedDay.find((row) => row.subject === "אנגלית").text, "עמ׳ 4");
assert.equal(importedDay.find((row) => row.subject === "חשבון").status, "not-updated");
assert.equal(importedDay.find((row) => row.subject === "עברית").status, "no-homework");
S.importPack(imported, parentPack);
assert.equal(imported.schools.length, 1);
assert.equal(imported.schools[0].classrooms.length, 1);
assert.equal(imported.schools[0].classrooms[0].kids.length, 1);
assert.throws(() => S.addPrincipal(imported, { role: "principal", code: principalCode }, { schoolName: "חדש", principalName: "חדש" }, random), /forbidden/);

const studentPack = S.decodePack(S.encodePack(S.packFor(state, "student", kid.kidCode)));
assert.equal(studentPack.schools[0].classrooms[0].kids.length, 1);
assert.equal(studentPack.schools[0].classrooms[0].teacherCode, "");
assert.equal(studentPack.schools[0].classrooms[0].kids[0].parentCode, "");
assert.equal(studentPack.schools[0].classrooms[0].kids[0].kidCode, kid.kidCode);
const studentState = S.emptyState();
S.importPack(studentState, studentPack);
assert.equal(S.identify(studentState, kid.kidCode).role, "student");
assert.equal(S.identify(studentState, kid.parentCode), null);

assert.equal(S.copyPayload("K7P2QX"), "K7P2QX");
assert.equal(S.copyPayload("  k7p2qx "), "K7P2QX");
assert.equal(S.copyPayload(principalCode), principalCode);
assert.equal(S.copyPayload(kid.kidCode), kid.kidCode);
assert.equal(S.copyPayload(kid.parentCode), kid.parentCode);
assert.equal(/\s|קוד|http|#pack|שלום/.test(S.copyPayload(principalCode)), false);

const teacherPack = S.packFor(state, "teacher", teacherCode);
assert.equal(teacherPack.schools[0].principalCode, "");
assert.equal(teacherPack.schools[0].classrooms[0].teacherCode, teacherCode);
assert.equal(teacherPack.schools[0].classrooms[0].kids.length, 2);

const schoolA = S.identify(state, principalCode).school;
const roomA = S.identify(state, teacherCode).room;
const kidA = roomA.kids.find((item) => item.firstName === "נועה");
const torah = S.SUBJECTS[4];
const science = S.SUBJECTS[3];

assert.equal(S.canEdit(state, admin, { kind: "school", id: schoolA.id }), true);
assert.equal(S.canEdit(state, admin, { kind: "class", id: roomA.id }), true);
assert.equal(S.canEdit(state, admin, { kind: "kid", id: kidA.id }), true);
assert.equal(S.canEdit(state, admin, { kind: "parent", id: kidA.id }), true);
assert.equal(S.canEdit(state, admin, { kind: "homework", classId: roomA.id }), true);
assert.equal(S.canEdit(state, principal, { kind: "class", id: roomA.id }), true);
assert.equal(S.canEdit(state, principal, { kind: "class", schoolId: schoolA.id }), true);
assert.equal(S.canEdit(state, principal, { kind: "kid", id: kidA.id }), true);
assert.equal(S.canEdit(state, principal, { kind: "parent", id: kidA.id }), true);
assert.equal(S.canEdit(state, principal, { kind: "homework", classId: roomA.id }), true);
assert.equal(S.canEdit(state, principal, { kind: "school", id: schoolA.id }), false);
assert.equal(S.canEdit(state, teacher, { kind: "kid", id: kidA.id }), true);
assert.equal(S.canEdit(state, teacher, { kind: "parent", id: kidA.id }), true);
assert.equal(S.canEdit(state, teacher, { kind: "homework", classId: roomA.id }), true);
assert.equal(S.canEdit(state, teacher, { kind: "class", id: roomA.id }), false);
assert.equal(S.canEdit(state, teacher, { kind: "school", id: schoolA.id }), false);
assert.equal(S.canEdit(state, student, { kind: "kid", id: kidA.id }), false);
assert.equal(S.canEdit(state, student, { kind: "homework", classId: roomA.id }), false);
assert.equal(S.canEdit(state, parent, { kind: "kid", id: kidA.id }), false);
assert.equal(S.canEdit(state, parent, { kind: "homework", classId: roomA.id }), false);
assert.equal(S.canEdit(state, null, { kind: "school", id: schoolA.id }), false);

const principalBCode = S.addPrincipal(state, admin, { schoolName: "ברוש", principalName: "יואב" }, random);
const principalB = { role: "principal", code: principalBCode };
const schoolB = S.identify(state, principalBCode).school;
const teacherBCode = S.addClassroom(state, principalB, { className: "ו'1", teacherName: "יוסי" }, random);
const teacherB = { role: "teacher", code: teacherBCode };
const roomB = S.identify(state, teacherBCode).room;
const kidB = S.addKid(state, teacherB, { firstName: "עידו" }, random);
const kidBNode = roomB.kids.find((item) => item.firstName === "עידו");

assert.equal(S.canEdit(state, principal, { kind: "class", id: roomB.id }), false);
assert.equal(S.canEdit(state, principal, { kind: "class", schoolId: schoolB.id }), false);
assert.equal(S.canEdit(state, principal, { kind: "kid", id: kidBNode.id }), false);
assert.equal(S.canEdit(state, principal, { kind: "parent", id: kidBNode.id }), false);
assert.equal(S.canEdit(state, principal, { kind: "homework", classId: roomB.id }), false);
assert.throws(() => S.addClassroom(state, principal, { schoolId: schoolB.id, className: "א'1", teacherName: "רן" }, random), /forbidden/);
assert.throws(() => S.addKid(state, principal, { classId: roomB.id, firstName: "רן" }, random), /forbidden/);
assert.throws(() => S.setHomework(state, principal, { classId: roomB.id, date, subject: torah, mode: "none" }), /forbidden/);
assert.throws(() => S.rename(state, principal, { kind: "class", id: roomB.id, name: "ז'1", extra: "אחר" }), /forbidden/);
assert.throws(() => S.rename(state, principal, { kind: "school", id: schoolA.id, name: "אחר", extra: "אחר" }), /forbidden/);
assert.throws(() => S.resetCode(state, principal, { kind: "school", id: schoolA.id }, random), /forbidden/);
assert.throws(() => S.removeNode(state, principal, { kind: "school", id: schoolA.id }), /forbidden/);
assert.throws(() => S.removeNode(state, principal, { kind: "kid", id: kidBNode.id }), /forbidden/);
assert.equal(S.canEdit(state, teacher, { kind: "kid", id: kidBNode.id }), false);
assert.equal(S.canEdit(state, teacher, { kind: "parent", id: kidBNode.id }), false);
assert.equal(S.canEdit(state, teacher, { kind: "homework", classId: roomB.id }), false);
assert.throws(() => S.addKid(state, teacher, { classId: roomB.id, firstName: "רן" }, random), /forbidden/);
assert.throws(() => S.setHomework(state, teacher, { classId: roomB.id, date, subject: torah, mode: "none" }), /forbidden/);
assert.throws(() => S.rename(state, teacher, { kind: "kid", id: kidBNode.id, name: "אחר" }), /forbidden/);
assert.throws(() => S.rename(state, teacher, { kind: "class", id: roomA.id, name: "א'1", extra: "אחר" }), /forbidden/);
assert.throws(() => S.resetCode(state, teacher, { kind: "class", id: roomA.id }, random), /forbidden/);
assert.throws(() => S.resetCode(state, teacher, { kind: "parent", id: kidBNode.id }, random), /forbidden/);
assert.throws(() => S.removeNode(state, teacher, { kind: "class", id: roomA.id }), /forbidden/);
assert.throws(() => S.removeNode(state, teacher, { kind: "kid", id: kidBNode.id }), /forbidden/);
assert.throws(() => S.removeNode(state, student, { kind: "kid", id: kidA.id }), /forbidden/);
assert.throws(() => S.rename(state, parent, { kind: "kid", id: kidA.id, name: "אחר" }), /forbidden/);

const addedClass = S.addClassroom(state, admin, { schoolId: schoolA.id, className: "ד'1", teacherName: "אור" }, random);
assert.match(addedClass, ALPHABET);
const addedByAdmin = S.addKid(state, admin, { classId: roomA.id, firstName: "ליאן" }, random);
assert.match(addedByAdmin.kidCode, ALPHABET);
const addedByPrincipal = S.addKid(state, principal, { classId: roomA.id, firstName: "תום" }, random);
assert.match(addedByPrincipal.parentCode, ALPHABET);
S.setHomework(state, principal, { classId: roomA.id, date, subject: torah, mode: "post", text: "פרק א" });
S.setHomework(state, admin, { classId: roomB.id, date, subject: science, mode: "none" });
assert.equal(S.dayFor(state, { role: "student", code: kidB.kidCode }, date).find((row) => row.subject === science).status, "no-homework");
assert.equal(S.dayFor(state, student, date).find((row) => row.subject === torah).text, "פרק א");

S.rename(state, admin, { kind: "school", id: schoolA.id, name: "אלון חדש", extra: "דנה" });
assert.equal(schoolA.name, "אלון חדש");
S.rename(state, principal, { kind: "class", id: roomA.id, name: "ה'3", extra: "מיכל" });
assert.equal(roomA.name, "ה'3");
S.rename(state, teacher, { kind: "kid", id: kidA.id, name: "נועה ב" });
assert.equal(kidA.firstName, "נועה ב");
S.rename(state, principalB, { kind: "kid", id: kidBNode.id, name: "עידו ב" });
assert.equal(kidBNode.firstName, "עידו ב");
assert.throws(() => S.rename(state, teacherB, { kind: "parent", id: kidBNode.id, name: "לא שם" }), /forbidden/);

const oldKidCode = kidA.kidCode;
const resetKid = S.resetCode(state, teacher, { kind: "kid", id: kidA.id }, random);
assert.match(resetKid, ALPHABET);
assert.notEqual(resetKid, oldKidCode);
assert.equal(S.identify(state, oldKidCode), null);
assert.equal(S.identify(state, resetKid).role, "student");
const oldParentCode = kidA.parentCode;
const resetParent = S.resetCode(state, principal, { kind: "parent", id: kidA.id }, random);
assert.notEqual(resetParent, oldParentCode);
assert.equal(S.identify(state, resetParent).role, "parent");
const oldTeacherCode = roomB.teacherCode;
const resetTeacher = S.resetCode(state, admin, { kind: "class", id: roomB.id }, random);
assert.equal(S.identify(state, oldTeacherCode), null);
assert.equal(S.identify(state, resetTeacher).role, "teacher");
const oldPrincipalCode = schoolB.principalCode;
const resetPrincipal = S.resetCode(state, admin, { kind: "school", id: schoolB.id }, random);
assert.equal(S.identify(state, oldPrincipalCode), null);
assert.equal(S.identify(state, resetPrincipal).role, "principal");

assert.throws(() => S.removeNode(state, teacher, { kind: "parent", id: kidA.id }), /forbidden/);
assert.throws(() => S.removeNode(state, principalB, { kind: "class", id: roomA.id }), /forbidden/);
assert.throws(() => S.removeNode(state, principal, { kind: "class", id: roomB.id }), /forbidden/);
S.removeNode(state, teacher, { kind: "kid", id: kidA.id });
assert.equal(S.identify(state, resetKid), null);
S.removeNode(state, principal, { kind: "class", id: S.identify(state, addedClass).room.id });
assert.equal(S.identify(state, addedClass), null);
S.removeNode(state, { role: "principal", code: resetPrincipal }, { kind: "class", id: roomB.id });
assert.equal(S.identify(state, resetTeacher), null);
S.removeNode(state, admin, { kind: "school", id: schoolB.id });
assert.equal(state.schools.some((item) => item.id === schoolB.id), false);
const lian = roomA.kids.find((item) => item.firstName === "ליאן");
S.markDone(state, { role: "student", code: lian.kidCode }, { date, subject: "אנגלית", done: true });
assert.equal(S.dayFor(state, { role: "parent", code: lian.parentCode }, date).find((row) => row.subject === "אנגלית").done, true);
assert.throws(() => S.markDone(state, { role: "parent", code: lian.parentCode }, { date, subject: "אנגלית", done: false }), /forbidden/);

const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..", "simple");
const page = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const css = fs.readFileSync(path.join(root, "app.css"), "utf8");
const manifest = fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8");
assert.match(page, /<html lang="he" dir="rtl">/);
assert.match(app, /lang = "he"/);
assert.match(app, /dir = "rtl"/);
assert.match(app, /dir="rtl"/);
assert.match(app, /<bdi dir="ltr">/);
assert.match(app, /מנהל מערכת/);
assert.match(app, /data-act="edit"/);
assert.match(app, /למחוק/);
assert.match(app, /canEdit/);
assert.doesNotMatch(app, /window\.confirm/);
assert.doesNotMatch(app, /אדמין|Admin/);
assert.doesNotMatch(manifest, /אדמין|Admin/);
assert.doesNotMatch(app, /"(NoHW|Admin|Principal|Teacher|Student|Parent)"/);
assert.doesNotMatch(manifest, /NoHW/);
assert.doesNotMatch(css, /\b(left|right)\b/);
assert.match(css, /margin-inline|padding-inline|text-align:\s*start/);
assert.match(app, /M9 5l7 7-7 7/);

console.log("simple logic ok");
