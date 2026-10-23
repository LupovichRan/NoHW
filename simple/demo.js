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
  function room(id, name, teacher, kids, homework) {
    return { id: id, name: name, teacherName: teacher, teacherCode: code(id + ":t"), homework: homework || {}, kids: kids || [] };
  }
  function school(id, name, principal, rooms) {
    return { id: id, name: name, principalName: principal, principalCode: code(id + ":s"), classrooms: rooms || [] };
  }
  function person(id, name, emoji, role, extra) {
    return Object.assign({ id: id, name: name, emoji: emoji, role: role }, extra || {});
  }
  function pack(id, title, personId, people, schools) {
    return { id: id, title: title, personId: personId, people: people, state: { v: 1, schools: schools } };
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
      person("par-yael", "יעל ברק", "👩", "parent", { kidIds: extra || ["k-noa"] })
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
      person("par-yael", "יעל ברק", "👩", "parent", { kidIds: ["k-noa", "k-tamar"] }),
      person("par-avigail", "אביגיל דהן", "👱‍♀️", "parent", { kidIds: ["k-omer"] }),
      person("par-moshe", "משה כץ", "👨", "parent", { kidIds: ["k-ido"] })
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
      pack("normal", "יום רגיל · 2 מתוך 3 הושלמו", "s-k-noa", corePeople(), [alonPair(day, normalHomework(day), normalDone(day))]),
      pack("stale", "המורה לא עדכנה", "s-k-noa", corePeople(), [alonPair(day)]),
      pack("none", "אין שיעורים היום", "s-k-noa", corePeople(), [alonPair(day, noneDay(day))]),
      pack("two", "הורה לשני ילדים", "par-yael", [
        person("p-s-alon", "דנה כהן", "👩", "principal", { schoolId: "s-alon" }),
        person("t-c-h2", "מיכל אביב", "👩‍🏫", "teacher", { schoolId: "s-alon", classId: "c-h2" }),
        person("t-c-d1", "אור לוי", "👨‍🏫", "teacher", { schoolId: "s-alon", classId: "c-d1" }),
        person("s-k-noa", "נועה", "👧", "student", { schoolId: "s-alon", classId: "c-h2", kidId: "k-noa" }),
        person("s-k-tamar", "תמר", "👧", "student", { schoolId: "s-alon", classId: "c-d1", kidId: "k-tamar" }),
        person("par-yael", "יעל ברק", "👩", "parent", { kidIds: ["k-noa", "k-tamar"] })
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
      ]),
      pack("add-class", "מנהל מוסיף כיתה", "p-s-alon", [
        person("p-s-alon", "דנה כהן", "👩", "principal", { schoolId: "s-alon" }),
        person("t-c-h2", "מיכל אביב", "👩‍🏫", "teacher", { schoolId: "s-alon", classId: "c-h2" }),
        person("s-k-noa", "נועה", "👧", "student", { schoolId: "s-alon", classId: "c-h2", kidId: "k-noa" })
      ], [school("s-alon", "אלון", "דנה כהן", [room("c-h2", "ה'2", "מיכל אביב", [kid("k-noa", "נועה")])])]),
      pack("add-school", "מנהל מערכת מוסיף בית ספר", "admin", [
        person("admin", "נועם גל", "🧔", "admin"),
        person("p-s-alon", "דנה כהן", "👩", "principal", { schoolId: "s-alon" }),
        person("t-c-h2", "מיכל אביב", "👩‍🏫", "teacher", { schoolId: "s-alon", classId: "c-h2" }),
        person("s-k-omer", "עומר", "👦", "student", { schoolId: "s-alon", classId: "c-h2", kidId: "k-omer" })
      ], [school("s-alon", "אלון", "דנה כהן", [room("c-h2", "ה'2", "מיכל אביב", [kid("k-omer", "עומר")])])]),
      pack("hidden", "כיתה או בית ספר אחר לא מופיעים", "t-c-h2", [
        person("p-s-alon", "דנה כהן", "👩", "principal", { schoolId: "s-alon" }),
        person("p-s-brosh", "יואב מזרחי", "👨", "principal", { schoolId: "s-brosh" }),
        person("t-c-h2", "מיכל אביב", "👩‍🏫", "teacher", { schoolId: "s-alon", classId: "c-h2" }),
        person("t-c-d1", "אור לוי", "👨‍🏫", "teacher", { schoolId: "s-alon", classId: "c-d1" }),
        person("t-c-v1", "רונית שמש", "👩‍🏫", "teacher", { schoolId: "s-brosh", classId: "c-v1" }),
        person("s-k-noa", "נועה", "👧", "student", { schoolId: "s-alon", classId: "c-h2", kidId: "k-noa" }),
        person("s-k-tamar", "תמר", "👧", "student", { schoolId: "s-alon", classId: "c-d1", kidId: "k-tamar" }),
        person("s-k-ido", "עידו", "👦", "student", { schoolId: "s-brosh", classId: "c-v1", kidId: "k-ido" })
      ], [
        school("s-alon", "אלון", "דנה כהן", [
          room("c-h2", "ה'2", "מיכל אביב", [kid("k-noa", "נועה")]),
          room("c-d1", "ד'1", "אור לוי", [kid("k-tamar", "תמר")])
        ]),
        school("s-brosh", "ברוש", "יואב מזרחי", [room("c-v1", "ו'1", "רונית שמש", [kid("k-ido", "עידו")])])
      ]),
      pack("empty", "בית ספר חדש וריק", "p-s-dekel", [
        person("p-s-dekel", "רן אור", "👨", "principal", { schoolId: "s-dekel" })
      ], [school("s-dekel", "דקל", "רן אור", [])]),
      pack("week", "שבוע עם השלמה חלקית", "par-yael", [
        person("t-c-h2", "מיכל אביב", "👩‍🏫", "teacher", { schoolId: "s-alon", classId: "c-h2" }),
        person("s-k-noa", "נועה", "👧", "student", { schoolId: "s-alon", classId: "c-h2", kidId: "k-noa" }),
        person("par-yael", "יעל ברק", "👩", "parent", { kidIds: ["k-noa"] })
      ], [school("s-alon", "אלון", "דנה כהן", [room("c-h2", "ה'2", "מיכל אביב", [kid("k-noa", "נועה", weekDone)], weekHomework)])])
    ];
  }

  return {
    weekDates: weekDates,
    schoolDay: schoolDay,
    cast: cast,
    scenarios: scenarios,
    findSchool: findSchool,
    findClass: findClass,
    findKid: findKid,
    personActor: personActor,
    schoolsFor: schoolsFor,
    classesFor: classesFor
  };
});
