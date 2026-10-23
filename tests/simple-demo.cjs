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
assert.equal(D.scenarios(today).length, 12);
for (const pack of packs) {
  assert.equal(pack.state.v, 1);
  assert.ok(Array.isArray(pack.people) && pack.people.length > 0);
  if (pack.personId) assert.ok(who(pack, pack.personId));
  const codes = codesOf(pack.state);
  assert.equal(new Set(codes).size, codes.length);
  for (const code of codes) assert.match(code, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
}

const byId = Object.fromEntries(D.scenarios(today).map((pack) => [pack.id, pack]));
for (const id of ["normal", "stale", "none", "two", "add-class", "add-school", "hidden", "empty", "week", "board", "parents-msg", "bump-msg"]) assert.ok(byId[id], id);

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

const boardRows = S.rowsFor(D.findKid(byId.board.state, "k-noa").room, today, null);
assert.deepEqual(boardRows.map((row) => row.subject), [S.SUBJECTS[0], S.SUBJECTS[1], "אמנות"]);
assert.equal(boardRows[0].status, "posted");
assert.equal(boardRows[0].text, "תרגיל 4");
assert.equal(boardRows[0].photo.indexOf("data:image/"), 0);
assert.equal(boardRows[0].voice.indexOf("data:audio/"), 0);
assert.equal(boardRows[0].photos.length, 2);
assert.equal(boardRows[0].voices.length, 2);
assert.equal(boardRows[0].voices[0].text, "תרגיל ארבע");
assert.equal(boardRows[0].voices[1].text, "עמוד שתים עשרה");
assert.equal(boardRows[1].status, "not-updated");
assert.equal(boardRows[2].status, "not-updated");
assert.notEqual(boardRows[1].status, "no-homework");
const parentsRoom = byId["parents-msg"].state.schools[0].classrooms[0];
assert.equal(S.messagesFor(parentsRoom, "student").some((item) => item.audience === "parents"), false);
assert.equal(S.messagesFor(parentsRoom, "student").some((item) => item.text === "מבחן ביום ד׳"), true);
assert.equal(S.messagesFor(parentsRoom, "parent").some((item) => item.text === "שיחת הורים מחר"), true);
const bumped = S.messagesFor(byId["bump-msg"].state.schools[0].classrooms[0], "student");
assert.equal(bumped[0].id, "m-old");
assert.equal(bumped[0].edited, true);
assert.equal(bumped[0].text, "הטיול נדחה ליום ג׳");
assert.ok(bumped[0].bump > bumped[1].bump);
assert.equal(who(byId.board, byId.board.personId).role, "teacher");

const emojis = D.scenarios(today).map((pack) => pack.emoji);
assert.equal(emojis.every((emoji) => emoji), true);
assert.equal(new Set(emojis).size, emojis.length);

const freshNormal = D.liveView(D.scenarioById("normal", today).state, today);
assert.equal(freshNormal.date, today);
assert.equal(freshNormal.schools.length, 1);
assert.equal(freshNormal.schools[0].name, "אלון");
assert.equal(freshNormal.schools[0].classCount, 1);
assert.equal(freshNormal.schools[0].kidCount, 2);
const freshRoom = freshNormal.schools[0].classes[0];
assert.equal(freshRoom.name, "ה'2");
assert.equal(freshRoom.kidCount, 2);
assert.equal(freshRoom.posted, 3);
assert.equal(freshRoom.notUpdated, 2);
assert.equal(freshRoom.none, 0);
assert.equal(freshRoom.done, 2);
assert.equal(freshRoom.kids[0].name, "נועה");
assert.equal(freshRoom.kids[0].done, 2);
assert.equal(freshRoom.kids[1].name, "עומר");
assert.equal(freshRoom.kids[1].done, 0);

const dirty = D.scenarioById("normal", today);
dirty.state.schools[0].classrooms[0].kids[0].firstName = "רות";
S.setHomework(dirty.state, D.personActor(dirty.state, who(dirty, "t-c-h2")), { classId: "c-h2", date: today, subject: S.SUBJECTS[3], mode: "post", text: "עמוד 9" });
const dirtyLive = D.liveView(dirty.state, today);
assert.equal(dirtyLive.schools[0].classes[0].kids[0].name, "רות");
assert.equal(dirtyLive.schools[0].classes[0].posted, 4);
assert.equal(dirtyLive.schools[0].classes[0].notUpdated, 1);
const restored = D.scenarioById("normal", today);
const restoredLive = D.liveView(restored.state, today);
assert.equal(D.findKid(restored.state, "k-noa").kid.firstName, "נועה");
assert.equal(restoredLive.schools[0].classes[0].posted, 3);
assert.equal(restoredLive.schools[0].classes[0].notUpdated, 2);
assert.equal(restoredLive.schools[0].classes[0].none, 0);
assert.equal(restoredLive.schools[0].classes[0].done, 2);
assert.equal(restoredLive.schools[0].classes[0].kids[0].name, "נועה");
assert.equal(D.scenarioById("cast", today).people.length, D.cast(today).people.length);
assert.equal(D.scenarioById("missing", today).id, "cast");
assert.equal(JSON.stringify(D.liveView(restored.state, today)), JSON.stringify(restoredLive));

const staleLive = D.liveView(byId.stale.state, today);
assert.equal(staleLive.schools[0].classes[0].posted, 0);
assert.equal(staleLive.schools[0].classes[0].notUpdated, 5);
assert.equal(staleLive.schools[0].classes[0].none, 0);
assert.equal(staleLive.schools[0].classes[0].done, 0);
const noneLive = D.liveView(byId.none.state, today);
assert.equal(noneLive.schools[0].classes[0].none, 5);
assert.equal(noneLive.schools[0].classes[0].posted, 0);
assert.equal(noneLive.schools[0].classes[0].notUpdated, 0);
const emptyLive = D.liveView(byId.empty.state, today);
assert.equal(emptyLive.schools.length, 1);
assert.equal(emptyLive.schools[0].name, "דקל");
assert.equal(emptyLive.schools[0].classCount, 0);
assert.equal(emptyLive.schools[0].kidCount, 0);
assert.equal(emptyLive.schools[0].classes.length, 0);
const hiddenLive = D.liveView(byId.hidden.state, today);
assert.equal(hiddenLive.schools.length, 2);
assert.equal(hiddenLive.schools[0].classCount, 2);
assert.equal(hiddenLive.schools[0].kidCount, 2);
assert.equal(hiddenLive.schools[1].classCount, 1);
assert.equal(hiddenLive.schools[1].kidCount, 1);
const weekLive = D.liveView(byId.week.state, today);
assert.equal(weekLive.schools[0].classes[0].posted, 2);
assert.equal(weekLive.schools[0].classes[0].notUpdated, 3);
assert.equal(weekLive.schools[0].classes[0].done, 1);
assert.equal(D.liveView(byId.stale.state, saturday).date, today);

const before = JSON.stringify(byId.empty.state);
D.liveView(byId.empty.state, today);
assert.equal(JSON.stringify(byId.empty.state), before);

for (const pack of packs) {
  assert.ok(pack.people.some((item) => item.role === "parent"), pack.id + " parent");
  for (const school of pack.state.schools) {
    for (const room of school.classrooms) {
      for (const kid of room.kids) {
        assert.ok(pack.people.some((item) => item.role === "parent" && (item.kidIds || []).includes(kid.id)), pack.id + " " + kid.firstName);
      }
    }
  }
}
assert.equal(D.parentCaption(who(cast, "par-yael"), cast.state), "אמא של נועה ותמר");
assert.equal(D.parentCaption(who(byId.normal, "par-yael"), byId.normal.state), "אמא של נועה");
assert.equal(D.parentCaption(who(byId.two, "par-yael"), byId.two.state), "אמא של נועה ותמר");
assert.equal(D.parentCaption(who(cast, "par-moshe"), cast.state), "אבא של עידו");
assert.equal(D.parentCaption(who(byId.empty, "par-hadas"), byId.empty.state), "");
assert.equal(who(byId.two, byId.two.personId).role, "parent");
assert.equal(who(byId.week, byId.week.personId).role, "parent");

const appJs = fs.readFileSync(path.join(__dirname, "..", "simple", "app.js"), "utf8");
assert.match(appJs, /scenarioById/);
assert.match(appJs, /liveView/);
assert.match(appJs, /parentCaption/);
assert.match(appJs, /לאפס/);
assert.match(appJs, /פעיל/);
assert.match(appJs, /הורים/);
assert.match(appJs, /מנהלי בית ספר/);
assert.match(appJs, /ראה כהורה/);
assert.match(appJs, /data-act="filter"/);
assert.match(appJs, /data-act="as-parent"/);

const doc = fs.readFileSync(path.join(__dirname, "..", "docs", "simple-demo-scenarios.md"), "utf8");
for (const pack of D.scenarios(today)) assert.ok(doc.includes(pack.title), pack.title);
assert.match(doc, /איפוס/);
assert.match(doc, /לאפס/);
assert.match(doc, /החלפת דמות/);
assert.match(doc, /נתונים/);
assert.match(doc, /נתונים חיים/);
assert.match(doc, /הורים/);
assert.match(doc, /ראה כהורה/);
assert.match(doc, /אמא של נועה/);

function ROLE(pack, role) {
  return pack.people.find((item) => item.role === role).name;
}

console.log("simple demo ok");
