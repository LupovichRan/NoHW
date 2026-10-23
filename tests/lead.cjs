const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const S = require("../simple/logic.js");
const D = require("../simple/demo.js");
const L = require("../simple/lead.js");

const today = "2026-10-23";
const helper = D.scenarioById("helper", today);
const hidden = D.scenarioById("hidden", today);
const principal = D.scenarioById("principal-demo", today);
const stale = D.scenarioById("stale", today);
const none = D.scenarioById("none", today);
const empty = D.scenarioById("setup-school", today);
const parents = D.scenarioById("parents-msg", today);

function person(pack, id) {
  return pack.people.find((item) => item.id === id);
}
function ids(pack) {
  return pack.cards.map((item) => item.id);
}
function blob(pack) {
  return JSON.stringify(pack.cards);
}
const noa = person(helper, "s-k-noa");
const yael = person(helper, "par-yael");
const michal = person(helper, "t-c-h2");
const dana = person(helper, "p-s-alon");
const admin = person(helper, "admin");

assert.equal(L.partOf(8), "morning");
assert.equal(L.partOf(15), "afternoon");
assert.equal(L.partOf(19), "evening");
assert.equal(L.waitingPhrase(1), "מקצוע אחד עוד לא עודכן");
assert.equal(L.waitingPhrase(2), "2 מקצועות עוד לא עודכנו");

const studentAfternoon = L.opening(helper.state, noa, { today, hour: 15, people: helper.people });
assert.equal(studentAfternoon.mode, "home");
assert.equal(studentAfternoon.part, "afternoon");
assert.equal(studentAfternoon.cards[0].id, "tomorrow");
assert.equal(studentAfternoon.cards.length >= 2 && studentAfternoon.cards.length <= 4, true);
assert.match(blob(studentAfternoon), /עמ׳ 18/);
assert.match(blob(studentAfternoon), /קריאה/);
assert.match(blob(studentAfternoon), /כתיב/);
assert.match(blob(studentAfternoon), /מבחן ביום א׳/);
assert.equal(blob(studentAfternoon).includes("עומר"), false);
assert.equal(blob(studentAfternoon).includes("שיחת הורים"), false);
assert.equal(blob(studentAfternoon).includes("סיימתי"), false);
const ticks = studentAfternoon.cards.find((item) => item.id === "tomorrow").widget.rows.filter((row) => row.tick);
assert.equal(ticks.length > 0, true);
assert.equal(ticks.some((row) => row.label.includes("עמ׳ 18")), true);

const studentMorning = L.opening(helper.state, noa, { today, hour: 8, people: helper.people });
assert.equal(studentMorning.cards[0].id === "tomorrow" || studentMorning.cards[0].id === "today", true);

const parentEvening = L.opening(helper.state, yael, { today, hour: 19, people: helper.people });
assert.equal(parentEvening.cards[0].id, "kid:k-noa");
assert.match(blob(parentEvening), /נועה/);
assert.match(blob(parentEvening), /שיחת הורים/);
assert.equal(blob(parentEvening).includes("עומר"), false);

const teacherMorning = L.opening(helper.state, michal, { today, hour: 8, people: helper.people });
assert.equal(teacherMorning.cards[0].id, "unposted");
assert.match(teacherMorning.cards[0].title, /מקצוע אחד עוד לא עודכן/);
assert.match(teacherMorning.cards[0].text, /אנגלית/);
assert.deepEqual(teacherMorning.cards[0].chips.map((item) => item.label), ["לעדכן עכשיו", "אין שיעורים"]);
assert.match(blob(teacherMorning), /נועה/);
assert.match(blob(teacherMorning), /עומר/);
assert.match(blob(teacherMorning), /סיימתי/);
assert.equal(teacherMorning.cards[0].expand.name, "homework");

const two = JSON.parse(JSON.stringify(helper.state));
delete two.schools[0].classrooms[0].homework[today]["עברית"];
const twoPack = L.opening(two, michal, { today, hour: 8, people: helper.people });
assert.equal(twoPack.cards[0].title, "2 מקצועות עוד לא עודכנו");
assert.match(twoPack.cards[0].text, /אנגלית/);
assert.match(twoPack.cards[0].text, /עברית/);

const principalHome = L.opening(principal.state, person(principal, "p-s-alon"), { today, hour: 9, people: principal.people });
assert.equal(principalHome.mode, "home");
assert.match(blob(principalHome), /ה'2/);
assert.match(blob(principalHome), /ד'1/);
assert.match(blob(principalHome), /פורסם/);
assert.match(blob(principalHome), /%/);
assert.match(blob(principalHome), /ניהול כיתות/);
assert.equal(blob(principalHome).includes("נועה"), false);
assert.equal(blob(principalHome).includes("עומר"), false);
assert.equal(blob(principalHome).includes("תמר"), false);

const adminHome = L.opening(helper.state, admin, { today, hour: 10, people: helper.people });
assert.match(blob(adminHome), /אלון/);
assert.match(blob(adminHome), /עוד לא עודכן/);
assert.equal(blob(adminHome).includes("נועה"), false);
assert.equal(blob(adminHome).includes("עומר"), false);

const setup = L.opening(empty.state, person(empty, "admin"), { today, hour: 9, people: empty.people });
assert.equal(setup.mode, "setup");
assert.equal(setup.cards.length, 0);
assert.equal(setup.progress.complete, false);

const seen = {};
teacherMorning.cards.forEach((item) => { seen[item.id] = item.fingerprint; });
const again = L.opening(helper.state, michal, { today, hour: 8, people: helper.people, seen });
assert.equal(again.cards.some((item) => item.id === "unposted"), false);
const changed = JSON.parse(JSON.stringify(helper.state));
delete changed.schools[0].classrooms[0].homework[today]["חשבון"];
const moved = L.opening(changed, michal, { today, hour: 8, people: helper.people, seen });
assert.equal(moved.cards[0].id, "unposted");
assert.match(moved.cards[0].text, /אנגלית/);

const teacherHidden = L.opening(hidden.state, person(hidden, "t-c-h2"), { today, hour: 8, people: hidden.people });
const hiddenText = JSON.stringify(teacherHidden);
assert.equal(hiddenText.includes("ד'1"), false);
assert.equal(hiddenText.includes("ברוש"), false);
const studentHidden = L.opening(hidden.state, person(hidden, "s-k-noa"), { today, hour: 15, people: hidden.people });
const studentHiddenText = JSON.stringify(studentHidden);
assert.equal(studentHiddenText.includes("תמר"), false);
assert.equal(studentHiddenText.includes("עידו"), false);
assert.equal(studentHiddenText.includes("ברוש"), false);
const parentHidden = L.opening(hidden.state, person(hidden, "par-yael"), { today, hour: 19, people: hidden.people });
const parentHiddenText = JSON.stringify(parentHidden);
assert.match(parentHiddenText, /נועה/);
assert.match(parentHiddenText, /תמר/);
assert.equal(parentHiddenText.includes("עידו"), false);
assert.equal(parentHiddenText.includes("ברוש"), false);

const stalePack = L.opening(stale.state, person(stale, "s-k-noa"), { today, hour: 15, people: stale.people });
assert.match(blob(stalePack), /לא עודכן/);
assert.equal(blob(stalePack).includes("אין שיעורים"), false);
const nonePack = L.opening(none.state, person(none, "s-k-noa"), { today, hour: 15, people: none.people });
assert.match(blob(nonePack), /אין שיעורים/);

const actor = D.personActor(helper.state, michal);
const posted = L.perform(helper.state, actor, "post-now", teacherMorning.cards[0], { today });
assert.equal(posted.ok, true);
assert.equal(posted.navigate.subject, "אנגלית");
assert.equal(posted.navigate.fromLead, true);
const denied = L.perform(helper.state, D.personActor(helper.state, noa), "none-day", teacherMorning.cards[0], { today });
assert.equal(denied.ok, false);
const copy = JSON.parse(JSON.stringify(helper.state));
const cleared = L.perform(copy, D.personActor(copy, michal), "none-day", teacherMorning.cards[0], { today });
assert.equal(cleared.ok, true);
assert.match(cleared.text, /אין שיעורים להיום/);
S.rowsFor(copy.schools[0].classrooms[0], today, null).forEach((row) => assert.equal(row.status, "no-homework"));

const parentMsg = L.opening(parents.state, person(parents, "par-yael"), { today, hour: 20, people: parents.people });
assert.match(blob(parentMsg), /התראה/);
assert.match(blob(parentMsg), /שיחת הורים מחר/);
const studentMsg = L.opening(parents.state, person(parents, "s-k-noa"), { today, hour: 15, people: parents.people });
assert.equal(blob(studentMsg).includes("שיחת הורים"), false);

const source = fs.readFileSync(path.join(__dirname, "..", "simple", "lead.js"), "utf8");
assert.equal(/fetch\s*\(|XMLHttpRequest|WebSocket|openai|api[_-]?key/i.test(source), false);
const app = fs.readFileSync(path.join(__dirname, "..", "simple", "app.js"), "utf8");
assert.match(app, /lead-expand/);
assert.match(app, /lead-chip/);
assert.match(app, /פתח מסך מלא/);
assert.match(app, /textContent/);
const sw = fs.readFileSync(path.join(__dirname, "..", "simple", "sw.js"), "utf8");
assert.match(sw, /nohw-simple-v21/);
assert.match(sw, /lead\.js/);

console.log("lead ok");
