# Contributing

Nohomework is a Hebrew-first homework board. This branch is a static, local-first pilot in `dist/`. There is no database and no account system.

- Open an issue or a pull request for bugs and small improvements. The interface is Hebrew first; English, Russian, and Arabic strings live in `dist/translations.js`.
- Run `cd dist && python3 -m http.server 8099` and `for t in tests/*.cjs; do node "$t" || exit 1; done` before sending a change.
- Demo people in `dist/classes.js` are fictional. Do not add real student, parent, or teacher names, phone numbers, or ID numbers.
- Do not commit secrets, `.env` files, service-role keys, or access tokens. The app is meant to stay deployable as static files.
