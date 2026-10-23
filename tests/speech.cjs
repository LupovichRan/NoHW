const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Speech = require("../simple/speech.js");
const S = require("../simple/logic.js");
const G = require("../simple/setup.js");
const A = require("../simple/assistant.js");
const D = require("../simple/demo.js");

const today = "2026-10-23";

assert.equal(Speech.normalize("  מה יש למחר?  "), "מה יש למחר");
assert.equal(Speech.normalize("כן."), "כן");
assert.equal(Speech.normalize("לא!"), "לא");
assert.equal(Speech.normalize(""), "");

assert.deepEqual(Speech.names("נועה, תמר, אורי"), ["נועה", "תמר", "אורי"]);
assert.equal(Speech.names("נועה, תמר, אורי").length, 3);
assert.deepEqual(Speech.names("דנה כהן"), ["דנה כהן"]);
assert.deepEqual(Speech.routeTranscript("עמוד 3", "homework"), { ok: true, kind: "field", text: "עמוד 3", names: [] });
assert.equal(Speech.routeTranscript("כן.", "chat").text, "כן");
assert.equal(Speech.routeTranscript("   ", "chat").ok, false);

const helper = D.scenarioById("helper", today);
const noa = helper.people.find(function (item) { return item.id === "s-k-noa"; });
const heard = Speech.routeTranscript("מה יש למחר?", "chat");
const answer = A.ask(helper.state, noa, { text: heard.text, today: today });
assert.equal(answer.intent, "tomorrow-work");
assert.match(answer.text, /עמ׳ 18/);
const yes = Speech.routeTranscript("כן!", "chat");
assert.equal(yes.text, "כן");

const state = S.emptyState();
const code = S.addPrincipal(state, { role: "admin" }, { schoolName: "דקל", principalName: "רן" }, function () { return 0.2; });
const school = state.schools[0];
S.addClassroom(state, { role: "principal", code: code }, { schoolId: school.id, className: "ה'2", teacherName: "מיכל" }, Math.random);
const room = school.classrooms[0];
const who = { role: "teacher", classId: room.id, schoolId: school.id };
let kids = G.guide(state, who, null, "", { today: today, intent: "setup-kids" });
kids = G.guide(state, who, kids.session, Speech.normalize("נועה, תמר, אורי"), { today: today });
assert.deepEqual(kids.confirm.payload.names, ["נועה", "תמר", "אורי"]);
assert.equal(room.kids.length, 0);

assert.equal(Speech.listenWith(true), "web");
assert.equal(Speech.listenWith(false), "none");
assert.equal(Speech.speakWith("clip.mp3"), "clip");
assert.equal(Speech.speakWith(""), "synth");
assert.equal(Speech.clipSrc("greet-student"), "voice/greet-student.mp3");
assert.equal(Speech.clipSrc("draft-keep-1"), "voice/draft-keep-1.mp3");
assert.equal(Speech.clipSrc(""), "");
assert.equal(Speech.clipSrc("../secret"), "");
assert.equal(Speech.clipSrc("voice/greet-student.mp3"), "");

const talk = Speech.conversation();
assert.equal(talk.mode(), "off");
assert.equal(talk.enable(), "listening");
assert.equal(talk.handsFree(), true);
const said = talk.final("מה יש למחר?");
assert.equal(said.accepted, true);
assert.equal(said.text, "מה יש למחר");
assert.equal(talk.mode(), "speaking");
assert.equal(talk.endSpeak(), "listening");
assert.equal(talk.timeout(), true);
assert.equal(talk.mode(), "idle");
assert.equal(talk.handsFree(), true);
assert.equal(talk.tap(), "listening");
talk.disable();
assert.equal(talk.mode(), "off");
assert.equal(talk.final("כן").accepted, false);

const once = Speech.conversation();
assert.equal(once.tap(), "listening");
assert.equal(once.final("כן.").text, "כן");
assert.equal(once.mode(), "off");
assert.equal(once.handsFree(), false);
assert.equal(once.timeout(), false);

const teacher = { role: "teacher", code: room.teacherCode };
assert.equal(S.studentMicOn(room), true);
assert.equal(Speech.studentsMaySpeak(room), true);
assert.deepEqual(S.setStudentMic(state, teacher, { classId: room.id, on: false }), { students: false });
assert.equal(Speech.studentsMaySpeak(room), false);
assert.throws(function () { S.setStudentMic(state, { role: "student", code: "nope" }, { classId: room.id, on: true }); }, /forbidden/);
const packed = S.packFor(state, "teacher", room.teacherCode);
assert.equal(packed.schools[0].classrooms[0].mic.students, false);
const copy = S.emptyState();
S.importPack(copy, packed);
assert.equal(copy.schools[0].classrooms[0].mic.students, false);
S.setStudentMic(state, teacher, { classId: room.id, on: true });
assert.equal(room.mic, undefined);

const speech = fs.readFileSync(path.join(__dirname, "..", "simple", "speech.js"), "utf8");
assert.doesNotMatch(speech, /api[_-]?key|authorization|bearer |sk-|openai|subscription|fetch\(/i);
assert.match(speech, /he-IL/);
assert.match(speech, /TODO/);
const app = fs.readFileSync(path.join(__dirname, "..", "simple", "app.js"), "utf8");
assert.match(app, /micbig/);
assert.match(app, /דיבור רצוף/);
assert.match(app, /הכתבה/);
assert.match(app, /מקשיב\.\.\./);
assert.match(app, /אין הרשאה למיקרופון/);
assert.match(app, /הדיבור לא זמין בדפדפן זה/);
assert.match(app, /זיהוי הדיבור בדפדפן עשוי לשלוח שמע לספק הדפדפן/);
assert.match(app, /track\.stop\(\)/);
const page = fs.readFileSync(path.join(__dirname, "..", "simple", "index.html"), "utf8");
assert.match(page, /speech\.js/);
assert.match(page, /connect-src 'self'/);
const sw = fs.readFileSync(path.join(__dirname, "..", "simple", "sw.js"), "utf8");
assert.match(sw, /nohw-simple-v23/);
assert.match(sw, /speech\.js/);
assert.match(sw, /voice\/lines\.json/);
assert.match(sw, /voice\/hashes\.json/);
const H = require("../simple/avatar-he.js");
const P = require("../simple/speak-he.js");
const lines = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "simple", "voice", "lines.json"), "utf8"));
const byId = {};
lines.forEach(function (line) { byId[line.id] = line.text; });
H.lines().forEach(function (line) {
  assert.equal(byId[line.id], P.pronounce(line.text), line.id);
  const parts = String(line.text).split(/\n+/);
  if (parts.length < 2) return;
  parts.forEach(function (part, index) {
    assert.equal(byId[line.id + "-" + (index + 1)], P.pronounce(part), line.id);
  });
});
assert.equal(H.idFor("הכנתי טיוטה."), "draft-keep-1");
assert.equal(H.idFor(H.text("remind-all-done")), "remind-all-done");
const voiceDir = path.join(__dirname, "..", "simple", "voice");
const hashes = JSON.parse(fs.readFileSync(path.join(voiceDir, "hashes.json"), "utf8"));
assert.equal(Array.isArray(hashes), false);
Object.keys(hashes).forEach(function (id) {
  assert.equal(typeof byId[id], "string", id);
  assert.equal(fs.existsSync(path.join(voiceDir, id + ".mp3")), true, id);
});
fs.readdirSync(voiceDir).forEach(function (name) {
  if (!name.endsWith(".mp3")) return;
  assert.equal(typeof hashes[name.slice(0, -4)], "string", name);
});
const tool = fs.readFileSync(path.join(__dirname, "..", "tools", "gen-voice.mjs"), "utf8");
assert.match(tool, /AZURE_SPEECH_KEY/);
assert.match(tool, /AZURE_SPEECH_REGION/);
assert.match(tool, /he-IL-HilaNeural/);
assert.match(tool, /audio-24khz-48kbitrate-mono-mp3/);
assert.match(tool, /cognitiveservices\/v1/);
assert.doesNotMatch(tool, /AZURE_SPEECH_KEY\s*=\s*["'][^"']+["']/);
assert.equal(fs.readdirSync(path.join(__dirname, "..", "simple", "voice")).some(function (name) { return name.endsWith(".mp3"); }), false);

console.log("speech ok");
