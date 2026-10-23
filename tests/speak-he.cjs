const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../simple/speak-he.js");
const H = require("../simple/avatar-he.js");

assert.equal(P.pronounce("ד׳1"), "דָּלֶת אַחַת");
assert.equal(P.pronounce("ד'1"), "דָּלֶת אַחַת");
assert.equal(P.pronounce("ה'2"), "הֵא שְׁתַּיִם");
assert.equal(P.pronounce("18:00"), "בְּשֵׁשׁ בָּעֶרֶב");
assert.equal(P.pronounce("ב-18:00"), "בְּשֵׁשׁ בָּעֶרֶב");
assert.equal(P.pronounce("אזכיר לך ב-18:00 על חשבון."), "אזכיר לך בְּשֵׁשׁ בָּעֶרֶב על חֶשְׁבּוֹן.");
assert.equal(P.pronounce("15:30"), "בְּשָׁלוֹשׁ וָחֵצִי אַחַר הַצָּהֳרַיִם");
assert.equal(P.pronounce("17:15"), "בְּחָמֵשׁ וָרֶבַע בָּעֶרֶב");
assert.equal(P.pronounce("ילד 1"), "ילד אֶחָד");
assert.equal(P.pronounce("כיתה 2"), "כיתה שְׁתַּיִם");
assert.equal(P.pronounce("2 ילדים"), "שְׁנֵי ילדים");
assert.equal(P.pronounce("2 כיתות"), "שְׁתֵּי כיתות");
assert.equal(P.pronounce("1 מתוך 2"), "אֶחָד מתוך שְׁנַיִם");
assert.equal(P.pronounce("אני יודע רק מה שקשור לכיתה 😊"), "אני יודע רק מה שקשור לכיתה");
assert.equal(P.pronounce("להיום לא נשאר כלום 🎉"), "להיום לא נשאר כלום");
assert.equal(P.pronounce("שיעורי בית"), "שיעורי בַּיִת");
assert.equal(P.pronounce("תנ״ך"), "תַּנַ״ךְ");
assert.equal(P.pronounce("נועה"), "נוֹעָה");
assert.equal(P.pronounce("   "), "");

const ranked = P.rankVoices([
  { name: "Carmit", lang: "he-IL", localService: true },
  { name: "Google עברית", lang: "he-IL", localService: false },
  { name: "Microsoft Hila Online", lang: "he-IL", localService: false },
  { name: "Samantha", lang: "en-US", localService: true }
]);
assert.equal(ranked.length, 3);
assert.equal(ranked[0].name, "Microsoft Hila Online");
assert.equal(ranked[1].name, "Google עברית");
assert.equal(P.rankVoices([{ name: "Google Asaf Natural", lang: "he-IL", localService: false }, { name: "Microsoft Hila Online", lang: "he-IL", localService: false }])[0].name, "Google Asaf Natural");
P.setPreferredVoice("Carmit");
assert.equal(P.chooseVoice(ranked).name, "Carmit");
P.setPreferredVoice("");
assert.equal(P.chooseVoice(ranked).name, "Microsoft Hila Online");

const Speech = require("../simple/speech.js");
assert.equal(P.clipFor("fallback"), "");
const plain = P.resolveSpeech("fallback", H.text("fallback"));
assert.equal(plain.mode, "clip");
assert.equal(plain.src, Speech.clipSrc("fallback"));
assert.equal(plain.text.includes("😊"), false);
assert.equal(P.resolveSpeech("", "שלום").mode, "synth");
P.setClip("voice-test", "audio/voice-test.mp3");
assert.equal(P.clipFor("voice-test"), "audio/voice-test.mp3");
const saved = P.resolveSpeech("voice-test", H.text("voice-test"));
assert.equal(saved.mode, "clip");
assert.equal(saved.src, "audio/voice-test.mp3");

const speak = fs.readFileSync(path.join(__dirname, "..", "simple", "speak-he.js"), "utf8");
assert.match(speak, /voiceschanged/);
assert.match(speak, /he-IL/);
assert.match(speak, /rate = 0\.95/);
assert.match(speak, /pitch = 1/);
const app = fs.readFileSync(path.join(__dirname, "..", "simple", "app.js"), "utf8");
assert.match(app, /speakQueue/);
assert.match(app, /helper-voice-test/);
assert.match(app, /readAloud = !!pref\.on/);
const doc = fs.readFileSync(path.join(__dirname, "..", "docs", "avatar-hebrew-lines.md"), "utf8");
H.lines().forEach(function (line) {
  line.text.split("\n").forEach(function (part) {
    assert.equal(doc.includes(part), true, part);
  });
});
assert.match(doc, /HilaNeural/);
assert.match(doc, /Wavenet/);

console.log("speak he ok");
