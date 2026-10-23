const S = window.Nohw;
const KEY = "nohw-simple";
const ADMIN = "nohw-simple-admin";
const SES = "nohw-simple-session";
const STATUS = { "not-updated": "לא עודכן", "no-homework": "אין שיעורים" };
const ROLES = [
  ["admin", "מנהל מערכת", "M12 3l7 3v6c0 4.2-3.1 7.4-7 8.8C8.1 19.4 5 16.2 5 12V6l7-3z"],
  ["principal", "מנהל", "M4 20h16M6 20V5h12v15M9 8h2M13 8h2M9 12h2M13 12h2M10 20v-4h4v4"],
  ["teacher", "מורה", "M15.2 8.2a3.2 3.2 0 1 1-6.4 0 3.2 3.2 0 0 1 6.4 0zM6 19.2c1.1-2.7 3.2-4 6-4s4.9 1.3 6 4"],
  ["student", "תלמיד", ["M4.5 5.5h6A2.5 2.5 0 0 1 13 8v11H7A2.5 2.5 0 0 1 4.5 16.5z", "M13 8h6.5V19H13"]],
  ["parent", "הורה", "M8.2 11.2a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2zM16.4 10.4a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4zM3.8 18.4c.7-2.1 2.3-3.2 4.4-3.2s3.7 1.1 4.4 3.2M13.2 18.4c.5-1.6 1.7-2.6 3.2-2.6 1.6 0 2.8.9 3.4 2.6"]
];
const I = {
  back: "M9 5l7 7-7 7",
  check: "M5 12.5 9.2 16.8 19 7.2",
  chat: "M5 16.2V7.2A2.2 2.2 0 0 1 7.2 5h9.6A2.2 2.2 0 0 1 19 7.2v6.2a2.2 2.2 0 0 1-2.2 2.2H9.2L5 19.2z",
  copy: ["M8 8.5h8.5V18H8z", "M7.5 15.5V6h8.5"],
  pencil: "M14.5 5.5l4 4M4 20l4.2-.8L19.2 8.2a2 2 0 0 0-2.8-2.8L5.4 16.4 4 20z"
};
const CODE_LABEL = { school: ["principal", "קוד מנהל"], class: ["teacher", "קוד מורה"], kid: ["student", "קוד תלמיד"], parent: ["parent", "קוד הורה"] };

let state = S.emptyState();
let session = null;
let view = { name: "roles" };
let stack = [];
let toastTimer = 0;

function ico(d, mirror) {
  const paths = Array.isArray(d) ? d : [d];
  return '<svg class="' + (mirror ? "mirror" : "") + '" viewBox="0 0 24 24" aria-hidden="true">' + paths.map(function (p) {
    return '<path d="' + p + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
  }).join("") + "</svg>";
}
function ltr(value) {
  return '<bdi dir="ltr">' + esc(value) + "</bdi>";
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}
function today() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || ""); } catch (e) { return null; }
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }
function saveSession() { localStorage.setItem(SES, JSON.stringify(session)); }
function render() { document.getElementById("app").innerHTML = html(); }
function push(next) { stack.push(view); view = next; render(); }
function show(next) { view = next; render(); }
function shell(head, body) {
  const toast = view.toast ? '<p class="toast" role="status">' + esc(view.toast) + "</p>" : "";
  return '<section class="app" lang="he" dir="rtl">' + head + body + toast + "</section>";
}
function bar(title, sub, extra, backLabel) {
  return '<header class="top"><button class="icon" type="button" data-act="back" aria-label="' + (backLabel || "חזרה") + '">' + ico(I.back) + '</button><div class="titles"><h1>' + esc(title) + "</h1>" + (sub ? "<p>" + esc(sub) + "</p>" : "") + "</div>" + (extra || "") + "</header>";
}
function backWord() { return stack.length ? "חזרה" : "החלפת תפקיד"; }
function roleMeta(id) { return ROLES.find(function (role) { return role[0] === id; }); }
function schoolById(id) { return state.schools.find(function (item) { return item.id === id; }) || null; }
function classById(id) {
  for (const school of state.schools) {
    const room = (school.classrooms || []).find(function (item) { return item.id === id; });
    if (room) return { school, room };
  }
  return null;
}
function kidById(id) {
  for (const school of state.schools) {
    for (const room of school.classrooms || []) {
      const kid = (room.kids || []).find(function (item) { return item.id === id; });
      if (kid) return { school, room, kid };
    }
  }
  return null;
}
function here() {
  if (!session) return {};
  if (session.role === "admin") return { schoolId: view.schoolId, classId: view.classId };
  const found = S.identify(state, session.code);
  if (!found) return {};
  if (session.role === "principal") return { schoolId: found.school.id, classId: view.classId, found };
  if (session.role === "teacher") return { schoolId: found.school.id, classId: found.room.id, found };
  return { found };
}
function listLevel() {
  if (view.name === "classes" || (view.name === "main" && session && session.role === "principal")) return "classes";
  if (view.name === "kids" || (view.name === "main" && session && session.role === "teacher")) return "kids";
  if (view.name === "main" && session && session.role === "admin") return "schools";
  return view.name;
}
function nodeTitle(kind, id) {
  if (kind === "school") return (schoolById(id) || {}).name || "";
  if (kind === "class") { const found = classById(id); return found ? found.room.name : ""; }
  const found = kidById(id);
  return found ? found.kid.firstName : "";
}
function err() { return view.error ? '<p class="err">' + esc(view.error) + "</p>" : ""; }
function shareBlocks(items) {
  return (items || []).map(function (item) {
    return '<div class="block"><span>' + esc(item.label) + (item.hint ? " · " + esc(item.hint) : "") + '</span><p class="big">' + ltr(item.code) + '</p><div class="pair"><button class="primary wa" type="button" data-act="wa" data-role="' + item.role + '" data-code="' + esc(item.code) + '">' + ico(I.chat, true) + "וואטסאפ</button><button class=\"ghost\" type=\"button\" data-act=\"copy\" data-code=\"" + esc(item.code) + "\">העתקה</button></div></div>";
  }).join("");
}
function codeLine(role, code, label) {
  return '<div class="code-line"><span>' + esc(label) + "</span><b>" + ltr(code) + '</b><button class="icon" type="button" data-act="copy" data-code="' + esc(code) + '" aria-label="העתקה">' + ico(I.copy) + '</button><button class="icon" type="button" data-act="wa" data-role="' + role + '" data-code="' + esc(code) + '" aria-label="וואטסאפ">' + ico(I.chat, true) + "</button></div>";
}
function entityList(kind, rows, title, sub, extra) {
  const body = rows.length ? '<div class="list">' + rows.map(function (row) {
    const pencil = S.canEdit(state, session, { kind: kind, id: row.id })
      ? '<button class="icon" type="button" data-act="edit" data-kind="' + kind + '" data-id="' + esc(row.id) + '" aria-label="עריכה">' + ico(I.pencil) + "</button>"
      : "";
    return '<div class="card"><button class="who" type="button" data-act="open" data-id="' + esc(row.id) + '"><strong>' + esc(row.title) + "</strong><small>" + row.metaHtml + "</small></button>" + pencil + "</div>";
  }).join("") + "</div>" : '<p class="empty">ריק</p>';
  return shell(bar(title, sub, extra || "", backWord()), body + '<button class="primary add" type="button" data-act="add"><span aria-hidden="true">+</span>הוספה</button>');
}
function dayButton(classId) {
  return S.canEdit(state, session, { kind: "homework", classId: classId }) ? '<button class="text" type="button" data-act="day">היום</button>' : "";
}
function rolesHtml() {
  const buttons = ROLES.map(function (role) {
    return '<button class="role" type="button" data-act="role" data-arg="' + role[0] + '"><span class="badge">' + ico(role[2]) + "</span><b>" + esc(role[1]) + "</b></button>";
  }).join("");
  return shell('<header class="hero"><h1>שיעורי בית</h1></header>', '<div class="roles">' + buttons + "</div>" + err());
}
function codeHtml() {
  const role = roleMeta(view.role);
  return shell(bar(role[1], "", "", backWord()), '<form class="stack"><input class="code-input" name="code" dir="ltr" maxlength="6" autocapitalize="characters" autocomplete="off" aria-label="קוד" required>' + err() + '<button class="primary" type="submit">כניסה</button></form>');
}
function schoolsHtml() {
  return entityList("school", state.schools.map(function (school) {
    return { id: school.id, title: school.name, metaHtml: esc(school.principalName) + " · " + ltr(school.principalCode) };
  }), "בתי ספר", "");
}
function classesHtml() {
  const school = schoolById(here().schoolId);
  const rows = school ? (school.classrooms || []).map(function (room) {
    return { id: room.id, title: room.name, metaHtml: esc(room.teacherName) + " · " + ltr(room.teacherCode) };
  }) : [];
  return entityList("class", rows, school ? school.name : "כיתות", school ? "כיתות" : "");
}
function kidsHtml() {
  const found = classById(here().classId);
  const rows = found ? (found.room.kids || []).map(function (kid) {
    return { id: kid.id, title: kid.firstName, metaHtml: "תלמיד " + ltr(kid.kidCode) + " · הורה " + ltr(kid.parentCode) };
  }) : [];
  return entityList("kid", rows, found ? found.room.name : "כיתה", found ? found.room.teacherName : "", found ? dayButton(found.room.id) : "");
}
function kidHtml() {
  const found = kidById(view.kidId);
  if (!found) return kidsHtml();
  return shell(bar(found.kid.firstName, found.room.name, "", "חזרה"), shareBlocks([
    { role: "student", code: found.kid.kidCode, label: "קוד תלמיד", hint: found.kid.firstName },
    { role: "parent", code: found.kid.parentCode, label: "קוד הורה", hint: found.kid.firstName }
  ]));
}
function formHtml() {
  const add = view.add;
  const title = add === "school" ? "בית ספר" : add === "class" ? "כיתה" : "ילד";
  const fields = add === "school" ? [["a", "בית הספר", "בית הספר"], ["b", "שם המנהל", "שם המנהל"]] : add === "class" ? [["a", "כיתה", "ה'2"], ["b", "שם המורה", "שם המורה"]] : [["a", "שם פרטי", "שם פרטי"]];
  return shell(bar(title, "", "", "חזרה"), '<form class="stack">' + fields.map(function (field) {
    return '<input name="' + field[0] + '" dir="rtl" maxlength="40" required placeholder="' + field[2] + '" aria-label="' + field[1] + '">';
  }).join("") + err() + '<button class="primary" type="submit">יצירה</button></form>');
}
function editHtml() {
  const kind = view.kind;
  const fields = [];
  const lines = [];
  if (kind === "school") {
    const school = schoolById(view.id);
    if (!school) return schoolsHtml();
    fields.push(["a", "בית הספר", school.name], ["b", "שם המנהל", school.principalName]);
    lines.push(codeLine("principal", school.principalCode, "קוד מנהל"));
  } else if (kind === "class") {
    const found = classById(view.id);
    if (!found) return classesHtml();
    fields.push(["a", "כיתה", found.room.name], ["b", "שם המורה", found.room.teacherName]);
    lines.push(codeLine("teacher", found.room.teacherCode, "קוד מורה"));
  } else {
    const found = kidById(view.id);
    if (!found) return kidsHtml();
    fields.push(["a", "שם פרטי", found.kid.firstName]);
    lines.push(codeLine("student", found.kid.kidCode, "קוד תלמיד"), codeLine("parent", found.kid.parentCode, "קוד הורה"));
  }
  const inputs = fields.map(function (field) {
    return '<input name="' + field[0] + '" dir="rtl" maxlength="40" required value="' + esc(field[2]) + '" aria-label="' + field[1] + '">';
  }).join("");
  const resets = kind === "kid"
    ? '<div class="pair"><button class="ghost" type="button" data-act="reset" data-kind="kid" data-id="' + esc(view.id) + '">קוד תלמיד</button><button class="ghost" type="button" data-act="reset" data-kind="parent" data-id="' + esc(view.id) + '">קוד הורה</button></div>'
    : '<button class="ghost" type="button" data-act="reset" data-kind="' + kind + '" data-id="' + esc(view.id) + '">קוד חדש</button>';
  return shell(bar("עריכה", nodeTitle(kind, view.id), "", "חזרה"), '<form class="stack fit">' + inputs + err() + '<button class="primary" type="submit">שמירה</button></form><div class="tools">' + lines.join("") + resets + '<button class="ghost" type="button" data-act="ask" data-kind="' + kind + '" data-id="' + esc(view.id) + '">מחיקה</button></div>');
}
function confirmHtml() {
  return shell(bar("מחיקה", view.title || "", "", "חזרה"), '<div class="confirm"><p class="ask">למחוק?</p><div class="pair"><button class="primary" type="button" data-act="delete">מחיקה</button><button class="ghost" type="button" data-act="back">ביטול</button></div></div>');
}
function shareHtml() {
  return shell(bar("שיתוף", "", "", "חזרה"), shareBlocks(view.items));
}
function chip(row) {
  const label = row.status === "posted" ? row.text : STATUS[row.status];
  return '<em class="chip ' + (row.status === "posted" ? "posted" : "") + '">' + esc(label) + "</em>";
}
function tick(row, live) {
  if (row.status !== "posted") return "";
  const mark = row.done ? ico(I.check) : "";
  if (!live) return '<span class="tick' + (row.done ? " on" : "") + '" aria-label="' + (row.done ? "הוכן" : "לא הוכן") + '">' + mark + "</span>";
  return '<button class="tick' + (row.done ? " on" : "") + '" type="button" data-act="tick" data-subject="' + esc(row.subject) + '" aria-pressed="' + (row.done ? "true" : "false") + '" aria-label="הוכן">' + mark + "</button>";
}
function dayRows(rows, live) {
  return rows.map(function (row) {
    return '<div class="row"><span><strong>' + esc(row.subject) + "</strong>" + chip(row) + "</span>" + tick(row, live) + "</div>";
  }).join("");
}
function dayHtml() {
  const found = S.identify(state, session.code);
  const rows = S.dayFor(state, session, today());
  return shell(bar("היום", found ? found.kid.firstName : "", "", backWord()), '<div class="list">' + dayRows(rows, session.role === "student") + "</div>");
}
function homeworkRoom() {
  return classById(view.classId || here().classId);
}
function homeworkHtml() {
  const found = homeworkRoom();
  if (!found) return kidsHtml();
  const rows = S.rowsFor(found.room, today(), null);
  const current = rows.find(function (row) { return row.subject === view.subject; }) || rows[0];
  const buttons = rows.map(function (row) {
    return '<button class="row' + (row.subject === current.subject ? " on" : "") + '" type="button" data-act="subject" data-subject="' + esc(row.subject) + '"><span><strong>' + esc(row.subject) + "</strong>" + chip(row) + "</span></button>";
  }).join("");
  return shell(bar("היום", found.room.name, "", "חזרה"), '<form class="stack"><div class="list">' + buttons + '</div><input name="text" dir="rtl" maxlength="80" placeholder="שיעורי בית" aria-label="שיעורי בית" value="' + esc(current && current.text) + '">' + err() + '<div class="pair"><button class="primary" type="submit">שמירה</button><button class="ghost" type="button" data-act="none">אין</button></div></form>');
}
function html() {
  if (view.name === "code") return codeHtml();
  if (view.name === "roles" || !session) return rolesHtml();
  if (session.role !== "admin" && !(S.identify(state, session.code) || {}).code) return rolesHtml();
  if (view.name === "form") return formHtml();
  if (view.name === "share") return shareHtml();
  if (view.name === "homework") return homeworkHtml();
  if (view.name === "edit") return editHtml();
  if (view.name === "confirm") return confirmHtml();
  if (view.name === "kid") return kidHtml();
  if (session.role === "student" || session.role === "parent") return dayHtml();
  if (listLevel() === "kids") return kidsHtml();
  if (listLevel() === "classes") return classesHtml();
  return schoolsHtml();
}
function leave() {
  session = null;
  stack = [];
  localStorage.removeItem(SES);
  view = { name: "roles" };
  render();
}
function unwind() {
  view = stack.pop() || { name: "main" };
  while (view.name === "edit" || view.name === "confirm" || view.name === "form") view = stack.pop() || { name: "main" };
  render();
}
function message(role, code) {
  const url = location.origin + location.pathname + location.search + "#pack=" + S.encodePack(S.packFor(state, role, code));
  return "קוד \u2066" + code + "\u2069\n\u2066" + url + "\u2069";
}
function homeworkInput(mode, text) {
  const classId = view.classId || here().classId;
  S.setHomework(state, session, { date: today(), subject: view.subject, classId: classId, mode: mode, text: text });
}
function onClick(event) {
  const el = event.target.closest("[data-act]");
  if (!el || el.closest("form") && el.type === "submit") return;
  const act = el.dataset.act;
  if (act === "role") {
    if (el.dataset.arg === "admin") {
      if (localStorage.getItem(ADMIN) !== "1") { view = { name: "roles", error: "אין הרשאה" }; render(); return; }
      session = { role: "admin" };
      saveSession();
      stack = [];
      view = { name: "main" };
    } else push({ name: "code", role: el.dataset.arg });
    render();
  } else if (act === "back") {
    if (stack.length) { view = stack.pop(); render(); }
    else leave();
  } else if (act === "add") {
    const ids = here();
    const level = listLevel();
    if (level === "schools") push({ name: "form", add: "school" });
    else if (level === "classes") push({ name: "form", add: "class", schoolId: ids.schoolId });
    else push({ name: "form", add: "kid", classId: ids.classId });
  } else if (act === "open") {
    const id = el.dataset.id;
    const level = listLevel();
    const ids = here();
    if (level === "schools") push({ name: "classes", schoolId: id });
    else if (level === "classes") push({ name: "kids", schoolId: ids.schoolId, classId: id });
    else push({ name: "kid", schoolId: ids.schoolId, classId: ids.classId, kidId: id });
  } else if (act === "edit") {
    if (!S.canEdit(state, session, { kind: el.dataset.kind, id: el.dataset.id })) return;
    push({ name: "edit", kind: el.dataset.kind, id: el.dataset.id });
  } else if (act === "ask") {
    push({ name: "confirm", kind: el.dataset.kind, id: el.dataset.id, title: nodeTitle(el.dataset.kind, el.dataset.id) });
  } else if (act === "delete") {
    try {
      S.removeNode(state, session, { kind: view.kind, id: view.id });
      save();
      unwind();
    } catch (e) { view.error = "אין הרשאה"; render(); }
  } else if (act === "reset") {
    try {
      const kind = el.dataset.kind;
      const id = el.dataset.id;
      const code = S.resetCode(state, session, { kind: kind, id: id }, Math.random);
      save();
      const pair = CODE_LABEL[kind];
      show({ name: "share", items: [{ role: pair[0], code: code, label: pair[1], hint: nodeTitle(kind === "parent" ? "kid" : kind, id) }] });
    } catch (e) { view.error = e.message === "forbidden" ? "אין הרשאה" : "חסר"; render(); }
  } else if (act === "day") push({ name: "homework", classId: here().classId, subject: S.SUBJECTS[0] });
  else if (act === "subject") { view.subject = el.dataset.subject; view.error = ""; render(); }
  else if (act === "none") {
    try { homeworkInput("none"); save(); view.error = ""; }
    catch (e) { view.error = e.message === "forbidden" ? "אין הרשאה" : "חסר"; }
    render();
  } else if (act === "tick") {
    const row = S.dayFor(state, session, today()).find(function (item) { return item.subject === el.dataset.subject; });
    S.markDone(state, session, { date: today(), subject: el.dataset.subject, done: !row.done });
    save();
    render();
  } else if (act === "wa") window.open("https://wa.me/?text=" + encodeURIComponent(message(el.dataset.role, el.dataset.code)), "_blank", "noopener");
  else if (act === "copy") {
    const payload = S.copyPayload(el.dataset.code);
    const done = function () {
      view.toast = "הועתק";
      render();
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () { view.toast = ""; render(); }, 1400);
    };
    const fallback = function () {
      const area = document.createElement("textarea");
      area.value = payload;
      area.dir = "ltr";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(payload).then(done).catch(function () { fallback(); done(); });
    else { fallback(); done(); }
  }
}
function fail(error) {
  view.error = error && error.message === "forbidden" ? "אין הרשאה" : "חסר";
  render();
}
function onSubmit(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  if (view.name === "code") {
    const found = S.identify(state, data.get("code"));
    if (!found || found.role !== view.role) { view.error = "שגוי"; render(); return; }
    session = { role: found.role, code: found.code };
    saveSession();
    stack = [];
    view = { name: "main" };
    render();
    return;
  }
  if (view.name === "homework") {
    try { homeworkInput("post", data.get("text")); save(); view.error = ""; }
    catch (e) { view.error = e.message === "forbidden" ? "אין הרשאה" : "חסר"; }
    render();
    return;
  }
  if (view.name === "edit") {
    try {
      S.rename(state, session, { kind: view.kind, id: view.id, name: data.get("a"), extra: data.get("b") });
      save();
      view = stack.pop() || { name: "main" };
    } catch (e) { fail(e); return; }
    render();
    return;
  }
  try {
    const ids = here();
    if (view.add === "school") {
      const code = S.addPrincipal(state, session, { schoolName: data.get("a"), principalName: data.get("b") }, Math.random);
      save();
      show({ name: "share", items: [{ role: "principal", code: code, label: "קוד מנהל", hint: String(data.get("b") || "").trim() }] });
    } else if (view.add === "class") {
      const code = S.addClassroom(state, session, { schoolId: view.schoolId || ids.schoolId, className: data.get("a"), teacherName: data.get("b") }, Math.random);
      save();
      show({ name: "share", items: [{ role: "teacher", code: code, label: "קוד מורה", hint: String(data.get("b") || "").trim() }] });
    } else {
      const kid = S.addKid(state, session, { classId: view.classId || ids.classId, firstName: data.get("a") }, Math.random);
      save();
      const name = String(data.get("a") || "").trim();
      show({ name: "share", items: [
        { role: "student", code: kid.kidCode, label: "קוד תלמיד", hint: name },
        { role: "parent", code: kid.parentCode, label: "קוד הורה", hint: name }
      ] });
    }
  } catch (e) { fail(e); }
}
function boot() {
  document.documentElement.lang = "he";
  document.documentElement.dir = "rtl";
  const stored = readJSON(KEY);
  state = stored && stored.v === 1 && Array.isArray(stored.schools) ? stored : S.emptyState();
  const token = (location.hash.match(/^#pack=([A-Za-z0-9_-]+)/) || [])[1];
  if (token) {
    try {
      const who = S.importPack(state, S.decodePack(token));
      save();
      if (who.role && who.role !== "admin" && who.code && S.identify(state, who.code)) {
        session = { role: who.role, code: who.code };
        saveSession();
        stack = [];
        view = { name: "main" };
      }
    } catch (e) { view = { name: "roles", error: "שגוי" }; }
    history.replaceState(null, "", location.pathname + location.search);
  } else if (localStorage.getItem(ADMIN) !== "1" && state.schools.length === 0) localStorage.setItem(ADMIN, "1");
  if (!session) {
    const saved = readJSON(SES);
    if (saved && saved.role === "admin" && localStorage.getItem(ADMIN) === "1") { session = saved; view = { name: "main" }; }
    else if (saved && saved.code && (S.identify(state, saved.code) || {}).role === saved.role) { session = { role: saved.role, code: S.identify(state, saved.code).code }; view = { name: "main" }; }
  }
  const app = document.getElementById("app");
  app.addEventListener("click", onClick);
  app.addEventListener("submit", onSubmit);
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
}
boot();
