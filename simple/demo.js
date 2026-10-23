(function (root, factory) {
  const model = typeof module === "object" && module.exports ? require("./logic.js") : root.Nohw;
  const api = factory(model);
  if (typeof module === "object" && module.exports) module.exports = api;
  root.NohwDemo = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (S) {
  const SUB = S.SUBJECTS;

  function shift(today, days) {
    const parts = String(today).split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    date.setDate(date.getDate() + days);
    return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
  }
  function weekDates(today) {
    const parts = String(today).split("-").map(Number);
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    const day = date.getDay();
    const start = shift(today, day === 6 ? -6 : -day);
    return [0, 1, 2, 3, 4, 5].map(function (offset) { return shift(start, offset); });
  }
  function schoolDay(today) {
    const days = weekDates(today);
    return days.indexOf(today) >= 0 ? today : days[5];
  }
  function code(seed) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let hash = 2166136261 >>> 0;
    const text = String(seed);
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    let out = "";
    for (let i = 0; i < 6; i++) {
      hash = (Math.imul(hash ^ text.charCodeAt(i % text.length), 16777619) + i * 97 + 1) >>> 0;
      out += alphabet[hash % alphabet.length];
    }
    return out;
  }
  function post(text) { return { mode: "post", text: text }; }
  function none() { return { mode: "none" }; }
  function kid(id, name, done) {
    return { id: id, firstName: name, kidCode: code(id + ":k"), parentCode: code(id + ":p"), done: done || {} };
  }
  function beep() {
    const rate = 8000;
    const n = 2400;
    const bytes = new Uint8Array(44 + n * 2);
    function writeStr(offset, text) { for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i); }
    function write32(offset, value) { bytes[offset] = value & 255; bytes[offset + 1] = (value >> 8) & 255; bytes[offset + 2] = (value >> 16) & 255; bytes[offset + 3] = (value >> 24) & 255; }
    function write16(offset, value) { bytes[offset] = value & 255; bytes[offset + 1] = (value >> 8) & 255; }
    writeStr(0, "RIFF");
    write32(4, 36 + n * 2);
    writeStr(8, "WAVE");
    writeStr(12, "fmt ");
    write32(16, 16);
    write16(20, 1);
    write16(22, 1);
    write32(24, rate);
    write32(28, rate * 2);
    write16(32, 2);
    write16(34, 16);
    writeStr(36, "data");
    write32(40, n * 2);
    for (let i = 0; i < n; i++) {
      const sample = Math.round(Math.sin((2 * Math.PI * 523.25 * i) / rate) * 9000);
      write16(44 + i * 2, sample & 65535);
    }
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return "data:audio/wav;base64," + btoa(bin);
  }
  const BOARD_VOICE = beep();
  const BOARD_PHOTO = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#143d2a"/><text x="320" y="170" fill="#f4f7ef" font-size="54" text-anchor="middle" font-family="Rubik,sans-serif">תרגיל 4</text><text x="320" y="230" fill="#d7ead4" font-size="28" text-anchor="middle" font-family="Rubik,sans-serif">לוח הכיתה</text></svg>');
  function weekTable() {
    const table = {};
    for (let day = 0; day < 6; day++) {
      const slots = SUB.slice();
      while (slots.length < 6) slots.push("");
      table[String(day)] = slots;
    }
    return table;
  }
  function room(id, name, teacher, kids, homework, extra) {
    const item = { id: id, name: name, teacherName: teacher, teacherCode: code(id + ":t"), homework: homework || {}, kids: kids || [], timetable: weekTable(), messages: [] };
    const more = extra || {};
    if (more.timetable) item.timetable = more.timetable;
    if (more.messages) item.messages = more.messages;
    return item;
  }
  function school(id, name, principal, rooms) {
    return { id: id, name: name, principalName: principal, principalCode: code(id + ":s"), classrooms: rooms || [] };
  }
  function person(id, name, emoji, role, extra) {
    return Object.assign({ id: id, name: name, emoji: emoji, role: role }, extra || {});
  }
  function pack(id, title, personId, people, schools, emoji) {
    return { id: id, title: title, personId: personId, people: people, emoji: emoji || "", state: { v: 1, schools: schools } };
  }
  function findSchool(state, id) {
    return (state.schools || []).find(function (item) { return item.id === id; }) || null;
  }
  function findClass(state, id) {
    for (const item of state.schools || []) {
      const found = (item.classrooms || []).find(function (roomItem) { return roomItem.id === id; });
      if (found) return { school: item, room: found };
    }
    return null;
  }
  function findKid(state, id) {
    for (const item of state.schools || []) {
      for (const roomItem of item.classrooms || []) {
        const found = (roomItem.kids || []).find(function (kidItem) { return kidItem.id === id; });
        if (found) return { school: item, room: roomItem, kid: found };
      }
    }
    return null;
  }
  function personActor(state, who) {
    if (!who) return null;
    if (who.role === "admin") return { role: "admin" };
    if (who.role === "principal") {
      const item = findSchool(state, who.schoolId);
      return item && item.principalCode ? { role: "principal", code: item.principalCode } : null;
    }
    if (who.role === "teacher") {
      const found = findClass(state, who.classId);
      return found && found.room.teacherCode ? { role: "teacher", code: found.room.teacherCode } : null;
    }
    if (who.role === "student") {
      const found = findKid(state, who.kidId);
      return found && found.kid.kidCode ? { role: "student", code: found.kid.kidCode } : null;
    }
    if (who.role === "parent") return { role: "parent" };
    return null;
  }
  function schoolsFor(state, who) {
    if (!who) return [];
    if (who.role === "admin") return state.schools || [];
    if (who.role === "principal" || who.role === "teacher" || who.role === "student") {
      const item = findSchool(state, who.schoolId);
      return item ? [item] : [];
    }
    if (who.role === "parent") {
      const ids = {};
      (who.kidIds || []).forEach(function (kidId) {
        const found = findKid(state, kidId);
        if (found) ids[found.school.id] = found.school;
      });
      return Object.keys(ids).map(function (id) { return ids[id]; });
    }
    return [];
  }
  function classesFor(state, who) {
    if (!who) return [];
    if (who.role === "admin") {
      const all = [];
      (state.schools || []).forEach(function (item) { (item.classrooms || []).forEach(function (roomItem) { all.push(roomItem); }); });
      return all;
    }
    if (who.role === "principal") {
      const item = findSchool(state, who.schoolId);
      return item ? item.classrooms || [] : [];
    }
    if (who.role === "teacher") {
      const found = findClass(state, who.classId);
      return found ? [found.room] : [];
    }
    return [];
  }
  function normalHomework(day) {
    const homework = {};
    homework[day] = {};
    homework[day][SUB[0]] = post("עמ׳ 12");
    homework[day][SUB[1]] = post("כתיב");
    homework[day][SUB[2]] = post("עמ׳ 4");
    return homework;
  }
  function normalDone(day) {
    const done = {};
    done[day] = {};
    done[day][SUB[0]] = true;
    done[day][SUB[1]] = true;
    return done;
  }
  function noneDay(day) {
    const homework = {};
    homework[day] = {};
    SUB.forEach(function (subject) { homework[day][subject] = none(); });
    return homework;
  }
  function alonPair(day, homework, noaDone) {
    const noa = kid("k-noa", "נועה", noaDone);
    const omer = kid("k-omer", "עומר");
    return school("s-alon", "אלון", "דנה כהן", [room("c-h2", "ה'2", "מיכל אביב", [noa, omer], homework)]);
  }
  function corePeople(extra) {
    return [
      person("admin", "נועם גל", "🧔", "admin"),
      person("p-s-alon", "דנה כהן", "👩", "principal", { schoolId: "s-alon" }),
      person("t-c-h2", "מיכל אביב", "👩‍🏫", "teacher", { schoolId: "s-alon", classId: "c-h2" }),
      person("s-k-noa", "נועה", "👧", "student", { schoolId: "s-alon", classId: "c-h2", kidId: "k-noa" }),
      person("s-k-omer", "עומר", "👦", "student", { schoolId: "s-alon", classId: "c-h2", kidId: "k-omer" }),
      person("par-yael", "יעל ברק", "👩", "parent", { kidIds: extra || ["k-noa"], kin: "אמא" }),
      person("par-avigail", "אביגיל דהן", "👱‍♀️", "parent", { kidIds: ["k-omer"], kin: "אמא" })
    ];
  }

  function cast(today) {
    const day = schoolDay(today);
    const noa = kid("k-noa", "נועה", normalDone(day));
    const omer = kid("k-omer", "עומר");
    const tamar = kid("k-tamar", "תמר");
    const itai = kid("k-itai", "איתי");
    const ido = kid("k-ido", "עידו");
    const maya = kid("k-maya", "מאיה");
    const schools = [
      school("s-alon", "אלון", "דנה כהן", [
        room("c-h2", "ה'2", "מיכל אביב", [noa, omer], normalHomework(day)),
        room("c-d1", "ד'1", "אור לוי", [tamar, itai])
      ]),
      school("s-brosh", "ברוש", "יואב מזרחי", [
        room("c-v1", "ו'1", "רונית שמש", [ido]),
        room("c-h1", "ה'1", "יוסי חדד", [maya])
      ])
    ];
    const people = [
      person("admin", "נועם גל", "🧔", "admin"),
      person("p-s-alon", "דנה כהן", "👩", "principal", { schoolId: "s-alon" }),
      person("p-s-brosh", "יואב מזרחי", "👨", "principal", { schoolId: "s-brosh" }),
      person("t-c-h2", "מיכל אביב", "👩‍🏫", "teacher", { schoolId: "s-alon", classId: "c-h2" }),
      person("t-c-d1", "אור לוי", "👨‍🏫", "teacher", { schoolId: "s-alon", classId: "c-d1" }),
      person("t-c-v1", "רונית שמש", "👩‍🏫", "teacher", { schoolId: "s-brosh", classId: "c-v1" }),
      person("t-c-h1", "יוסי חדד", "👨‍🏫", "teacher", { schoolId: "s-brosh", classId: "c-h1" }),
      person("s-k-noa", "נועה", "👧", "student", { schoolId: "s-alon", classId: "c-h2", kidId: "k-noa" }),
      person("s-k-omer", "עומר", "👦", "student", { schoolId: "s-alon", classId: "c-h2", kidId: "k-omer" }),
      person("s-k-tamar", "תמר", "👧", "student", { schoolId: "s-alon", classId: "c-d1", kidId: "k-tamar" }),
      person("s-k-ido", "עידו", "👦", "student", { schoolId: "s-brosh", classId: "c-v1", kidId: "k-ido" }),
      person("s-k-maya", "מאיה", "👧", "student", { schoolId: "s-brosh", classId: "c-h1", kidId: "k-maya" }),
      person("par-yael", "יעל ברק", "👩", "parent", { kidIds: ["k-noa", "k-tamar"], kin: "אמא" }),
      person("par-avigail", "אביגיל דהן", "👱‍♀️", "parent", { kidIds: ["k-omer"], kin: "אמא" }),
      person("par-moshe", "משה כץ", "👨", "parent", { kidIds: ["k-ido"], kin: "אבא" }),
      person("par-rina", "רינה לוי", "👩", "parent", { kidIds: ["k-itai"], kin: "אמא" }),
      person("par-adi", "עדי מור", "👩", "parent", { kidIds: ["k-maya"], kin: "אמא" })
    ];
    return pack("cast", "", "", people, schools);
  }

  function scenarios(today) {
    const day = schoolDay(today);
    const days = weekDates(today);
    const weekHomework = {};
    const weekDone = {};
    days.forEach(function (date, index) { weekHomework[date] = {}; weekDone[date] = {}; });
    weekHomework[days[0]][SUB[0]] = post("תרגילים");
    weekHomework[days[0]][SUB[1]] = post("קריאה");
    weekDone[days[0]][SUB[0]] = true;
    weekDone[days[0]][SUB[1]] = true;
    weekHomework[days[1]][SUB[0]] = post("עמ׳ 8");
    weekHomework[days[1]][SUB[1]] = none();
    weekHomework[days[2]][SUB[0]] = none();
    weekHomework[days[2]][SUB[1]] = none();
    weekHomework[days[2]][SUB[2]] = none();
    weekHomework[days[2]][SUB[3]] = none();
    weekHomework[days[2]][SUB[4]] = none();
    weekHomework[days[3]][SUB[0]] = post("עמ׳ 15");
    weekHomework[days[3]][SUB[1]] = post("חיבור");
    weekHomework[days[3]][SUB[2]] = post("יחידה 2");
    weekDone[days[3]][SUB[0]] = true;
    weekHomework[days[4]][SUB[2]] = post("עמ׳ 4");
    weekDone[days[4]][SUB[2]] = true;
    weekHomework[days[5]][SUB[0]] = post("עמ׳ 20");
    weekHomework[days[5]][SUB[1]] = post("הכתבה");
    weekDone[days[5]][SUB[1]] = true;

    const tamarDone = {};
    tamarDone[day] = {};
    tamarDone[day][SUB[3]] = true;

    return [
      pack("normal", "יום רגיל · 2 מתוך 3 הושלמו", "s-k-noa", corePeople(), [alonPair(day, normalHomework(day), normalDone(day))], "✅"),
      pack("stale", "המורה לא עדכנה", "s-k-noa", corePeople(), [alonPair(day)], "⏳"),
      pack("none", "אין שיעורים היום", "s-k-noa", corePeople(), [alonPair(day, noneDay(day))], "🚫"),
      pack("two", "הורה לשני ילדים", "par-yael", [
        person("p-s-alon", "דנה כהן", "👩", "principal", { schoolId: "s-alon" }),
        person("t-c-h2", "מיכל אביב", "👩‍🏫", "teacher", { schoolId: "s-alon", classId: "c-h2" }),
        person("t-c-d1", "אור לוי", "👨‍🏫", "teacher", { schoolId: "s-alon", classId: "c-d1" }),
        person("s-k-noa", "נועה", "👧", "student", { schoolId: "s-alon", classId: "c-h2", kidId: "k-noa" }),
        person("s-k-tamar", "תמר", "👧", "student", { schoolId: "s-alon", classId: "c-d1", kidId: "k-tamar" }),
        person("par-yael", "יעל ברק", "👩", "parent", { kidIds: ["k-noa", "k-tamar"], kin: "אמא" })
      ], [
        school("s-alon", "אלון", "דנה כהן", [
          room("c-h2", "ה'2", "מיכל אביב", [kid("k-noa", "נועה", normalDone(day))], normalHomework(day)),
          room("c-d1", "ד'1", "אור לוי", [kid("k-tamar", "תמר", tamarDone)], (function () {
            const homework = {};
            homework[day] = {};
            homework[day][SUB[3]] = post("ניסוי");
            homework[day][SUB[4]] = post("פרק א");
            return homework;
          })())
        ])
      ], "👪"),
      pack("add-class", "מנהל מוסיף כיתה", "p-s-alon", [
        person("p-s-alon", "דנה כהן", "👩", "principal", { schoolId: "s-alon" }),
        person("t-c-h2", "מיכל אביב", "👩‍🏫", "teacher", { schoolId: "s-alon", classId: "c-h2" }),
        person("s-k-noa", "נועה", "👧", "student", { schoolId: "s-alon", classId: "c-h2", kidId: "k-noa" }),
        person("par-yael", "יעל ברק", "👩", "parent", { kidIds: ["k-noa"], kin: "אמא" })
      ], [school("s-alon", "אלון", "דנה כהן", [room("c-h2", "ה'2", "מיכל אביב", [kid("k-noa", "נועה")])])], "➕"),
      pack("add-school", "מנהל מערכת מוסיף בית ספר", "admin", [
        person("admin", "נועם גל", "🧔", "admin"),
        person("p-s-alon", "דנה כהן", "👩", "principal", { schoolId: "s-alon" }),
        person("t-c-h2", "מיכל אביב", "👩‍🏫", "teacher", { schoolId: "s-alon", classId: "c-h2" }),
        person("s-k-omer", "עומר", "👦", "student", { schoolId: "s-alon", classId: "c-h2", kidId: "k-omer" }),
        person("par-avigail", "אביגיל דהן", "👱‍♀️", "parent", { kidIds: ["k-omer"], kin: "אמא" })
      ], [school("s-alon", "אלון", "דנה כהן", [room("c-h2", "ה'2", "מיכל אביב", [kid("k-omer", "עומר")])])], "🏫"),
      pack("hidden", "כיתה או בית ספר אחר לא מופיעים", "t-c-h2", [
        person("p-s-alon", "דנה כהן", "👩", "principal", { schoolId: "s-alon" }),
        person("p-s-brosh", "יואב מזרחי", "👨", "principal", { schoolId: "s-brosh" }),
        person("t-c-h2", "מיכל אביב", "👩‍🏫", "teacher", { schoolId: "s-alon", classId: "c-h2" }),
        person("t-c-d1", "אור לוי", "👨‍🏫", "teacher", { schoolId: "s-alon", classId: "c-d1" }),
        person("t-c-v1", "רונית שמש", "👩‍🏫", "teacher", { schoolId: "s-brosh", classId: "c-v1" }),
        person("s-k-noa", "נועה", "👧", "student", { schoolId: "s-alon", classId: "c-h2", kidId: "k-noa" }),
        person("s-k-tamar", "תמר", "👧", "student", { schoolId: "s-alon", classId: "c-d1", kidId: "k-tamar" }),
        person("s-k-ido", "עידו", "👦", "student", { schoolId: "s-brosh", classId: "c-v1", kidId: "k-ido" }),
        person("par-yael", "יעל ברק", "👩", "parent", { kidIds: ["k-noa", "k-tamar"], kin: "אמא" }),
        person("par-moshe", "משה כץ", "👨", "parent", { kidIds: ["k-ido"], kin: "אבא" })
      ], [
        school("s-alon", "אלון", "דנה כהן", [
          room("c-h2", "ה'2", "מיכל אביב", [kid("k-noa", "נועה")]),
          room("c-d1", "ד'1", "אור לוי", [kid("k-tamar", "תמר")])
        ]),
        school("s-brosh", "ברוש", "יואב מזרחי", [room("c-v1", "ו'1", "רונית שמש", [kid("k-ido", "עידו")])])
      ], "🙈"),
      pack("empty", "בית ספר חדש וריק", "p-s-dekel", [
        person("p-s-dekel", "רן אור", "👨", "principal", { schoolId: "s-dekel" }),
        person("par-hadas", "הדס אור", "👩", "parent", { kidIds: [], kin: "אמא" })
      ], [school("s-dekel", "דקל", "רן אור", [])], "🌱"),
      pack("week", "שבוע עם השלמה חלקית", "par-yael", [
        person("t-c-h2", "מיכל אביב", "👩‍🏫", "teacher", { schoolId: "s-alon", classId: "c-h2" }),
        person("s-k-noa", "נועה", "👧", "student", { schoolId: "s-alon", classId: "c-h2", kidId: "k-noa" }),
        person("par-yael", "יעל ברק", "👩", "parent", { kidIds: ["k-noa"], kin: "אמא" })
      ], [school("s-alon", "אלון", "דנה כהן", [room("c-h2", "ה'2", "מיכל אביב", [kid("k-noa", "נועה", weekDone)], weekHomework)])], "📅"),
      (function () {
        const homework = {};
        homework[day] = {};
        homework[day][SUB[0]] = { mode: "post", text: "תרגיל 4", photo: BOARD_PHOTO, voice: BOARD_VOICE };
        const built = alonPair(day, homework);
        const table = weekTable();
        table["5"] = [SUB[0], SUB[1], "אמנות", "", "", ""];
        built.classrooms[0].timetable = table;
        return pack("board", "מורה מצלמת לוח", "t-c-h2", corePeople(), [built], "📷");
      })(),
      (function () {
        const built = alonPair(day, normalHomework(day), normalDone(day));
        built.classrooms[0].messages = [
          { id: "m-class", text: "מבחן ביום ד׳", photo: "", voice: "", audience: "class", alert: false, at: 1000, bump: 1000, edited: false },
          { id: "m-parents", text: "שיחת הורים מחר", photo: "", voice: "", audience: "parents", alert: true, at: 2000, bump: 2000, edited: false }
        ];
        return pack("parents-msg", "הודעה להורים בלבד", "t-c-h2", corePeople(), [built], "💬");
      })(),
      (function () {
        const built = alonPair(day, normalHomework(day), normalDone(day));
        built.classrooms[0].messages = [
          { id: "m-old", text: "הטיול נדחה ליום ג׳", photo: "", voice: "", audience: "class", alert: true, at: 1000, bump: 4000, edited: true },
          { id: "m-new", text: "להביא ספר", photo: "", voice: "", audience: "class", alert: false, at: 3000, bump: 3000, edited: false }
        ];
        return pack("bump-msg", "עדכון והקפצת הודעה", "t-c-h2", corePeople(), [built], "📌");
      })()
    ];
  }

  function parentCaption(who, state) {
    if (!who || who.role !== "parent") return "";
    const names = [];
    (who.kidIds || []).forEach(function (id) {
      const found = findKid(state, id);
      if (found) names.push(found.kid.firstName);
    });
    if (!names.length) return "";
    const kids = names.length === 1 ? names[0] : names.slice(0, -1).join(", ") + " ו" + names[names.length - 1];
    return (who.kin || "הורה") + " של " + kids;
  }
  function scenarioById(id, today) {
    if (id && id !== "cast") {
      const found = scenarios(today).find(function (item) { return item.id === id; });
      if (found) return found;
    }
    return cast(today);
  }
  function liveView(state, date) {
    const day = schoolDay(date);
    const schools = ((state && state.schools) || []).map(function (item) {
      const classes = (item.classrooms || []).map(function (room) {
        const rows = S.rowsFor(room, day, null);
        const kids = (room.kids || []).map(function (kid) {
          const done = S.rowsFor(room, day, kid).filter(function (row) { return row.done; }).length;
          return { id: kid.id, name: kid.firstName, done: done };
        });
        return {
          id: room.id,
          name: room.name,
          kidCount: kids.length,
          posted: rows.filter(function (row) { return row.status === "posted"; }).length,
          notUpdated: rows.filter(function (row) { return row.status === "not-updated"; }).length,
          none: rows.filter(function (row) { return row.status === "no-homework"; }).length,
          done: kids.reduce(function (sum, kid) { return sum + kid.done; }, 0),
          kids: kids
        };
      });
      return {
        id: item.id,
        name: item.name,
        classCount: classes.length,
        kidCount: classes.reduce(function (sum, room) { return sum + room.kidCount; }, 0),
        classes: classes
      };
    });
    return { date: day, schools: schools };
  }

  return {
    weekDates: weekDates,
    schoolDay: schoolDay,
    cast: cast,
    scenarios: scenarios,
    scenarioById: scenarioById,
    liveView: liveView,
    parentCaption: parentCaption,
    findSchool: findSchool,
    findClass: findClass,
    findKid: findKid,
    personActor: personActor,
    schoolsFor: schoolsFor,
    classesFor: classesFor
  };
});
