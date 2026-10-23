(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./logic.js") : root.Nohw;
  const api = factory(model);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NohwAssist = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (S) {
  const FALLBACK = "אני יודע רק מה שקשור לכיתה 😊";
  const DAY = ["יום א׳", "יום ב׳", "יום ג׳", "יום ד׳", "יום ה׳", "יום ו׳", "שבת"];
  const ROLES = {
    student: [
      { id: "tomorrow-work", label: "מה יש למחר?", keys: [["מה יש למחר"], ["מה יש מחר"], ["שיעורי בית", "מחר"], ["יש למחר"], ["שיעורים למחר"]] },
      { id: "left", label: "מה נשאר לי?", keys: [["מה נשאר לי"], ["מה נשאר"], ["לא סיימתי"], ["נשאר לי"]] },
      { id: "messages", label: "מה המורה שלחה?", keys: [["מה המורה שלחה"], ["המורה שלחה"], ["המורה שלח"], ["הודעות"]] },
      { id: "tomorrow-lessons", label: "איזה שיעורים מחר?", keys: [["איזה שיעורים מחר"], ["אילו שיעורים", "מחר"], ["מערכת", "מחר"], ["לוז", "מחר"], ["לו״ז", "מחר"], ["מה השיעורים מחר"]] },
      { id: "streak", label: "איך הרצף שלי?", keys: [["הרצף"], ["הרצף שלי"], ["רצף"], ["כמה ימים ברצף"]] }
    ],
    parent: [
      { id: "status", label: "מה המצב?", keys: [["מה המצב"], ["מצב השיעורים"], ["איך הולך"]] },
      { id: "left", label: "מה עוד לא הוכן?", keys: [["מה עוד לא הוכן"], ["לא הוכן"], ["מה נשאר"], ["עוד לא סיימו"]] },
      { id: "messages", label: "מה נשלח?", keys: [["מה נשלח"], ["הודעות"], ["מה שלחו"]] },
      { id: "week", label: "סיכום השבוע", keys: [["סיכום השבוע"], ["השבוע"], ["סיכום שבועי"]] }
    ],
    teacher: [
      { id: "unposted", label: "מה עוד לא פורסם?", keys: [["מה עוד לא פורסם"], ["לא פורסם"], ["מה חסר לפרסם"]] },
      { id: "unfinished", label: "מי עוד לא סיים?", keys: [["מי עוד לא סיים"], ["מי לא סיים"], ["עוד לא סיימו"], ["מי לא הוכן"]] },
      { id: "messages", label: "מה שלחתי?", keys: [["מה שלחתי"], ["הודעות ששלחתי"], ["מה נשלח"]] },
      { id: "remind", label: "נסח תזכורת", keys: [["נסח תזכורת"], ["תזכורת"], ["תנסח"], ["טיוטת תזכורת"]] }
    ],
    principal: [
      { id: "status", label: "מה מצב הכיתה?", keys: [["מה מצב הכיתה"], ["מצב הכיתה"], ["מה המצב"], ["סטטוס"]] }
    ]
  };
  ROLES.admin = ROLES.principal;

  function norm(value) {
    return String(value || "")
      .replace(/[\u0591-\u05C7]/g, "")
      .replace(/[?!.,:;]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  function chips(role) {
    return (ROLES[role] || []).map(function (item) { return { id: item.id, label: item.label }; });
  }
  function match(role, text) {
    const spoken = norm(text);
    if (!spoken) return "";
    const list = ROLES[role] || [];
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      if (norm(item.label) === spoken) return item.id;
      for (let k = 0; k < item.keys.length; k++) {
        const parts = item.keys[k];
        const ok = parts.every(function (part) { return spoken.indexOf(norm(part)) >= 0; });
        if (ok) return item.id;
      }
    }
    return "";
  }
  function findKid(state, id) {
    for (const school of (state && state.schools) || []) {
      for (const room of school.classrooms || []) {
        const kid = (room.kids || []).find(function (item) { return item.id === id; });
        if (kid) return { room: room, kid: kid };
      }
    }
    return null;
  }
  function findClass(state, id) {
    for (const school of (state && state.schools) || []) {
      const room = (school.classrooms || []).find(function (item) { return item.id === id; });
      if (room) return room;
    }
    return null;
  }
  function scopedKids(state, who) {
    if (!who) return [];
    if (who.role === "student") {
      const found = findKid(state, who.kidId);
      return found ? [found] : [];
    }
    if (who.role === "parent") {
      const out = [];
      (who.kidIds || []).forEach(function (id) {
        const found = findKid(state, id);
        if (found) out.push(found);
      });
      return out;
    }
    return [];
  }
  function mentionsOther(state, who, text) {
    const spoken = norm(text);
    if (!spoken || (who.role !== "student" && who.role !== "parent")) return false;
    const allowed = {};
    scopedKids(state, who).forEach(function (item) { allowed[item.kid.id] = 1; });
    for (const school of state.schools || []) {
      for (const room of school.classrooms || []) {
        for (const kid of room.kids || []) {
          if (allowed[kid.id]) continue;
          const name = norm(kid.firstName);
          if (name && spoken.indexOf(name) >= 0) return true;
        }
      }
    }
    return false;
  }
  function dayLabel(iso) {
    const parts = String(iso || "").split("-").map(Number);
    if (parts.length < 3) return "";
    return DAY[new Date(parts[0], parts[1] - 1, parts[2]).getDay()] || "";
  }
  function shift(today, days) {
    const parts = String(today).split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() + days);
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }
  function weekDates(today) {
    const parts = String(today).split("-").map(Number);
    const day = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    const start = shift(today, day === 6 ? -6 : -day);
    return [0, 1, 2, 3, 4, 5].map(function (offset) { return shift(start, offset); });
  }
  function lessons(room, iso) {
    const parts = String(iso).split("-").map(Number);
    const day = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    const slots = day === 6 ? null : room && room.timetable && room.timetable[String(day)];
    const names = [];
    if (Array.isArray(slots)) {
      slots.forEach(function (item) {
        const name = String(item || "").trim();
        if (name && names.indexOf(name) < 0) names.push(name);
      });
    }
    return names.length ? names : S.subjectsFor(room, iso);
  }
  function pushPhoto(list, item) {
    if (list.length >= 6) return;
    let id = "";
    let src = "";
    if (item && typeof item === "object") {
      id = String(item.id || "");
      src = String(item.src || "");
    } else src = String(item || "");
    if (src.indexOf("data:image/") !== 0) src = "";
    if (id && !/^[A-Za-z0-9_-]{1,48}$/.test(id)) id = "";
    if (!src && !id) return;
    const key = id || src;
    if (list.some(function (photo) { return (photo.id || photo.src) === key; })) return;
    list.push({ id: id, src: src });
  }
  function pushVoice(list, item) {
    if (list.length >= 4) return;
    let id = "";
    let src = "";
    let text = "";
    if (item && typeof item === "object") {
      id = String(item.id || "");
      src = String(item.src || "");
      text = String(item.text || "").slice(0, 280);
    } else src = String(item || "");
    if (src.indexOf("data:audio/") !== 0) src = "";
    if (id && !/^[A-Za-z0-9_-]{1,48}$/.test(id)) id = "";
    if (!src && !id) return;
    const key = id || src;
    if (list.some(function (voice) { return (voice.id || voice.src) === key; })) return;
    list.push({ id: id, src: src, text: text });
  }
  function takeRows(rows, photos, voices) {
    (rows || []).forEach(function (row) {
      if (!row || row.status !== "posted") return;
      (row.photos || []).forEach(function (item) { pushPhoto(photos, item); });
      (row.voices || []).forEach(function (item) { pushVoice(voices, item); });
    });
  }
  function takeMessage(msg, photos, voices) {
    const photosList = msg && msg.photos && msg.photos.length ? msg.photos : (msg && msg.photo ? [msg.photo] : []);
    const voicesList = msg && msg.voices && msg.voices.length ? msg.voices : (msg && msg.voice ? [msg.voice] : []);
    photosList.forEach(function (item) { pushPhoto(photos, item); });
    voicesList.forEach(function (item) { pushVoice(voices, item); });
  }
  function postedLine(row) {
    if (row.status === "posted") return row.subject + ": " + (row.text || "פורסם");
    if (row.status === "no-homework") return row.subject + ": אין שיעורים";
    return row.subject + ": לא עודכן";
  }
  function unfinished(room, date) {
    const lines = [];
    (room.kids || []).forEach(function (kid) {
      const left = S.rowsFor(room, date, kid).filter(function (row) { return row.status === "posted" && !row.done; });
      if (left.length) lines.push(kid.firstName + ": " + left.map(function (row) { return row.subject; }).join(", "));
    });
    return lines;
  }
  function answer(text, photos, voices, draft) {
    return { text: text, photos: photos || [], voices: voices || [], draft: draft || "" };
  }
  function studentAnswer(found, intent, today) {
    const room = found.room;
    const kid = found.kid;
    const photos = [];
    const voices = [];
    if (intent === "tomorrow-work") {
      const date = S.nextSchoolDay(today);
      const rows = S.rowsFor(room, date, kid);
      takeRows(rows, photos, voices);
      const body = rows.length ? rows.map(postedLine).join("\n") : "אין שיעורים למחר.";
      return answer("מחר, " + dayLabel(date) + ":\n" + body, photos, voices);
    }
    if (intent === "tomorrow-lessons") {
      const date = S.nextSchoolDay(today);
      const names = lessons(room, date);
      return answer("מחר בלו״ז, " + dayLabel(date) + ":\n" + names.join("\n"));
    }
    if (intent === "left") {
      const rows = S.rowsFor(room, today, kid).filter(function (row) { return row.status === "posted" && !row.done; });
      takeRows(rows, photos, voices);
      if (!rows.length) return answer("לא נשאר לך כלום להיום 🎉");
      return answer("נשאר לך:\n" + rows.map(function (row) { return row.subject + ": " + (row.text || "פורסם"); }).join("\n"), photos, voices);
    }
    if (intent === "messages") {
      const msgs = S.messagesFor(room, "student").slice(0, 5);
      msgs.forEach(function (msg) { takeMessage(msg, photos, voices); });
      if (!msgs.length) return answer("אין הודעות חדשות.");
      return answer("המורה שלחה:\n" + msgs.map(function (msg) { return msg.text || "הודעה"; }).join("\n"), photos, voices);
    }
    if (intent === "streak") {
      const dates = weekDates(today).filter(function (item) { return item <= today; }).reverse();
      let count = 0;
      for (let i = 0; i < dates.length; i++) {
        const rows = S.rowsFor(room, dates[i], kid).filter(function (row) { return row.status === "posted"; });
        if (!rows.length) continue;
        if (rows.every(function (row) { return row.done; })) count += 1;
        else if (dates[i] === today) continue;
        else break;
      }
      const todayRows = S.rowsFor(room, today, kid).filter(function (row) { return row.status === "posted"; });
      const done = todayRows.filter(function (row) { return row.done; }).length;
      return answer("הרצף שלך: " + count + ".\nהיום הוכנו " + done + " מתוך " + todayRows.length + ".");
    }
    return null;
  }
  function parentAnswer(kids, intent, today) {
    const photos = [];
    const voices = [];
    if (!kids.length) return null;
    if (intent === "status") {
      const blocks = kids.map(function (found) {
        const rows = S.rowsFor(found.room, today, found.kid);
        const body = rows.map(function (row) {
          if (row.status === "posted") return row.subject + ": " + (row.text || "פורסם") + " · " + (row.done ? "הוכן" : "עוד לא");
          if (row.status === "no-homework") return row.subject + ": אין שיעורים";
          return row.subject + ": לא עודכן";
        }).join("\n");
        return found.kid.firstName + ":\n" + body;
      });
      return answer(blocks.join("\n\n"));
    }
    if (intent === "left") {
      const blocks = kids.map(function (found) {
        const rows = S.rowsFor(found.room, today, found.kid).filter(function (row) { return row.status === "posted" && !row.done; });
        takeRows(rows, photos, voices);
        if (!rows.length) return found.kid.firstName + ": הכל הוכן";
        return found.kid.firstName + ":\n" + rows.map(function (row) { return row.subject + ": " + (row.text || "פורסם"); }).join("\n");
      });
      return answer(blocks.join("\n\n"), photos, voices);
    }
    if (intent === "messages") {
      const seen = {};
      const blocks = [];
      kids.forEach(function (found) {
        if (seen[found.room.id]) return;
        seen[found.room.id] = 1;
        const msgs = S.messagesFor(found.room, "parent").slice(0, 5);
        msgs.forEach(function (msg) { takeMessage(msg, photos, voices); });
        const body = msgs.length ? msgs.map(function (msg) { return msg.text || "הודעה"; }).join("\n") : "אין הודעות";
        blocks.push(found.room.name + ":\n" + body);
      });
      return answer(blocks.join("\n\n"), photos, voices);
    }
    if (intent === "week") {
      const dates = weekDates(today);
      const blocks = kids.map(function (found) {
        let posted = 0;
        let done = 0;
        dates.forEach(function (date) {
          S.rowsFor(found.room, date, found.kid).forEach(function (row) {
            if (row.status !== "posted") return;
            posted += 1;
            if (row.done) done += 1;
          });
        });
        return found.kid.firstName + " השבוע: " + done + " הוכנו מתוך " + posted + ".";
      });
      return answer(blocks.join("\n"));
    }
    return null;
  }
  function teacherAnswer(room, intent, today) {
    if (!room) return null;
    const photos = [];
    const voices = [];
    if (intent === "unposted") {
      const missing = S.rowsFor(room, today, null).filter(function (row) { return row.status === "not-updated"; });
      if (!missing.length) return answer("הכל פורסם להיום.");
      return answer("עוד לא פורסם היום:\n" + missing.map(function (row) { return row.subject; }).join("\n"));
    }
    if (intent === "unfinished" || intent === "remind") {
      const lines = unfinished(room, today);
      if (intent === "remind") {
        const draft = lines.length ? "תזכורת: עוד לא הוכן — " + lines.join("; ") + "." : "תזכורת: כל מה שפורסם הוכן. כל הכבוד!";
        return answer("הכנתי טיוטה. היא ממתינה בשדה ההודעה, ואת השליחה עושים ידנית.\n" + draft, [], [], draft);
      }
      if (!lines.length) return answer("כולם סיימו את מה שפורסם.");
      return answer("עוד לא סיימו:\n" + lines.join("\n"));
    }
    if (intent === "messages") {
      const msgs = S.messagesFor(room, "teacher").slice(0, 5);
      msgs.forEach(function (msg) { takeMessage(msg, photos, voices); });
      if (!msgs.length) return answer("עוד לא שלחת הודעות.");
      return answer("שלחת:\n" + msgs.map(function (msg) { return msg.text || "הודעה"; }).join("\n"), photos, voices);
    }
    return null;
  }
  function classStatus(room, today) {
    const rows = S.rowsFor(room, today, null);
    let done = 0;
    let possible = 0;
    (room.kids || []).forEach(function (kid) {
      S.rowsFor(room, today, kid).forEach(function (row) {
        if (row.status !== "posted") return;
        possible += 1;
        if (row.done) done += 1;
      });
    });
    const posted = rows.filter(function (row) { return row.status === "posted"; }).length;
    const waiting = rows.filter(function (row) { return row.status === "not-updated"; }).length;
    const none = rows.filter(function (row) { return row.status === "no-homework"; }).length;
    return room.name + " היום:\nפורסם " + posted + "\nלא עודכן " + waiting + "\nאין שיעורים " + none + "\nהוכן " + done + " מתוך " + possible;
  }
  function empty(role) {
    return { text: FALLBACK, intent: "", photos: [], voices: [], draft: "", chips: chips(role) };
  }
  function ask(state, who, opts) {
    opts = opts || {};
    const role = who && who.role || "";
    const pack = empty(role);
    const today = String(opts.today || "");
    if (!state || !who || !ROLES[role] || !today) return pack;
    let intent = "";
    if (opts.intent && (ROLES[role] || []).some(function (item) { return item.id === opts.intent; })) intent = opts.intent;
    else intent = match(role, opts.text || "");
    if (!intent) return pack;
    if (mentionsOther(state, who, opts.text || "")) return pack;
    let built = null;
    if (role === "student") {
      const kids = scopedKids(state, who);
      built = kids.length ? studentAnswer(kids[0], intent, today) : null;
    } else if (role === "parent") built = parentAnswer(scopedKids(state, who), intent, today);
    else if (role === "teacher") built = teacherAnswer(findClass(state, who.classId), intent, today);
    else if (role === "principal" || role === "admin") {
      const room = findClass(state, who.classId);
      built = room && intent === "status" ? answer(classStatus(room, today)) : null;
    }
    if (!built || !built.text) return pack;
    return {
      text: String(built.text),
      intent: intent,
      photos: built.photos || [],
      voices: built.voices || [],
      draft: built.draft || "",
      chips: pack.chips
    };
  }

  return { FALLBACK: FALLBACK, chips: chips, match: match, ask: ask };
});
