(function (root, factory) {
  const api = factory(root);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NohwSpeech = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (root) {
  const LISTEN_MS = 8000;
  const LANG = "he-IL";

  function sameOriginUrl(value, origin) {
    const raw = String(value || "").trim();
    const base = String(origin || "").trim();
    if (!raw || !base) return "";
    let url;
    try { url = new URL(raw, base); } catch (e) { return ""; }
    let home;
    try { home = new URL(base); } catch (e) { return ""; }
    if (url.origin !== home.origin) return "";
    if (url.protocol !== "https:" && url.protocol !== "http:") return "";
    return url.href;
  }
  function sttOrder(env, settings) {
    env = env || {};
    settings = settings || {};
    const order = [];
    const url = sameOriginUrl(settings.sttUrl, env.origin);
    if (url) order.push({ id: "remote", url: url });
    if (env.webSpeech) order.push({ id: "web" });
    if (!order.length) order.push({ id: "none" });
    return order;
  }
  function chooseStt(env, settings) {
    return sttOrder(env, settings)[0];
  }
  function ttsOrder(id, text, settings, clip, origin) {
    settings = settings || {};
    const order = [];
    if (clip) order.push({ id: "clip", src: String(clip) });
    const url = sameOriginUrl(settings.ttsUrl, origin);
    if (url) order.push({ id: "remote", url: url, text: String(text || "") });
    order.push({ id: "synth", text: String(text || "") });
    return order;
  }
  function chooseTts(id, text, settings, clip, origin) {
    return ttsOrder(id, text, settings, clip, origin)[0];
  }
  function normalize(text) {
    const value = String(text || "").replace(/[\u200e\u200f]/g, "").replace(/\s+/g, " ").trim().replace(/[.!?؟…]+$/g, "").trim();
    return value.slice(0, 200);
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
      enable: function () {
        handsFree = true;
        mode = "listening";
        return mode;
      },
      disable: function () {
        handsFree = false;
        mode = "off";
        return mode;
      },
      tap: function () {
        mode = "listening";
        return mode;
      },
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
  function transcribeRemote(fetchFn, url, blob, origin) {
    const plan = chooseStt({ webSpeech: false, origin: origin }, { sttUrl: url });
    if (plan.id !== "remote") return Promise.reject(new Error("blocked"));
    return Promise.resolve().then(function () {
      return fetchFn(plan.url, {
        method: "POST",
        headers: { "content-type": (blob && blob.type) || "application/octet-stream" },
        body: blob
      });
    }).then(function (res) {
      if (!res || !res.ok) throw new Error("remote");
      return res.json();
    }).then(function (body) {
      return normalize(body && body.text);
    });
  }
  function synthesizeRemote(fetchFn, url, text, origin) {
    const plan = chooseTts("", text, { ttsUrl: url }, "", origin);
    if (plan.id !== "remote") return Promise.reject(new Error("blocked"));
    return Promise.resolve().then(function () {
      return fetchFn(plan.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: String(text || "").slice(0, 500) })
      });
    }).then(function (res) {
      if (!res || !res.ok || !res.blob) throw new Error("remote");
      return res.blob();
    });
  }
  function speak(items, hooks, env) {
    env = env || {};
    hooks = hooks || {};
    const speaker = env.speaker;
    const settings = env.settings || {};
    const origin = env.origin || "";
    const list = items || [];
    let index = 0;
    let stopped = false;
    function finish() {
      if (stopped) return;
      if (hooks.done) hooks.done();
    }
    function step() {
      if (stopped) return;
      if (index >= list.length) { finish(); return; }
      const item = list[index];
      const at = index;
      index += 1;
      if (hooks.phrase) hooks.phrase(at);
      const clip = speaker && speaker.clipFor ? speaker.clipFor(item.id) : "";
      const order = ttsOrder(item.id, item.text, settings, clip, origin);
      tryPlan(order, 0, item);
    }
    function tryPlan(order, n, item) {
      if (stopped) return;
      const plan = order[n];
      if (!plan) { step(); return; }
      if (plan.id === "remote") {
        synthesizeRemote(env.fetch || root.fetch, plan.url, plan.text, origin).then(function (blob) {
          if (stopped) return;
          playBlob(blob, function () { step(); });
        }).catch(function () {
          if (!stopped) tryPlan(order, n + 1, item);
        });
        return;
      }
      if (speaker && speaker.speakQueue) {
        const spoken = plan.id === "clip" ? [item] : [{ id: "", text: item.text }];
        speaker.speakQueue(spoken, { done: function () { if (!stopped) step(); } });
        return;
      }
      step();
    }
    function playBlob(blob, done) {
      const AudioCtor = root.Audio;
      const makeUrl = root.URL && root.URL.createObjectURL;
      if (!AudioCtor || !makeUrl || !blob) { done(); return; }
      const src = root.URL.createObjectURL(blob);
      const audio = new AudioCtor(src);
      const end = function () {
        try { root.URL.revokeObjectURL(src); } catch (e) {}
        done();
      };
      audio.onended = end;
      audio.onerror = end;
      const played = audio.play();
      if (played && played.catch) played.catch(end);
    }
    step();
    return {
      cancel: function () {
        stopped = true;
        if (speaker && speaker.cancel) speaker.cancel();
      }
    };
  }

  return {
    LISTEN_MS: LISTEN_MS,
    LANG: LANG,
    sameOriginUrl: sameOriginUrl,
    sttOrder: sttOrder,
    chooseStt: chooseStt,
    ttsOrder: ttsOrder,
    chooseTts: chooseTts,
    normalize: normalize,
    names: names,
    routeTranscript: routeTranscript,
    studentsMaySpeak: studentsMaySpeak,
    conversation: conversation,
    transcribeRemote: transcribeRemote,
    synthesizeRemote: synthesizeRemote,
    speak: speak
  };
});
