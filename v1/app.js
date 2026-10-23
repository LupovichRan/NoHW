// Nohomework v1 – phone-first Hebrew PWA. Items sync per family code; photos stay in this browser (IndexedDB).
import { extractRules, findSubject, postsFromExport, unzipText, ymd, addDays, weekday, nextSchoolDay, hebDate, DAY_NAMES, SUBJECT_NAMES, TYPE_LABEL } from "./lib/core.js";
import { emptyDoc, mergeDocs, newCode, CODE_RE } from "./lib/merge.js";
import { DEMO_TIMETABLE, demoPosts, DEMO_PASTE } from "./seed/synthetic.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const qs = new URLSearchParams(location.search);
const TODAY = /^\d{4}-\d{2}-\d{2}$/.test(qs.get("today") || "") ? qs.get("today") : ymd(new Date());
const KEY = "nohw.v1";

// ---------- state ----------
let S = JSON.parse(localStorage.getItem(KEY) || "null") || { me: "", code: "", doc: emptyDoc(), posts: [], dayOffset: 0 };
const save = () => localStorage.setItem(KEY, JSON.stringify(S));
const items = () => Object.values(S.doc.items).filter((i) => !i.deleted);
const tt = () => S.doc.meta.timetable || {};
function touchItem(id, patch) { S.doc.items[id] = { ...S.doc.items[id], ...patch, u: Date.now() }; save(); render.last = null; render(); sync(); }
function setMeta(patch) { S.doc.meta = { ...S.doc.meta, ...patch, u: Date.now() }; save(); sync(); }

// ---------- photos (IndexedDB, never uploaded to the family store) ----------
const dbp = new Promise((res, rej) => {
  const r = indexedDB.open("nohw", 1);
  r.onupgradeneeded = () => { r.result.createObjectStore("photos"); r.result.createObjectStore("shares"); };
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});
async function idb(store, mode, fn) {
  const db = await dbp;
  return new Promise((res, rej) => { const tx = db.transaction(store, mode); const r = fn(tx.objectStore(store)); tx.oncomplete = () => res(r?.result); tx.onerror = () => rej(tx.error); });
}
async function shrink(file, max = 1280, q = 0.8) {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = Object.assign(document.createElement("canvas"), { width: Math.round(bmp.width * k), height: Math.round(bmp.height * k) });
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, "image/jpeg", q));
}
const toDataURL = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
const photoURL = {};
async function thumb(id) { if (!photoURL[id]) { const b = await idb("photos", "readonly", (s) => s.get(id)); if (b) photoURL[id] = URL.createObjectURL(b); } return photoURL[id]; }

// ---------- extraction ----------
let provider = null;
fetch("api/extract").then((r) => r.json()).then((j) => { provider = j.provider; }).catch(() => { provider = "offline"; });
async function extract(post, blobs = []) {
  try {
    const images = provider === "gemini" ? await Promise.all(blobs.slice(0, 6).map(async (b) => toDataURL(await shrink(b, 1024, 0.7)))) : [];
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch("api/extract", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ post: { ...post, images }, timetable: tt() }), signal: ctl.signal });
    clearTimeout(t);
    if (!r.ok) throw new Error(r.status);
    return await r.json();
  } catch { return { provider: "rules-local", ...extractRules(post, { timetable: tt() }) }; }
}
async function addPost({ text = "", date = TODAY, sender = "parent", files = [], prevSubject = null, source = "paste", photosCount = 0 }) {
  const blobs = [];
  for (const f of files) if (f.type?.startsWith("image/")) blobs.push(await shrink(f));
  const photoIds = [];
  for (const b of blobs) { const id = "ph_" + uid(); await idb("photos", "readwrite", (s) => s.put(b, id)); photoIds.push(id); }
  const post = { id: "p_" + uid(), date, text: text.trim(), photos: photoIds.length || photosCount, sender, prevSubject };
  const r = await extract(post, blobs);
  const added = [];
  const sig = (i) => `${i.type}|${i.due}|${i.text}`;
  const existing = new Set(items().map(sig));
  for (const it of r.items || []) {
    if (existing.has(sig(it))) continue;
    const id = "i_" + uid();
    S.doc.items[id] = { id, ...it, postId: post.id, postDate: date, photoIds: it.type === "homework" || it.needsConfirm ? photoIds : [], createdAt: Date.now(), u: Date.now(), done: null };
    added.push(S.doc.items[id]);
  }
  S.posts.unshift({ id: post.id, date, text: post.text.slice(0, 400), photoIds, provider: r.provider, kind: r.kind, n: added.length, source, at: Date.now() });
  S.posts = S.posts.slice(0, 200);
  save();
  return { added, kind: r.kind, provider: r.provider };
}

// ---------- family sync ----------
let syncing = false, again = false, lastSync = 0, syncErr = false;
async function sync() {
  if (!S.code) return;
  if (syncing) { again = true; return; }
  syncing = true; again = false;
  try {
    const r = await fetch("api/family", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: S.code, doc: S.doc }) });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    S.doc = mergeDocs(S.doc, j.doc); lastSync = Date.now(); syncErr = false; save();
  } catch { syncErr = true; }
  syncing = false; render();
  if (again) sync();
}
setInterval(sync, 8000);
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && sync());

// ---------- UI helpers ----------
function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.add("on"); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("on"), 2600); }
const relDay = (d) => d === TODAY ? "היום" : d === addDays(TODAY, 1) ? "מחר" : hebDate(d);
function card(i, { showDue = true } = {}) {
  const done = i.done ? `<span class="by">✓ ${esc(i.done.by)} · ${new Date(i.done.at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</span>` : "";
  const label = i.type === "action" ? (i.done ? "טופל" : "לטיפול") : "בוצע";
  return `<div class="card ${i.type}${i.done ? " done" : ""}" data-id="${i.id}">
    <input type="checkbox" ${i.done ? "checked" : ""} aria-label="${label}" data-act="done">
    <div class="body"><div class="txt">${esc(i.text)}</div>
      <div class="meta">${i.subject ? `<span class="tag">${esc(i.subject)}</span>` : ""}${showDue && i.due ? `<span>📅 ${esc(relDay(i.due))}</span>` : ""}${i.photoIds?.length ? `<span data-act="photo" role="button">📷 ${i.photoIds.length}</span>` : ""}${done}</div>
    </div></div>`;
}
function confirmCard(i) {
  return `<div class="card confirm" data-id="${i.id}"><div class="body">
    <div class="q">❓ ${esc(i.question || "לאשר?")}</div><div class="txt">${esc(i.text)}</div>
    <div class="meta"><span class="tag">${esc(TYPE_LABEL[i.type])}</span>${i.subject ? `<span class="tag">${esc(i.subject)}</span>` : ""}${i.due ? `<span>📅 ${esc(relDay(i.due))}</span>` : ""}${i.photoIds?.length ? `<span data-act="photo" role="button">📷 ${i.photoIds.length}</span>` : ""}</div>
    <div class="row">
      <select data-f="type" aria-label="סוג">${["homework", "bring", "notice", "action", "change"].map((t) => `<option value="${t}" ${t === i.type ? "selected" : ""}>${TYPE_LABEL[t]}</option>`).join("")}</select>
      <select data-f="subject" aria-label="מקצוע"><option value="">מקצוע…</option>${SUBJECT_NAMES.map((s) => `<option ${s === i.subject ? "selected" : ""}>${s}</option>`).join("")}</select>
      <input type="date" data-f="due" value="${i.due || ""}" aria-label="תאריך">
    </div>
    <div class="row"><button class="btn pri" data-act="confirm">✓ אישור</button><button class="btn" data-act="dismiss">לא רלוונטי</button></div>
  </div></div>`;
}
const section = (title, list, html = list.map((i) => card(i)).join(""), emptyText = "אין") =>
  `<h2>${title} <span class="n">${list.filter((i) => !i.done).length}</span></h2>${html || `<div class="empty">${emptyText}</div>`}`;
const byDone = (a, b) => (!!a.done - !!b.done) || ((a.due || "9") < (b.due || "9") ? -1 : 1);

function lessonsFor(day) {
  const ov = items().filter((i) => i.type === "timetable" && i.due === day).sort((a, b) => b.createdAt - a.createdAt)[0];
  return { lessons: ov?.extra?.lessons?.length ? ov.extra.lessons : tt()[weekday(day)] || [], fromPost: !!ov };
}
function timetableBlock(day) {
  const { lessons, fromPost } = lessonsFor(day);
  const changes = items().filter((i) => i.type === "change" && (i.due === day || (!i.due && i.postDate >= addDays(TODAY, -1))));
  return `<h2>מערכת ל${esc(relDay(day))}</h2><div class="card timetable"><div class="body">
    ${lessons.length ? `<div class="lessons">${lessons.map((l) => `<span>${esc(l)}</span>`).join("")}</div>` : `<div class="empty">אין מערכת. <a href="#settings">להגדרת מערכת קבועה</a></div>`}
    <div class="src">${fromPost ? "לפי הודעת המורה" : "לפי המערכת הקבועה"}</div></div></div>
    ${changes.map((c) => card(c)).join("")}`;
}
function joinPanel() {
  if (S.me) return "";
  return `<div class="panel"><b>${S.code ? "הצטרפת למשפחה 👋" : "שלום!"}</b><label class="lab" for="meName">איך לקרוא לך? (יופיע ליד מה שסימנת)</label>
    <input id="meName" type="text" placeholder="למשל: אמא, אבא, סבתא"><div class="row"><button class="btn pri" data-act="setMe">שמירה</button></div></div>`;
}

// ---------- views ----------
const views = {
  tonight() {
    const T = addDays(nextSchoolDay(TODAY, tt()), 0), day = S.dayOffset ? addDays(T, S.dayOffset) : T;
    const all = items(), ok = all.filter((i) => !i.needsConfirm);
    const bring = ok.filter((i) => i.type === "bring" && (i.due === day || (!i.due && i.postDate >= addDays(TODAY, -1)))).sort(byDone);
    const hw = ok.filter((i) => i.type === "homework" && (!i.due || i.due >= TODAY) && (!i.done || i.done.at > Date.now() - 864e5)).sort(byDone);
    const notices = ok.filter((i) => i.type === "notice" && ((i.due && i.due >= TODAY) || (!i.due && i.postDate >= addDays(TODAY, -2)))).sort(byDone);
    const actions = ok.filter((i) => i.type === "action" && (!i.done || i.done.at > Date.now() - 2 * 864e5)).sort(byDone);
    const conf = all.filter((i) => i.needsConfirm);
    return `${joinPanel()}<div class="daybar"><button data-act="day" data-d="-1" aria-label="יום קודם">‹</button><div><small>הערב מתכוננים ל</small><br><b>${esc(hebDate(day))}</b></div><button data-act="day" data-d="1" aria-label="יום הבא">›</button></div>
      ${section("🎒 מה להביא", bring, undefined, "אין ציוד מיוחד")}
      ${timetableBlock(day)}
      ${section("📚 שיעורי בית", hw, hw.map((i) => card(i)).join(""), "אין שיעורי בית פתוחים")}
      ${section("📣 הודעות", notices, undefined, "אין הודעות חדשות")}
      ${section("✍️ לטיפול הורה", actions, undefined, "אין")}
      ${section("❓ צריך אישור", conf, conf.map(confirmCard).join(""), "הכול ברור")}`;
  },
  morning() {
    const all = items().filter((i) => !i.needsConfirm);
    const bring = all.filter((i) => i.type === "bring" && (i.due === TODAY || (!i.due && i.postDate >= addDays(TODAY, -1)))).sort(byDone);
    const dueToday = all.filter((i) => ["homework", "action"].includes(i.type) && i.due === TODAY).sort(byDone);
    return `<div class="daybar"><div><small>בוקר טוב! היום</small><br><b>${esc(hebDate(TODAY))}</b></div><span style="font-size:28px">☀️</span></div>
      <div class="big-list">${section("🎒 להכניס לתיק", bring, undefined, "אין ציוד מיוחד היום")}</div>
      ${timetableBlock(TODAY)}${dueToday.length ? section("⏰ להגשה היום", dueToday) : ""}`;
  },
  add() {
    const posts = S.posts.slice(0, 8);
    return `<div class="panel"><b>הדבקת הודעה מהקבוצה</b><label class="lab" for="pasteText">טקסט (אפשר להעביר מוואטסאפ: שיתוף ← Nohomework)</label>
      <textarea id="pasteText" placeholder="הדביקו כאן הודעה מהמורה או מהילדים"></textarea>
      <label class="lab" for="photoIn">תמונות (נשמרות רק במכשיר הזה)</label><input id="photoIn" type="file" accept="image/*" multiple>
      <div class="thumbs" id="pendingThumbs"></div>
      <div class="row"><label class="lab" for="postDate" style="margin:6px 0">תאריך ההודעה</label><input id="postDate" type="date" value="${TODAY}" style="max-width:180px">
      <select id="sender" aria-label="מי שלח" style="max-width:150px"><option value="teacher">המורה</option><option value="student">ילד/ה</option><option value="parent">הורה</option></select></div>
      <div class="row"><button class="btn pri big" data-act="extract">חילוץ משימות</button></div>
      <div class="row"><button class="btn" data-act="demoPaste">הדבקת דוגמה</button></div>
      <div id="extractOut">${lastExtractHTML()}</div></div>
      <div class="panel"><b>ייבוא צ'אט וואטסאפ</b><div class="note">בוואטסאפ: הקבוצה ← עוד ← ייצוא צ'אט. קובץ ‎.zip או ‎.txt. הקובץ נקרא רק כאן במכשיר.</div>
      <label class="lab" for="since">מתאריך</label><input id="since" type="date" value="${addDays(TODAY, -14)}">
      <label class="lab" for="chatIn">קובץ</label><input id="chatIn" type="file" accept=".zip,.txt,text/plain,application/zip">
      <div id="importOut" class="note"></div></div>
      <h2>הודעות אחרונות</h2>${posts.map((p) => `<div class="card notice"><div class="body"><div class="txt">${esc(p.text.slice(0, 140) || "(תמונות בלי כיתוב)")}</div>
        <div class="meta"><span>${esc(hebDate(p.date))}</span><span>${p.kind === "lesson_notes" ? "סיכום שיעור – לא נוסף" : p.kind === "social" ? "ברכה – לא נוסף" : `${p.n} פריטים`}</span>${p.photoIds.length ? `<span>📷 ${p.photoIds.length}</span>` : ""}<span class="tag">${esc(p.provider)}</span></div>
        <div class="thumbs" data-thumbs="${p.photoIds.join(",")}"></div></div></div>`).join("") || `<div class="empty">עוד לא נוספו הודעות</div>`}`;
  },
  settings() {
    const t = tt();
    const link = S.code ? `${location.origin}${location.pathname}?family=${S.code}` : "";
    return `<div class="panel"><b>פרטים</b><label class="lab" for="child">שם הילד/ה</label><input id="child" type="text" value="${esc(S.doc.meta.child || "")}" placeholder="למשל: יעל, ד'2">
      <label class="lab" for="meName2">השם שלי</label><input id="meName2" type="text" value="${esc(S.me)}" placeholder="אמא / אבא">
      <div class="row"><button class="btn pri" data-act="saveProfile">שמירה</button></div></div>
      <div class="panel"><b>מערכת שעות קבועה</b><div class="note">מקצועות מופרדים בפסיק. משמשת לתאריכים כמו "לשיעור הבא".</div>
      <table class="tt">${[0, 1, 2, 3, 4, 5].map((d) => `<tr><th>${DAY_NAMES[d]}</th><td><input type="text" data-day="${d}" value="${esc((t[d] || []).join(", "))}"></td></tr>`).join("")}</table>
      <div class="row"><button class="btn pri" data-act="saveTT">שמירת מערכת</button><button class="btn" data-act="demoTT">מערכת לדוגמה</button></div></div>
      <div class="panel"><b>שיתוף עם הורה נוסף</b>
      ${S.code ? `<div class="note">קוד המשפחה (כל מי שיש לו את הקוד רואה ומסמן משימות):</div><div class="code" id="famCode">${S.code}</div>
        <div class="row"><button class="btn pri" data-act="copyLink" data-link="${esc(link)}">העתקת קישור משפחה</button><span class="note">${syncErr ? "⚠️ אין חיבור לסנכרון" : lastSync ? "מסונכרן ✓" : ""}</span></div>`
        : `<div class="row"><button class="btn pri" data-act="newFamily">יצירת קוד משפחה</button></div>
        <label class="lab" for="joinCode">או הצטרפות עם קוד</label><div class="row"><input id="joinCode" type="text" maxlength="8" style="max-width:200px;text-transform:uppercase" placeholder="ABCD2345"><button class="btn" data-act="join">הצטרפות</button></div>`}
      </div>
      <div class="panel"><b>דמו</b><div class="note">מנוע חילוץ: ${esc(provider === "gemini" ? "Gemini (בשרת)" : provider === "rules" ? "כללים מובנים (אין מפתח AI בשרת)" : "כללים מקומיים (לא מחובר לשרת)")}</div>
      <div class="row"><button class="btn" data-act="seed">טעינת נתוני דוגמה</button><button class="btn" data-act="reset">איפוס במכשיר</button></div>
      <div class="note">פרטיות: תמונות נשמרות רק בדפדפן הזה. לסנכרון עולים רק טקסט המשימות והסימונים.</div></div>`;
  },
};

let pendingFiles = [], lastExtract = null;
function lastExtractHTML() {
  if (!lastExtract) return "";
  const list = lastExtract.ids.map((id) => S.doc.items[id]).filter((i) => i && !i.deleted);
  return `<h2>נוספו ${lastExtract.ids.length}</h2>` + (list.map((i) => i.needsConfirm ? confirmCard(i) : card(i)).join("") || `<div class="empty">${lastExtract.kind === "lesson_notes" ? "נראה כמו סיכום שיעור – לא נוסף" : lastExtract.kind === "social" ? "ברכה – אין משימות" : "לא נמצאו משימות"}</div>`);
}
function tab() { const h = location.hash.slice(1); return views[h] ? h : "tonight"; }
function render() {
  const t = tab();
  const ae = document.activeElement;
  if (render.last === t && ae?.closest?.("#view") && (ae.tagName === "TEXTAREA" || ae.tagName === "SELECT" || (ae.tagName === "INPUT" && !["checkbox", "button", "file"].includes(ae.type)))) return; // don't clobber typing
  render.last = t;
  $("#view").innerHTML = views[t]();
  document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("on", a.dataset.tab === t));
  $("#subtitle").textContent = S.doc.meta.child ? `${S.doc.meta.child}` : "סדר מהקבוצות של הכיתה";
  $("#who").textContent = S.me ? `${S.me}${S.code ? " · 👪" : ""}` : "מי אני?";
  document.querySelectorAll("[data-thumbs]").forEach(async (el) => {
    const ids = el.dataset.thumbs.split(",").filter(Boolean);
    el.innerHTML = (await Promise.all(ids.map(thumb))).filter(Boolean).map((u) => `<img src="${u}" alt="תמונה מהקבוצה">`).join("");
  });
}
window.addEventListener("hashchange", () => { render.last = null; render(); window.scrollTo(0, 0); });
$("#who").addEventListener("click", () => { location.hash = "settings"; });

// ---------- events ----------
document.addEventListener("change", async (e) => {
  const el = e.target;
  if (el.dataset.act === "done") {
    const id = el.closest("[data-id]").dataset.id;
    touchItem(id, { done: el.checked ? { by: S.me || "הורה", at: Date.now() } : null });
    if (el.checked) toast("סומן ✓");
  } else if (el.id === "photoIn") {
    pendingFiles = [...el.files];
    $("#pendingThumbs").innerHTML = pendingFiles.map((f) => `<img src="${URL.createObjectURL(f)}" alt="">`).join("");
  } else if (el.id === "chatIn" && el.files[0]) {
    const f = el.files[0], out = $("#importOut");
    out.textContent = "קורא…";
    try {
      const txt = /\.zip$/i.test(f.name) || f.type.includes("zip") ? await unzipText(await f.arrayBuffer()) : await f.text();
      const posts = postsFromExport(txt, $("#since").value);
      let n = 0, lesson = 0;
      for (const p of posts) { const r = await addPost({ text: p.text, date: p.date, sender: p.sender, prevSubject: p.prevSubject, source: "import", files: [], photosCount: p.photos }); n += r.added.length; if (r.kind === "lesson_notes") lesson++; }
      out.textContent = `${posts.length} הודעות ← ${n} פריטים. ${lesson} סיכומי שיעור דולגו.`;
      sync();
    } catch (err) { out.textContent = "לא הצלחתי לקרוא את הקובץ: " + err.message; }
  }
});
document.addEventListener("click", async (e) => {
  const b = e.target.closest("[data-act]");
  if (!b || b.tagName === "INPUT") return;
  const id = b.closest("[data-id]")?.dataset.id;
  const act = b.dataset.act;
  if (act === "day") { S.dayOffset = (S.dayOffset || 0) + +b.dataset.d; save(); render(); }
  else if (act === "confirm") {
    const c = b.closest(".card");
    const patch = { needsConfirm: false, question: null, type: $("[data-f=type]", c).value, subject: $("[data-f=subject]", c).value || null, due: $("[data-f=due]", c).value || null };
    touchItem(id, patch); toast("אושר");
  } else if (act === "dismiss") { touchItem(id, { deleted: true }); toast("הוסר"); }
  else if (act === "photo") {
    const it = S.doc.items[id]; const u = it?.photoIds?.[0] && await thumb(it.photoIds[0]);
    if (u) window.open(u, "_blank"); else toast("התמונה שמורה רק במכשיר ששלח אותה");
  } else if (act === "extract") {
    const text = $("#pasteText").value;
    if (!text.trim() && !pendingFiles.length) return toast("אין מה לחלץ");
    b.disabled = true; b.textContent = "מחלץ…";
    const r = await addPost({ text, date: $("#postDate").value || TODAY, sender: $("#sender").value, files: pendingFiles });
    pendingFiles = [];
    lastExtract = { ids: r.added.map((i) => i.id), kind: r.kind };
    render.last = null; render();
    sync();
  } else if (act === "demoPaste") { $("#pasteText").value = DEMO_PASTE; }
  else if (act === "setMe") { const v = $("#meName").value.trim(); if (v) { S.me = v; save(); render.last = null; render(); } }
  else if (act === "saveProfile") { S.me = $("#meName2").value.trim(); setMeta({ child: $("#child").value.trim() }); toast("נשמר"); render.last = null; render(); }
  else if (act === "saveTT" || act === "demoTT") {
    const t = act === "demoTT" ? DEMO_TIMETABLE : Object.fromEntries([...document.querySelectorAll("[data-day]")].map((i) => [i.dataset.day, i.value.split(/[,،]/).map((x) => x.trim()).filter(Boolean)]));
    setMeta({ timetable: t }); toast("המערכת נשמרה"); render.last = null; render();
  } else if (act === "newFamily") { S.code = newCode(); save(); await sync(); render.last = null; render(); }
  else if (act === "join") { const c = $("#joinCode").value.trim().toUpperCase(); if (!CODE_RE.test(c)) return toast("קוד לא תקין"); S.code = c; save(); await sync(); render.last = null; render(); toast("הצטרפת"); }
  else if (act === "copyLink") { try { await navigator.clipboard.writeText(b.dataset.link); toast("הקישור הועתק"); } catch { prompt("קישור משפחה:", b.dataset.link); } }
  else if (act === "seed") { await loadSeed(); location.hash = "tonight"; }
  else if (act === "reset") { if (confirm("למחוק את כל הנתונים במכשיר הזה?")) { localStorage.removeItem(KEY); indexedDB.deleteDatabase("nohw"); location.href = location.pathname; } }
});

async function loadSeed() {
  setMeta({ timetable: DEMO_TIMETABLE, child: S.doc.meta.child || "יעל · ד'2" });
  const posts = demoPosts(TODAY);
  let prev = null;
  for (const p of posts) {
    const files = [];
    for (const u of p.photoSeed || []) files.push(new File([await (await fetch(u)).blob()], u.split("/").pop(), { type: "image/jpeg" }));
    await addPost({ text: p.text, date: p.date, sender: p.sender, files, prevSubject: p.sender === "student" ? prev : null, source: "demo" });
    prev = p.sender === "student" ? findSubject(p.text) || prev : null;
  }
  render.last = null; render(); sync(); toast("נטענו הודעות דוגמה");
}

// ---------- boot: family link, share target ----------
async function boot() {
  const fam = (qs.get("family") || "").toUpperCase();
  if (CODE_RE.test(fam) && fam !== S.code) { S.code = fam; S.doc = emptyDoc(); save(); }
  if (qs.has("family")) history.replaceState(null, "", location.pathname + (qs.get("today") ? `?today=${qs.get("today")}` : "") + location.hash);
  render();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  await sync();
  const share = await idb("shares", "readonly", (s) => s.get("pending")).catch(() => null);
  if (share || qs.get("text")) {
    await idb("shares", "readwrite", (s) => s.delete("pending")).catch(() => {});
    const text = [share?.title, share?.text ?? qs.get("text"), share?.url].filter(Boolean).join("\n");
    const files = share?.files || [];
    const chat = files.find((f) => /\.(zip|txt)$/i.test(f.name || "") || /zip|text\/plain/.test(f.type));
    location.hash = "add"; render.last = null; render();
    if (chat) { const dt = new DataTransfer(); dt.items.add(chat); const inp = $("#chatIn"); inp.files = dt.files; inp.dispatchEvent(new Event("change", { bubbles: true })); return; }
    $("#pasteText").value = text;
    pendingFiles = files.filter((f) => f.type?.startsWith("image/"));
    $("#pendingThumbs").innerHTML = pendingFiles.map((f) => `<img src="${URL.createObjectURL(f)}" alt="">`).join("");
    toast("התקבל שיתוף מוואטסאפ");
    $("[data-act=extract]").click();
  }
}
boot();
