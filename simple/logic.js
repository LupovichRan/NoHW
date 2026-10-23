(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.Nohw = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const CODE = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;
  const SUBJECTS = ["חשבון", "עברית", "אנגלית", "מדעים", "תנ״ך"];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }
  function norm(code) {
    return String(code || "").trim().toUpperCase();
  }
  function cleanCode(code) {
    const text = norm(code);
    return CODE.test(text) ? text : "";
  }
  function textOf(value) {
    const text = String(value || "").trim();
    if (!text) throw new Error("missing");
    return text.slice(0, 40);
  }
  function copyPayload(code) {
    const text = norm(code);
    if (!CODE.test(text)) throw new Error("missing");
    return text;
  }
  function generateCode(random) {
    const next = random || Math.random;
    let out = "";
    for (let i = 0; i < 6; i++) out += ALPHABET[Math.floor(next() * ALPHABET.length)];
    return out;
  }
  function uid(random) {
    let out = "";
    for (let i = 0; i < 8; i++) out += Math.floor(random() * 36).toString(36);
    return out;
  }
  function emptyState() {
    return { v: 1, schools: [] };
  }
  function codes(state) {
    const used = new Set();
    for (const school of state.schools || []) {
      if (school.principalCode) used.add(school.principalCode);
      for (const room of school.classrooms || []) {
        if (room.teacherCode) used.add(room.teacherCode);
        for (const kid of room.kids || []) {
          if (kid.kidCode) used.add(kid.kidCode);
          if (kid.parentCode) used.add(kid.parentCode);
        }
      }
    }
    return used;
  }
  function uniqueCode(state, random, extra) {
    const used = codes(state);
    for (let i = 0; i < 40; i++) {
      const code = generateCode(random);
      if (!used.has(code) && !(extra && extra.has(code))) return code;
    }
    throw new Error("codes");
  }
  function locate(state, code) {
    const c = norm(code);
    if (!c) return null;
    for (const school of state.schools || []) {
      if (school.principalCode && school.principalCode === c) return { role: "principal", code: c, school };
      for (const room of school.classrooms || []) {
        if (room.teacherCode && room.teacherCode === c) return { role: "teacher", code: c, school, room };
        for (const kid of room.kids || []) {
          if (kid.kidCode && kid.kidCode === c) return { role: "student", code: c, school, room, kid };
          if (kid.parentCode && kid.parentCode === c) return { role: "parent", code: c, school, room, kid };
        }
      }
    }
    return null;
  }
  function locateClass(state, classId) {
    if (!classId) return null;
    for (const school of state.schools || []) {
      for (const room of school.classrooms || []) {
        if (room.id === classId) return { school, room };
      }
    }
    return null;
  }
  function locateKid(state, kidId) {
    if (!kidId) return null;
    for (const school of state.schools || []) {
      for (const room of school.classrooms || []) {
        for (const kid of room.kids || []) {
          if (kid.id === kidId) return { school, room, kid };
        }
      }
    }
    return null;
  }
  function resolveTarget(state, target) {
    if (!target) return null;
    if (target.kind === "school") {
      const school = (state.schools || []).find(function (item) { return item.id === target.id; });
      return school ? { school } : null;
    }
    if (target.kind === "class") {
      if (target.id) return locateClass(state, target.id);
      const school = (state.schools || []).find(function (item) { return item.id === target.schoolId; });
      return school ? { school } : null;
    }
    if (target.kind === "homework") return locateClass(state, target.classId || target.id);
    if (target.kind === "kid" || target.kind === "parent") {
      if (target.id) return locateKid(state, target.id);
      return locateClass(state, target.classId);
    }
    return null;
  }
  function actorScope(state, actor) {
    if (!actor || actor.role === "student" || actor.role === "parent") return null;
    if (actor.role === "admin") return { role: "admin" };
    if (actor.role !== "principal" && actor.role !== "teacher") return null;
    const found = locate(state, actor.code);
    return found && found.role === actor.role ? found : null;
  }
  const EDIT = {
    admin: { school: 1, class: 1, kid: 1, parent: 1, homework: 1 },
    principal: { class: 1, kid: 1, parent: 1, homework: 1 },
    teacher: { kid: 1, parent: 1, homework: 1 }
  };
  function canEdit(state, actor, target) {
    const scope = actorScope(state, actor);
    if (!scope || !target || !EDIT[scope.role][target.kind]) return false;
    const node = resolveTarget(state, target);
    if (!node) return false;
    if (scope.role === "admin") return true;
    if (!node.school || node.school.id !== scope.school.id) return false;
    if (scope.role === "principal") return true;
    return !!(node.room && scope.room && node.room.id === scope.room.id);
  }
  function requireEdit(state, actor, target) {
    if (!canEdit(state, actor, target)) throw new Error("forbidden");
    return resolveTarget(state, target);
  }
  function addPrincipal(state, actor, input, random) {
    if (!actor || actor.role !== "admin") throw new Error("forbidden");
    const school = {
      id: uid(random),
      name: textOf(input && input.schoolName),
      principalName: textOf(input && input.principalName),
      principalCode: uniqueCode(state, random),
      classrooms: []
    };
    state.schools.push(school);
    return school.principalCode;
  }
  function addClassroom(state, actor, input, random) {
    let schoolId = input && input.schoolId;
    if (!schoolId && actor && actor.role === "principal") {
      const found = locate(state, actor.code);
      schoolId = found && found.role === "principal" ? found.school.id : "";
    }
    const node = requireEdit(state, actor, { kind: "class", schoolId });
    const room = {
      id: uid(random),
      name: textOf(input && input.className),
      teacherName: textOf(input && input.teacherName),
      teacherCode: uniqueCode(state, random),
      homework: {},
      kids: []
    };
    node.school.classrooms.push(room);
    return room.teacherCode;
  }
  function addKid(state, actor, input, random) {
    let classId = input && input.classId;
    if (!classId && actor && actor.role === "teacher") {
      const found = locate(state, actor.code);
      classId = found && found.role === "teacher" ? found.room.id : "";
    }
    const node = requireEdit(state, actor, { kind: "kid", classId });
    if (!node.room) throw new Error("forbidden");
    const kidCode = uniqueCode(state, random);
    const parentCode = uniqueCode(state, random, new Set([kidCode]));
    node.room.kids.push({
      id: uid(random),
      firstName: textOf(input && input.firstName),
      kidCode,
      parentCode,
      done: {}
    });
    return { kidCode, parentCode };
  }
  function statusOf(entry) {
    if (!entry || typeof entry !== "object") return "not-updated";
    if (entry.mode === "none") return "no-homework";
    if (entry.mode === "post") return "posted";
    return "not-updated";
  }
  function setHomework(state, actor, input) {
    let classId = input && input.classId;
    if (!classId && actor && actor.role === "teacher") {
      const found = locate(state, actor.code);
      classId = found && found.role === "teacher" ? found.room.id : "";
    }
    const node = requireEdit(state, actor, { kind: "homework", classId });
    const subject = input && input.subject;
    const date = input && input.date;
    if (!SUBJECTS.includes(subject) || !date) throw new Error("missing");
    node.room.homework = node.room.homework || {};
    node.room.homework[date] = node.room.homework[date] || {};
    if (input.mode === "none") {
      node.room.homework[date][subject] = { mode: "none" };
      return;
    }
    const text = String((input && input.text) || "").trim();
    if (input.mode !== "post" || !text) throw new Error("missing");
    node.room.homework[date][subject] = { mode: "post", text: text.slice(0, 80) };
  }
  function rename(state, actor, target) {
    const node = requireEdit(state, actor, target);
    if (target.kind === "school") {
      node.school.name = textOf(target.name);
      node.school.principalName = textOf(target.extra);
      return;
    }
    if (target.kind === "class") {
      if (!node.room) throw new Error("forbidden");
      node.room.name = textOf(target.name);
      node.room.teacherName = textOf(target.extra);
      return;
    }
    if (target.kind === "kid") {
      if (!node.kid) throw new Error("forbidden");
      node.kid.firstName = textOf(target.name);
      return;
    }
    throw new Error("forbidden");
  }
  function resetCode(state, actor, target, random) {
    if (!target || (target.kind !== "school" && target.kind !== "class" && target.kind !== "kid" && target.kind !== "parent")) throw new Error("forbidden");
    const node = requireEdit(state, actor, target);
    if (target.kind === "class" && !node.room) throw new Error("forbidden");
    if ((target.kind === "kid" || target.kind === "parent") && !node.kid) throw new Error("forbidden");
    const code = uniqueCode(state, random);
    if (target.kind === "school") node.school.principalCode = code;
    else if (target.kind === "class") node.room.teacherCode = code;
    else if (target.kind === "kid") node.kid.kidCode = code;
    else node.kid.parentCode = code;
    return code;
  }
  function removeNode(state, actor, target) {
    if (!target || (target.kind !== "school" && target.kind !== "class" && target.kind !== "kid")) throw new Error("forbidden");
    const node = requireEdit(state, actor, target);
    if (target.kind === "class" && !node.room) throw new Error("forbidden");
    if (target.kind === "kid" && !node.kid) throw new Error("forbidden");
    if (target.kind === "school") state.schools = state.schools.filter(function (item) { return item.id !== node.school.id; });
    else if (target.kind === "class") node.school.classrooms = node.school.classrooms.filter(function (item) { return item.id !== node.room.id; });
    else node.room.kids = node.room.kids.filter(function (item) { return item.id !== node.kid.id; });
  }
  function rowsFor(room, date, kid) {
    const day = (room.homework || {})[date] || {};
    const marks = (kid && kid.done && kid.done[date]) || {};
    return SUBJECTS.map(function (subject) {
      const entry = day[subject];
      const status = statusOf(entry);
      return {
        subject,
        status,
        text: status === "posted" ? entry.text || "" : "",
        done: status === "posted" && !!marks[subject]
      };
    });
  }
  function dayFor(state, actor, date) {
    if (!actor || (actor.role !== "student" && actor.role !== "parent")) throw new Error("forbidden");
    const found = locate(state, actor.code);
    if (!found || found.role !== actor.role) throw new Error("forbidden");
    return rowsFor(found.room, date, found.kid);
  }
  function markDone(state, actor, input) {
    if (!actor || actor.role !== "student") throw new Error("forbidden");
    const found = locate(state, actor.code);
    if (!found || found.role !== "student") throw new Error("forbidden");
    const subject = input && input.subject;
    const date = input && input.date;
    const entry = ((found.room.homework || {})[date] || {})[subject];
    if (statusOf(entry) !== "posted") throw new Error("forbidden");
    found.kid.done = found.kid.done || {};
    found.kid.done[date] = found.kid.done[date] || {};
    found.kid.done[date][subject] = !!input.done;
  }
  function kidSlice(kid, role) {
    return {
      id: kid.id,
      firstName: kid.firstName,
      kidCode: role === "student" ? kid.kidCode : "",
      parentCode: role === "parent" ? kid.parentCode : "",
      done: clone(kid.done || {})
    };
  }
  function packFor(state, role, code) {
    const found = locate(state, code);
    if (!found || found.role !== role) throw new Error("forbidden");
    const school = {
      id: found.school.id,
      name: found.school.name,
      principalName: found.school.principalName,
      principalCode: role === "principal" ? found.school.principalCode : "",
      classrooms: []
    };
    if (role === "principal") {
      school.classrooms = clone(found.school.classrooms || []);
      return { v: 1, role, code: found.code, schools: [school] };
    }
    const room = found.room;
    school.classrooms = [{
      id: room.id,
      name: room.name,
      teacherName: room.teacherName,
      teacherCode: role === "teacher" ? room.teacherCode : "",
      homework: clone(room.homework || {}),
      kids: role === "teacher" ? clone(room.kids || []) : [kidSlice(found.kid, role)]
    }];
    return { v: 1, role, code: found.code, schools: [school] };
  }
  function encodePack(pack) {
    const bytes = new TextEncoder().encode(JSON.stringify(pack));
    let bin = "";
    for (const byte of bytes) bin += String.fromCharCode(byte);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  function decodePack(token) {
    const pad = token.length % 4 ? "=".repeat(4 - (token.length % 4)) : "";
    const bin = atob(String(token).replace(/-/g, "+").replace(/_/g, "/") + pad);
    const bytes = Uint8Array.from(bin, function (ch) { return ch.charCodeAt(0); });
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  function cleanHomework(homework) {
    const out = {};
    for (const date of Object.keys(homework || {})) {
      out[date] = {};
      for (const subject of Object.keys(homework[date] || {})) {
        const entry = homework[date][subject];
        if (!entry) continue;
        if (entry.mode === "none") out[date][subject] = { mode: "none" };
        else if (entry.mode === "post" && String(entry.text || "").trim()) out[date][subject] = { mode: "post", text: String(entry.text).trim().slice(0, 80) };
      }
    }
    return out;
  }
  function mergeHomework(local, incoming) {
    const out = clone(local || {});
    const clean = cleanHomework(incoming);
    for (const date of Object.keys(clean)) out[date] = Object.assign({}, out[date] || {}, clean[date]);
    return out;
  }
  function mergeDone(local, incoming) {
    const out = clone(local || {});
    for (const date of Object.keys(incoming || {})) {
      out[date] = Object.assign({}, out[date] || {});
      for (const subject of Object.keys(incoming[date] || {})) out[date][subject] = !!incoming[date][subject];
    }
    return out;
  }
  function mergeKid(room, incoming) {
    if (!incoming || !incoming.id) return;
    const kidCode = cleanCode(incoming.kidCode);
    const parentCode = cleanCode(incoming.parentCode);
    let kid = room.kids.find(function (item) { return item.id === incoming.id; });
    if (!kid && kidCode) kid = room.kids.find(function (item) { return item.kidCode === kidCode; });
    if (!kid && parentCode) kid = room.kids.find(function (item) { return item.parentCode === parentCode; });
    if (!kid) {
      room.kids.push({
        id: String(incoming.id),
        firstName: String(incoming.firstName || "").trim().slice(0, 40),
        kidCode,
        parentCode,
        done: mergeDone({}, incoming.done)
      });
      return;
    }
    if (incoming.firstName) kid.firstName = String(incoming.firstName).trim().slice(0, 40);
    if (kidCode) kid.kidCode = kidCode;
    if (parentCode) kid.parentCode = parentCode;
    kid.done = mergeDone(kid.done, incoming.done);
  }
  function mergeRoom(school, incoming) {
    if (!incoming || !incoming.id) return;
    const teacherCode = cleanCode(incoming.teacherCode);
    let room = school.classrooms.find(function (item) { return item.id === incoming.id; });
    if (!room && teacherCode) room = school.classrooms.find(function (item) { return item.teacherCode === teacherCode; });
    if (!room) {
      room = {
        id: String(incoming.id),
        name: String(incoming.name || "").trim().slice(0, 40),
        teacherName: String(incoming.teacherName || "").trim().slice(0, 40),
        teacherCode,
        homework: {},
        kids: []
      };
      school.classrooms.push(room);
    } else {
      if (incoming.name) room.name = String(incoming.name).trim().slice(0, 40);
      if (incoming.teacherName) room.teacherName = String(incoming.teacherName).trim().slice(0, 40);
      if (teacherCode) room.teacherCode = teacherCode;
    }
    room.homework = mergeHomework(room.homework, incoming.homework);
    for (const kid of incoming.kids || []) mergeKid(room, kid);
  }
  function mergeSchool(state, incoming) {
    if (!incoming || !incoming.id) throw new Error("bad-pack");
    const principalCode = cleanCode(incoming.principalCode);
    let school = state.schools.find(function (item) { return item.id === incoming.id; });
    if (!school && principalCode) school = state.schools.find(function (item) { return item.principalCode === principalCode; });
    if (!school) {
      school = {
        id: String(incoming.id),
        name: String(incoming.name || "").trim().slice(0, 40),
        principalName: String(incoming.principalName || "").trim().slice(0, 40),
        principalCode,
        classrooms: []
      };
      state.schools.push(school);
    } else {
      if (incoming.name) school.name = String(incoming.name).trim().slice(0, 40);
      if (incoming.principalName) school.principalName = String(incoming.principalName).trim().slice(0, 40);
      if (principalCode) school.principalCode = principalCode;
    }
    for (const room of incoming.classrooms || []) mergeRoom(school, room);
  }
  function importPack(state, pack) {
    if (!pack || pack.v !== 1 || !Array.isArray(pack.schools)) throw new Error("bad-pack");
    for (const school of pack.schools) mergeSchool(state, school);
    return { role: pack.role || "", code: cleanCode(pack.code) };
  }

  return {
    SUBJECTS,
    generateCode,
    copyPayload,
    emptyState,
    identify: locate,
    addPrincipal,
    addClassroom,
    addKid,
    canEdit,
    rename,
    resetCode,
    removeNode,
    statusOf,
    setHomework,
    rowsFor,
    dayFor,
    markDone,
    packFor,
    encodePack,
    decodePack,
    importPack
  };
});
