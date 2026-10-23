(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NohwSpeak = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  // ניקוד והגייה נאמרים בלבד. הם לא מוצגים בבועה.
  const FEM = {
    1: "אַחַת",
    2: "שְׁתַּיִם",
    3: "שָׁלוֹשׁ",
    4: "אַרְבַּע",
    5: "חָמֵשׁ",
    6: "שֵׁשׁ",
    7: "שֶׁבַע",
    8: "שְׁמוֹנֶה",
    9: "תֵּשַׁע",
    10: "עֶשֶׂר",
    11: "אַחַת עֶשְׂרֵה",
    12: "שְׁתֵּים עֶשְׂרֵה"
  };
  const MASC = {
    1: "אֶחָד",
    2: "שְׁנַיִם",
    3: "שְׁלוֹשָׁה",
    4: "אַרְבָּעָה",
    5: "חֲמִשָּׁה",
    6: "שִׁשָּׁה",
    7: "שִׁבְעָה",
    8: "שְׁמוֹנָה",
    9: "תִּשְׁעָה",
    10: "עֲשָׂרָה",
    11: "אֶחָד עָשָׂר",
    12: "שְׁנֵים עָשָׂר"
  };
  const LETTERS = {
    "א": "אַלֶף",
    "ב": "בֵּית",
    "ג": "גִּימֶל",
    "ד": "דָּלֶת",
    "ה": "הֵא",
    "ו": "וָו"
  };
  const FEM_NOUNS = ["כיתה", "כיתות", "שעה", "הודעה", "הודעות", "דקה", "תמונה", "ילדה", "בועה"];
  const MASC_NOUNS = ["ילד", "ילדים", "יום", "מקצוע", "מקצועות", "שיעור", "שיעורים", "רצף", "תלמיד", "תלמידים"];
  const WORDS = [
    ["שיעורי בית", "שיעורי בַּיִת"],
    ["תנ״ך", "תַּנַ״ךְ"],
    ["תנ\"ך", "תַּנַ״ךְ"],
    ["תנך", "תַּנַ״ךְ"],
    ["חשבון", "חֶשְׁבּוֹן"],
    ["עברית", "עִבְרִית"],
    ["אנגלית", "אַנְגְּלִית"],
    ["מדעים", "מַדָּעִים"],
    ["נועה", "נוֹעָה"],
    ["עומר", "עֹמֶר"],
    ["יעל", "יַעֵל"],
    ["תמר", "תָּמָר"],
    ["דנה", "דָּנָה"],
    ["מיכל", "מִיכַל"],
    ["יואב", "יוֹאָב"],
    ["נועם", "נֹעַם"],
    ["אלון", "אַלּוֹן"],
    ["אביב", "אָבִיב"],
    ["ברק", "בָּרָק"],
    ["כהן", "כֹּהֵן"]
  ];
  let clips = Object.create(null);
  let preferredName = "";
  let seq = 0;
  let audio = null;

  function sayNumber(n, gender) {
    const map = gender === "f" ? FEM : MASC;
    const value = Number(n);
    if (map[value]) return map[value];
    return String(n);
  }
  function sayCount(n, gender, beforeNoun) {
    if (beforeNoun && Number(n) === 2) return gender === "f" ? "שְׁתֵּי" : "שְׁנֵי";
    return sayNumber(n, gender);
  }
  function dayPart(hour) {
    if (hour >= 5 && hour <= 11) return "בַּבֹּקֶר";
    if (hour === 12) return "בַּצָּהֳרַיִם";
    if (hour >= 13 && hour <= 16) return "אַחַר הַצָּהֳרַיִם";
    if (hour >= 17 && hour <= 20) return "בָּעֶרֶב";
    return "בַּלַּיְלָה";
  }
  function hour12(hour) {
    const value = hour % 12;
    return value === 0 ? 12 : value;
  }
  function sayTime(hour, minute) {
    const part = dayPart(hour);
    const shown = hour12(hour);
    const word = sayNumber(shown, "f");
    if (minute === 0) return "בְּ" + word + " " + part;
    if (minute === 15) return "בְּ" + word + " וָרֶבַע " + part;
    if (minute === 30) return "בְּ" + word + " וָחֵצִי " + part;
    if (minute === 45) {
      const next = hour12(hour + 1);
      return "בְּ" + sayNumber(next, "f") + " פָּחוֹת רֶבַע " + part;
    }
    return "בְּ" + word + " וְ" + sayNumber(minute, "f") + " " + part;
  }
  function nounGender(word) {
    if (FEM_NOUNS.indexOf(word) >= 0) return "f";
    if (MASC_NOUNS.indexOf(word) >= 0) return "m";
    return "";
  }
  function stripEmoji(value) {
    return String(value || "")
      .replace(/\u200d|\ufe0f/g, "")
      .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
      .replace(/[🎉😊🎤✓○]/g, "");
  }
  function replaceWord(value, from, to) {
    const pattern = new RegExp("(^|[^\\u0590-\\u05FF])" + from + "(?=$|[^\\u0590-\\u05FF])", "g");
    return value.replace(pattern, function (all, lead) { return lead + to; });
  }
  function pronounce(value) {
    let text = stripEmoji(value).replace(/\s+/g, " ").trim();
    if (!text) return "";
    text = text.replace(/([אבגדהו])['׳′](\d{1,2})/g, function (_all, letter, num) {
      const name = LETTERS[letter] || letter;
      return name + " " + sayNumber(num, "f");
    });
    text = text.replace(/ב-?(\d{1,2})[:.](\d{2})/g, function (_all, hour, minute) {
      return sayTime(Number(hour), Number(minute));
    });
    text = text.replace(/(^|[^\d])(\d{1,2})[:.](\d{2})(?!\d)/g, function (all, lead, hour, minute) {
      if (!lead && all.charAt(0) !== hour.charAt(0) && !/^\d/.test(all)) return all;
      return lead + sayTime(Number(hour), Number(minute));
    });
    WORDS.forEach(function (pair) { text = replaceWord(text, pair[0], pair[1]); });
    text = text.replace(/(\d{1,2})\s+מתוך\s+(\d{1,2})/g, function (_all, a, b) {
      return sayNumber(a, "m") + " מתוך " + sayNumber(b, "m");
    });
    text = text.replace(/(\d{1,2})\s+([\u0590-\u05FF]+)/g, function (all, num, word) {
      const gender = nounGender(word);
      if (!gender) return all;
      return sayCount(num, gender, true) + " " + word;
    });
    text = text.replace(/([\u0590-\u05FF]+)\s+(\d{1,2})/g, function (all, word, num) {
      const gender = nounGender(word);
      if (!gender) return all;
      return word + " " + sayNumber(num, gender);
    });
    return text.replace(/\s+/g, " ").trim();
  }
  function voiceScore(voice) {
    const lang = String(voice && voice.lang || "");
    if (!/^he([-_]|$)/i.test(lang)) return -1;
    const name = String(voice.name || "");
    let score = 10;
    if (/google/i.test(name)) score += 50;
    if (/microsoft/i.test(name)) score += 40;
    if (/online|natural|neural/i.test(name)) score += 30;
    if (/hila|avri|asaf/i.test(name)) score += 25;
    if (/he-il/i.test(lang)) score += 5;
    if (voice.localService === false) score += 8;
    return score;
  }
  function rankVoices(list) {
    return (list || []).filter(function (voice) { return voiceScore(voice) >= 0; }).sort(function (a, b) {
      return voiceScore(b) - voiceScore(a);
    });
  }
  function setPreferredVoice(name) {
    preferredName = String(name || "");
  }
  function preferredVoice() {
    return preferredName;
  }
  function chooseVoice(list) {
    const ranked = rankVoices(list);
    if (preferredName) {
      const picked = ranked.filter(function (voice) { return voice.name === preferredName; })[0];
      if (picked) return picked;
    }
    return ranked[0] || null;
  }
  function setClip(id, url) {
    if (!id || !url) return;
    clips[id] = String(url);
  }
  function clipFor(id) {
    return id && clips[id] ? clips[id] : "";
  }
  function resolveSpeech(id, text) {
    const spoken = pronounce(text);
    const registered = clipFor(id);
    if (registered) return { mode: "clip", src: registered, text: spoken };
    const local = root.NohwSpeech && id && root.NohwSpeech.clipSrc(id);
    if (local) return { mode: "clip", src: local, text: spoken };
    return { mode: "synth", text: spoken };
  }
  function cancel() {
    seq += 1;
    if (audio) {
      try { audio.pause(); } catch (e) {}
      audio = null;
    }
    const synth = root.speechSynthesis;
    if (synth) {
      try { synth.cancel(); } catch (e) {}
    }
  }
  function ensureVoices(done) {
    const synth = root.speechSynthesis;
    if (!synth || !synth.getVoices) { done([]); return; }
    const ready = synth.getVoices();
    if (ready && ready.length) { done(ready); return; }
    let finished = false;
    const finish = function () {
      if (finished) return;
      finished = true;
      done(synth.getVoices() || []);
    };
    if (synth.addEventListener) synth.addEventListener("voiceschanged", finish);
    else if (synth.onvoiceschanged !== undefined) {
      const prev = synth.onvoiceschanged;
      synth.onvoiceschanged = function () {
        if (prev) prev();
        finish();
      };
    }
    setTimeout(finish, 700);
  }
  function speakQueue(items, hooks) {
    cancel();
    const token = seq;
    hooks = hooks || {};
    const list = items || [];
    let index = 0;
    function step() {
      if (token !== seq) return;
      if (index >= list.length) {
        if (hooks.done) hooks.done();
        return;
      }
      const item = list[index];
      const current = index;
      index += 1;
      if (hooks.phrase) hooks.phrase(current);
      const plan = resolveSpeech(item.id, item.text);
      if (plan.mode === "clip") {
        playClip(plan.src, token, step, plan.text);
        return;
      }
      utter(plan.text, token, step);
    }
    setTimeout(step, 350);
  }
  function playClip(src, token, done, fallbackText) {
    const AudioCtor = root.Audio;
    if (!AudioCtor) { utter(fallbackText, token, done); return; }
    let settled = false;
    function finishOk() {
      if (settled || token !== seq) return;
      settled = true;
      setTimeout(done, 200);
    }
    function finishFail() {
      if (settled || token !== seq) return;
      settled = true;
      utter(fallbackText, token, done);
    }
    audio = new AudioCtor(src);
    audio.onended = finishOk;
    audio.onerror = finishFail;
    const played = audio.play();
    if (played && played.catch) played.catch(finishFail);
  }
  function utter(text, token, done) {
    const synth = root.speechSynthesis;
    if (!synth || !text || typeof root.SpeechSynthesisUtterance !== "function") {
      if (token === seq) done();
      return;
    }
    ensureVoices(function (voices) {
      if (token !== seq) return;
      const piece = new root.SpeechSynthesisUtterance(text);
      piece.lang = "he-IL";
      piece.rate = 0.95;
      piece.pitch = 1;
      const voice = chooseVoice(voices);
      if (voice) piece.voice = voice;
      piece.onend = function () { if (token === seq) setTimeout(done, 200); };
      piece.onerror = function () { if (token === seq) done(); };
      try { synth.speak(piece); } catch (e) { if (token === seq) done(); }
    });
  }

  return {
    pronounce: pronounce,
    sayNumber: sayNumber,
    sayCount: sayCount,
    sayTime: sayTime,
    voiceScore: voiceScore,
    rankVoices: rankVoices,
    chooseVoice: chooseVoice,
    setPreferredVoice: setPreferredVoice,
    preferredVoice: preferredVoice,
    setClip: setClip,
    clipFor: clipFor,
    resolveSpeech: resolveSpeech,
    ensureVoices: ensureVoices,
    speakQueue: speakQueue,
    cancel: cancel
  };
});
