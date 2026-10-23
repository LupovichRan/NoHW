const S = window.Nohw;
const KEY = "nohw-simple";
const ADMIN = "nohw-simple-admin";
const SES = "nohw-simple-session";
const STATUS = { "not-updated": "לא עודכן", "no-homework": "אין שיעורים" };
const ROLES = [
  ["admin", "אדמין", "M12 3l7 3v6c0 4.2-3.1 7.4-7 8.8C8.1 19.4 5 16.2 5 12V6l7-3z"],
  ["principal", "מנהל", "M4 20h16M6 20V5h12v15M9 8h2M13 8h2M9 12h2M13 12h2M10 20v-4h4v4"],
  ["teacher", "מורה", "M15.2 8.2a3.2 3.2 0 1 1-6.4 0 3.2 3.2 0 0 1 6.4 0zM6 19.2c1.1-2.7 3.2-4 6-4s4.9 1.3 6 4"],
  ["student", "תלמיד", ["M4.5 5.5h6A2.5 2.5 0 0 1 13 8v11H7A2.5 2.5 0 0 1 4.5 16.5z", "M13 8h6.5V19H13"]],
  ["parent", "הורה", "M8.2 11.2a2.6 2.6 0 1 1 0-5.2 2.6 2.6 0 0 1 0 5.2zM16.4 10.4a2.2 2.2 0 1 1 0-4.4 2.2 2.2 0 0 1 0 4.4zM3.8 18.4c.7-2.1 2.3-3.2 4.4-3.2s3.7 1.1 4.4 3.2M13.2 18.4c.5-1.6 1.7-2.6 3.2-2.6 1.6 0 2.8.9 3.4 2.6"]
];
const I = {
  back: "M9 5l7 7-7 7",
  check: "M5 12.5 9.2 16.8 19 7.2",
  chat: "M5 16.2V7.2A2.2 2.2 0 0 1 7.2 5h9.6A2.2 2.2 0 0 1 19 7.2v6.2a2.2 2.2 0 0 1-2.2 2.2H9.2L5 19.2z",
  copy: ["M8 8.5h8.5V18H8z", "M7.5 15.5V6h8.5"]
};

let state = S.emptyState();
let session = null;
let view = { name: "roles" };
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
function shell(head, body) {
  const toast = view.toast ? '<p class="toast" role="status">' + esc(view.toast) + "</p>" : "";
  return '<section class="app" lang="he" dir="rtl">' + head + body + toast + "</section>";
}
function bar(title, sub, extra, backLabel) {
  return '<header class="top"><button class="icon" type="button" data-act="back" aria-label="' + (backLabel || "חזרה") + '">' + ico(I.back) + '</button><div class="titles"><h1>' + esc(title) + "</h1>" + (sub ? "<p>" + esc(sub) + "</p>" : "") + "</div>" + (extra || "") + "</header>";
}
function roleMeta(id) { return ROLES.find(function (role) { return role[0] === id; }); }
function place() {
  if (!session || session.role === "admin") return { title: "בתי ספר" };
  const found = S.identify(state, session.code);
  if (!found) return { title: "שיעורי בית" };
  if (session.role === "principal") return { title: "כיתות", sub: found.school.name };
  if (session.role === "teacher") return { title: found.room.name, sub: found.room.teacherName };
  return { title: "היום", sub: found.kid.firstName };
}
function shareItems(id) {
  if (session.role === "admin") {
    const school = state.schools.find(function (item) { return item.id === id; });
    return school ? [{ role: "principal", code: school.principalCode, label: "קוד מנהל", hint: school.principalName }] : [];
  }
  const found = S.identify(state, session.code);
  if (session.role === "principal") {
    const room = found.school.classrooms.find(function (item) { return item.id === id; });
    return room ? [{ role: "teacher", code: room.teacherCode, label: "קוד מורה", hint: room.teacherName }] : [];
  }
  const kid = found.room.kids.find(function (item) { return item.id === id; });
  return kid ? [
    { role: "student", code: kid.kidCode, label: "קוד תלמיד", hint: kid.firstName },
    { role: "parent", code: kid.parentCode, label: "קוד הורה", hint: kid.firstName }
  ] : [];
}
function cards() {
  if (session.role === "admin") {
    return state.schools.map(function (school) {
      return { id: school.id, title: school.name, metaHtml: esc(school.principalName) + " · " + ltr(school.principalCode) };
    });
  }
  const found = S.identify(state, session.code);
  if (session.role === "principal") {
    return found.school.classrooms.map(function (room) {
      return { id: room.id, title: room.name, metaHtml: esc(room.teacherName) + " · " + ltr(room.teacherCode) };
    });
  }
  return found.room.kids.map(function (kid) {
    return { id: kid.id, title: kid.firstName, metaHtml: "תלמיד " + ltr(kid.kidCode) + " · הורה " + ltr(kid.parentCode) };
  });
}
function rolesHtml() {
  const buttons = ROLES.map(function (role) {
    return '<button class="role" type="button" data-act="role" data-arg="' + role[0] + '"><span class="badge">' + ico(role[2]) + "</span><b>" + esc(role[1]) + "</b></button>";
  }).join("");
  return shell('<header class="hero"><h1>שיעורי בית</h1></header>', '<div class="roles">' + buttons + "</div>" + err());
}
function codeHtml() {
  const role = roleMeta(view.role);
  return shell(bar(role[1], "", "", "החלפת תפקיד"), '<form class="stack"><input class="code-input" name="code" dir="ltr" maxlength="6" autocapitalize="characters" autocomplete="off" aria-label="קוד" required>' + err() + '<button class="primary" type="submit">כניסה</button></form>');
}
function listHtml() {
  const info = place();
  const rows = cards();
  const extra = session.role === "teacher" ? '<button class="text" type="button" data-act="day">היום</button>' : "";
  const body = rows.length ? '<div class="list">' + rows.map(function (row) {
    return '<button class="card" type="button" data-act="open" data-id="' + esc(row.id) + '"><span class="who"><strong>' + esc(row.title) + "</strong><small>" + row.metaHtml + "</small></span></button>";
  }).join("") + "</div>" : '<p class="empty">ריק</p>';
  return shell(bar(info.title, info.sub, extra, "החלפת תפקיד"), body + '<button class="primary add" type="button" data-act="add"><span aria-hidden="true">+</span>הוספה</button>');
}
function formHtml() {
  const title = session.role === "admin" ? "בית ספר" : session.role === "principal" ? "כיתה" : "ילד";
  const fields = session.role === "admin" ? [["a", "בית הספר", "בית הספר"], ["b", "שם המנהל", "שם המנהל"]] : session.role === "principal" ? [["a", "כיתה", "ה'2"], ["b", "שם המורה", "שם המורה"]] : [["a", "שם פרטי", "שם פרטי"]];
  return shell(bar(title), '<form class="stack">' + fields.map(function (field) {
    return '<input name="' + field[0] + '" dir="rtl" maxlength="40" required placeholder="' + field[2] + '" aria-label="' + field[1] + '">';
  }).join("") + err() + '<button class="primary" type="submit">יצירה</button></form>');
}
function shareHtml() {
  const blocks = (view.items || []).map(function (item) {
    return '<div class="block"><span>' + esc(item.label) + (item.hint ? " · " + esc(item.hint) : "") + '</span><p class="big">' + ltr(item.code) + '</p><div class="pair"><button class="primary wa" type="button" data-act="wa" data-role="' + item.role + '" data-code="' + esc(item.code) + '">' + ico(I.chat, true) + "וואטסאפ</button><button class=\"ghost\" type=\"button\" data-act=\"copy\" data-role=\"" + item.role + "\" data-code=\"" + esc(item.code) + "\">העתקה</button></div></div>";
  }).join("");
  return shell(bar("שיתוף"), blocks);
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
  const info = place();
  const rows = S.dayFor(state, session, today());
  return shell(bar(info.title, info.sub, "", "החלפת תפקיד"), '<div class="list">' + dayRows(rows, session.role === "student") + "</div>");
}
function homeworkHtml() {
  const found = S.identify(state, session.code);
  const rows = S.rowsFor(found.room, today(), null);
  const current = rows.find(function (row) { return row.subject === view.subject; }) || rows[0];
  const buttons = rows.map(function (row) {
    return '<button class="row' + (row.subject === current.subject ? " on" : "") + '" type="button" data-act="subject" data-subject="' + esc(row.subject) + '"><span><strong>' + esc(row.subject) + "</strong>" + chip(row) + "</span></button>";
  }).join("");
  return shell(bar("היום", found.room.name), '<form class="stack"><div class="list">' + buttons + '</div><input name="text" dir="rtl" maxlength="80" placeholder="שיעורי בית" aria-label="שיעורי בית" value="' + esc(current && current.text) + '">' + err() + '<div class="pair"><button class="primary" type="submit">שמירה</button><button class="ghost" type="button" data-act="none">אין</button></div></form>');
}
function err() { return view.error ? '<p class="err">' + esc(view.error) + "</p>" : ""; }
function html() {
  if (view.name === "code") return codeHtml();
  if (view.name === "roles" || !session) return rolesHtml();
  if (session.role !== "admin" && !(S.identify(state, session.code) || {}).code) return rolesHtml();
  if (view.name === "form") return formHtml();
  if (view.name === "share") return shareHtml();
  if (view.name === "homework" && session.role === "teacher") return homeworkHtml();
  if (session.role === "student" || session.role === "parent") return dayHtml();
  return listHtml();
}
function leave() {
  session = null;
  localStorage.removeItem(SES);
  view = { name: "roles" };
  render();
}
function message(role, code) {
  const url = location.origin + location.pathname + location.search + "#pack=" + S.encodePack(S.packFor(state, role, code));
  return "קוד \u2066" + code + "\u2069\n\u2066" + url + "\u2069";
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
      view = { name: "main" };
    } else view = { name: "code", role: el.dataset.arg };
    render();
  } else if (act === "back") {
    if (view.name === "form" || view.name === "share" || view.name === "homework") { view = { name: "main" }; render(); }
    else leave();
  } else if (act === "add") { view = { name: "form" }; render(); }
  else if (act === "open") { view = { name: "share", items: shareItems(el.dataset.id) }; render(); }
  else if (act === "day") { view = { name: "homework", subject: S.SUBJECTS[0] }; render(); }
  else if (act === "subject") { view.subject = el.dataset.subject; view.error = ""; render(); }
  else if (act === "none") {
    try { S.setHomework(state, session, { date: today(), subject: view.subject, mode: "none" }); save(); view.error = ""; }
    catch (e) { view.error = "חסר"; }
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
function onSubmit(event) {
  event.preventDefault();
  const data = new FormData(event.target);
  if (view.name === "code") {
    const found = S.identify(state, data.get("code"));
    if (!found || found.role !== view.role) { view.error = "שגוי"; render(); return; }
    session = { role: found.role, code: found.code };
    saveSession();
    view = { name: "main" };
    render();
    return;
  }
  if (view.name === "homework") {
    try { S.setHomework(state, session, { date: today(), subject: view.subject, mode: "post", text: data.get("text") }); save(); view.error = ""; }
    catch (e) { view.error = "חסר"; }
    render();
    return;
  }
  try {
    if (session.role === "admin") {
      const code = S.addPrincipal(state, session, { schoolName: data.get("a"), principalName: data.get("b") }, Math.random);
      save();
      view = { name: "share", items: [{ role: "principal", code, label: "קוד מנהל", hint: String(data.get("b") || "").trim() }] };
    } else if (session.role === "principal") {
      const code = S.addClassroom(state, session, { className: data.get("a"), teacherName: data.get("b") }, Math.random);
      save();
      view = { name: "share", items: [{ role: "teacher", code, label: "קוד מורה", hint: String(data.get("b") || "").trim() }] };
    } else {
      const kid = S.addKid(state, session, { firstName: data.get("a") }, Math.random);
      save();
      const name = String(data.get("a") || "").trim();
      view = { name: "share", items: [
        { role: "student", code: kid.kidCode, label: "קוד תלמיד", hint: name },
        { role: "parent", code: kid.parentCode, label: "קוד הורה", hint: name }
      ] };
    }
  } catch (e) {
    view.error = e.message === "forbidden" ? "אין הרשאה" : "חסר";
  }
  render();
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
