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
      return answer("מהמורה:\n" + msgs.map(function (msg) { return msg.text || "הודעה"; }).join("\n"), photos, voices);
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
        return answer("הכנתי טיוטה.\nהשליחה נשארת אצלך, ידנית.\n" + draft, [], [], draft);
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
  function cardItem(id, title, text, go, extra) {
    extra = extra || {};
    return {
      id: id,
      title: title,
      text: text,
      progress: extra.progress || null,
      photos: extra.photos || [],
      voices: extra.voices || [],
      go: go || null
    };
  }
  function subjectPhrase(count) {
    if (count === 1) return "מקצוע אחד לא עודכן";
    return count + " מקצועות לא עודכנו";
  }
  function postedToday(room, date, kid) {
    return S.rowsFor(room, date, kid).filter(function (row) { return row.status === "posted"; });
  }
  function weekLine(found, today) {
    let posted = 0;
    let done = 0;
    weekDates(today).forEach(function (date) {
      S.rowsFor(found.room, date, found.kid).forEach(function (row) {
        if (row.status !== "posted") return;
        posted += 1;
        if (row.done) done += 1;
      });
    });
    return found.kid.firstName + " השבוע: " + done + " הוכנו מתוך " + posted;
  }
  function remindDraft(room, today) {
    const lines = unfinished(room, today);
    return lines.length ? "תזכורת: עוד לא הוכן — " + lines.join("; ") + "." : "תזכורת: כל מה שפורסם הוכן. כל הכבוד!";
  }
  function notUpdated(room, today) {
    return S.rowsFor(room, today, null).filter(function (row) { return row.status === "not-updated"; });
  }
  function doneStats(room, today) {
    let done = 0;
    let possible = 0;
    (room.kids || []).forEach(function (kid) {
      postedToday(room, today, kid).forEach(function (row) {
        possible += 1;
        if (row.done) done += 1;
      });
    });
    return { done: done, possible: possible };
  }
  function schoolsFor(state, who) {
    const schools = (state && state.schools) || [];
    if (!who) return [];
    if (who.role === "principal") return schools.filter(function (school) { return school.id === who.schoolId; });
    if (who.role === "admin") {
      if (who.schoolId) return schools.filter(function (school) { return school.id === who.schoolId; });
      return schools.slice();
    }
    return [];
  }
  function studentDigest(found, today) {
    const room = found.room;
    const kid = found.kid;
    const items = [];
    const date = S.nextSchoolDay(today);
    const rows = S.rowsFor(room, date, kid);
    const photos = [];
    const voices = [];
    takeRows(rows, photos, voices);
    const names = lessons(room, date);
    const body = rows.length ? rows.map(postedLine).join("\n") : "אין שיעורים למחר.";
    items.push(cardItem("tomorrow", "למחר", "מחר, " + dayLabel(date) + "\n" + names.join(", ") + "\n" + body, { name: "day", kidId: kid.id, date: date }, { photos: photos.slice(0, 1), voices: voices.slice(0, 1) }));
    const posted = postedToday(room, today, kid);
    const left = posted.filter(function (row) { return !row.done; });
    if (left.length) {
      items.push(cardItem("left", "נשאר", left.map(function (row) { return row.subject + ": " + (row.text || "פורסם"); }).join("\n"), { name: "day", kidId: kid.id, date: today }, { progress: { done: posted.length - left.length, total: posted.length } }));
    }
    const msgs = S.messagesFor(room, "student").slice(0, 5);
    if (msgs.length) {
      const msgPhotos = [];
      const msgVoices = [];
      msgs.forEach(function (msg) { takeMessage(msg, msgPhotos, msgVoices); });
      items.push(cardItem("messages", "מהמורה", msgs.map(function (msg) { return msg.text || "הודעה"; }).join("\n"), { name: "messages" }, { photos: msgPhotos.slice(0, 1), voices: msgVoices.slice(0, 1) }));
    }
    if (posted.length && !left.length) {
      items.push(cardItem("cheer", "כל הכבוד", "כל הכבוד, הכול הוכן היום", null, { progress: { done: posted.length, total: posted.length } }));
    }
    return { greeting: "היי, זה מה שחשוב עכשיו.", items: items };
  }
  function parentDigest(kids, today) {
    const items = [];
    const seen = {};
    kids.forEach(function (found) {
      const posted = postedToday(found.room, today, found.kid);
      const done = posted.filter(function (row) { return row.done; }).length;
      items.push(cardItem("kid:" + found.kid.id + ":status", "מצב", found.kid.firstName + ": הוכנו " + done + " מתוך " + posted.length, { name: "day", kidId: found.kid.id, date: today }, posted.length ? { progress: { done: done, total: posted.length } } : null));
      const date = S.nextSchoolDay(today);
      const waiting = S.rowsFor(found.room, date, found.kid).filter(function (row) { return row.status === "posted" && !row.done; });
      if (waiting.length) {
        items.push(cardItem("kid:" + found.kid.id + ":tomorrow", "למחר", found.kid.firstName + ":\n" + waiting.map(function (row) { return row.subject + ": " + (row.text || "פורסם"); }).join("\n"), { name: "day", kidId: found.kid.id, date: date }));
      }
      if (!seen[found.room.id]) {
        seen[found.room.id] = 1;
        const msgs = S.messagesFor(found.room, "parent").slice(0, 5);
        if (msgs.length) {
          const alert = msgs.some(function (msg) { return msg.alert; });
          const photos = [];
          const voices = [];
          msgs.forEach(function (msg) { takeMessage(msg, photos, voices); });
          const text = msgs.map(function (msg) { return msg.text || "הודעה"; }).join("\n") + (alert ? "\nהתראה" : "");
          items.push(cardItem("kid:" + found.kid.id + ":messages", "נשלח", text, { name: "messages" }, { photos: photos.slice(0, 1), voices: voices.slice(0, 1) }));
        }
      }
      items.push(cardItem("kid:" + found.kid.id + ":week", "השבוע", weekLine(found, today), { name: "day", kidId: found.kid.id, date: today }));
    });
    return { greeting: "היי, ככה נראה היום.", items: items };
  }
  function teacherDigest(room, today) {
    const items = [];
    if (!room) return { greeting: "היי, זה מה שמחכה בכיתה.", items: items };
    const missing = notUpdated(room, today);
    if (missing.length) {
      items.push(cardItem("unposted", subjectPhrase(missing.length), missing.map(function (row) { return row.subject; }).join("\n"), { name: "homework", classId: room.id }));
    }
    const lines = unfinished(room, today);
    if (lines.length) items.push(cardItem("unfinished", "עוד לא סיימו", lines.join("\n"), { name: "kids", classId: room.id }));
    const replies = S.messagesFor(room, "teacher").filter(function (msg) { return msg.from === "student" || msg.from === "parent"; });
    if (replies.length) items.push(cardItem("replies", "תגובות", replies.map(function (msg) { return msg.text || "הודעה"; }).join("\n"), { name: "messages" }));
    const draft = remindDraft(room, today);
    items.push(cardItem("draft", "טיוטה", draft, { name: "compose", classId: room.id, text: draft, fillDraft: true }));
    return { greeting: "היי, זה מה שמחכה בכיתה.", items: items };
  }
  function schoolDigest(schools, today, wide) {
    const items = [];
    schools.forEach(function (school) {
      let done = 0;
      let possible = 0;
      let waitingSubjects = 0;
      (school.classrooms || []).forEach(function (room) {
        const missing = notUpdated(room, today);
        waitingSubjects += missing.length;
        const stats = doneStats(room, today);
        done += stats.done;
        possible += stats.possible;
        if (!wide && missing.length) {
          items.push(cardItem("class:" + room.id, room.name, subjectPhrase(missing.length), { name: "kids", classId: room.id, schoolId: school.id }));
        }
      });
      if (wide) {
        if (waitingSubjects) items.push(cardItem("school:" + school.id, school.name, school.name + ": " + subjectPhrase(waitingSubjects), { name: "classes", schoolId: school.id }));
        return;
      }
      const pct = possible ? Math.round(100 * done / possible) : 0;
      items.push(cardItem("school:" + school.id, "בית הספר", "בית הספר: הוכן " + pct + "% (" + done + " מתוך " + possible + ")", { name: "classes", schoolId: school.id }));
    });
    if (wide && !items.length) items.push(cardItem("clear", "הכל מעודכן", "אין בתי ספר שמחכים לעדכון", null));
    return items;
  }
  function digest(state, who, opts) {
    opts = opts || {};
    const today = String(opts.today || "");
    const role = who && who.role || "";
    if (!state || !who || !today) return { greeting: "", items: [] };
    if (role === "student") {
      const kids = scopedKids(state, who);
      return kids.length ? studentDigest(kids[0], today) : { greeting: "היי, זה מה שחשוב עכשיו.", items: [] };
    }
    if (role === "parent") return parentDigest(scopedKids(state, who), today);
    if (role === "teacher") return teacherDigest(findClass(state, who.classId), today);
    if (role === "principal") return { greeting: "היי, זה מצב בית הספר.", items: schoolDigest(schoolsFor(state, who), today, false) };
    if (role === "admin") {
      const wide = !who.schoolId;
      return { greeting: wide ? "היי, אלה בתי הספר שמחכים." : "היי, זה מצב בית הספר.", items: schoolDigest(schoolsFor(state, who), today, wide) };
    }
    return { greeting: "", items: [] };
  }
  function defaults(role) {
    if (role === "student") return { on: true, time: "17:00" };
    if (role === "parent") return { on: true, time: "19:00" };
    if (role === "teacher") return { on: true, time: "15:00" };
    return null;
  }
  function reminderDue(state, who, opts) {
    opts = opts || {};
    const today = String(opts.today || "");
    const time = String(opts.time || "");
    if (!state || !who || !today || !/^\d{2}:\d{2}$/.test(time)) return null;
    const role = who.role;
    if (role === "student") {
      const kids = scopedKids(state, who);
      if (!kids.length) return null;
      const left = postedToday(kids[0].room, today, kids[0].kid).filter(function (row) { return !row.done; });
      if (!left.length) return null;
      return { id: "student:" + today + ":" + time, title: "תזכורת ערב", body: "רק תזכורת. עוד נשאר: " + left.map(function (row) { return row.subject + (row.text ? " " + row.text : ""); }).join(", "), time: time };
    }
    if (role === "parent") {
      const lines = [];
      scopedKids(state, who).forEach(function (found) {
        const left = postedToday(found.room, today, found.kid).filter(function (row) { return !row.done; });
        if (left.length) lines.push(found.kid.firstName + ": " + left.map(function (row) { return row.subject + (row.text ? " " + row.text : ""); }).join(", "));
      });
      if (!lines.length) return null;
      return { id: "parent:" + today + ":" + time, title: "תזכורת ערב", body: "רק תזכורת. עוד נשאר: " + lines.join("; "), time: time };
    }
    if (role === "teacher") {
      const room = findClass(state, who.classId);
      if (!room) return null;
      const missing = notUpdated(room, today);
      if (!missing.length) return null;
      return { id: "teacher:" + today + ":" + time, title: "תזכורת", body: "רק תזכורת. עוד לא פורסם: " + missing.map(function (row) { return row.subject; }).join(", "), time: time };
    }
    return null;
  }
  function parseWhen(text) {
    const raw = String(text || "").replace(/\s+/g, " ").trim();
    let found = raw.match(/תזכיר(?:י)? לי (?:בשעה |ב-?|ב )(\d{1,2})[:.](\d{2})(?: על (.+))?/);
    if (!found) found = raw.match(/remind me at (\d{1,2}):(\d{2})(?: about (.+))?/i);
    if (!found) return null;
    const hour = Number(found[1]);
    const minute = Number(found[2]);
    if (hour > 23 || minute > 59) return null;
    return { time: String(hour).padStart(2, "0") + ":" + String(minute).padStart(2, "0"), about: String(found[3] || "").trim().slice(0, 40) };
  }
  function delayUntil(now, time) {
    const found = String(time || "").match(/^(\d{2}):(\d{2})$/);
    if (!found || !now || typeof now.getTime !== "function") return 0;
    const target = new Date(now.getTime());
    target.setHours(Number(found[1]), Number(found[2]), 0, 0);
    return target.getTime() - now.getTime();
  }
  function unreadCount(items, seen) {
    seen = seen || {};
    return (items || []).filter(function (item) { return seen[item.id] !== item.text; }).length;
  }
  function markSeen(items, seen) {
    const next = {};
    Object.keys(seen || {}).forEach(function (key) { next[key] = seen[key]; });
    (items || []).forEach(function (item) { next[item.id] = item.text; });
    return next;
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
    const when = parseWhen(opts.text || "");
    if (when) {
      const about = when.about ? " על " + when.about : "";
      return {
        text: "אזכיר לך ב-" + when.time + about + ".",
        intent: "custom-remind",
        photos: [],
        voices: [],
        draft: "",
        chips: pack.chips,
        reminder: { time: when.time, about: when.about }
      };
    }
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
    else if (role === "teacher") {
      const room = findClass(state, who.classId);
      if (room && intent === "remind") {
        const draft = remindDraft(room, today);
        built = answer("הכנתי טיוטה.\nהשליחה נשארת אצלך, ידנית.\n" + draft, [], [], draft);
      } else built = teacherAnswer(room, intent, today);
    }
    else if (role === "principal" || role === "admin") {
      const room = findClass(state, who.classId);
      if (room && intent === "status") built = answer(classStatus(room, today));
      else if (!who.classId && intent === "status") {
        const card = digest(state, who, { today: today });
        built = answer(card.items.map(function (item) { return item.text; }).filter(Boolean).join("\n") || "אין עדכון");
      }
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

  return {
    FALLBACK: FALLBACK,
    chips: chips,
    match: match,
    ask: ask,
    digest: digest,
    defaults: defaults,
    reminderDue: reminderDue,
    parseWhen: parseWhen,
    delayUntil: delayUntil,
    unreadCount: unreadCount,
    markSeen: markSeen
  };
});
