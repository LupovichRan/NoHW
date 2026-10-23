// Gemini provider. Server-only: reads the key from the environment; never shipped to the client.
import { resolveHint, findSubject, TYPES } from "./core.js";

const SCHEMA = {
  type: "OBJECT",
  properties: {
    kind: { type: "STRING", enum: ["items", "lesson_notes", "social", "empty"] },
    items: { type: "ARRAY", items: { type: "OBJECT", properties: {
      type: { type: "STRING", enum: TYPES },
      subject: { type: "STRING", nullable: true },
      text: { type: "STRING" },
      when: { type: "STRING", enum: ["explicit", "today", "tomorrow", "weekday", "next_lesson", "none"] },
      explicit_date: { type: "STRING", nullable: true, description: "YYYY-MM-DD when when=explicit" },
      weekday: { type: "INTEGER", nullable: true, description: "0=Sunday..5=Friday when when=weekday" },
      lessons: { type: "ARRAY", items: { type: "STRING" }, nullable: true },
      confidence: { type: "NUMBER" },
      question: { type: "STRING", nullable: true, description: "Hebrew question to the parent if anything is unclear" },
    }, required: ["type", "text", "when", "confidence"] } },
  },
  required: ["kind", "items"],
};

const PROMPT = `אתה מחלץ משימות להורים של ילד בכיתה ד' מהודעות וואטסאפ של הכיתה (מורה או ילדים).
סוגים: bring (מה להביא/ללבוש), timetable (מערכת שעות ליום מסוים, lessons=רשימת מקצועות), homework (שיעורי בית/משימה),
notice (הודעה/אירוע), change (שינוי בשעה/מקום/מערכת), action (טופס, חתימה, תשלום, רכישה על ידי ההורה).
כללים:
- תמונות של מחברת/לוח עם כיתוב שהוא רק שם מקצוע הן סיכום שיעור: kind=lesson_notes ואין items.
- אם התמונה מראה שיעורי בית (עמודים, תרגילים, "לבית") - homework.
- ברכות, תודות, מזל טוב, רפואה שלמה - kind=social.
- אל תחשב תאריכים בעצמך: מלא when (tomorrow/today/weekday/next_lesson/explicit/none). "לשיעור הבא" = next_lesson.
- אם לא ברור מקצוע, תאריך, או אם זה שיעורי בית או עבודה בכיתה - confidence נמוך ושאלה קצרה בעברית ב-question. אל תנחש.
- text: ניסוח קצר וברור בעברית להורה (עד 120 תווים). ילדים כותבים בשגיאות (אמוד=עמוד, סהיף=סעיף).`;

export async function extractGemini(post, ctx, { key, model = "gemini-2.5-flash", fetchImpl = fetch } = {}) {
  const parts = [{ text: `${PROMPT}\n\nתאריך ההודעה: ${post.date}. השולח: ${post.sender === "teacher" ? "מורה" : post.sender === "student" ? "ילד/ה" : "לא ידוע"}.` +
    (post.prevSubject ? `\nהכיתוב הקודם של אותו שולח היה על: ${post.prevSubject}.` : "") +
    `\nמספר תמונות: ${post.photos || 0}.\nההודעה:\n"""${post.text || ""}"""` }];
  for (const img of (post.images || []).slice(0, 6)) {
    const m = /^data:(image\/[\w+]+);base64,(.+)$/.exec(img);
    if (m) parts.push({ inline_data: { mime_type: m[1], data: m[2] } });
  }
  const r = await fetchImpl(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { temperature: 0, responseMimeType: "application/json", responseSchema: SCHEMA } }),
  });
  if (!r.ok) throw new Error(`gemini ${r.status}`);
  const j = await r.json();
  const raw = JSON.parse(j.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "{}");
  const tt = ctx.timetable || {};
  const items = (raw.items || []).filter((i) => TYPES.includes(i.type)).map((i) => {
    const subject = i.subject ? findSubject(i.subject) || i.subject : null;
    const h = i.when === "explicit" && /^\d{4}-\d{2}-\d{2}$/.test(i.explicit_date || "") ? { hint: "x", date: i.explicit_date }
      : i.when === "weekday" ? { hint: "weekday", wd: i.weekday ?? 0 } : i.when === "none" ? null : { hint: i.when };
    let due = resolveHint(h, post.date, subject, tt);
    let question = i.question || null;
    if (i.when === "next_lesson" && !due) question = question || `מתי השיעור הבא${subject ? " ב" + subject : ""}?`;
    if (i.confidence < 0.6 && !question) question = "לא בטוח שהבנתי נכון. לאשר?";
    return { type: i.type, subject, text: String(i.text).slice(0, 160), due, needsConfirm: !!question, question, confidence: i.confidence, extra: i.lessons?.length ? { lessons: i.lessons } : null };
  });
  return { items, dropped: raw.kind === "lesson_notes" ? [{ reason: "lesson_notes", photos: post.photos }] : [], kind: raw.kind || "items" };
}
