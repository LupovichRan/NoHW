(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NohwHebrew = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // משפטים קבועים. מה שכתוב כאן הוא מה שהעוזר מציג. ההגייה לדיבור נפרדת.
  const FIXED = [
    ["fallback", "אני יודע רק מה שקשור לכיתה 😊"],
    ["greet-student", "היי, הנה מה שחשוב עכשיו."],
    ["greet-parent", "היי, ככה נראה היום."],
    ["greet-teacher", "היי, זה מה שמחכה בכיתה."],
    ["greet-principal", "היי, ככה נראה בית הספר."],
    ["greet-admin", "היי, ככה נראה בית הספר."],
    ["greet-admin-wide", "היי, אלה בתי הספר שכדאי לבדוק."],
    ["chat-hello", "היי, אפשר לשאול על הכיתה."],
    ["setup-hello", "היי, נמשיך בהקמה."],
    ["nothing-left", "להיום לא נשאר כלום 🎉"],
    ["no-tomorrow", "מחר אין שיעורים."],
    ["no-messages", "אין הודעות חדשות."],
    ["no-messages-short", "אין הודעות"],
    ["all-posted", "להיום הכל כבר פורסם."],
    ["all-finished", "כולם סיימו את מה שפורסם."],
    ["none-sent", "עוד אין הודעות."],
    ["cheer", "כל הכבוד, הכול הוכן היום"],
    ["no-update", "אין עדכון."],
    ["schools-clear", "אין בתי ספר שמחכים לעדכון"],
    ["deny", "אין הרשאה"],
    ["ok", "בסדר."],
    ["declined", "בסדר, לא שיניתי."],
    ["done", "בוצע."],
    ["not-done", "לא בוצע."],
    ["yes-or-no", "כן או לא?"],
    ["voice-test", "היי, ככה אני נשמע. אפשר לשאול אותי על הכיתה."],
    ["voice-hint", "בכיתה ההקראה כבויה, עד שלוחצים הקראה. האיכות תלויה בקול העברית שבמכשיר."],
    ["voice-device", "האיכות תלויה בקול העברית שבמכשיר."],
    ["voice-best", "הקול הכי טוב"],
    ["voice-empty", "אין במכשיר קול עברית."],
    ["ask-school", "איך קוראים לבית הספר?"],
    ["ask-principal", "מי המנהל/ת?"],
    ["which-classes", "אילו כיתות? אפשר לכתוב ד׳1-ד׳3, או רשימה."],
    ["all-have-teacher", "לכל הכיתות יש מורה."],
    ["which-class", "לאיזו כיתה?"],
    ["delete-which", "איזה בית ספר למחוק?"],
    ["which-school", "איזה בית ספר?"],
    ["no-schools", "אין בתי ספר."],
    ["no-class", "אין כיתה."],
    ["which-kids", "איך קוראים לילדים? אפשר שורה, או פסיק."],
    ["all-have-parent", "לכל הילדים יש הורה."],
    ["which-kid", "לאיזה ילד?"],
    ["which-face", "איזה פנים לבחור?"],
    ["ask-helper-name", "איך קוראים לעוזר?"],
    ["none-day", "לסמן אין שיעורים להיום?"],
    ["choose", "מה עושים עכשיו?"],
    ["go-scenarios", "עוברים לתרחישים."],
    ["go-reset", "עוברים לאיפוס."],
    ["classes-updated", "כל הכיתות עודכנו היום."],
    ["updated-today", "היום הכל עודכן."],
    ["name-updated", "השם עודכן."],
    ["helper-saved", "העוזר נשמר."],
    ["marked-none", "סומן אין שיעורים להיום."],
    ["kids-added", "הילדים נוספו."],
    ["kid-added", "הילד נוסף."],
    ["class-added", "נוספה כיתה."],
    ["template-done", "המערכת הוחלה. אפשר לדייק בלו״ז."],
    ["draft-keep", "הכנתי טיוטה.\nהשליחה נשארת אצלך, ידנית."],
    ["draft-parents", "הכנתי טיוטה להורים. השליחה נשארת אצלך."],
    ["draft-staff", "הכנתי טיוטה. השליחה נשארת אצלך."],
    ["attention-clear", "אין בתי ספר שמחכים לתשומת לב"],
    ["from-teacher", "מהמורה:"],
    ["you-sent", "שלחת:"],
    ["still-left", "נשאר לך:"],
    ["not-posted", "עוד לא פורסם היום:"],
    ["not-finished", "עוד לא סיימו:"],
    ["missing-today", "חסר היום:"],
    ["one-subject", "מקצוע אחד לא עודכן"],
    ["message-word", "הודעה"],
    ["posted-word", "פורסם"],
    ["prepared-word", "הוכן"],
    ["not-yet", "עוד לא"],
    ["no-homework", "אין שיעורים"],
    ["not-updated", "לא עודכן"],
    ["alert-word", "התראה"],
    ["tomorrow-title", "למחר"],
    ["left-title", "נשאר"],
    ["status-title", "מצב"],
    ["week-title", "השבוע"],
    ["sent-title", "נשלח"],
    ["unfinished-title", "עוד לא סיימו"],
    ["replies-title", "תגובות"],
    ["draft-title", "טיוטה"],
    ["school-title", "בית הספר"],
    ["clear-title", "הכל מעודכן"],
    ["remind-title", "תזכורת"],
    ["remind-evening", "תזכורת ערב"],
    ["setup-go", "המשך הקמה"],
    ["all-prepared", "הכל הוכן"]
  ];
  const byId = {};
  FIXED.forEach(function (row) { byId[row[0]] = row[1]; });

  function text(id) {
    return byId[id] || "";
  }
  function lines() {
    return FIXED.map(function (row) { return { id: row[0], text: row[1] }; });
  }
  function idFor(value) {
    const raw = String(value || "");
    for (let i = 0; i < FIXED.length; i++) {
      if (FIXED[i][1] === raw) return FIXED[i][0];
    }
    return "";
  }
  function join(parts) {
    return parts.filter(function (part) { return String(part || "").trim(); }).join("\n");
  }
  function greet(role, wide) {
    if (role === "student") return text("greet-student");
    if (role === "parent") return text("greet-parent");
    if (role === "teacher") return text("greet-teacher");
    if (role === "admin") return wide ? text("greet-admin-wide") : text("greet-admin");
    if (role === "principal") return text("greet-principal");
    return text("chat-hello");
  }
  function subjectPhrase(count) {
    if (count === 1) return text("one-subject");
    return count + " מקצועות לא עודכנו";
  }
  function postedLine(row) {
    if (row.status === "posted") return row.subject + ": " + (row.text || text("posted-word"));
    if (row.status === "no-homework") return row.subject + ": " + text("no-homework");
    return row.subject + ": " + text("not-updated");
  }
  function tomorrowWork(day, rows) {
    const body = rows && rows.length ? rows.join("\n") : text("no-tomorrow");
    return "מחר, " + day + ":\n" + body;
  }
  function tomorrowLessons(day, names) {
    return "מחר בלו״ז, " + day + ":\n" + names.join("\n");
  }
  function leftWork(rows) {
    return text("still-left") + "\n" + rows.join("\n");
  }
  function fromTeacher(rows) {
    return text("from-teacher") + "\n" + rows.join("\n");
  }
  function streak(count, done, total) {
    return "הרצף שלך: " + count + ".\nהיום הוכנו " + done + " מתוך " + total + ".";
  }
  function kidBlock(name, body) {
    return name + ":\n" + body;
  }
  function kidStatusLine(name, subject, detail, done) {
    return subject + ": " + (detail || text("posted-word")) + " · " + (done ? text("prepared-word") : text("not-yet"));
  }
  function kidNoHomework(subject) {
    return subject + ": " + text("no-homework");
  }
  function kidNotUpdated(subject) {
    return subject + ": " + text("not-updated");
  }
  function kidLeftLine(subject, detail) {
    return subject + ": " + (detail || text("posted-word"));
  }
  function allPrepared(name) {
    return name + ": " + text("all-prepared");
  }
  function roomMessages(name, body) {
    return name + ":\n" + body;
  }
  function weekLine(name, done, posted) {
    return name + " השבוע: " + done + " הוכנו מתוך " + posted + ".";
  }
  function weekCard(name, done, posted) {
    return name + " השבוע: " + done + " הוכנו מתוך " + posted;
  }
  function notPosted(subjects) {
    return text("not-posted") + "\n" + subjects.join("\n");
  }
  function notFinished(lines) {
    return text("not-finished") + "\n" + lines.join("\n");
  }
  function sentList(rows) {
    return text("you-sent") + "\n" + rows.join("\n");
  }
  function remindDraft(lines) {
    if (!lines.length) return "תזכורת: כל מה שפורסם הוכן. כל הכבוד!";
    return "תזכורת: עוד לא הוכן — " + lines.join("; ") + ".";
  }
  function draftIntro(draft) {
    return text("draft-keep") + "\n" + draft;
  }
  function classStatus(name, posted, waiting, none, done, possible) {
    return name + " היום:\nפורסם " + posted + "\nלא עודכן " + waiting + "\nאין שיעורים " + none + "\nהוכן " + done + " מתוך " + possible;
  }
  function digestTomorrow(day, names, body) {
    return join(["מחר, " + day, names.join(", "), body]);
  }
  function digestLeft(rows) {
    return rows.join("\n");
  }
  function parentStatus(name, done, total) {
    return name + ": הוכנו " + done + " מתוך " + total;
  }
  function parentTomorrow(name, rows) {
    return name + ":\n" + rows.join("\n");
  }
  function messagesBody(rows, alert) {
    return rows.join("\n") + (alert ? "\n" + text("alert-word") : "");
  }
  function schoolDone(pct, done, possible) {
    return "בית הספר: הוכן " + pct + "% (" + done + " מתוך " + possible + ")";
  }
  function schoolAttention(name, phrase) {
    return name + ": " + phrase;
  }
  function studentReminder(items) {
    return "רק תזכורת. עוד נשאר: " + items.join(", ");
  }
  function parentReminder(lines) {
    return "רק תזכורת. עוד נשאר: " + lines.join("; ");
  }
  function teacherReminder(subjects) {
    return "רק תזכורת. עוד לא פורסם: " + subjects.join(", ");
  }
  function customReminder(time, about) {
    return "אזכיר לך ב-" + time + (about ? " על " + about : "") + ".";
  }
  function setupProgress(done, total) {
    return "הקמה " + done + "/" + total;
  }
  function setupItem(done, title) {
    return (done ? "✓ " : "○ ") + title;
  }
  function confirmSchool(school, principal) {
    return "להוסיף את בית הספר " + school + " עם " + principal + "?";
  }
  function addedSchool(name) {
    return "נוסף בית הספר " + name + ".";
  }
  function confirmClasses(count) {
    return count === 1 ? "להוסיף כיתה אחת?" : "להוסיף " + count + " כיתות?";
  }
  function addedClasses(count) {
    return count === 1 ? text("class-added") : "נוספו " + count + " כיתות.";
  }
  function confirmList(title, names) {
    return title + "\n" + names.join(", ");
  }
  function whoTeaches(name) {
    return "מי המורה של " + name + "?";
  }
  function confirmTeacher(teacher, room) {
    return "לשבץ את " + teacher + " ל" + room + "?";
  }
  function teacherPlaced(teacher, room) {
    return teacher + " משויך ל" + room + ".";
  }
  function confirmDelete(name) {
    return "למחוק את " + name + "?";
  }
  function deletedSchool(name) {
    return name + " נמחק.";
  }
  function renameAsk(name) {
    return "שם חדש ל" + name + "?";
  }
  function confirmRename(from, to) {
    return "לשנות את " + from + " ל" + to + "?";
  }
  function confirmTemplate(grade, slots) {
    const title = "לשים תבנית ל" + (grade || "כיתה") + "?";
    return { title: title, text: title + "\n" + slots.join(", ") };
  }
  function confirmKids(count) {
    return count === 1 ? "להוסיף ילד אחד?" : "להוסיף " + count + " ילדים?";
  }
  function whoParent(name) {
    return "מי ההורה של " + name + "?";
  }
  function confirmParent(parent, kid) {
    return "להוסיף את " + parent + " כהורה של " + kid + "?";
  }
  function parentAdded(name) {
    return name + " נוסף.";
  }
  function nameFace(face) {
    return "איך קוראים ל" + face + "?";
  }
  function confirmFace(face, name) {
    return "לשמור " + face + " בשם " + name + "?";
  }
  function noClasses(name) {
    return name + ": אין כיתות";
  }
  function noPosts(name) {
    return name + ": אין פרסום השבוע";
  }
  function health(schools, classes, teachers, kids, rate) {
    return "בתי ספר " + schools + "\nכיתות " + classes + "\nמורים " + teachers + "\nילדים " + kids + "\nפרסום היום " + rate + "%";
  }
  function staffDraft(names) {
    return "שלום המורים, היום עוד לא עודכן: " + names.join(", ") + ".";
  }
  function staffDraftSay(draft) {
    return text("draft-staff") + "\n" + draft;
  }
  function parentDraftBody(lines) {
    if (!lines.length) return "שלום, כל מה שפורסם הוכן. כל הכבוד!";
    return "שלום, עוד לא הוכן: " + lines.join("; ") + ".";
  }
  function parentDraftSay(draft) {
    return text("draft-parents") + "\n" + draft;
  }
  function missingLine(name, subjects) {
    return name + ": " + subjects.join(", ");
  }
  function checklistTitle(id) {
    if (id === "school") return "בית ספר";
    if (id === "classes") return "כיתות";
    if (id === "teachers") return "מורים";
    if (id === "timetable") return "מערכת";
    if (id === "kids") return "ילדים";
    if (id === "parents") return "הורים";
    if (id === "avatar") return "עוזר";
    return id;
  }

  return {
    FIXED: FIXED,
    lines: lines,
    text: text,
    idFor: idFor,
    greet: greet,
    subjectPhrase: subjectPhrase,
    postedLine: postedLine,
    tomorrowWork: tomorrowWork,
    tomorrowLessons: tomorrowLessons,
    leftWork: leftWork,
    fromTeacher: fromTeacher,
    streak: streak,
    kidBlock: kidBlock,
    kidStatusLine: kidStatusLine,
    kidNoHomework: kidNoHomework,
    kidNotUpdated: kidNotUpdated,
    kidLeftLine: kidLeftLine,
    allPrepared: allPrepared,
    roomMessages: roomMessages,
    weekLine: weekLine,
    weekCard: weekCard,
    notPosted: notPosted,
    notFinished: notFinished,
    sentList: sentList,
    remindDraft: remindDraft,
    draftIntro: draftIntro,
    classStatus: classStatus,
    digestTomorrow: digestTomorrow,
    digestLeft: digestLeft,
    parentStatus: parentStatus,
    parentTomorrow: parentTomorrow,
    messagesBody: messagesBody,
    schoolDone: schoolDone,
    schoolAttention: schoolAttention,
    studentReminder: studentReminder,
    parentReminder: parentReminder,
    teacherReminder: teacherReminder,
    customReminder: customReminder,
    setupProgress: setupProgress,
    setupItem: setupItem,
    confirmSchool: confirmSchool,
    addedSchool: addedSchool,
    confirmClasses: confirmClasses,
    addedClasses: addedClasses,
    confirmList: confirmList,
    whoTeaches: whoTeaches,
    confirmTeacher: confirmTeacher,
    teacherPlaced: teacherPlaced,
    confirmDelete: confirmDelete,
    deletedSchool: deletedSchool,
    renameAsk: renameAsk,
    confirmRename: confirmRename,
    confirmTemplate: confirmTemplate,
    confirmKids: confirmKids,
    whoParent: whoParent,
    confirmParent: confirmParent,
    parentAdded: parentAdded,
    nameFace: nameFace,
    confirmFace: confirmFace,
    noClasses: noClasses,
    noPosts: noPosts,
    health: health,
    staffDraft: staffDraft,
    staffDraftSay: staffDraftSay,
    parentDraftBody: parentDraftBody,
    parentDraftSay: parentDraftSay,
    missingLine: missingLine,
    checklistTitle: checklistTitle,
    FALLBACK: text("fallback")
  };
});
