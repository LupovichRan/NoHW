# QA and security report — simple

Date: 23 October 2026. Build under test is the `simple` branch, the Hebrew PWA in `simple/`. Nothing was merged. This is a POC for one phone: vanilla JS, localStorage, and IndexedDB. No accounts, no sync, and no backend.

The report covers the final build. After a character is chosen, the home is the avatar conversation: the face on top and a Hebrew RTL bubble feed below. A short scored list in `simple/lead.js` opens the two to four cards that fit the role, the time of day, and the data. Old dashboards (the teacher tiles, the principal stats home, the admin lists, the student and parent screens) appear only when the avatar shares them, as compact widgets with `פתח מסך מלא`. A chip starts an existing composer as a sheet and returns to the chat with a confirmation bubble. A small `☰` menu is the fallback to any full screen. There is no tab bar and no tile grid. Setup-incomplete users see the setup wizard first.

The same assistant, עוזר הכיתה, still answers only from data already on the device, walks setup, and speaks the lines in `simple/avatar-he.js` (listed in `docs/avatar-hebrew-lines.md`). Read-aloud stays off until turned on. A big microphone listens in Hebrew and sends the transcript through the same path as typed text. Hands-free mode speaks the answer, then listens again until a timeout. Dictation fills homework text, message text, and kid lists. `simple/speech.js` is two small fallbacks: Web Speech he-IL, or a note that typing still works; a local clip `simple/voice/{id}.mp3` when that file exists, or the device voice. The clips are not in this commit. Generate them on the machine that holds the key, from the repo root: `AZURE_SPEECH_KEY='…' AZURE_SPEECH_REGION=northeurope node tools/gen-voice.mjs`. Then commit `simple/voice/*.mp3` and `simple/voice/hashes.json`. The key stays out of the repo and the client. A remote recognizer is a one-line TODO, not a client. Browser speech recognition may send audio to the browser vendor, and a teacher can turn the student microphone off for a class. It does not call a language model. A change waits for כן. A reminder arrives as a new bubble in the feed plus a notification while the app is open. A reliable background push still needs a backend later.

Earlier product work is still in this build: scoped live data, specific media errors, a one-tap teacher day, renamed labels, self-hosted Rubik, the three-minute principal scenario, and profile photos.

## How it was run

- Logic and demo tests: `node tests/simple.cjs`, `node tests/simple-demo.cjs`, `node tests/media.cjs`, `node tests/assist.cjs`, `node tests/setup.cjs`, `node tests/speak-he.cjs`, `node tests/lead.cjs`, `node tests/speech.cjs`.
- Browser walk at 390×844 in headless Chromium: `node tests/e2e/walk.mjs` against a local static server. 62 product checks passed, 0 failed. WebKit is not installed in this environment, so that browser was not run.
- axe-core on the start hub, the principal avatar home, the timetable, a student day, the message list, the profile sheet, the avatar conversation as a student, a parent, and a principal, and the teacher setup screen (the lead home). No serious or critical violations.
- Lighthouse mobile, local server, two runs, both the same: performance 85, accessibility 100, best practices 100 (Lighthouse 12). PWA 100 (Lighthouse 11.7, the last release that still scores PWA). The performance score is first-contentful-paint on this static server (render-blocking CSS, no gzip). The scripts were not minified.
- gitleaks 8.28.0 on the current tree, no leaks. `npm audit` in `tests/e2e` reported 0 vulnerabilities.

## Pass / fail

| Check | Result |
| --- | --- |
| יום רגיל · 2 מתוך 3 הושלמו | Pass |
| המורה לא עדכנה | Pass |
| אין שיעורים היום | Pass |
| הורה לשני ילדים | Pass |
| מנהל מוסיף כיתה | Pass |
| מנהל מערכת מוסיף בית ספר | Pass |
| כיתה או בית ספר אחר לא מופיעים | Pass |
| בית ספר חדש וריק | Pass |
| שבוע עם השלמה חלקית | Pass |
| מורה מצלמת לוח | Pass |
| הודעה להורים בלבד | Pass |
| עדכון והקפצת הודעה | Pass |
| הדגמה למנהל/ת – 3 דקות | Pass |
| שיחה עם עוזר הכיתה | Pass |
| הקמת בית ספר עם העוזר | Pass |
| Character switching and the people filters | Pass |
| Start screen: תרחישים, נתונים חיים, דמויות | Pass |
| Scenario reset returns the seeded data | Pass |
| Add, edit, and delete below the actor's level | Pass |
| A teacher does not see another class; a principal does not see another school | Pass |
| Student and parent live data shows only their own kid(s), not the all-schools tree | Pass |
| Principal and teacher live data is limited to their school or class | Pass |
| Presenter נתונים חיים on the start screen still shows every school | Pass |
| Timetable (לו״ז שיעורים), including a custom subject | Pass |
| Homework text, a large JPEG, and two recordings | Pass |
| שמור והבא moves to the next unposted subject; 0/5 progress; אין שיעורים היום | Pass |
| אין שיעורים is distinct from לא עודכן | Pass |
| Class message vs parents-only; a student does not see the parents-only note | Pass |
| Alert banner, edit, bump, and delete cancelled | Pass |
| RTL (`dir=rtl`) and no horizontal overflow on every scenario | Pass |
| Manifest, service worker, and a reload while offline | Pass |
| axe-core, no serious or critical issues | Pass |
| Lighthouse performance / accessibility / best practices / PWA | 85 / 100 / 100 / 100 |
| WebKit | Not run. The browser is not installed here. |
| XSS payloads in a school name, a student name, homework text, a transcript, and a custom subject stay as text | Pass |
| Content-Security-Policy and referrer policy | Pass |
| `#pack=` and JSON import: schema, 100,000-character cap, `__proto__` and `constructor` dropped | Pass |
| Media types and size caps; SVG board seeds still display; `javascript:` and audio-as-photo are dropped | Pass |
| gitleaks | Pass, no leaks |
| npm audit of the e2e dev dependencies | Pass, 0 vulnerabilities |
| No third-party requests during the walk | Pass |
| Speech screen says the browser may use its own speech service, and that recognition may send audio to the browser vendor | Pass |
| A simulated transcript follows the same intent path as typed text, including כן and לא | Pass |
| `נועה, תמר, אורי` stays three kid names, and the wizard confirm lists those three | Pass |
| Speech fallback: Web Speech when the browser has it, otherwise typing. A known line plays `voice/{id}.mp3` when the file exists, otherwise the device voice. No remote speech client and no key in the repo | Pass |
| Hands-free mode speaks, then listens, then goes idle on timeout. One tap listens once and stops | Pass |
| A teacher can turn the class microphone off for students. A student cannot change that setting | Pass |
| Profile photo: set, remove, emoji fallback, teacher may set a student, student cannot set someone else | Pass |
| Profile photos stay out of a normal `#pack=` and are included only when a profile export is requested | Pass |
| Service worker cache stays on the app's own directory | Pass |
| Class assistant: each chip and the common phrasings map to one intent, and the answers match the seeded class | Pass |
| A student does not receive another child's details, and a student does not see parents-only messages | Pass |
| An unknown question returns «אני יודע רק מה שקשור לכיתה 😊» and the suggestion chips | Pass |
| Chat text is set with `textContent`; an HTML payload in a question stays text and does not run | Pass |
| A reminder draft fills the composer and is not sent until the teacher sends it | Pass |
| Principal and admin class drill-down reports counts only, with no child names | Pass |
| Assistant questions are kept in memory for the session and are not written to localStorage | Pass |
| Proactive digest: student, parent, teacher, principal, and admin cards match the seeded class, in priority order, and omit other children | Pass |
| Reminder rules fire only for unfinished homework or unposted subjects, and a typed time creates a custom reminder | Pass |
| Relevance engine: the top cards for the seeded student, parent, teacher, principal, and admin match the role and the injected time of day | Pass |
| A card already seen today stays hidden until its data changes | Pass |
| Embedded cards render only the actor's allowed data. A student or parent never sees another class or the all-schools tree | Pass |
| `פתח מסך מלא` opens the existing screen, and `חזרה` returns to the chat | Pass |
| A teacher chip posts homework from the avatar. Saving returns `שמרתי את השיעור.` and the subject is posted | Pass |
| `אין שיעורים` from the avatar marks the day's subjects as no homework | Pass |
| Setup-incomplete users get the setup wizard as the home, before daily cards | Pass |
| The `☰` menu is closed until opened, and it reaches the full screens | Pass |
| A due reminder is a new avatar bubble in the feed, plus the in-app banner and a notification | Pass |
| An in-app reminder banner and a service-worker notification show for the demo trigger; the screen says background push needs a backend | Pass |
| Setup wizards add a school, classes, a teacher, kids, a parent, and the class avatar only after כן | Pass |
| A principal cannot add a school from the assistant, and a teacher cannot add a class | Pass |
| A range such as ד׳1-ד׳3 and a pasted list of names become separate entities | Pass |
| The avatar shows setup progress until the checklist is complete, then the daily digest returns | Pass |
| Digest, answers, reminders, setup steps, and confirmations are RTL Hebrew bubbles with a tail, a typing indicator, and the person's reply on the other side. Read-aloud uses he-IL | Pass |
| Avatar lines are in `simple/avatar-he.js`. Spoken text expands grades, hours, and numbers, strips emoji, and is not shown with niqqud. Students start muted | Pass |

## Bugs found and fixed

1. Live data inside a character showed every school. It is now scoped: an admin sees every school, a principal their school, a teacher their class, and a student or parent only their own kid(s). The all-schools view stays on the start screen, and it is not linked from the scenario list.
2. A failed save, a bad file, and a missing name all said חסר. The screen now says אין הרשאה, חסר שם, חסר תוכן, הקובץ גדול מדי, סוג קובץ לא נתמך, or האחסון מלא.
3. The page loaded Rubik from Google Fonts, and the service worker cached those responses. Rubik Hebrew and Latin woff2 files now live in `simple/fonts/` with `font-display: swap`. The worker ignores any other origin and any path outside its own directory (`/NoHW/simple/` on GitHub Pages).
4. There was no Content-Security-Policy and no referrer policy. `index.html` now sets `default-src 'self'`, allows `data:` and `blob:` only for images and media, and sets `no-referrer`. There are no inline scripts.
5. `decodePack` and `importPack` trusted the JSON. They now rebuild the object without `__proto__`, `constructor`, or `prototype`, cap the token at 100,000 characters, and keep only known message and timetable fields. Photo slots accept image data or a short id. Voice slots accept audio data or a short id.
6. Photos and recordings had no size or type check before they were stored. An image must be `image/*` (or a known image extension) and at most 15 MB. A recording must be audio (or `video/webm` from a recorder) and at most 4 MB. Removing a clip still revokes its object URL.
7. Lighthouse's PWA score was 88 because the manifest had no maskable icon. The padded app icons are now also declared as maskable. The score is 100.
8. The principal opened straight into class management, the teacher day had no whole-day clear and no save-and-next, and several labels still said מערכת, נתונים, or מנהל. Those are the approved product changes, and the checks above were run after them.
9. People had only emoji avatars. Each person can now keep a square 256px profile photo in IndexedDB. You can change your own photo, and someone above you can change a person below them. A normal share pack does not include those photos.
10. A parent's done mark was a `span` with `aria-label`, which axe rejects on a generic element. It is now `role="img"`, so the name is allowed and the chat sheet can sit on top of that screen without a serious violation.
11. The avatar badge showed a count while the button name was only «עוזר הכיתה», which axe reports as a name mismatch. That badge is gone: the conversation is the home, so there is no floating button to name.
12. The lead chat log was a scrollable region with no keyboard access. axe flagged it on the teacher setup screen. The log now has `tabindex="0"`, and that check passes.

## Remaining risks

| Risk | Severity | Notes |
| --- | --- | --- |
| Web Speech may send audio to the browser's own speech service | Medium | The app does not upload homework or chat text. Recording, read-aloud, and the microphone use the browser's speech APIs. The chat says recognition may send audio to the browser vendor. A teacher can turn the student microphone off per class. Hebrew pronunciation is only as good as the installed he-IL voice. |
| Read-aloud quality varies by device | Low | Fixed lines play a local Hila clip after `tools/gen-voice.mjs` has been run. Until those mp3 files are pushed, and for any line that includes a name or homework text, the picker uses speechSynthesis he-IL. |
| A `#pack=` link can still change the local demo | Low | The pack cannot run code or pollute prototypes. It can merge names and homework into the on-device demo, which has no accounts. |
| Most of the page is drawn with `innerHTML` | Low | User-entered strings go through `esc()`. The lead cards, widgets, chips, confirmation bubbles, assistant chat, reminder banner, notification card, and setup confirmations set questions, answers, and names with `textContent`. A later edit that interpolates a field without `esc()` would be an XSS bug. The CSP blocks injected scripts. |
| Reminders do not arrive if the app is closed | Low | Times are stored on the device and checked with `setTimeout` while the app is open, plus a catch-up when it opens. The reminder settings and the demo script say a reliable background push needs a backend later. |
| WebKit was not executed here | Low | Chromium at 390×844 passed, including the camera file input and the recording bar. A real iPhone pass is still the check for Safari's camera picker. |
| The service worker caches later same-origin GETs inside its directory | Low | It does not cache other origins, and it does not cache the rest of `/NoHW/`. |

## Post-POC

Left out on purpose: a sync backend, accounts, real background push, multi-device use, and scale. Reminders fire only while the app is open. A remote recognizer, and a live voice for sentences that include a name or homework text, stay out. Hebrew only. Error text, offline cache, and Lighthouse are enough for the phone demo, not a production pass.
