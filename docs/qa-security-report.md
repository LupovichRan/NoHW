# QA and security report — simple

Date: 23 October 2026. Build under test is the `simple` branch, the Hebrew PWA in `simple/`. Nothing was merged.

The report covers the build after the approved product changes: a principal home with today's class numbers, live data scoped to the signed-in character, specific media errors, a one-tap teacher day, the renamed labels, a self-hosted Rubik font, and the three-minute principal scenario.

## How it was run

- Logic and demo tests: `node tests/simple.cjs`, `node tests/simple-demo.cjs`, `node tests/media.cjs`.
- Browser walk at 390×844 in headless Chromium: `node tests/e2e/walk.mjs` against a local static server. 42 checks passed, 0 failed. WebKit is not installed in this environment, so that browser was not run.
- axe-core on the start hub, the principal home, the timetable, a student day, and the message list. No serious or critical violations.
- Lighthouse mobile, local server: performance 97, accessibility 100, best practices 100 (Lighthouse 12). PWA 100 (Lighthouse 11.7, the last release that still scores PWA).
- gitleaks 8.28.0 on the workspace, no leaks. `npm audit` in `tests/e2e` reported 0 vulnerabilities.

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
| Lighthouse performance / accessibility / best practices / PWA | 96 / 100 / 100 / 100 |
| WebKit | Not run. The browser is not installed here. |
| XSS payloads in a school name, a student name, homework text, a transcript, and a custom subject stay as text | Pass |
| Content-Security-Policy and referrer policy | Pass |
| `#pack=` and JSON import: schema, 100,000-character cap, `__proto__` and `constructor` dropped | Pass |
| Media types and size caps; SVG board seeds still display; `javascript:` and audio-as-photo are dropped | Pass |
| gitleaks | Pass, no leaks |
| npm audit of the e2e dev dependencies | Pass, 0 vulnerabilities |
| No third-party requests during the walk | Pass |
| Speech screen says the browser may use its own speech service | Pass |
| Profile photo: set, remove, emoji fallback, teacher may set a student, student cannot set someone else | Pass |
| Profile photos stay out of a normal `#pack=` and are included only when a profile export is requested | Pass |
| Service worker cache stays on the app's own directory | Pass |

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

## Remaining risks

| Risk | Severity | Notes |
| --- | --- | --- |
| Web Speech may send audio to the browser's own speech service | Medium | The app does not upload homework. The recording screen says the browser may use its own speech service. Turning transcription off would remove the risk and also the transcript. |
| A `#pack=` link can still change the local demo | Low | The pack cannot run code or pollute prototypes. It can merge names and homework into the on-device demo, which has no accounts. |
| The page is drawn with `innerHTML` | Low | User-entered strings go through `esc()`. Scenario emoji are catalog data, not typed input. A later edit that interpolates a field without `esc()` would be an XSS bug. The CSP blocks injected scripts. |
| WebKit was not executed here | Low | Chromium at 390×844 passed, including the camera file input and the recording bar. A real iPhone pass is still the check for Safari's camera picker. |
| The service worker caches later same-origin GETs inside its directory | Low | It does not cache other origins, and it does not cache the rest of `/NoHW/`. |
