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
  live: "M4 12h2.8l2-6 3.4 12 2.2-6H20",
  cast: "M8 11.2a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2zM16.2 10.2a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2zM3.6 18.6c.7-2.2 2.4-3.4 4.4-3.4s3.7 1.2 4.4 3.4M13 18.6c.4-1.5 1.6-2.4 3.2-2.4 1.5 0 2.7.8 3.2 2.4"
};

let scenarioId = "cast";
let scenarioTitle = "";
let suggestedId = "";
let roleFilter = "all";
let focusSuggested = false;
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
  localStorage.setItem(STORE, JSON.stringify({ scenarioId: scenarioId, scenarioTitle: scenarioTitle, personId: person && person.id || "", suggestedId: suggestedId, people: people, state: state }));
}
function render() {
  document.getElementById("app").innerHTML = html();
  if (!focusSuggested) return;
  focusSuggested = false;
  const picked = document.querySelector(".person.on");
  if (picked) picked.scrollIntoView({ block: "center" });
}
function push(next) { stack.push(view); view = next; render(); }
function actor() { return D.personActor(state, person); }
function shell(head, body) {
  return '<section class="app" lang="he" dir="rtl">' + head + body + "</section>";
}
function castButton() {
  return '<button class="icon" type="button" data-act="cast" aria-label="החלפת דמות">' + ico(I.cast) + "</button>";
}
function liveButton() {
  return '<button class="icon" type="button" data-act="live" aria-label="נתונים חיים">' + ico(I.live) + "</button>";
}
function bar(title, sub, extra) {
  const back = stack.length ? '<button class="icon" type="button" data-act="back" aria-label="חזרה">' + ico(I.back) + "</button>" : "";
  return '<header class="top">' + back + '<div class="titles"><h1>' + esc(title) + "</h1>" + (sub ? "<p>" + esc(sub) + "</p>" : "") + "</div>" + (extra || "") + liveButton() + castButton() + "</header>";
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
    } else if (item.role === "parent") {
      const before = (item.kidIds || []).length;
      item.kidIds = (item.kidIds || []).filter(function (id) { return D.findKid(state, id); });
      item.keepEmpty = before === 0;
    }
  });
  people = people.filter(function (item) {
    if (item.role === "admin") return true;
    if (item.role === "principal") return !!D.findSchool(state, item.schoolId);
    if (item.role === "teacher") return !!D.findClass(state, item.classId);
    if (item.role === "student") return !!D.findKid(state, item.kidId);
    return item.role === "parent" && (item.kidIds.length > 0 || item.keepEmpty);
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
function adopt(pack, next) {
  scenarioId = pack.id;
  scenarioTitle = pack.title || "";
  people = pack.people;
  state = pack.state;
  person = null;
  suggestedId = pack.personId || "";
  roleFilter = "all";
  focusSuggested = next.name === "people" && !!suggestedId;
  stack = next.stack || [];
  view = { name: next.name };
  saveStore();
  render();
}
function peopleHtml() {
  const groups = [
    ["admin", "מנהל מערכת", "🧔"],
    ["principal", "מנהלי בית ספר", "🏫"],
    ["teacher", "מורים", "👩‍🏫"],
    ["student", "תלמידים", "🎒"],
    ["parent", "הורים", "👪"]
  ];
  const filters = [["all", "הכל"], ["admin", "מערכת"], ["principal", "מנהל"], ["teacher", "מורה"], ["student", "תלמיד"], ["parent", "הורה"]];
  const chips = '<div class="filters">' + filters.map(function (item) {
    const icon = groups.filter(function (group) { return group[0] === item[0]; })[0];
    return '<button class="filter' + (roleFilter === item[0] ? " on" : "") + '" type="button" data-act="filter" data-role="' + item[0] + '" aria-pressed="' + (roleFilter === item[0] ? "true" : "false") + '">' + (icon ? "<span>" + icon[2] + "</span>" : "") + esc(item[1]) + "</button>";
  }).join("") + "</div>";
  const body = groups.map(function (group) {
    if (roleFilter !== "all" && roleFilter !== group[0]) return "";
    const items = people.filter(function (item) { return item.role === group[0]; }).sort(function (a, b) { return a.name.localeCompare(b.name, "he"); });
    if (!items.length) return "";
    const cards = items.map(function (item) {
      const on = item.id === suggestedId;
      const caption = D.parentCaption(item, state);
      return '<button class="person' + (group[0] === "parent" ? " parent" : "") + (on ? " on" : "") + '" type="button" data-act="enter" data-id="' + esc(item.id) + '"' + (on ? ' aria-current="true"' : "") + '><span class="avatar">' + item.emoji + '</span><span class="meta"><strong>' + esc(item.name) + "</strong>" + (caption ? "<small>" + esc(caption) + "</small>" : "") + "</span></button>";
    }).join("");
    return '<section class="group" data-role="' + group[0] + '"><h2><span>' + group[2] + "</span>" + esc(group[1]) + '</h2><div class="cast' + (group[0] === "parent" ? " parents" : "") + '">' + cards + "</div></section>";
  }).join("");
  return shell(bar("דמויות", scenarioTitle), chips + '<div class="groups">' + body + "</div>");
}
function startHtml() {
  const head = '<header class="top"><div class="titles"><h1>שיעורי בית</h1></div></header>';
  const cards = [["data", "📂", "נתונים"], ["live", "📡", "נתונים חיים"], ["people", "👥", "דמויות"]].map(function (item) {
    return '<button class="choice" type="button" data-act="go" data-to="' + item[0] + '"><span class="avatar">' + item[1] + "</span><strong>" + esc(item[2]) + "</strong></button>";
  }).join("");
  return shell(head, '<div class="hub">' + cards + "</div>");
}
function dataHtml() {
  const rows = D.scenarios(today()).map(function (item) {
    const on = item.id === scenarioId;
    return '<button class="scenario' + (on ? " on" : "") + '" type="button" data-act="scenario" data-id="' + esc(item.id) + '"' + (on ? ' aria-current="true"' : "") + '><span class="avatar">' + esc(item.emoji) + "</span><strong>" + esc(item.title) + "</strong>" + (on ? '<span class="mark">' + ico(I.check) + "<small>פעיל</small></span>" : "") + "</button>";
  }).join("");
  return shell(bar("נתונים"), '<div class="list picks">' + rows + '</div><button class="ghost reset" type="button" data-act="reset">איפוס</button>');
}
function stat(icon, value, label) {
  return '<span class="stat" aria-label="' + esc(label + " " + value) + '"><span class="emo">' + icon + "</span><b>" + value + "</b><small>" + esc(label) + "</small></span>";
}
function liveHtml() {
  const tree = D.liveView(state, today());
  const schools = tree.schools.map(function (school) {
    const classes = school.classes.map(function (room) {
      const kids = room.kids.map(function (kid) {
        return '<div class="kid"><span>🎒</span><b>' + esc(kid.name) + '</b><span class="mini" aria-label="' + esc("הוכן " + kid.done) + '">✅ ' + kid.done + "</span></div>";
      }).join("");
      return '<div class="room"><div class="line"><span class="emo">📚</span><strong>' + esc(room.name) + '</strong><span class="mini" aria-label="' + esc("ילדים " + room.kidCount) + '">🎒 ' + room.kidCount + '</span></div><div class="stats">' + stat("📝", room.posted, "פורסם") + stat("⏳", room.notUpdated, "לא עודכן") + stat("🚫", room.none, "אין שיעורים") + stat("✅", room.done, "הוכן") + "</div>" + kids + "</div>";
    }).join("");
    return '<section class="school"><div class="line"><span class="emo">🏫</span><strong>' + esc(school.name) + '</strong><span class="mini" aria-label="' + esc("כיתות " + school.classCount) + '">📚 ' + school.classCount + '</span><span class="mini" aria-label="' + esc("ילדים " + school.kidCount) + '">🎒 ' + school.kidCount + "</span></div>" + classes + "</section>";
  }).join("");
  return shell(bar("נתונים חיים"), '<div class="tree">' + (schools || '<p class="empty">אין בתי ספר</p>') + "</div>");
}
function resetHtml() {
  return shell(bar("איפוס"), '<div class="confirm"><p class="ask">לאפס?</p><div class="pair"><button class="primary" type="button" data-act="do-reset">איפוס</button><button class="ghost" type="button" data-act="back">ביטול</button></div></div>');
}
function pencil(kind, id) {
  if (!S.canEdit(state, actor(), { kind: kind, id: id })) return "";
  return '<button class="icon" type="button" data-act="edit" data-kind="' + kind + '" data-id="' + esc(id) + '" aria-label="עריכה">' + ico(I.pencil) + "</button>";
}
function entityList(kind, rows, title, sub, extra, empty) {
  const body = rows.length ? '<div class="list">' + rows.map(function (row) {
    return '<div class="card"><button class="who" type="button" data-act="open" data-id="' + esc(row.id) + '"><strong>' + esc(row.title) + "</strong>" + (row.meta ? "<small>" + esc(row.meta) + "</small>" : "") + "</button>" + (row.aside || "") + pencil(kind, row.id) + "</div>";
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
function linkParent(kidId, name) {
  const text = String(name || "").trim().slice(0, 40);
  if (!text || !kidId) return;
  const existing = parentOf(kidId);
  if (existing) { existing.name = text; return; }
  const found = D.findKid(state, kidId);
  people.push({ id: "par-" + kidId, name: text, emoji: "👪", role: "parent", kin: "הורה", kidIds: [kidId], schoolId: found ? found.school.id : "", classId: found ? found.room.id : "" });
}
function parentOf(kidId) {
  return people.find(function (item) { return item.role === "parent" && (item.kidIds || []).indexOf(kidId) >= 0; }) || null;
}
function parentIcon(kidId) {
  const parent = parentOf(kidId);
  if (!parent) return "";
  return '<button class="icon" type="button" data-act="as-parent" data-id="' + esc(parent.id) + '" aria-label="ראה כהורה"><span class="emo">👪</span></button>';
}
function kidsHtml(classId) {
  const found = D.findClass(state, classId);
  const rows = found ? (found.room.kids || []).map(function (item) {
    return { id: item.id, title: item.firstName, meta: "", aside: parentIcon(item.id) };
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
  return shell(bar(person.name, D.parentCaption(person, state) || "הילדים"), body);
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
function parentShortcut(kidId) {
  const parent = parentOf(kidId);
  if (!parent) return "";
  const caption = D.parentCaption(parent, state);
  return '<button class="jump" type="button" data-act="as-parent" data-id="' + esc(parent.id) + '"><span>👪</span><b>ראה כהורה</b>' + (caption ? "<small>" + esc(caption) + "</small>" : "") + "</button>";
}
function dayHtml(kidId, live) {
  const found = D.findKid(state, kidId);
  if (!found) return shell(bar("היום"), '<p class="empty">אין ילדים</p>');
  const date = focusDate();
  const rows = S.rowsFor(found.room, date, found.kid);
  const jump = live ? parentShortcut(kidId) : "";
  return shell(bar(found.kid.firstName, found.room.name), jump + weekStrip(date) + '<div class="list">' + dayRows(rows, live) + "</div>");
}
const ENTITY = {
  school: { icon: "🏫", noun: "בית ספר", add: "הוספת בית ספר", edit: "עריכת בית ספר", remove: "מחיקת בית ספר", fields: [["a", "שם בית ספר", "אלון"], ["b", "שם מנהל/ת", "דנה כהן"]] },
  class: { icon: "🚪", noun: "כיתה", add: "הוספת כיתה", edit: "עריכת כיתה", remove: "מחיקת כיתה", fields: [["a", "שם כיתה", "ה'2"], ["b", "שם מורה", "מיכל אביב"]] },
  kid: { icon: "🧒", noun: "תלמיד", add: "הוספת תלמיד", edit: "עריכת תלמיד", remove: "מחיקת תלמיד", fields: [["a", "שם תלמיד", "נועה"], ["b", "שם הורה", "יעל ברק", "👪"]] },
  parent: { icon: "👪", noun: "הורה", add: "הוספת הורה", edit: "עריכת הורה", remove: "מחיקת הורה", fields: [["a", "שם הורה", "יעל ברק", "👪"]] }
};
function entityOf(kind) { return ENTITY[kind] || ENTITY.kid; }
function entityHeading(item, name) {
  return item.icon + " " + (name ? item.edit + " · " + name : item.add);
}
function fieldInput(field, value) {
  const label = (field[3] ? field[3] + " " : "") + field[1];
  return '<label class="field"><span>' + esc(label) + '</span><input name="' + field[0] + '" dir="rtl" maxlength="40" required value="' + esc(value || "") + '" placeholder="' + esc(field[2]) + '" aria-label="' + esc(field[1]) + '"></label>';
}
function formHtml() {
  const item = entityOf(view.add);
  const inputs = item.fields.map(function (field) { return fieldInput(field, ""); }).join("");
  return shell(bar(entityHeading(item, "")), '<form class="stack">' + inputs + err() + '<button class="primary" type="submit">יצירה</button></form>');
}
function editValues(kind) {
  if (kind === "school") {
    const school = D.findSchool(state, view.id);
    return school ? [school.name, [school.name, school.principalName]] : null;
  }
  if (kind === "class") {
    const found = D.findClass(state, view.id);
    return found ? [found.room.name, [found.room.name, found.room.teacherName]] : null;
  }
  if (kind === "parent") {
    const parent = people.find(function (item) { return item.id === view.id && item.role === "parent"; });
    return parent ? [parent.name, [parent.name]] : null;
  }
  const found = D.findKid(state, view.id);
  if (!found) return null;
  const parent = parentOf(view.id);
  return [found.kid.firstName, [found.kid.firstName, parent ? parent.name : ""]];
}
function editHtml() {
  const item = entityOf(view.kind);
  const values = editValues(view.kind);
  if (!values) {
    if (view.kind === "school") return schoolsHtml();
    if (view.kind === "class") return classesHtml(person && person.schoolId);
    return shell(bar(entityHeading(item, "")), '<p class="empty">אין ילדים</p>');
  }
  const inputs = item.fields.map(function (field, index) { return fieldInput(field, values[1][index]); }).join("");
  const remove = view.kind === "parent" ? "" : '<div class="tools"><button class="ghost" type="button" data-act="ask" data-kind="' + view.kind + '" data-id="' + esc(view.id) + '">' + esc(item.remove) + "</button></div>";
  return shell(bar(entityHeading(item, values[0])), '<form class="stack fit">' + inputs + err() + '<button class="primary" type="submit">שמירה</button></form>' + remove);
}
function confirmHtml() {
  const item = entityOf(view.kind);
  const name = view.title || item.noun;
  return shell(bar(item.icon + " " + item.remove + " · " + name), '<div class="confirm"><p class="ask">למחוק את ' + esc(name) + '?</p><div class="pair"><button class="primary" type="button" data-act="delete">' + esc(item.remove) + '</button><button class="ghost" type="button" data-act="back">ביטול</button></div></div>');
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
  if (view.name === "start") return startHtml();
  if (view.name === "data") return dataHtml();
  if (view.name === "live") return liveHtml();
  if (view.name === "reset") return resetHtml();
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
  if (act === "go") {
    const name = el.dataset.to;
    if (name === "data" || name === "live" || name === "people") {
    if (name === "people") roleFilter = "all";
    push({ name: name });
  }
  } else if (act === "live") {
    if (view.name !== "live") push({ name: "live" });
  } else if (act === "scenario") {
    const pack = D.scenarioById(el.dataset.id, today());
    if (pack && pack.id === el.dataset.id) adopt(pack, { name: "people", stack: [{ name: "start" }, { name: "data" }] });
  } else if (act === "reset") push({ name: "reset" });
  else if (act === "do-reset") adopt(D.scenarioById(scenarioId, today()), { name: "data", stack: [{ name: "start" }] });
  else if (act === "filter") { roleFilter = el.dataset.role || "all"; render(); }
  else if (act === "as-parent") {
    const who = people.find(function (item) { return item.id === el.dataset.id; });
    if (!who || who.role !== "parent") return;
    const prev = { name: view.name, personId: person && person.id || "" };
    ["schoolId", "classId", "kidId", "date", "subject", "kind", "id", "add", "title"].forEach(function (key) { if (view[key]) prev[key] = view[key]; });
    stack.push(prev);
    person = who;
    view = { name: "main" };
    saveStore();
    render();
  } else if (act === "enter") {
    const who = people.find(function (item) { return item.id === el.dataset.id; });
    if (!who) return;
    person = who;
    stack = [];
    view = { name: "main" };
    saveStore();
    render();
  } else if (act === "cast") {
    person = null;
    roleFilter = "all";
    stack = [{ name: "start" }];
    view = { name: "people" };
    saveStore();
    render();
  } else if (act === "back") {
    if (stack.length) {
      const prev = stack.pop();
      if (prev.personId) {
        const who = people.find(function (item) { return item.id === prev.personId; });
        if (who) person = who;
      }
      view = prev;
      render();
    } else { person = null; stack = [{ name: "start" }]; view = { name: "people" }; saveStore(); render(); }
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
      if (view.kind === "parent") {
        const parent = people.find(function (item) { return item.id === view.id && item.role === "parent"; });
        if (!parent) throw new Error("missing");
        parent.name = String(data.get("a") || "").trim().slice(0, 40);
        if (!parent.name) throw new Error("missing");
      } else {
        S.rename(state, actor(), { kind: view.kind, id: view.id, name: data.get("a"), extra: data.get("b") });
        if (view.kind === "kid") linkParent(view.id, data.get("b"));
      }
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
      const added = S.identify(state, created.kidCode);
      if (added && added.kid) linkParent(added.kid.id, data.get("b"));
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
    suggestedId = saved.suggestedId || "";
    view = person ? { name: "main" } : { name: "start" };
  } else {
    const pack = D.cast(today());
    scenarioId = pack.id;
    scenarioTitle = "";
    people = pack.people;
    state = pack.state;
    person = null;
    suggestedId = "";
    stack = [];
    view = { name: "start" };
  }
  const app = document.getElementById("app");
  app.addEventListener("click", onClick);
  app.addEventListener("submit", onSubmit);
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(function () {});
}
boot();
