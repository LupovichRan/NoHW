# Security policy

## Reporting a vulnerability

Report security issues privately through [GitHub Security Advisories](https://github.com/LupovichRan/NoHW/security/advisories/new).

Do not open a public issue for an undisclosed vulnerability. Leave out secrets, access tokens, and personal data. Include the impact and a way to reproduce the problem.

דיווח על בעיית אבטחה: באופן פרטי דרך GitHub Security Advisories, לא ב-issue ציבורי, ובלי סודות או מידע אישי.

## Supported versions

Security fixes are applied on `main`. This repository is a static demo. The site files live in `dist/`, and there is no server or account system in this tree.

## Scope

The app runs in the browser and keeps demo data on the device. There is no dependency manifest here. Third-party libraries are pinned CDN URLs in the web workers.
