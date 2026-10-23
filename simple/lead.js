(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./logic.js") : root.Nohw;
  const hebrew = typeof module === "object" && module.exports ? require("./avatar-he.js") : root.NohwHebrew;
  const setup = typeof module === "object" && module.exports ? require("./setup.js") : root.NohwSetup;
  const api = factory(model, hebrew, setup);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NohwLead = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (S, H, G) {
  function partOf(hour) {
    const value = Number(hour);
    if (!Number.isFinite(value)) return "afternoon";
    if (value < 12) return "morning";
    if (value < 17) return "afternoon";
    return "evening";
  }
  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }
  function findClass(state, id) {
    const schools = (state && state.schools) || [];
    for (let i = 0; i < schools.length; i++) {
      const rooms = schools[i].classrooms || [];
      for (let j = 0; j < rooms.length; j++) if (rooms[j].id === id) return rooms[j];
    }
    return null;
  }
  function findKid(state, id) {
    const schools = (state && state.schools) || [];
    for (let i = 0; i < schools.length; i++) {
      const rooms = schools[i].classrooms || [];
      for (let j = 0; j < rooms.length; j++) {
        const kids = rooms[j].kids || [];
        for (let k = 0; k < kids.length; k++) if (kids[k].id === id) return { room: rooms[j], kid: kids[k], school: schools[i] };
      }
    }
    return null;
  }
  function schoolsFor(state, who) {
    const schools = (state && state.schools) || [];
    if (!who) return [];
    if (who.role === "admin") return who.schoolId ? schools.filter(function (school) { return school.id === who.schoolId; }) : schools.slice();
    if (who.role === "principal" || who.role === "teacher" || who.role === "student") {
      return schools.filter(function (school) { return school.id === who.schoolId; });
    }
    return [];
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
  function waitingPhrase(count) {
    if (count === 1) return "מקצוע אחד עוד לא עודכן";
    return count + " מקצועות עוד לא עודכנו";
  }
  function rowLabel(row) {
    if (row.status === "posted") return row.subject + (row.text ? " " + row.text : "");
    if (row.status === "no-homework") return row.subject + ": " + H.text("no-homework");
    return row.subject + ": " + H.text("not-updated");
  }
  function card(spec) {
    const text = clean(spec.text || "");
    const title = clean(spec.title || "");
    return {
      id: spec.id,
      score: spec.score || 0,
      title: title,
      text: text,
      chips: spec.chips || [],
      widget: spec.widget || null,
      expand: spec.expand || null,
      classId: spec.classId || "",
      schoolId: spec.schoolId || "",
      subjects: spec.subjects || [],
      fingerprint: spec.id + ":" + title + ":" + text
    };
  }
  function bump(part, table) {
    return table[part] || 0;
  }
  function homeworkRows(room, date, kid, tick) {
    return S.rowsFor(room, date, kid).map(function (row) {
      return {
        label: rowLabel(row),
        subject: row.subject,
        status: row.status,
        text: row.text || "",
        done: !!row.done,
        date: date,
        kidId: kid ? kid.id : "",
        tick: !!(tick && row.status === "posted")
      };
    });
  }
  function studentCards(state, who, today, part) {
    const found = scopedKids(state, who)[0];
    if (!found) return [];
    const room = found.room;
    const kid = found.kid;
    const tomorrow = S.nextSchoolDay(today);
    const tomorrowRows = S.rowsFor(room, tomorrow, kid);
    const todayRows = S.rowsFor(room, today, kid);
    const left = todayRows.filter(function (row) { return row.status === "posted" && !row.done; });
    const cards = [];
    const tomorrowText = tomorrowRows.map(rowLabel).join("\n");
    cards.push(card({
      id: "tomorrow",
      score: 62 + bump(part, { morning: 18, afternoon: 36, evening: 16 }) + (left.length ? 0 : 4),
      title: "למחר",
      text: tomorrowText || H.text("no-tomorrow"),
      widget: { kind: "homework", rows: homeworkRows(room, tomorrow, kid, true) },
      expand: { name: "day", kidId: kid.id, date: tomorrow },
      classId: room.id
    }));
    const todayText = left.length ? left.map(rowLabel).join("\n") : todayRows.map(rowLabel).join("\n");
    cards.push(card({
      id: "today",
      score: 58 + bump(part, { morning: 12, afternoon: 28, evening: 24 }) + left.length * 3,
      title: left.length ? "נשאר להיום" : "היום",
      text: todayText,
      widget: { kind: "homework", rows: homeworkRows(room, today, kid, true) },
      expand: { name: "day", kidId: kid.id, date: today },
      classId: room.id
    }));
    const msgs = S.messagesFor(room, "student", { kidId: kid.id }).slice(0, 4);
    if (msgs.length) {
      cards.push(card({
        id: "messages",
        score: 44 + (msgs.some(function (msg) { return msg.alert; }) ? 18 : 0),
        title: "מהמורה",
        text: msgs.map(function (msg) { return msg.text || H.text("message-word"); }).join("\n"),
        widget: { kind: "messages", rows: msgs.map(function (msg) { return { label: msg.text || H.text("message-word"), alert: !!msg.alert }; }) },
        expand: { name: "messages" },
        classId: room.id
      }));
    }
    return cards;
  }
  function parentCards(state, who, today, part) {
    const kids = scopedKids(state, who);
    const cards = [];
    kids.forEach(function (found) {
      const rows = S.rowsFor(found.room, today, found.kid);
      const done = rows.filter(function (row) { return row.status === "posted" && row.done; }).length;
      const posted = rows.filter(function (row) { return row.status === "posted"; }).length;
      cards.push(card({
        id: "kid:" + found.kid.id,
        score: 64 + bump(part, { morning: 8, afternoon: 16, evening: 34 }),
        title: found.kid.firstName,
        text: H.parentStatus(found.kid.firstName, done, posted) + "\n" + rows.map(rowLabel).join("\n"),
        widget: { kind: "kids", rows: [{ label: found.kid.firstName + " · " + found.room.name, kidId: found.kid.id, done: posted > 0 && done === posted }].concat(homeworkRows(found.room, today, found.kid, false).map(function (row) { return { label: row.label, done: row.done, kidId: found.kid.id }; })) },
        expand: { name: "day", kidId: found.kid.id, date: today },
        classId: found.room.id
      }));
    });
    const seen = {};
    const lines = [];
    const msgRows = [];
    kids.forEach(function (found) {
      if (seen[found.room.id]) return;
      seen[found.room.id] = 1;
      S.messagesFor(found.room, "parent").slice(0, 4).forEach(function (msg) {
        const label = (msg.alert ? H.text("alert-word") + " " : "") + (msg.text || H.text("message-word"));
        lines.push(label);
        msgRows.push({ label: label, alert: !!msg.alert });
      });
    });
    if (lines.length) {
      cards.push(card({
        id: "messages",
        score: 48 + bump(part, { evening: 12 }) + (msgRows.some(function (row) { return row.alert; }) ? 20 : 0),
        title: "הודעות",
        text: lines.join("\n"),
        widget: { kind: "messages", rows: msgRows },
        expand: { name: "messages" }
      }));
    }
    return cards;
  }
  function teacherCards(state, who, today, part) {
    const room = findClass(state, who.classId);
    if (!room) return [];
    const rows = S.rowsFor(room, today, null);
    const missing = rows.filter(function (row) { return row.status === "not-updated"; });
    const cards = [];
    if (missing.length) {
      cards.push(card({
        id: "unposted",
        score: 70 + bump(part, { morning: 36, afternoon: 14, evening: 8 }) + missing.length * 4,
        title: waitingPhrase(missing.length),
        text: missing.map(function (row) { return row.subject; }).join("\n"),
        chips: [{ id: "post-now", label: "לעדכן עכשיו" }, { id: "none-day", label: "אין שיעורים" }],
        widget: { kind: "homework", rows: homeworkRows(room, today, null, false) },
        expand: { name: "homework", classId: room.id },
        classId: room.id,
        subjects: missing.map(function (row) { return row.subject; })
      }));
    }
    const waiting = [];
    (room.kids || []).forEach(function (kid) {
      const left = S.rowsFor(room, today, kid).filter(function (row) { return row.status === "posted" && !row.done; });
      if (left.length) waiting.push({ label: kid.firstName + ": " + left.map(function (row) { return row.subject; }).join(", "), kidId: kid.id });
    });
    if (waiting.length) {
      cards.push(card({
        id: "unfinished",
        score: 52 + bump(part, { morning: 8, afternoon: 28, evening: 18 }),
        title: H.text("unfinished-title"),
        text: waiting.map(function (row) { return row.label; }).join("\n"),
        widget: { kind: "kids", rows: waiting },
        expand: { name: "kids", classId: room.id },
        classId: room.id
      }));
    }
    const replies = S.messagesFor(room, "teacher").filter(function (msg) { return msg.from === "student" || msg.from === "parent"; }).slice(0, 4);
    if (replies.length) {
      cards.push(card({
        id: "replies",
        score: 46,
        title: H.text("replies-title"),
        text: replies.map(function (msg) { return msg.text || H.text("message-word"); }).join("\n"),
        widget: { kind: "messages", rows: replies.map(function (msg) { return { label: msg.text || H.text("message-word") }; }) },
        expand: { name: "messages" },
        classId: room.id
      }));
    }
    const parts = String(today).split("-").map(Number);
    const weekday = new Date(parts[0], parts[1] - 1, parts[2]).getDay();
    const slots = (room.timetable && room.timetable[weekday === 6 ? "5" : String(weekday)]) || [];
    const names = slots.map(function (item) { return clean(item); }).filter(Boolean);
    if (names.length) {
      cards.push(card({
        id: "timetable",
        score: 24 + bump(part, { morning: 10 }),
        title: "הלו״ז להיום",
        text: names.join("\n"),
        widget: { kind: "timetable", rows: names.map(function (name) { return { label: name }; }) },
        expand: { name: "timetable", classId: room.id },
        classId: room.id
      }));
    }
    return cards;
  }
  function classStats(room, today) {
    const rows = S.rowsFor(room, today, null);
    let posted = 0;
    let waiting = 0;
    let none = 0;
    rows.forEach(function (row) {
      if (row.status === "posted") posted += 1;
      else if (row.status === "no-homework") none += 1;
      else waiting += 1;
    });
    let done = 0;
    let possible = 0;
    (room.kids || []).forEach(function (kid) {
      S.rowsFor(room, today, kid).forEach(function (row) {
        if (row.status !== "posted") return;
        possible += 1;
        if (row.done) done += 1;
      });
    });
    const pct = possible ? Math.round(100 * done / possible) : 0;
    return { posted: posted, waiting: waiting, none: none, done: done, possible: possible, pct: pct };
  }
  function principalCards(state, who, today, part) {
    const schools = schoolsFor(state, who);
    const cards = [];
    schools.forEach(function (school) {
      let done = 0;
      let possible = 0;
      const classRows = [];
      (school.classrooms || []).forEach(function (room) {
        const stats = classStats(room, today);
        done += stats.done;
        possible += stats.possible;
        const label = room.name + " פורסם " + stats.posted + " לא עודכן " + stats.waiting + " " + stats.pct + "%";
        classRows.push({ label: label, id: room.id, name: room.name });
        if (stats.waiting) {
          cards.push(card({
            id: "class:" + room.id,
            score: 72 + bump(part, { morning: 24, afternoon: 12, evening: 8 }) + stats.waiting,
            title: room.name,
            text: waitingPhrase(stats.waiting),
            widget: { kind: "stats", rows: [{ label: label, id: room.id }] },
            expand: { name: "kids", classId: room.id, schoolId: school.id },
            classId: room.id,
            schoolId: school.id
          }));
        }
      });
      const pct = possible ? Math.round(100 * done / possible) : 0;
      cards.push(card({
        id: "school:" + school.id,
        score: 60,
        title: H.text("school-title"),
        text: H.schoolDone(pct, done, possible),
        chips: [{ id: "manage", label: "ניהול כיתות" }],
        widget: { kind: "stats", rows: classRows },
        expand: { name: "classes", schoolId: school.id },
        schoolId: school.id
      }));
    });
    return cards;
  }
  function healthLine(state, today) {
    let classes = 0;
    let teachers = 0;
    let kids = 0;
    let posted = 0;
    let slots = 0;
    ((state && state.schools) || []).forEach(function (school) {
      (school.classrooms || []).forEach(function (room) {
        classes += 1;
        if (clean(room.teacherName)) teachers += 1;
        kids += (room.kids || []).length;
        S.rowsFor(room, today, null).forEach(function (row) {
          if (row.status === "no-homework") return;
          slots += 1;
          if (row.status === "posted") posted += 1;
        });
      });
    });
    const rate = slots ? Math.round(100 * posted / slots) : 0;
    return H.health((state.schools || []).length, classes, teachers, kids, rate);
  }
  function adminCards(state, who, today, part) {
    const schools = schoolsFor(state, who);
    const cards = [];
    const attention = [];
    schools.forEach(function (school) {
      const rooms = school.classrooms || [];
      let waiting = 0;
      rooms.forEach(function (room) {
        waiting += S.rowsFor(room, today, null).filter(function (row) { return row.status === "not-updated"; }).length;
      });
      if (!rooms.length) attention.push({ id: school.id, label: H.noClasses(school.name) });
      else if (waiting) attention.push({ id: school.id, label: H.schoolAttention(school.name, waitingPhrase(waiting)) });
    });
    if (attention.length) {
      cards.push(card({
        id: "attention",
        score: 74 + bump(part, { morning: 16, afternoon: 10, evening: 8 }),
        title: "כדאי לבדוק",
        text: attention.map(function (row) { return row.label; }).join("\n"),
        widget: { kind: "schools", rows: attention },
        expand: { name: "schools" }
      }));
    }
    cards.push(card({
      id: "health",
      score: 36,
      title: "מצב המערכת",
      text: healthLine(state, today),
      expand: { name: "schools" }
    }));
    if (!cards.length) {
      cards.push(card({
        id: "clear",
        score: 20,
        title: H.text("clear-title"),
        text: H.text("schools-clear"),
        expand: { name: "schools" }
      }));
    }
    return cards;
  }
  function candidates(state, who, opts) {
    const today = String(opts && opts.today || "");
    const part = partOf(opts && opts.hour);
    const role = who && who.role || "";
    if (!state || !who || !today) return [];
    if (role === "student") return studentCards(state, who, today, part);
    if (role === "parent") return parentCards(state, who, today, part);
    if (role === "teacher") return teacherCards(state, who, today, part);
    if (role === "principal") return principalCards(state, who, today, part);
    if (role === "admin") return adminCards(state, who, today, part);
    return [];
  }
  function fresh(list, seen) {
    seen = seen || {};
    return list.filter(function (item) { return seen[item.id] !== item.fingerprint; }).sort(function (a, b) { return b.score - a.score || String(a.id).localeCompare(String(b.id)); });
  }
  function take(list) {
    if (list.length <= 4) return { cards: list, more: [] };
    return { cards: list.slice(0, 4), more: list.slice(4) };
  }
  function signature(state, who, opts) {
    opts = opts || {};
    const setup = needsSetup(state, who, opts);
    const body = candidates(state, who, opts).map(function (item) { return item.fingerprint; }).join("|");
    return (setup ? "setup" : "home") + ":" + body;
  }
  function needsSetup(state, who, opts) {
    if (!G || !who) return false;
    if (who.role !== "admin" && who.role !== "principal" && who.role !== "teacher") return false;
    const status = G.checklist(state, who, { today: opts.today, people: opts.people || [] });
    return !!(status && status.progress && status.progress.total > 0 && !status.complete);
  }
  function opening(state, who, opts) {
    opts = opts || {};
    const part = partOf(opts.hour);
    const role = who && who.role || "";
    const greeting = H.greet(role, role === "admin" && !(who && who.schoolId));
    if (needsSetup(state, who, opts)) {
      const status = G.checklist(state, who, { today: opts.today, people: opts.people || [] });
      return { mode: "setup", part: part, greeting: H.text("setup-hello"), cards: [], more: [], progress: status };
    }
    const ranked = fresh(candidates(state, who, opts), opts.seen || {});
    const picked = take(ranked);
    if (!picked.cards.length) {
      picked.cards = [card({ id: "clear", score: 1, title: greeting, text: H.text("lead-clear") })];
    }
    return { mode: "home", part: part, greeting: greeting, cards: picked.cards, more: picked.more, progress: null };
  }
  function reveal(pack) {
    const more = (pack && pack.more) || [];
    return { cards: more, intro: more.length ? H.text("more-intro") : H.text("lead-clear") };
  }
  function perform(state, actor, chip, item, opts) {
    opts = opts || {};
    const today = String(opts.today || "");
    if (!state || !actor || !item || !chip || !today) return { ok: false };
    if (chip === "none-day") {
      if (!S.canEdit(state, actor, { kind: "homework", classId: item.classId })) return { ok: false, text: H.text("deny") };
      const room = findClass(state, item.classId);
      if (!room) return { ok: false, text: H.text("deny") };
      S.rowsFor(room, today, null).forEach(function (row) {
        S.setHomework(state, actor, { classId: room.id, date: today, subject: row.subject, mode: "none" });
      });
      return { ok: true, text: H.text("marked-none") };
    }
    if (chip === "post-now") {
      if (!S.canEdit(state, actor, { kind: "homework", classId: item.classId })) return { ok: false, text: H.text("deny") };
      return { ok: true, navigate: { name: "post", classId: item.classId, subject: (item.subjects || [])[0] || "", fromLead: true } };
    }
    if (chip === "manage") return { ok: true, navigate: { name: "classes", schoolId: item.schoolId || "" } };
    if (chip === "expand" && item.expand) return { ok: true, navigate: item.expand };
    return { ok: false };
  }

  return {
    partOf: partOf,
    waitingPhrase: waitingPhrase,
    candidates: candidates,
    signature: signature,
    opening: opening,
    reveal: reveal,
    perform: perform
  };
});
