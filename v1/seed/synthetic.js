// Synthetic demo data. Invented names and text that mimic the patterns of real class groups. No real content.
import { addDays, nextSchoolDay } from "../lib/core.js";

export const DEMO_TIMETABLE = {
  0: ["שפה", "חשבון", "אנגלית", "תורה", "חינוך גופני"],
  1: ["אומנות", "שפה", "קריאה דיאלוגית", "חשבון", "הנדסה"],
  2: ["לשון", "מדעים", "חשבון", "אנגלית", "מורשת"],
  3: ["שפה", "הנדסה", "עת הדעת", "מולדת", "חינוך גופני"],
  4: ["חשבון", "שפה", "אנגלית", "מדעים", "חינוך"],
  5: ["שפה", "תורה", "חשבון"],
};

export function demoPosts(today) {
  const d = (n) => addDays(today, n);
  const due = addDays(nextSchoolDay(today, DEMO_TIMETABLE), 3);
  const [, m, dd] = due.split("-");
  return [
    { sender: "teacher", date: d(0), time: "16:05", text:
`שלום לכולם,
מערכת שעות למחר:
- שפה- מחברת 14 שורות.
- חשבון- מחברת משבצות וחוברת מספר 7.
- אנגלית- ספר וחוברת עבודה.
- תורה- ספר תנ"ך מלא.
מזכירה להביא ספר קריאה אישי לקריאת בוקר.
בשיעור חשבון עבדנו בעמודים 41-42. מי שלא סיים נא להשלים בבית.` },
    { sender: "teacher", date: d(0), time: "17:30", text:
`הורים יקרים 🌼
1) מחר יתקיים טקס קצר בחצר. נא לבוא בחולצה לבנה.
2) יש להחזיר עד יום חמישי טופס אישור יציאה לסיור, חתום.
3) תשלום עבור הסיור דרך הקישור: https://example.org/pay
תודה רבה!` },
    { sender: "teacher", date: d(0), time: "18:10", text: "*עדכון חשוב:* אסיפת ההורים ביום שלישי תתקיים בשעה 18:00 במקום 17:00." },
    { sender: "student", date: d(0), time: "12:40", text: "אנגלית", photoSeed: ["seed/notebook-2.jpg"] },
    { sender: "student", date: d(0), time: "12:44", text: "חשבון אמוד 52 סהיף 3 לשיעור הבא", photoSeed: ["seed/notebook-1.jpg"] },
    { sender: "student", date: d(0), time: "13:02", text: "צריך מחברת ספירלה לאומנות" },
    { sender: "student", date: d(0), time: "13:20", text: "", photoSeed: ["seed/notebook-1.jpg"] },
    { sender: "teacher", date: d(0), time: "19:00", text: `שוייכה לילדים משימה בחשבון באתר התרגול, בנושא שברים. את המשימה יש להגיש עד ה-${+dd}.${+m}.` },
    { sender: "teacher", date: d(-1), time: "20:15", text: "בוקר טוב לכולם, מזל טוב לנועה ליום הולדתה! 🎉" },
  ];
}

// A post to paste in the demo (looks like a forwarded teacher message)
export const DEMO_PASTE = `היי,
מחר יש להביא כובע ובקבוק מים לפעילות בחוץ.
מי שלא עשה בעת הדעת לעשות לשיעור הבא.`;
