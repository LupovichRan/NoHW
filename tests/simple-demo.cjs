const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../simple/logic.js");
const D = require("../simple/demo.js");

const today = "2026-10-23";
const saturday = "2026-10-24";
assert.equal(D.schoolDay(today), today);
assert.equal(D.schoolDay(saturday), today);
assert.deepEqual(D.weekDates(today), ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-23"]);

function who(pack, id) {
  const person = pack.people.find((item) => item.id === id);
  assert.ok(person, id);
  return person;
}
function codesOf(state) {
  const codes = [];
  for (const school of state.schools) {
    codes.push(school.principalCode);
    for (const room of school.classrooms) {
      codes.push(room.teacherCode);
      for (const kid of room.kids) codes.push(kid.kidCode, kid.parentCode);
    }
  }
  return codes;
}

const cast = D.cast(today);
const count = (role) => cast.people.filter((item) => item.role === role).length;
assert.equal(count("admin"), 1);
assert.equal(count("principal"), 2);
assert.ok(count("teacher") >= 3 && count("teacher") <= 4);
assert.ok(count("student") >= 4);
assert.ok(count("parent") >= 3);
assert.equal(cast.people.find((item) => item.role === "admin").name.length > 0, true);
assert.equal(ROLE(cast, "admin"), "נועם גל");
assert.equal(cast.people.every((item) => item.emoji && item.name), true);
const yael = who(cast, "par-yael");
assert.deepEqual(yael.kidIds, ["k-noa", "k-tamar"]);
assert.notEqual(D.findKid(cast.state, "k-noa").room.id, D.findKid(cast.state, "k-tamar").room.id);

const packs = [cast].concat(D.scenarios(today));
assert.equal(D.scenarios(today).length, 9);
for (const pack of packs) {
  assert.equal(pack.state.v, 1);
  assert.ok(Array.isArray(pack.people) && pack.people.length > 0);
  if (pack.personId) assert.ok(who(pack, pack.personId));
  const codes = codesOf(pack.state);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
}

const byId = Object.fromEntries(D.scenarios(today).map((pack) => [pack.id, pack]));
for (const id of ["normal", "stale", "none", "two", "add-class", "add-school", "hidden", "empty", "week"]) assert.ok(byId[id], id);

const normalKid = D.findKid(byId.normal.state, "k-noa");
const normalRows = S.rowsFor(normalKid.room, today, normalKid.kid);
assert.equal(normalRows.filter((row) => row.status === "posted").length, 3);
assert.equal(normalRows.filter((row) => row.done).length, 2);
for (const row of normalRows.filter((row) => row.status !== "posted")) assert.equal(row.status, "not-updated");
const student = D.personActor(byId.normal.state, who(byId.normal, "s-k-noa"));
S.markDone(byId.normal.state, student, { date: today, subject: S.SUBJECTS[2], done: true });
assert.equal(S.rowsFor(normalKid.room, today, normalKid.kid).find((row) => row.subject === S.SUBJECTS[2]).done, true);
assert.throws(() => S.markDone(byId.normal.state, D.personActor(byId.normal.state, who(byId.normal, "par-yael")), { date: today, subject: S.SUBJECTS[0], done: false }), /forbidden/);

const staleRows = S.rowsFor(D.findKid(byId.stale.state, "k-noa").room, today, D.findKid(byId.stale.state, "k-noa").kid);
assert.equal(staleRows.every((row) => row.status === "not-updated"), true);
assert.equal(staleRows.some((row) => row.status === "no-homework"), false);

const noneRows = S.rowsFor(D.findKid(byId.none.state, "k-noa").room, today, D.findKid(byId.none.state, "k-noa").kid);
assert.equal(noneRows.every((row) => row.status === "no-homework"), true);

const parent = who(byId.two, "par-yael");
assert.equal(parent.kidIds.length, 2);
assert.notEqual(D.findKid(byId.two.state, parent.kidIds[0]).room.id, D.findKid(byId.two.state, parent.kidIds[1]).room.id);
assert.equal(byId.two.personId, "par-yael");

const principal = who(byId["add-class"], "p-s-alon");
assert.equal(byId["add-class"].state.schools[0].classrooms.length, 1);
assert.equal(S.canEdit(byId["add-class"].state, D.personActor(byId["add-class"].state, principal), { kind: "class", schoolId: "s-alon" }), true);
assert.equal(S.canEdit(byId["add-class"].state, D.personActor(byId["add-class"].state, principal), { kind: "school", id: "s-alon" }), false);

const admin = who(byId["add-school"], "admin");
assert.equal(S.canEdit(byId["add-school"].state, D.personActor(byId["add-school"].state, admin), { kind: "kid", id: "k-omer" }), true);
assert.equal(S.canEdit(byId["add-school"].state, D.personActor(byId["add-school"].state, admin), { kind: "homework", classId: "c-h2" }), true);
assert.equal(S.canEdit(byId["add-school"].state, D.personActor(byId["add-school"].state, admin), { kind: "school", id: "s-alon" }), true);

const michal = who(byId.hidden, "t-c-h2");
const dana = who(byId.hidden, "p-s-alon");
const yoav = who(byId.hidden, "p-s-brosh");
assert.deepEqual(D.classesFor(byId.hidden.state, michal).map((room) => room.id), ["c-h2"]);
assert.deepEqual(D.schoolsFor(byId.hidden.state, dana).map((school) => school.id), ["s-alon"]);
assert.deepEqual(D.schoolsFor(byId.hidden.state, yoav).map((school) => school.id), ["s-brosh"]);
assert.equal(S.canEdit(byId.hidden.state, D.personActor(byId.hidden.state, michal), { kind: "kid", id: "k-noa" }), true);
assert.equal(S.canEdit(byId.hidden.state, D.personActor(byId.hidden.state, michal), { kind: "kid", id: "k-tamar" }), false);
assert.equal(S.canEdit(byId.hidden.state, D.personActor(byId.hidden.state, michal), { kind: "homework", classId: "c-d1" }), false);
assert.equal(S.canEdit(byId.hidden.state, D.personActor(byId.hidden.state, dana), { kind: "class", id: "c-d1" }), true);
assert.equal(S.canEdit(byId.hidden.state, D.personActor(byId.hidden.state, dana), { kind: "kid", id: "k-ido" }), false);
assert.throws(() => S.setHomework(byId.hidden.state, D.personActor(byId.hidden.state, michal), { classId: "c-d1", date: today, subject: S.SUBJECTS[0], mode: "none" }), /forbidden/);
assert.throws(() => S.addClassroom(byId.hidden.state, D.personActor(byId.hidden.state, yoav), { schoolId: "s-alon", className: "א'1", teacherName: "רן" }, () => 0.2), /forbidden/);

assert.equal(byId.empty.state.schools[0].name, "דקל");
assert.equal(byId.empty.state.schools[0].classrooms.length, 0);
assert.equal(who(byId.empty, byId.empty.personId).role, "principal");

const weekKid = D.findKid(byId.week.state, "k-noa");
const days = D.weekDates(today);
assert.equal(who(byId.week, byId.week.personId).role, "parent");
const sunday = S.rowsFor(weekKid.room, days[0], weekKid.kid);
assert.equal(sunday.filter((row) => row.done).length, 2);
const monday = S.rowsFor(weekKid.room, days[1], weekKid.kid);
assert.equal(monday.find((row) => row.subject === S.SUBJECTS[0]).status, "posted");
assert.equal(monday.find((row) => row.subject === S.SUBJECTS[0]).done, false);
assert.equal(monday.find((row) => row.subject === S.SUBJECTS[1]).status, "no-homework");
assert.equal(S.rowsFor(weekKid.room, days[2], weekKid.kid).every((row) => row.status === "no-homework"), true);
assert.equal(S.rowsFor(weekKid.room, days[3], weekKid.kid).filter((row) => row.status === "posted").length, 3);
assert.equal(S.rowsFor(weekKid.room, days[3], weekKid.kid).filter((row) => row.done).length, 1);
assert.equal(S.rowsFor(weekKid.room, days[5], weekKid.kid).find((row) => row.subject === S.SUBJECTS[1]).done, true);
assert.equal(S.rowsFor(weekKid.room, days[5], weekKid.kid).find((row) => row.subject === S.SUBJECTS[0]).done, false);

const doc = fs.readFileSync(path.join(__dirname, "..", "docs", "simple-demo-scenarios.md"), "utf8");
for (const pack of D.scenarios(today)) assert.ok(doc.includes(pack.title), pack.title);
assert.match(doc, /איפוס/);
assert.match(doc, /החלפת דמות/);

function ROLE(pack, role) {
  return pack.people.find((item) => item.role === role).name;
}

console.log("simple demo ok");
