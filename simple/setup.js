(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./logic.js") : root.Nohw;
  const hebrew = typeof module === "object" && module.exports ? require("./avatar-he.js") : root.NohwHebrew;
  const api = factory(model, hebrew);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NohwSetup = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (S, H) {
  const ALLOW = {
    admin: { "add-school": 1, attention: 1, health: 1, "rename-school": 1, "delete-school": 1, scenarios: 1, reset: 1 },
    principal: { "add-classes": 1, "assign-teacher": 1, "missing-today": 1, "teacher-note": 1 },
    teacher: { template: 1, "add-kids": 1, "add-parent": 1, avatar: 1, "none-day": 1, gap: 1, "parent-draft": 1 }
  };
  const ENTRY = {
    "setup-school": "add-school",
    "setup-principal": "add-school",
    "setup-attention": "attention",
    "setup-health": "health",
    "setup-rename": "rename-school",
    "setup-delete": "delete-school",
    "setup-scenarios": "scenarios",
    "setup-reset": "reset",
    "setup-classes": "add-classes",
    "setup-teacher": "assign-teacher",
    "setup-missing": "missing-today",
    "setup-note": "teacher-note",
    "setup-timetable": "template",
    "setup-kids": "add-kids",
    "setup-parents": "add-parent",
    "setup-avatar": "avatar",
    "setup-none": "none-day",
    "setup-gap": "gap",
    "setup-parent-draft": "parent-draft"
  };
  const FACES = { sun: "שמש", fox: "שועל", moon: "ירח", star: "כוכב" };

  function allowed(role, action) {
    return !!(ALLOW[role] && ALLOW[role][action]);
  }
  function setupChips(role) {
    if (role === "admin") return [
      { id: "setup-school", label: "בית ספר חדש" },
      { id: "setup-principal", label: "מנהל/ת חדש/ה" },
      { id: "setup-attention", label: "תשומת לב" },
      { id: "setup-health", label: "מצב המערכת" },
      { id: "setup-rename", label: "שינוי שם" },
      { id: "setup-delete", label: "מחיקה" },
      { id: "setup-scenarios", label: "לתרחישים" },
      { id: "setup-reset", label: "לאיפוס" }
    ];
    if (role === "principal") return [
      { id: "setup-classes", label: "כיתות חדשות" },
      { id: "setup-teacher", label: "שיבוץ מורה" },
      { id: "setup-missing", label: "כיתות בלי עדכון" },
      { id: "setup-note", label: "הודעה למורים" }
    ];
    if (role === "teacher") return [
      { id: "setup-timetable", label: "תבנית מערכת" },
      { id: "setup-kids", label: "הוספת ילדים" },
      { id: "setup-parents", label: "הוספת הורה" },
      { id: "setup-avatar", label: "פנים לעוזר" },
      { id: "setup-none", label: "אין שיעורים להיום" },
      { id: "setup-gap", label: "מה חסר היום" },
      { id: "setup-parent-draft", label: "טיוטה להורים" }
    ];
    return [];
  }
  function blank() {
    return { flow: "", step: "", bag: {}, history: [] };
  }
  function cloneBag(bag) {
    const next = {};
    Object.keys(bag || {}).forEach(function (key) {
      next[key] = Array.isArray(bag[key]) ? bag[key].slice() : bag[key];
    });
    return next;
  }
  function remember(session) {
    const history = (session.history || []).concat([{ flow: session.flow, step: session.step, bag: cloneBag(session.bag) }]);
    return { flow: session.flow, step: session.step, bag: cloneBag(session.bag), history: history };
  }
  function backSession(session) {
    const history = (session.history || []).slice();
    const prev = history.pop();
    if (!prev) return blank();
    return { flow: prev.flow, step: prev.step, bag: cloneBag(prev.bag), history: history };
  }
  function reply(text, session, extra) {
    extra = extra || {};
    return {
      text: String(text || ""),
      session: session || blank(),
      chips: extra.chips || [],
      confirm: extra.confirm || null,
      draft: extra.draft || "",
      classId: extra.classId || "",
      audience: extra.audience || "",
      go: extra.go || null,
      back: !!extra.back,
      placeholder: extra.placeholder || "",
      forbidden: !!extra.forbidden
    };
  }
  function deny() {
    return reply(H.text("deny"), blank(), { forbidden: true });
  }
  function choices(session, chips) {
    const list = chips.slice();
    if ((session.history || []).length || session.flow) list.push({ id: "back", label: "אחורה" });
    return list;
  }
  function confirmChips() {
    return [{ id: "yes", label: "כן" }, { id: "no", label: "לא" }, { id: "back", label: "אחורה" }];
  }
  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 40);
  }
  function expandRange(piece) {
    const match = String(piece || "").match(/^([אבגדהו])(['׳]?)(\d+)\s*[-–—]\s*([אבגדהו])(['׳]?)(\d+)$/);
    if (!match || match[1] !== match[4]) return null;
    const start = Number(match[3]);
    const end = Number(match[6]);
    if (start < 1 || end > 12 || end < start || end - start > 11) return null;
    const mark = match[2] || match[5] || "";
    const names = [];
    for (let n = start; n <= end; n++) names.push(match[1] + mark + n);
    return names;
  }
  function parseList(text) {
    const out = [];
    String(text || "").replace(/\r/g, "").split(/\n+/).forEach(function (line) {
      line.split(/[,;،]/).forEach(function (part) {
        const piece = part.trim();
        if (!piece) return;
        const range = expandRange(piece.replace(/\s+/g, ""));
        const names = range || [piece.replace(/\s+/g, " ").trim()];
        names.forEach(function (name) {
          const value = clean(name);
          if (!value || out.length >= 30 || out.indexOf(value) >= 0) return;
          out.push(value);
        });
      });
    });
    return out;
  }
  function gradeLetter(name) {
    const match = String(name || "").match(/[אבגדהו]/);
    return match ? match[0] : "";
  }
  function templateSlots(name) {
    const grade = gradeLetter(name);
    const all = S.SUBJECTS.slice();
    if (grade === "א" || grade === "ב") return all.slice(0, 3);
    if (grade === "ג" || grade === "ד") return all.slice(0, 4);
    return all.slice(0, 5);
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
  function schoolsOf(state, who) {
    const schools = (state && state.schools) || [];
    if (!who) return [];
    if (who.role === "admin") return schools.slice();
    if (who.role === "principal") return schools.filter(function (school) { return school.id === who.schoolId; });
    return [];
  }
  function roomOf(state, who) {
    if (!who || !who.classId) return null;
    for (const school of (state && state.schools) || []) {
      const room = (school.classrooms || []).find(function (item) { return item.id === who.classId; });
      if (room) return { school: school, room: room };
    }
    return null;
  }
  function hasTable(room) {
    const table = room && room.timetable || {};
    return Object.keys(table).some(function (key) {
      return (table[key] || []).some(function (slot) { return String(slot || "").trim(); });
    });
  }
  function parentOf(kid, people) {
    return (people || []).some(function (person) {
      return person && person.role === "parent" && (person.kidIds || []).indexOf(kid.id) >= 0 && clean(person.name);
    });
  }
  function postedWeek(room, today) {
    return weekDates(today).some(function (date) {
      return S.rowsFor(room, date, null).some(function (row) { return row.status === "posted"; });
    });
  }
  function checklist(state, who, opts) {
    opts = opts || {};
    const role = who && who.role || "";
    const people = opts.people || [];
    if (role === "admin") {
      const schools = (state && state.schools) || [];
      const done = schools.length > 0;
      return { role: role, complete: done, progress: { done: done ? 1 : 0, total: 1 }, items: [{ id: "school", title: H.checklistTitle("school"), done: done }] };
    }
    if (role === "principal") {
      const rooms = ((schoolsOf(state, who)[0] || {}).classrooms) || [];
      const items = [
        { id: "classes", title: H.checklistTitle("classes"), done: rooms.length > 0 },
        { id: "teachers", title: H.checklistTitle("teachers"), done: rooms.length > 0 && rooms.every(function (room) { return clean(room.teacherName); }) },
        { id: "timetable", title: H.checklistTitle("timetable"), done: rooms.length > 0 && rooms.every(hasTable) }
      ];
      const count = items.filter(function (item) { return item.done; }).length;
      return { role: role, complete: count === items.length, progress: { done: count, total: items.length }, items: items };
    }
    if (role === "teacher") {
      const found = roomOf(state, who);
      const room = found && found.room;
      const kids = (room && room.kids) || [];
      const items = [
        { id: "timetable", title: H.checklistTitle("timetable"), done: !!room && hasTable(room) },
        { id: "kids", title: H.checklistTitle("kids"), done: kids.length > 0 },
        { id: "parents", title: H.checklistTitle("parents"), done: kids.length > 0 && kids.every(function (kid) { return parentOf(kid, people); }) },
        { id: "avatar", title: H.checklistTitle("avatar"), done: !!(room && room.helper && room.helper.face && clean(room.helper.name)) }
      ];
      const count = items.filter(function (item) { return item.done; }).length;
      return { role: role, complete: !!room && count === items.length, progress: { done: count, total: items.length }, items: items };
    }
    return { role: role, complete: true, progress: { done: 0, total: 0 }, items: [] };
  }
  function healthText(state, today) {
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
  function attentionText(state, today) {
    const lines = [];
    ((state && state.schools) || []).forEach(function (school) {
      const rooms = school.classrooms || [];
      if (!rooms.length) lines.push(H.noClasses(school.name));
      else if (!rooms.some(function (room) { return postedWeek(room, today); })) lines.push(H.noPosts(school.name));
    });
    return lines.length ? lines.join("\n") : H.text("attention-clear");
  }
  function missingText(state, who, today) {
    const rooms = ((schoolsOf(state, who)[0] || {}).classrooms) || [];
    const lines = [];
    rooms.forEach(function (room) {
      const waiting = S.rowsFor(room, today, null).filter(function (row) { return row.status === "not-updated"; });
      if (waiting.length) lines.push(H.missingLine(room.name, waiting.map(function (row) { return row.subject; })));
    });
    return lines.length ? lines.join("\n") : H.text("classes-updated");
  }
  function teacherNote(state, who, today) {
    const rooms = ((schoolsOf(state, who)[0] || {}).classrooms) || [];
    const names = [];
    rooms.forEach(function (room) {
      if (S.rowsFor(room, today, null).some(function (row) { return row.status === "not-updated"; })) names.push(room.name);
    });
    const school = schoolsOf(state, who)[0];
    const classId = rooms[0] ? rooms[0].id : "";
    if (!names.length) return { text: H.text("classes-updated"), draft: "", classId: classId };
    const draft = H.staffDraft(names);
    return { text: H.staffDraftSay(draft), draft: draft, classId: classId, audience: "class" };
  }
  function gapText(found, today) {
    if (!found) return H.text("no-class");
    const waiting = S.rowsFor(found.room, today, null).filter(function (row) { return row.status === "not-updated"; });
    if (!waiting.length) return H.text("updated-today");
    return H.text("missing-today") + "\n" + waiting.map(function (row) { return row.subject; }).join("\n");
  }
  function parentDraft(found, today) {
    if (!found) return { text: H.text("no-class"), draft: "" };
    const lines = [];
    (found.room.kids || []).forEach(function (kid) {
      const left = S.rowsFor(found.room, today, kid).filter(function (row) { return row.status === "posted" && !row.done; });
      if (left.length) lines.push(kid.firstName + ": " + left.map(function (row) { return row.subject; }).join(", "));
    });
    const draft = H.parentDraftBody(lines);
    return { text: H.parentDraftSay(draft), draft: draft, classId: found.room.id, audience: "parents" };
  }
  function schoolChips(state) {
    return ((state && state.schools) || []).map(function (school) {
      return { id: "school:" + school.id, label: school.name };
    });
  }
  function chosen(list, text, prefix, label, resume) {
    const picked = String(text || "");
    const found = (list || []).find(function (item) { return picked === prefix + item.id || picked === label(item); });
    if (found) return found;
    if (!picked && list && list.length === 1 && !resume) return list[0];
    return null;
  }
  function askName(session, text, key, nextStep, question, placeholder) {
    const value = clean(text);
    if (!value || value === "back") return null;
    const next = remember(session);
    next.step = nextStep;
    next.bag[key] = value;
    return { session: next, value: value, question: question, placeholder: placeholder };
  }
  function flowStep(state, who, session, text, opts) {
    const flow = session.flow;
    const today = opts.today;
    const role = who.role;
    if (!allowed(role, flow)) return deny();
    if (flow === "add-school") {
      if (session.step === "ask") {
        const named = askName(session, text, "schoolName", "principal", H.text("ask-principal"), "שם המנהל/ת");
        if (!named) return reply(H.text("ask-school"), session, { placeholder: "שם בית הספר", back: true, chips: choices(session, []) });
        return reply(named.question, named.session, { placeholder: named.placeholder, back: true, chips: choices(named.session, []) });
      }
      if (session.step === "principal") {
        const named = askName(session, text, "principalName", "confirm", "", "");
        if (!named) return reply(H.text("ask-principal"), session, { placeholder: "שם המנהל/ת", back: true, chips: choices(session, []) });
        const bag = named.session.bag;
        const ask = H.confirmSchool(bag.schoolName, bag.principalName);
        return reply(ask, named.session, {
          chips: confirmChips(),
          confirm: { title: ask, action: "add-school", payload: { schoolName: bag.schoolName, principalName: bag.principalName }, done: H.addedSchool(bag.schoolName) }
        });
      }
    }
    if (flow === "add-classes") {
      if (session.step === "ask") {
        const names = parseList(text);
        if (!names.length) return reply(H.text("which-classes"), session, { placeholder: "ד׳1-ד׳3", back: true, chips: choices(session, []) });
        const next = remember(session);
        next.step = "confirm";
        next.bag.names = names;
        const title = H.confirmClasses(names.length);
        return reply(H.confirmList(title, names), next, {
          chips: confirmChips(),
          confirm: { title: title, action: "add-classes", payload: { schoolId: who.schoolId || "", names: names }, done: H.addedClasses(names.length) }
        });
      }
    }
    if (flow === "assign-teacher") {
      const rooms = (((schoolsOf(state, who)[0] || {}).classrooms) || []).filter(function (room) { return !clean(room.teacherName); });
      if (!rooms.length && session.step === "ask") return reply(H.text("all-have-teacher"), blank(), { chips: setupChips(role) });
      if (session.step === "ask") {
        const room = chosen(rooms, text, "class:", function (item) { return item.name; }, opts.resume);
        if (!room) return reply(H.text("which-class"), session, { chips: choices(session, rooms.map(function (item) { return { id: "class:" + item.id, label: item.name }; })), back: true });
        const next = remember(session);
        next.step = "name";
        next.bag.classId = room.id;
        next.bag.className = room.name;
        return reply(H.whoTeaches(room.name), next, { placeholder: "שם המורה", back: true, chips: choices(next, []) });
      }
      if (session.step === "name") {
        const teacherName = clean(text);
        if (!teacherName) return reply(H.whoTeaches(session.bag.className), session, { placeholder: "שם המורה", back: true, chips: choices(session, []) });
        const next = remember(session);
        next.step = "confirm";
        next.bag.teacherName = teacherName;
        const title = H.confirmTeacher(teacherName, next.bag.className);
        return reply(title, next, {
          chips: confirmChips(),
          confirm: { title: title, action: "assign-teacher", payload: { classId: next.bag.classId, className: next.bag.className, teacherName: teacherName }, done: H.teacherPlaced(teacherName, next.bag.className) }
        });
      }
    }
    if (flow === "rename-school" || flow === "delete-school") {
      const schools = (state && state.schools) || [];
      if (!schools.length) return reply(H.text("no-schools"), blank(), { chips: setupChips(role) });
      if (session.step === "ask") {
        const school = chosen(schools, text, "school:", function (item) { return item.name; }, opts.resume);
        if (!school) return reply(flow === "delete-school" ? H.text("delete-which") : H.text("which-school"), session, { chips: choices(session, schoolChips(state)), back: true });
        const next = remember(session);
        next.bag.schoolId = school.id;
        next.bag.schoolName = school.name;
        next.bag.principalName = school.principalName;
        if (flow === "delete-school") {
          next.step = "confirm";
          const title = H.confirmDelete(school.name);
          return reply(title, next, { chips: confirmChips(), confirm: { title: title, action: "delete-school", payload: { id: school.id }, done: H.deletedSchool(school.name) } });
        }
        next.step = "name";
        return reply(H.renameAsk(school.name), next, { placeholder: "שם חדש", back: true, chips: choices(next, []) });
      }
      if (session.step === "name") {
        const name = clean(text);
        if (!name) return reply(H.renameAsk(session.bag.schoolName), session, { placeholder: "שם חדש", back: true, chips: choices(session, []) });
        const next = remember(session);
        next.step = "confirm";
        next.bag.name = name;
        const title = H.confirmRename(next.bag.schoolName, name);
        return reply(title, next, { chips: confirmChips(), confirm: { title: title, action: "rename-school", payload: { id: next.bag.schoolId, name: name, extra: next.bag.principalName }, done: H.text("name-updated") } });
      }
    }
    if (flow === "template") {
      const found = roomOf(state, who);
      if (!found) return reply(H.text("no-class"), blank());
      const slots = templateSlots(found.room.name);
      const shaped = H.confirmTemplate(gradeLetter(found.room.name), slots);
      if (session.step === "ask") {
        if (opts.resume) return reply(H.text("ok"), blank(), { chips: setupChips(role) });
        const next = remember(session);
        next.step = "confirm";
        return reply(shaped.text, next, { chips: confirmChips(), confirm: { title: shaped.title, action: "template", payload: { classId: found.room.id, slots: slots }, done: H.text("template-done") } });
      }
    }
    if (flow === "add-kids") {
      const found = roomOf(state, who);
      if (!found) return reply(H.text("no-class"), blank());
      if (session.step === "ask") {
        const names = parseList(text);
        if (!names.length) return reply(H.text("which-kids"), session, { placeholder: "נועה, עומר", back: true, chips: choices(session, []) });
        const next = remember(session);
        next.step = "confirm";
        next.bag.names = names;
        const title = H.confirmKids(names.length);
        return reply(H.confirmList(title, names), next, { chips: confirmChips(), confirm: { title: title, action: "add-kids", payload: { classId: found.room.id, names: names }, done: names.length === 1 ? H.text("kid-added") : H.text("kids-added") } });
      }
    }
    if (flow === "add-parent") {
      const found = roomOf(state, who);
      const kids = ((found && found.room.kids) || []).filter(function (kid) { return !parentOf(kid, opts.people || []); });
      if (!kids.length) return reply(H.text("all-have-parent"), blank(), { chips: setupChips(role) });
      if (session.step === "ask") {
        const kid = chosen(kids, text, "kid:", function (item) { return item.firstName; }, opts.resume);
        if (!kid) return reply(H.text("which-kid"), session, { chips: choices(session, kids.map(function (item) { return { id: "kid:" + item.id, label: item.firstName }; })), back: true });
        const next = remember(session);
        next.step = "name";
        next.bag.kidId = kid.id;
        next.bag.kidName = kid.firstName;
        return reply(H.whoParent(kid.firstName), next, { placeholder: "שם ההורה", back: true, chips: choices(next, []) });
      }
      if (session.step === "name") {
        const parentName = clean(text);
        if (!parentName) return reply(H.whoParent(session.bag.kidName), session, { placeholder: "שם ההורה", back: true, chips: choices(session, []) });
        const next = remember(session);
        next.step = "confirm";
        next.bag.parentName = parentName;
        const title = H.confirmParent(parentName, next.bag.kidName);
        return reply(title, next, { chips: confirmChips(), confirm: { title: title, action: "add-parent", payload: { kidId: next.bag.kidId, parentName: parentName }, done: H.parentAdded(parentName) } });
      }
    }
    if (flow === "avatar") {
      const found = roomOf(state, who);
      if (!found) return reply(H.text("no-class"), blank());
      if (session.step === "ask") {
        const face = String(text || "").replace(/^face:/, "");
        if (!FACES[face]) {
          return reply(H.text("which-face"), session, { chips: choices(session, Object.keys(FACES).map(function (id) { return { id: "face:" + id, label: FACES[id] }; })), back: true });
        }
        const next = remember(session);
        next.step = "name";
        next.bag.face = face;
        return reply(H.nameFace(FACES[face]), next, { placeholder: "שם העוזר", back: true, chips: choices(next, []) });
      }
      if (session.step === "name") {
        const name = clean(text);
        if (!name) return reply(H.text("ask-helper-name"), session, { placeholder: "שם העוזר", back: true, chips: choices(session, []) });
        const next = remember(session);
        next.step = "confirm";
        next.bag.name = name;
        const title = H.confirmFace(FACES[next.bag.face], name);
        return reply(title, next, { chips: confirmChips(), confirm: { title: title, action: "avatar", payload: { classId: found.room.id, face: next.bag.face, name: name }, done: H.text("helper-saved") } });
      }
    }
    if (flow === "none-day") {
      const found = roomOf(state, who);
      if (!found) return reply(H.text("no-class"), blank());
      if (session.step === "ask") {
        if (opts.resume) return reply(H.text("ok"), blank(), { chips: setupChips(role) });
        const next = remember(session);
        next.step = "confirm";
        const title = H.text("none-day");
        return reply(title, next, { chips: confirmChips(), confirm: { title: title, action: "none-day", payload: { classId: found.room.id, date: today }, done: H.text("marked-none") } });
      }
    }
    return reply(H.text("choose"), blank(), { chips: setupChips(role) });
  }
  function guide(state, who, session, text, opts) {
    opts = opts || {};
    const role = who && who.role || "";
    const today = String(opts.today || "");
    if (!state || !who || !ALLOW[role] || !today) return deny();
    if (opts.back) {
      const prev = backSession(session || blank());
      if (!prev.flow) return reply(H.text("ok"), blank(), { chips: setupChips(role) });
      const resumed = {};
      Object.keys(opts).forEach(function (key) { resumed[key] = opts[key]; });
      resumed.back = false;
      resumed.resume = true;
      return flowStep(state, who, prev, "", resumed);
    }
    if (opts.declined) return reply(H.text("declined"), blank(), { chips: setupChips(role) });
    if (opts.applied) return reply(opts.done || H.text("done"), blank(), { chips: setupChips(role) });
    const intent = opts.intent || "";
    if (ENTRY[intent]) {
      const flow = ENTRY[intent];
      if (!allowed(role, flow)) return deny();
      if (flow === "attention") return reply(attentionText(state, today), blank(), { chips: setupChips(role) });
      if (flow === "health") return reply(healthText(state, today), blank(), { chips: setupChips(role) });
      if (flow === "scenarios") return reply(H.text("go-scenarios"), blank(), { go: { name: "data" }, chips: setupChips(role) });
      if (flow === "reset") return reply(H.text("go-reset"), blank(), { go: { name: "reset" }, chips: setupChips(role) });
      if (flow === "missing-today") return reply(missingText(state, who, today), blank(), { chips: setupChips(role) });
      if (flow === "teacher-note") {
        const note = teacherNote(state, who, today);
        return reply(note.text, blank(), { draft: note.draft, classId: note.classId, audience: note.audience || "class", chips: setupChips(role) });
      }
      if (flow === "gap") return reply(gapText(roomOf(state, who), today), blank(), { chips: setupChips(role) });
      if (flow === "parent-draft") {
        const note = parentDraft(roomOf(state, who), today);
        return reply(note.text, blank(), { draft: note.draft, classId: note.classId, audience: "parents", chips: setupChips(role) });
      }
      return flowStep(state, who, { flow: flow, step: "ask", bag: {}, history: [] }, "", opts);
    }
    if (session && session.flow) return flowStep(state, who, session, text, opts);
    return reply(H.text("choose"), blank(), { chips: setupChips(role) });
  }

  return { allowed: allowed, setupChips: setupChips, parseList: parseList, templateSlots: templateSlots, checklist: checklist, guide: guide };
});
