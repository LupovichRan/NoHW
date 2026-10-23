# Nohomework v1 (demo)

A small Hebrew, RTL, phone-first PWA for parents of a 4th grader. It turns class WhatsApp posts into one evening list: what to bring tomorrow, tomorrow's timetable, homework, notices, parent actions, and anything that needs confirmation.

This is a proof of concept. There are no accounts, and the code is not production-hardened. It lives in `v1/` and does not touch the main app or its GitHub Pages deploy.

## What it does

- **Input**
  - Paste a forwarded post.
  - Add photos with a caption.
  - Share from WhatsApp on Android. The manifest `share_target` sends the share to the service worker, which posts to `./share-target`.
  - Import a WhatsApp chat export (`.zip` or `.txt`), for example to backfill a class. The file is read on the device.
- **Extraction** (`lib/core.js`, `lib/gemini.js`, `api/extract.js`)
  - Item types: bring, timetable, homework, notice, change, parent action, plus a *needs confirmation* flag.
  - Due dates are resolved without guessing, from the post date and the class timetable set up once: מחר, היום, ביום ראשון, explicit dates like 18.10.26, and לשיעור הבא (the next lesson of that subject).
  - Photo bursts are linked to their caption.
  - Lesson-note photos (a caption that is only a subject) are dropped.
  - A photo with no caption, homework with no subject, or conflicting dates are marked **צריך אישור** (needs confirmation) instead of guessed.
  - Two extractors sit behind one interface:
    - `gemini`: used when `GEMINI_API_KEY` is set on the server. The model classifies and extracts. Dates are still resolved deterministically by `resolveHint`.
    - `rules`: the built-in Hebrew rules, used by default and as the fallback. The browser also falls back to them when offline.
  - The key is never sent to the client. It is only read inside `api/extract.js`.
- **Output**
  - The **ערב** view for the next school day.
  - The **בוקר** "what to bring today" view.
  - Mark-done, shared between guardians by an 8-character family code or link (`?family=CODE`). The item shows who marked it, for example "✓ אבא 21:04".
- **Privacy**
  - Photos are resized and kept in the browser's IndexedDB only.
  - The family store only holds item text and done-state.
  - Photos are sent to the extractor only when the Gemini provider is on. They are not stored there.

## Run locally

```bash
cd v1
node server.mjs            # http://localhost:8787  (file store in .family-store.json)
node --test tests/          # unit tests for extraction, dates, WhatsApp parsing, zip, merge
node tests/e2e.mjs /tmp/shots   # Playwright at 390x844, synthetic data only (needs playwright-core + Chrome)
```

To try it, open Settings and choose **טעינת נתוני דוגמה** (load demo data). The demo data is fully synthetic.

## Deploy (Vercel)

1. Set the project root to `v1/`. No build step is needed. Vercel serves the static files and treats `api/*.js` as Node functions.
2. Set these environment variables in the Vercel project. None of them are committed.

| Var | Needed for | Notes |
| --- | --- | --- |
| `SUPABASE_URL`, `SUPABASE_KEY` | family sync | `SUPABASE_KEY` is the project's *publishable* key. Run `supabase.sql` once. Without these, the store falls back to memory, so sync is not durable. |
| `GEMINI_API_KEY` | AI extraction, including photos | Optional. Without it, the rules extractor is used. |
| `GEMINI_MODEL` | | Optional. The default is `gemini-2.5-flash`. |

## Files

| File | Contents |
| --- | --- |
| `index.html`, `styles.css`, `app.js` | The UI |
| `sw.js` | Offline shell and the share target |
| `manifest.webmanifest` | PWA manifest |
| `lib/core.js` | Dates, Hebrew rules extractor, burst linking, WhatsApp parser, tiny zip reader |
| `lib/gemini.js` | Gemini provider (server only) |
| `lib/merge.js` | Family doc merge (last writer wins per item) |
| `lib/store.js` | Supabase, file, or memory store |
| `api/extract.js`, `api/family.js` | Serverless functions |
| `seed/` | Synthetic demo posts and generated notebook images. They contain no real people or messages. |

Real class exports must never be committed here. The repo's `.gitignore` already excludes `*.zip`.
