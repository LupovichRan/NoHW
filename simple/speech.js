(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NohwSpeech = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const LISTEN_MS = 8000;
  const LANG = "he-IL";

  // Web Speech, or nothing. TODO: a remote recognizer can replace this later.
  function listenWith(hasWebSpeech) {
    return hasWebSpeech ? "web" : "none";
  }
  // A file in voice/{id}.mp3, otherwise the device voice. TODO: a remote voice can sit between them later.
  function clipSrc(id) {
    const clean = String(id || "");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) return "";
    return "voice/" + clean + ".mp3";
  }
  function speakWith(clip) {
    return clip ? "clip" : "synth";
  }
  function normalize(text) {
    return String(text || "").replace(/[\u200e\u200f]/g, "").replace(/\s+/g, " ").trim().replace(/[.!?؟…]+$/g, "").trim().slice(0, 200);
  }
  function names(text) {
    const out = [];
    String(text || "").replace(/\r/g, "").split(/\n+/).forEach(function (line) {
      line.split(/[,;،]/).forEach(function (part) {
        const value = part.replace(/\s+/g, " ").trim().slice(0, 40);
        if (!value || out.length >= 30 || out.indexOf(value) >= 0) return;
        out.push(value);
      });
    });
    return out;
  }
  function routeTranscript(text, target) {
    const clean = normalize(text);
    if (!clean) return { ok: false, kind: "", text: "", names: [] };
    if (target === "homework") return { ok: true, kind: "field", text: clean.slice(0, 80), names: [] };
    if (target === "message") return { ok: true, kind: "field", text: clean.slice(0, 280), names: [] };
    if (target === "kids") return { ok: true, kind: "kids", text: clean, names: names(clean) };
    return { ok: true, kind: "chat", text: clean, names: [] };
  }
  function studentsMaySpeak(room) {
    return !(room && room.mic && room.mic.students === false);
  }
  function conversation() {
    let handsFree = false;
    let mode = "off";
    return {
      handsFree: function () { return handsFree; },
      mode: function () { return mode; },
      enable: function () { handsFree = true; mode = "listening"; return mode; },
      disable: function () { handsFree = false; mode = "off"; return mode; },
      tap: function () { mode = "listening"; return mode; },
      beginSpeak: function () {
        if (!handsFree && mode === "off") return mode;
        mode = "speaking";
        return mode;
      },
      endSpeak: function () {
        if (handsFree) mode = "listening";
        else if (mode === "speaking") mode = "off";
        return mode;
      },
      final: function (text) {
        if (mode !== "listening") return { accepted: false, text: "" };
        const clean = normalize(text);
        if (!clean) return { accepted: false, text: "" };
        mode = handsFree ? "speaking" : "off";
        return { accepted: true, text: clean };
      },
      timeout: function () {
        if (mode !== "listening") return false;
        mode = handsFree ? "idle" : "off";
        return true;
      },
      stop: function () {
        const was = mode === "listening";
        mode = handsFree ? "idle" : "off";
        return was;
      }
    };
  }

  return {
    LISTEN_MS: LISTEN_MS,
    LANG: LANG,
    listenWith: listenWith,
    clipSrc: clipSrc,
    speakWith: speakWith,
    normalize: normalize,
    names: names,
    routeTranscript: routeTranscript,
    studentsMaySpeak: studentsMaySpeak,
    conversation: conversation
  };
});
