const S = window.Nohw;
const D = window.NohwDemo;
const STORE = "nohw-simple-demo";
const STATUS = { "not-updated": "לא עודכן", "no-homework": "אין שיעורים" };
const ROLE_LABEL = { admin: "מנהל מערכת", principal: "מנהל", teacher: "מורה", student: "תלמיד", parent: "הורה" };
const ROLE_ORDER = { admin: 0, principal: 1, teacher: 2, student: 3, parent: 4 };
const DAY_LABEL = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳"];
const I = {
  back: "M9 5l7 7-7 7",
  check: "M5 12.5 9.2 16.8 19 7.2",
  pencil: "M14.5 5.5l4 4M4 20l4.2-.8L19.2 8.2a2 2 0 0 0-2.8-2.8L5.4 16.4 4 20z",
  menu: "M4 7h16M4 12h16M4 17h16",
  cast: "M8 11.2a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2zM16.2 10.2a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM3.6 18.6c.7-2.2 2.4-3.4 4.4-3.4s3.7 1.2 4.4 3.4M13 18.6c.4-1.5 1.6-2.4 3.2-2.4 1.5 0 2.7.8 3.2 2.4"
};

let scenarioId = "cast";
let scenarioTitle = "";
let people = [];
let state = S.emptyState();
let person = null;
let view = { name: "people" };
let stack = [];

function ico(d) {
  const paths = Array.isArray(d) ? d : [d];
  return '<svg viewBox="0 0 24 24" aria-hidden="true">' + paths.map(function (p) {
    return '<path d="' + p + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
  }).join("") + "</svg>";
}
function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, function (ch) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch];
  });
}
function today() {
  const date = new Date();
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}
function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key) || ""); } catch (e) { return null; }
}
function saveStore() {
  localStorage.setItem(STORE, JSON.stringify({ scenarioId: scenarioId, scenarioTitle: scenarioTitle, personId: person && person.id || "", people: people, state: state }));
}
function render() { document.getElementById("app").innerHTML = html(); }
function push(next) { stack.push(view); view = next; render(); }
function actor() { return D.personActor(state, person); }
function shell(head, body) {
  return '<section class="app" lang="he" dir="rtl">' + head + body + "</section>";
}
function castButton() {
  return '<button class="icon" type="button" data-act="cast" aria-label="החלפת דמות">' + ico(I.cast) + "</button>";
}
function bar(title, sub, extra) {
  const back = stack.length ? '<button class="icon" type="button" data-act="back" aria-label="חזרה">' + ico(I.back) + "</button>" : "";
  return '<header class="top">' + back + '<div class="titles"><h1>' + esc(title) + "</h1>" + (sub ? "<p>" + esc(sub) + "</p>" : "") + "</div>" + (extra || "") + castButton() + "</header>";
}
function err() { return view.error ? '<p class="err">' + esc(view.error) + "</p>" : ""; }
function byRole(a, b) { return (ROLE_ORDER[a.role] - ROLE_ORDER[b.role]) || a.name.localeCompare(b.name, "he"); }
function focusDate() {
  const days = D.weekDates(today());
  const want = view.date || D.schoolDay(today());
  return days.indexOf(want) >= 0 ? want : days[days.length - 1];
}
function syncPeople() {
  people.forEach(function (item) {
    if (item.role === "principal") {
      const school = D.findSchool(state, item.schoolId);
      if (school) item.name = school.principalName;
    } else if (item.role === "teacher") {
      const found = D.findClass(state, item.classId);
      if (found) item.name = found.room.teacherName;
    } else if (item.role === "student") {
      const found = D.findKid(state, item.kidId);
      if (found) item.name = found.kid.firstName;
    } else if (item.role === "parent") item.kidIds = (item.kidIds || []).filter(function (id) { return D.findKid(state, id); });
  });
  people = people.filter(function (item) {
    if (item.role === "admin") return true;
    if (item.role === "principal") return !!D.findSchool(state, item.schoolId);
    if (item.role === "teacher") return !!D.findClass(state, item.classId);
    if (item.role === "student") return !!D.findKid(state, item.kidId);
    return item.role === "parent" && item.kidIds.length > 0;
  });
  if (person && !people.some(function (item) { return item.id === person.id; })) person = null;
}
function remember(role, code) {
  const found = S.identify(state, code);
  if (!found) return;
  if (role === "principal") people.push({ id: "p-" + found.school.id, name: found.school.principalName, emoji: "🏫", role: "principal", schoolId: found.school.id });
  else if (role === "teacher") people.push({ id: "t-" + found.room.id, name: found.room.teacherName, emoji: "📚", role: "teacher", schoolId: found.school.id, classId: found.room.id });
  else if (role === "student") people.push({ id: "s-" + found.kid.id, name: found.kid.firstName, emoji: "🎒", role: "student", schoolId: found.school.id, classId: found.room.id, kidId: found.kid.id });
}
function applyPack(pack, personId) {
  scenarioId = pack.id;
  scenarioTitle = pack.title || "";
  people = pack.people;
  state = pack.state;
  person = people.find(function (item) { return item.id === personId; }) || null;
  stack = [];
  view = person ? { name: "main" } : { name: "people" };
  saveStore();
  render();
}
function peopleHtml() {
  const cards = people.slice().sort(byRole).map(function (item) {
    return '<button class="person" type="button" data-act="enter" data-id="' + esc(item.id) + '"><span class="avatar">' + item.emoji + "</span><strong>" + esc(item.name) + '</strong><span class="tag">' + esc(ROLE_LABEL[item.role] || "") + "</span></button>";
  }).join("");
  const sub = scenarioTitle ? "<p>" + esc(scenarioTitle) + "</p>" : "";
  const head = '<header class="top"><div class="titles"><h1>שיעורי בית</h1>' + sub + '</div><button class="icon" type="button" data-act="menu" aria-label="תרחישים">' + ico(I.menu) + "</button>" + castButton() + "</header>";
  return shell(head, '<div class="cast">' + cards + "</div>");
}
function scenariosHtml() {
  const rows = D.scenarios(today()).map(function (item) {
    return '<button class="scenario" type="button" data-act="scenario" data-id="' + esc(item.id) + '">' + esc(item.title) + "</button>";
  }).join("");
  return shell(bar("תרחישים"), '<div class="list">' + rows + '</div><button class="ghost reset" type="button" data-act="reset">איפוס</button>');
}
function pencil(kind, id) {
  if (!S.canEdit(state, actor(), { kind: kind, id: id })) return "";
  return '<button class="icon" type="button" data-act="edit" data-kind="' + kind + '" data-id="' + esc(id) + '" aria-label="עריכה">' + ico(I.pencil) + "</button>";
}
function entityList(kind, rows, title, sub, extra, empty) {
  const body = rows.length ? '<div class="list">' + rows.map(function (row) {
    return '<div class="card"><button class="who" type="button" data-act="open" data-id="' + esc(row.id) + '"><strong>' + esc(row.title) + "</strong>" + (row.meta ? "<small>" + esc(row.meta) + "</small>" : "") + "</button>" + pencil(kind, row.id) + "</div>";
  }).join("") + "</div>" : '<p class="empty">' + empty + "</p>";
  return shell(bar(title, sub, extra || ""), body + '<button class="primary add" type="button" data-act="add"><span aria-hidden="true">+</span>הוספה</button>');
}
function schoolsHtml() {
  return entityList("school", (state.schools || []).map(function (item) {
    return { id: item.id, title: item.name, meta: item.principalName };
  }), "בתי ספר", "", "", "אין בתי ספר");
}
function classesHtml(schoolId) {
  const school = D.findSchool(state, schoolId);
  const rows = school ? (school.classrooms || []).map(function (item) {
    return { id: item.id, title: item.name, meta: item.teacherName };
  }) : [];
  return entityList("class", rows, school ? school.name : "כיתות", school ? "כיתות" : "", "", "אין כיתות");
}
function dayButton(classId) {
  return S.canEdit(state, actor(), { kind: "homework", classId: classId }) ? '<button class="text" type="button" data-act="day">היום</button>' : "";
}
function kidsHtml(classId) {
  const found = D.findClass(state, classId);
  const rows = found ? (found.room.kids || []).map(function (item) {
    return { id: item.id, title: item.firstName, meta: "" };
  }) : [];
  return entityList("kid", rows, found ? found.room.name : "כיתה", found ? found.room.teacherName : "", found ? dayButton(found.room.id) : "", "אין ילדים");
}
function parentKidsHtml() {
  const rows = (person.kidIds || []).map(function (id) {
    const found = D.findKid(state, id);
    return found ? { id: found.kid.id, title: found.kid.firstName, meta: found.room.name } : null;
  }).filter(Boolean);
  const body = rows.length ? '<div class="list">' + rows.map(function (row) {
    return '<button class="card" type="button" data-act="open" data-id="' + esc(row.id) + '"><span class="who"><strong>' + esc(row.title) + "</strong><small>" + esc(row.meta) + "</small></span></button>";
  }).join("") + "</div>" : '<p class="empty">אין ילדים</p>';
  return shell(bar("הילדים"), body);
}
function weekStrip(date) {
  return '<div class="week">' + D.weekDates(today()).map(function (item, index) {
    return '<button class="dow' + (item === date ? " on" : "") + '" type="button" data-act="date" data-date="' + item + '">' + DAY_LABEL[index] + "</button>";
  }).join("") + "</div>";
}
function chip(row) {
  const label = row.status === "posted" ? row.text : STATUS[row.status];
  return '<em class="chip' + (row.status === "posted" ? " posted" : "") + '">' + esc(label) + "</em>";
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
function dayHtml(kidId, live) {
  const found = D.findKid(state, kidId);
  if (!found) return shell(bar("היום"), '<p class="empty">אין ילדים</p>');
  const date = focusDate();
  const rows = S.rowsFor(found.room, date, found.kid);
  return shell(bar(found.kid.firstName, found.room.name), weekStrip(date) + '<div class="list">' + dayRows(rows, live) + "</div>");
}
function formHtml() {
  const add = view.add;
  const title = add === "school" ? "בית ספר" : add === "class" ? "כיתה" : "ילד";
  const fields = add === "school" ? [["a", "בית הספר", "בית הספר"], ["b", "שם המנהל", "שם המנהל"]] : add === "class" ? [["a", "כיתה", "ה'2"], ["b", "שם המורה", "שם המורה"]] : [["a", "שם פרטי", "שם פרטי"]];
  return shell(bar(title), '<form class="stack">' + fields.map(function (field) {
    return '<input name="' + field[0] + '" dir="rtl" maxlength="40" required placeholder="' + field[2] + '" aria-label="' + field[1] + '">';
  }).join("") + err() + '<button class="primary" type="submit">יצירה</button></form>');
}
function editHtml() {
  const kind = view.kind;
  let fields = [];
  let title = "";
  if (kind === "school") {
    const school = D.findSchool(state, view.id);
    if (!school) return schoolsHtml();
    title = school.name;
    fields = [["a", "בית הספר", school.name], ["b", "שם המנהל", school.principalName]];
  } else if (kind === "class") {
    const found = D.findClass(state, view.id);
    if (!found) return classesHtml(person && person.schoolId);
    title = found.room.name;
    fields = [["a", "כיתה", found.room.name], ["b", "שם המורה", found.room.teacherName]];
  } else {
    const found = D.findKid(state, view.id);
    if (!found) return shell(bar("עריכה"), '<p class="empty">אין ילדים</p>');
    title = found.kid.firstName;
    fields = [["a", "שם פרטי", found.kid.firstName]];
  }
  const inputs = fields.map(function (field) {
    return '<input name="' + field[0] + '" dir="rtl" maxlength="40" required value="' + esc(field[2]) + '" aria-label="' + field[1] + '">';
  }).join("");
  return shell(bar("עריכה", title), '<form class="stack fit">' + inputs + err() + '<button class="primary" type="submit">שמירה</button></form><div class="tools"><button class="ghost" type="button" data-act="ask" data-kind="' + kind + '" data-id="' + esc(view.id) + '">מחיקה</button></div>');
}
function confirmHtml() {
  return shell(bar("מחיקה", view.title || ""), '<div class="confirm"><p class="ask">למחוק?</p><div class="pair"><button class="primary" type="button" data-act="delete">מחיקה</button><button class="ghost" type="button" data-act="back">ביטול</button></div></div>');
}
function homeworkHtml() {
  const found = D.findClass(state, view.classId);
  if (!found) return shell(bar("היום"), '<p class="empty">אין כיתות</p>');
  const rows = S.rowsFor(found.room, D.schoolDay(today()), null);
  const current = rows.find(function (row) { return row.subject === view.subject; }) || rows[0];
  const buttons = rows.map(function (row) {
    return '<button class="row' + (row.subject === current.subject ? " on" : "") + '" type="button" data-act="subject" data-subject="' + esc(row.subject) + '"><span><strong>' + esc(row.subject) + "</strong>" + chip(row) + "</span></button>";
  }).join("");
  return shell(bar("היום", found.room.name), '<form class="stack"><div class="list">' + buttons + '</div><input name="text" dir="rtl" maxlength="80" placeholder="שיעורי בית" aria-label="שיעורי בית" value="' + esc(current && current.text) + '">' + err() + '<div class="pair"><button class="primary" type="submit">שמירה</button><button class="ghost" type="button" data-act="none">אין</button></div></form>');
}
function home() {
  if (person.role === "student") return dayHtml(person.kidId, true);
  if (person.role === "parent") return person.kidIds.length === 1 ? dayHtml(person.kidIds[0], false) : parentKidsHtml();
  if (person.role === "teacher") return kidsHtml(person.classId);
  if (person.role === "principal") return classesHtml(person.schoolId);
  return schoolsHtml();
}
function html() {
  if (view.name === "scenarios") return scenariosHtml();
  if (view.name === "people" || !person) return peopleHtml();
  if (view.name === "form") return formHtml();
  if (view.name === "edit") return editHtml();
  if (view.name === "confirm") return confirmHtml();
  if (view.name === "homework") return homeworkHtml();
  if (view.name === "day") return dayHtml(view.kidId, false);
  if (view.name === "kids") return kidsHtml(view.classId);
  if (view.name === "classes") return classesHtml(view.schoolId);
  return home();
}
function listLevel() {
  if (view.name === "classes" || (view.name === "main" && person && person.role === "principal")) return "classes";
  if (view.name === "kids" || (view.name === "main" && person && person.role === "teacher")) return "kids";
  if (view.name === "main" && person && person.role === "admin") return "schools";
  if (view.name === "day" || (view.name === "main" && person && person.role === "parent")) return "parent";
  return view.name;
}
function currentSchoolId() {
  if (view.schoolId) return view.schoolId;
  if (person && person.schoolId) return person.schoolId;
  const found = view.classId ? D.findClass(state, view.classId) : null;
  return found ? found.school.id : "";
}
function currentClassId() {
  if (view.classId) return view.classId;
  return person && person.classId || "";
}
function nodeTitle(kind, id) {
  if (kind === "school") return (D.findSchool(state, id) || {}).name || "";
  if (kind === "class") { const found = D.findClass(state, id); return found ? found.room.name : ""; }
  const found = D.findKid(state, id);
  return found ? found.kid.firstName : "";
}
function fail(error) {
  view.error = error && error.message === "forbidden" ? "אין הרשאה" : "חסר";
  render();
}
function homeworkInput(mode, text) {
  S.setHomework(state, actor(), { date: D.schoolDay(today()), subject: view.subject, classId: view.classId, mode: mode, text: text });
}
function onClick(event) {
  const el = event.target.closest("[data-act]");
  if (!el || (el.closest("form") && el.type === "submit")) return;
  const act = el.dataset.act;
  if (act === "menu") push({ name: "scenarios" });
  else if (act === "scenario") {
    const pack = D.scenarios(today()).find(function (item) { return item.id === el.dataset.id; });
    if (pack) applyPack(pack, pack.personId);
  } else if (act === "reset") applyPack(D.cast(today()), "");
  else if (act === "enter") {
    const who = people.find(function (item) { return item.id === el.dataset.id; });
    if (!who) return;
    person = who;
    stack = [];
    view = { name: "main" };
    saveStore();
    render();
  } else if (act === "cast") {
    person = null;
    stack = [];
    view = { name: "people" };
    saveStore();
    render();
  } else if (act === "back") {
    if (stack.length) { view = stack.pop(); render(); }
    else { person = null; view = { name: "people" }; saveStore(); render(); }
  } else if (act === "add") {
    const level = listLevel();
    if (level === "schools") push({ name: "form", add: "school" });
    else if (level === "classes") push({ name: "form", add: "class", schoolId: currentSchoolId() });
    else push({ name: "form", add: "kid", classId: currentClassId() });
  } else if (act === "open") {
    const level = listLevel();
    if (level === "schools") push({ name: "classes", schoolId: el.dataset.id });
    else if (level === "classes") push({ name: "kids", schoolId: currentSchoolId(), classId: el.dataset.id });
    else if (level === "parent") push({ name: "day", kidId: el.dataset.id });
    else push({ name: "day", kidId: el.dataset.id });
  } else if (act === "edit") {
    if (!S.canEdit(state, actor(), { kind: el.dataset.kind, id: el.dataset.id })) return;
    push({ name: "edit", kind: el.dataset.kind, id: el.dataset.id });
  } else if (act === "ask") push({ name: "confirm", kind: el.dataset.kind, id: el.dataset.id, title: nodeTitle(el.dataset.kind, el.dataset.id) });
  else if (act === "delete") {
    try {
      S.removeNode(state, actor(), { kind: view.kind, id: view.id });
      syncPeople();
      saveStore();
      view = stack.pop() || { name: "main" };
      while (view.name === "edit" || view.name === "confirm" || view.name === "form") view = stack.pop() || { name: "main" };
      if (!person) view = { name: "people" };
      render();
    } catch (e) { fail(e); }
  } else if (act === "day") push({ name: "homework", classId: currentClassId(), subject: S.SUBJECTS[0] });
  else if (act === "subject") { view.subject = el.dataset.subject; view.error = ""; render(); }
  else if (act === "none") {
    try { homeworkInput("none"); saveStore(); view.error = ""; }
    catch (e) { view.error = e.message === "forbidden" ? "אין הרשאה" : "חסר"; }
    render();
  } else if (act === "date") { view.date = el.dataset.date; render(); }
  else if (act === "tick") {
    const date = focusDate();
    const row = S.rowsFor(D.findKid(state, person.kidId).room, date, D.findKid(state, person.kidId).kid).find(function (item) { return item.subject === el.dataset.subject; });
    S.markDone(state, actor(), { date: date, subject: el.dataset.subject, done: !row.done });
    saveStore();
    render();
  }
}
function onSubmit(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  if (view.name === "homework") {
    try { homeworkInput("post", data.get("text")); saveStore(); view.error = ""; }
    catch (e) { view.error = e.message === "forbidden" ? "אין הרשאה" : "חסר"; }
    render();
    return;
  }
  if (view.name === "edit") {
    try {
      S.rename(state, actor(), { kind: view.kind, id: view.id, name: data.get("a"), extra: data.get("b") });
      syncPeople();
      saveStore();
      view = stack.pop() || { name: "main" };
    } catch (e) { fail(e); return; }
    render();
    return;
  }
  try {
    if (view.add === "school") {
      const code = S.addPrincipal(state, actor(), { schoolName: data.get("a"), principalName: data.get("b") }, Math.random);
      remember("principal", code);
    } else if (view.add === "class") {
      const code = S.addClassroom(state, actor(), { schoolId: view.schoolId || currentSchoolId(), className: data.get("a"), teacherName: data.get("b") }, Math.random);
      remember("teacher", code);
    } else {
      const created = S.addKid(state, actor(), { classId: view.classId || currentClassId(), firstName: data.get("a") }, Math.random);
      remember("student", created.kidCode);
    }
    saveStore();
    view = stack.pop() || { name: "main" };
  } catch (e) { fail(e); return; }
  render();
}
function boot() {
  document.documentElement.lang = "he";
  document.documentElement.dir = "rtl";
  const saved = readJSON(STORE);
  if (saved && saved.state && saved.state.v === 1 && Array.isArray(saved.people)) {
    scenarioId = saved.scenarioId || "cast";
    scenarioTitle = saved.scenarioTitle || "";
    people = saved.people;
    state = saved.state;
    person = people.find(function (item) { return item.id === saved.personId; }) || null;
    view = person ? { name: "main" } : { name: "people" };
  } else applyPack(D.cast(today()), "");
  const app = document.getElementById("app");
  app.addEventListener("click", onClick);
  app.addEventListener("submit", onSubmit);
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
}
boot();
