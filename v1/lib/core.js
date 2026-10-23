// Nohomework v1 core: dates, Hebrew rule extractor, photo bursts, WhatsApp export parser.
// Pure ES module with no dependencies. Runs in the browser and in Node (tests, /api).

export const TYPES = ["bring", "timetable", "homework", "notice", "change", "action"];
export const TYPE_LABEL = {
  bring: "מה להביא", timetable: "מערכת שעות", homework: "שיעורי בית",
  notice: "הודעה", change: "שינוי", action: "לטיפול הורה",
};
export const DAY_NAMES = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const SCHOOL_DAYS = [0, 1, 2, 3, 4, 5]; // Sun..Fri

// ---------- dates (all local "YYYY-MM-DD" strings; no time zones) ----------
export function ymd(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function parseYmd(s) { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12); }
export function addDays(s, n) { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); }
export function weekday(s) { return parseYmd(s).getDay(); }
export function nextSchoolDay(s, timetable) {
  for (let i = 1; i <= 8; i++) {
    const c = addDays(s, i);
    const wd = weekday(c);
    if (!SCHOOL_DAYS.includes(wd)) continue;
    if (timetable && Object.keys(timetable).length && !(timetable[wd] || []).length) continue;
    return c;
  }
  return addDays(s, 1);
}
export function nextWeekday(s, wd) { // strictly after s
  for (let i = 1; i <= 7; i++) { const c = addDays(s, i); if (weekday(c) === wd) return c; }
  return addDays(s, 7);
}
export function nextLesson(s, subject, timetable) {
  if (!subject || !timetable) return null;
  for (let i = 1; i <= 14; i++) {
    const c = addDays(s, i);
    if ((timetable[weekday(c)] || []).some((x) => sameSubject(x, subject))) return c;
  }
  return null;
}
export function hebDate(s) {
  if (!s) return "";
  const d = parseYmd(s);
  return `יום ${DAY_NAMES[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`;
}

// ---------- subjects ----------
const SUBJECTS = [
  ["חשבון", /חשבון|מתמטיקה|מטמטיקה/],
  ["הנדסה", /הנדסה|גיאומטריה|גאומטריה/],
  ["שפה", /(^|[\s\-–:,.(])(ב|ל|ו)?שפה(?![\u0590-\u05FF])/],
  ["לשון", /(^|[\s\-–:,.(])(ב|ל|ו)?לשון(?![\u0590-\u05FF])/],
  ["אנגלית", /אנגלית|english/i],
  ["מדעים", /מדעים|מדע(?![\u0590-\u05FF])/],
  ["תורה", /תורה|תנ"?ך|תנך/],
  ["מורשת", /מורשת/],
  ["עת הדעת", /עת הדעת/],
  ["חינוך גופני", /חינוך גופני|ספורט|חנ"?ג/],
  ["אומנות", /אומנות|אמנות/],
  ["מולדת", /מולדת/],
  ["קריאה דיאלוגית", /קריאה דיאלוגית/],
  ["חינוך", /חינוך לחיים|כישורי חיים|(^|\s)חינוך(?![\u0590-\u05FF])(?! גופני)/],
  ["מוזיקה", /מוזיקה|מוסיקה/],
];
export const SUBJECT_NAMES = SUBJECTS.map(([n]) => n);
export function findSubject(text) {
  for (const [name, re] of SUBJECTS) if (re.test(text)) return name;
  return null;
}
export function sameSubject(a, b) { return findSubject(a || "") === findSubject(b || "") && !!findSubject(a || ""); }

// ---------- date expressions ----------
const WD = { "ראשון": 0, "שני": 1, "שלישי": 2, "רביעי": 3, "חמישי": 4, "שישי": 5, "א": 0, "ב": 1, "ג": 2, "ד": 3, "ה": 4, "ו": 5 };
// Returns {hint, date} where hint is "explicit" | "tomorrow" | "today" | "weekday" | "next_lesson" | null
export function dateHints(text) {
  const out = [];
  const t = text.replace(/[\u200e\u200f\u2068\u2069*]/g, "");
  const ex = t.matchAll(/(?<![\d.])(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?(?![\d])/g);
  for (const m of ex) {
    const d = +m[1], mo = +m[2];
    if (d < 1 || d > 31 || mo < 1 || mo > 12) continue;
    // skip page ranges like "30-31" (dash) and times "17:00" (colon) — regex only takes . and /
    out.push({ hint: "explicit", day: d, month: mo, year: m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : null });
  }
  if (/(^|[^\u0590-\u05FF])(ל|עד |ל־)?מחר(?![\u0590-\u05FF])/.test(t)) out.push({ hint: "tomorrow" });
  if (/(^|[^\u0590-\u05FF])(ה)?היום(?![\u0590-\u05FF])/.test(t) && !/היום שוחחנו|היום בשיעור|היום עבדנו/.test(t)) out.push({ hint: "today" });
  const w = t.match(/(?:ל?יום|ביום|ליום)\s+(ראשון|שני|שלישי|רביעי|חמישי|שישי|[א-ו]['׳])/);
  if (w) out.push({ hint: "weekday", wd: WD[w[1].replace(/['׳]/, "")] });
  if (/(ל|ב|עד ה|עד ל)?שיעור ה?בא/.test(t)) out.push({ hint: "next_lesson" });
  return out;
}
export function resolveHint(h, postDate, subject, timetable) {
  if (!h) return null;
  if (h.hint === "explicit") {
    let y = h.year || +postDate.slice(0, 4);
    let c = `${y}-${String(h.month).padStart(2, "0")}-${String(h.day).padStart(2, "0")}`;
    if (!h.year && c < addDays(postDate, -60)) c = `${y + 1}${c.slice(4)}`;
    return c;
  }
  if (h.hint === "tomorrow") return nextSchoolDay(postDate, timetable);
  if (h.hint === "today") return postDate;
  if (h.hint === "weekday") return nextWeekday(postDate, h.wd);
  if (h.hint === "next_lesson") return nextLesson(postDate, subject, timetable);
  if (typeof h.date === "string") return h.date;
  return null;
}

// ---------- rule-based extractor ----------
const RE = {
  greeting: /^(שלום|היי|בוקר טוב|ערב טוב|תודה|סבבה|👍|מוסיפה|המשך|אמשך)[\s!.,🙏🏻💓🌸]*$/,
  social: /מזל טוב|רפואה שלמה|שנה טובה|שבת שלום|תודה רבה על|ברוכים הבאים|ברוכה הבאה|גאווה|מרגש|חופשה נעימה/,
  timetable: /מערכת (ה)?שעות (ל|ליום|למחר)|מערכת ליום|מערכת למחר/,
  bring: /להביא|להצטייד|לא לשכוח|יש לבוא (עם|ב)|לבוא בחולצ|נגיע ב|נא לבוא ב|רשימת ציוד|צריך (מחברת|שתי|ציוד|סרגל|חולצה|ספר|קלמר)|חולצה לבנה|חולצת ביה"?ס|יש לרכוש|לרכוש עבור/,
  homework: /שיעורי בית|ש"ב|לסיים|להשלים|לעשות|להכין|להגיש|משימה|משימת|עמוד|עמ['׳]|אמוד|תרגיל|סעיף|לסים|מי שלא (עשה|סיים|סיימה)/,
  classwork: /^(עבדנו|היום עבדנו|בשיעור עבדנו|עבודה בספר|בשיעורי .* האחרונים עבדנו|תרגלנו|היום בשיעור תרגלנו)/,
  change: /עדכון חשוב|עדכון לו"ז|לעדכון לו"ז|שינוי|במקום|הוקדם|נדחה|בוטל|יבוטל|תתקיים בשעה|תתקיים \*?בשעה|השעות בהן/,
  action: /טופס|לחתום|חתום|אישור(ים)? (הורים|יציאה)?|לשלם|תשלום|הצהרת (ה)?בריאות|פורטל הורים|מלגת|להחזיר|למלא|לטיפולכם/,
  notice: /יתקיים|תתקיים|טקס|אסיפ|מבחן|מיפוי|מכירת|טיול|לידיעתכם|מצ"ב|הודעה|בחירות|מועצת|יום הולדת|חוג/,
  lessonOnly: /^(שיעור )?([\u0590-\u05FF"' ]{2,18})$/,
};
const NOISE_LINE = /^[\s\-–•*💫⭐️🌸💖💓🙏🏻🏼✨🩵💙🤍😊😍🤩💐]*$/;

function segments(text) {
  const lines = text.split(/\n+/).map((l) => l.replace(/^[\s\-–•*💫⭐️]+|^\d+[).]\s*/g, "").trim()).filter((l) => l && !NOISE_LINE.test(l));
  return lines;
}
function clean(s) { return s.replace(/[*_~]/g, "").replace(/\s+/g, " ").trim(); }
function tidy(s) { return clean(s).replace(/^(היי|שלום לכולם|שלום|הורים יקרים)[,!]?\s*/, "").slice(0, 160); }

function mkItem(type, o) {
  return { type, subject: o.subject || null, text: tidy(o.text || ""), due: o.due || null, needsConfirm: !!o.question, question: o.question || null, confidence: o.question ? 0.4 : (o.confidence ?? 0.8), extra: o.extra || null };
}

/**
 * Extract items from one post.
 * post: { text, date: "YYYY-MM-DD", photos: number, prevSubject?: string, sender?: "teacher"|"student"|"parent" }
 * ctx:  { timetable: {0:[...],...} }
 * returns { items: [...], dropped: [{reason}], kind: "items"|"lesson_notes"|"social"|"empty" }
 */
export function extractRules(post, ctx = {}) {
  const tt = ctx.timetable || {};
  const text = (post.text || "").replace(/[\u200e\u200f\u2068\u2069]/g, "").replace(/<המדיה לא נכללה>|\S+\.(jpg|jpeg|png|webp|pdf|docx) \(קובץ מצורף\)/g, "").trim();
  const photos = post.photos || 0;
  const items = [], dropped = [];
  if (!text && !photos) return { items, dropped, kind: "empty" };
  if (!text && photos) {
    items.push(mkItem("homework", { text: photos > 1 ? `${photos} תמונות בלי כיתוב` : "תמונה בלי כיתוב", subject: post.prevSubject, question: "תמונה בלי כיתוב: האם אלה שיעורי בית או סיכום שיעור?" }));
    return { items, dropped, kind: "items" };
  }
  if (RE.greeting.test(clean(text)) || (RE.social.test(text) && !RE.bring.test(text) && !RE.action.test(text))) {
    return { items, dropped, kind: "social" };
  }
  const allHints = dateHints(text);
  const postSubject = findSubject(text);
  // Lesson-notes photo: caption is just a subject name ("שיעור חשבון", "אנגלית")
  if (photos && RE.lessonOnly.test(clean(text)) && postSubject && !RE.homework.test(text) && !RE.bring.test(text)) {
    dropped.push({ reason: "lesson_notes", subject: postSubject, photos });
    return { items, dropped, kind: "lesson_notes" };
  }

  // Timetable post: "מערכת שעות למחר/ליום X" + lines "subject - gear"
  if (RE.timetable.test(text)) {
    const h = allHints.find((x) => x.hint !== "explicit") || allHints[0] || { hint: "tomorrow" };
    const due = resolveHint(h, post.date, null, tt);
    const lessons = [], gear = [];
    for (const seg of segments(text)) {
      const m = seg.match(/^([^\-–:]{2,30})\s*[-–:]\s*(.+)$/);
      const subj = m && !/עבדנו|מי שלא|עמוד/.test(seg) ? findSubject(m[1]) : null;
      if (subj) { lessons.push(subj); gear.push(`${subj}: ${clean(m[2])}`); }
      else if (RE.bring.test(seg) && !RE.timetable.test(seg)) gear.push(clean(seg.replace(/^מזכירה\s*/, "")));
    }
    items.push(mkItem("timetable", { text: lessons.join(" · ") || "מערכת שעות", due, extra: { lessons }, confidence: 0.85 }));
    for (const g of gear) items.push(mkItem("bring", { text: g, due, subject: findSubject(g), confidence: 0.85 }));
    // homework-ish remainder ("מי שלא סיים ... להשלים")
    const hw = segments(text).find((s) => /מי שלא סיים|להשלים|לסיים/.test(s));
    if (hw) items.push(mkItem("homework", { text: hw, subject: findSubject(hw) || postSubject, due }));
    return { items, dropped, kind: "items" };
  }

  // Multi-point teacher posts: classify each segment. Short posts: whole text is one segment.
  const segs = text.length > 140 || /\n\s*(\d+[).]|-|💫)/.test(text) || segments(text).filter((l) => l.length > 12).length > 1 ? segments(text) : [clean(text)];
  let lastSubject = postSubject || post.prevSubject || null;
  const postIsForm = /טופס|מלגת|הצהרת/.test(text);
  for (const seg of segs) {
    const s = clean(seg);
    if (!s || RE.greeting.test(s) || RE.social.test(s)) continue;
    const subj = findSubject(s);
    if (subj) lastSubject = subj;
    let hints = dateHints(s);
    if (!hints.length && !RE.homework.test(s)) hints = allHints.filter((x) => x.hint !== "next_lesson").slice(0, 1); // inherit the post's date
    const h = hints[0] || null;
    const type =
      RE.classwork.test(s) && !/מי שלא סיים|להשלים/.test(s) ? "classwork" :
      RE.action.test(s) ? "action" :
      RE.bring.test(s) ? "bring" :
      RE.change.test(s) ? "change" :
      RE.homework.test(s) && (/\d/.test(s) || /משימה|משימת|להגיש|להשלים|לסיים|מי שלא/.test(s)) && !(postIsForm && !subj) ? "homework" :
      RE.notice.test(s) ? "notice" : null;
    if (type === "classwork") { dropped.push({ reason: "classwork" }); continue; }
    if (!type) continue;
    let due = null, question = null;
    const subjectForDue = subj || (type === "homework" ? lastSubject : null);
    // explicit vs relative conflict
    const exp = hints.find((x) => x.hint === "explicit"), rel = hints.find((x) => x.hint !== "explicit");
    if (exp && rel) {
      const a = resolveHint(exp, post.date, subjectForDue, tt), b = resolveHint(rel, post.date, subjectForDue, tt);
      due = a;
      if (a && b && a !== b) question = `כתוב "${rel.hint === "tomorrow" ? "מחר" : "יום " + DAY_NAMES[rel.wd ?? 0]}" אבל גם ${hebDate(a)}. מה נכון?`;
    } else if (h) {
      due = resolveHint(h, post.date, subjectForDue, tt);
      if (!due && h.hint === "next_lesson") question = subjectForDue ? `מתי השיעור הבא ב${subjectForDue}? (חסר במערכת)` : "לאיזה מקצוע \"השיעור הבא\"?";
    }
    if (type === "homework") {
      if (!subjectForDue) question = question || "באיזה מקצוע שיעורי הבית?";
      else if (!due) {
        due = nextLesson(post.date, subjectForDue, tt);
        if (!due) question = question || `עד מתי? (${subjectForDue} לא מופיע במערכת)`;
      }
      if (/רשות/.test(s)) question = null;
    }
    if (type === "bring" && !due) {
      if (/רשימת ציוד|קבוע|לאורך השנה/.test(s)) due = null;
      else if (post.sender === "student" || /צריך/.test(s)) { due = nextLesson(post.date, subj, tt) || nextSchoolDay(post.date, tt); }
      else due = nextSchoolDay(post.date, tt);
    }
    if (type === "bring" && /\d+ מחברות|שתי מחברות|מחברות/.test(s) && !/14 שורות|שורה|משבצות|ספירלה|חשבון/.test(s)) question = question || "איזה סוג מחברות?";
    if (type === "change" && /\d{1,2}:\d{2}/.test(s)) {
      const times = s.match(/\d{1,2}:\d{2}/g);
      items.push(mkItem("change", { text: s, due: due || post.date, extra: { times }, question }));
      continue;
    }
    items.push(mkItem(type, { text: s, subject: type === "homework" ? subjectForDue : subj, due, question }));
    // an event line that also asks to bring/wear something is both a bring item and a notice
    if (type === "bring" && /יתקיים|תתקיים|טקס|מכירת|טיול|מבחן/.test(s)) items.push(mkItem("notice", { text: s, due }));
  }
  if (!items.length && photos && postSubject) {
    dropped.push({ reason: "lesson_notes", subject: postSubject, photos });
    return { items, dropped, kind: "lesson_notes" };
  }
  if (!items.length && post.sender === "teacher" && text.length > 80) items.push(mkItem("notice", { text: segs[0] || text, confidence: 0.6 }));
  return { items, dropped, kind: items.length ? "items" : "empty" };
}

// ---------- photo bursts ----------
/**
 * Group raw chat messages into posts: consecutive photos from the same sender within 3 minutes
 * are attached to the caption right after them (within 3 min), or right before.
 * msgs: [{ts: Date-ish ms, sender, text, media: bool}]
 */
export function groupBursts(msgs, gapMs = 3 * 60 * 1000) {
  const posts = [];
  let i = 0;
  while (i < msgs.length) {
    const m = msgs[i];
    if (m.media && !m.text) {
      const burst = [m];
      let j = i + 1;
      while (j < msgs.length && msgs[j].sender === m.sender && msgs[j].media && !msgs[j].text && msgs[j].ts - burst[burst.length - 1].ts <= gapMs) burst.push(msgs[j++]);
      const next = msgs[j];
      if (next && next.sender === m.sender && next.text && next.ts - burst[burst.length - 1].ts <= gapMs) {
        posts.push({ ts: next.ts, sender: m.sender, text: next.text, photos: burst.length + (next.media ? 1 : 0), files: burst.map((b) => b.file).concat(next.file || []).filter(Boolean) });
        i = j + 1;
      } else {
        const prev = posts[posts.length - 1];
        if (prev && prev.sender === m.sender && m.ts - prev.ts <= gapMs && prev.text) { prev.photos += burst.length; prev.files.push(...burst.map((b) => b.file).filter(Boolean)); }
        else posts.push({ ts: m.ts, sender: m.sender, text: "", photos: burst.length, files: burst.map((b) => b.file).filter(Boolean) });
        i = j;
      }
    } else {
      posts.push({ ts: m.ts, sender: m.sender, text: m.text, photos: m.media ? 1 : 0, files: m.file ? [m.file] : [] });
      i++;
    }
  }
  // carry the subject from the previous caption of the same sender within 30 minutes
  for (let k = 1; k < posts.length; k++) {
    const p = posts[k], q = posts[k - 1];
    if (p.sender === q.sender && p.ts - q.ts <= 30 * 60 * 1000) p.prevSubject = findSubject(q.text || "") || q.prevSubject || null;
  }
  return posts;
}

// ---------- WhatsApp chat export (.txt) ----------
const LINE_ANDROID = /^(\d{1,2})[./](\d{1,2})[./](\d{2,4}),? (\d{1,2}):(\d{2})(?::\d{2})?(?:\s?[AP]M)?(?: - | )(.*)$/;
const LINE_IOS = /^\[(\d{1,2})[./](\d{1,2})[./](\d{2,4}),? (\d{1,2}):(\d{2})(?::\d{2})?(?:\s?[AP]M)?\] (.*)$/;
const MEDIA = /(\S+\.(?:jpg|jpeg|png|webp))\s*\((?:קובץ מצורף|file attached)\)|<attached: ([^>]+\.(?:jpg|jpeg|png|webp))>|<המדיה לא נכללה>|<Media omitted>|image omitted|התמונה הושמטה/i;
export function parseWhatsApp(txt) {
  const msgs = [];
  for (const raw of txt.replace(/\r/g, "").split("\n")) {
    const line = raw.replace(/^[\u200e\u200f]+/, "");
    const m = line.match(LINE_ANDROID) || line.match(LINE_IOS);
    if (m) {
      let [, d, mo, y, h, mi, rest] = m;
      y = +y < 100 ? 2000 + +y : +y;
      const ts = new Date(y, +mo - 1, +d, +h, +mi).getTime();
      const k = rest.indexOf(": ");
      if (k < 0) continue; // system line
      const sender = rest.slice(0, k).replace(/[\u200e\u200f\u202a\u202c~]/g, "").trim();
      msgs.push({ ts, sender, text: rest.slice(k + 2) });
    } else if (msgs.length) msgs[msgs.length - 1].text += "\n" + raw;
  }
  return msgs.map((x) => {
    const mm = x.text.match(MEDIA);
    let text = x.text.replace(MEDIA, "").replace(/[\u200e\u200f]/g, "").trim();
    if (/^(ההודעה הזו נמחקה|This message was deleted|בהמתנה להודעה זו)$/.test(text)) text = "";
    const file = mm ? (mm[1] || mm[2] || null) : null;
    const lines = text.split("\n");
    if (file && lines[0] === file.replace(/\.\w+$/, "")) lines.shift(); // docx/pdf echo
    return { ts: x.ts, sender: x.sender, text: lines.join("\n").trim(), media: !!mm, file };
  }).filter((x) => x.text || x.media);
}
export function senderRoles(msgs) {
  // The teacher is the sender whose name contains a teacher hint, else the most frequent long-message sender.
  const count = {};
  for (const m of msgs) count[m.sender] = (count[m.sender] || 0) + (m.text.length > 80 ? 3 : 1);
  const t = Object.keys(count).find((s) => /מחנכת|מורה|המורה|teacher/i.test(s)) || Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0];
  return (s) => (s === t ? "teacher" : "student");
}
export function postsFromExport(txt, sinceYmd) {
  const msgs = parseWhatsApp(txt);
  const role = senderRoles(msgs);
  return groupBursts(msgs).map((p) => ({ ...p, date: ymd(new Date(p.ts)), sender: role(p.sender) })).filter((p) => !sinceYmd || p.date >= sinceYmd);
}

// ---------- tiny zip reader (stored + deflate via DecompressionStream) ----------
export async function unzipText(buf, wanted = /\.txt$/i) {
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("not a zip");
  let p = dv.getUint32(eocd + 16, true);
  const n = dv.getUint16(eocd + 10, true);
  for (let k = 0; k < n; k++) {
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), elen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const off = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + elen + clen;
    if (!wanted.test(name)) continue;
    const start = off + 30 + dv.getUint16(off + 26, true) + dv.getUint16(off + 28, true);
    const data = u8.subarray(start, start + csize);
    if (method === 0) return new TextDecoder().decode(data);
    const ds = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(ds).text();
  }
  throw new Error("no chat .txt in zip");
}
