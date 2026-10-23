const CACHE = "nohw-simple-v20";
const SHELL = ["./","index.html","app.css","app.js","logic.js","avatar-he.js","speak-he.js","assistant.js","setup.js","lead.js","demo.js","media.js","manifest.webmanifest","icon-192.png","icon-512.png","fonts/rubik-hebrew-400-normal.woff2","fonts/rubik-hebrew-500-normal.woff2","fonts/rubik-hebrew-600-normal.woff2","fonts/rubik-hebrew-700-normal.woff2","fonts/rubik-latin-400-normal.woff2","fonts/rubik-latin-500-normal.woff2","fonts/rubik-latin-600-normal.woff2","fonts/rubik-latin-700-normal.woff2"];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key.indexOf("nohw-simple-") === 0 && key !== CACHE; }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("message", function (event) {
  const data = event.data || {};
  if (data.type !== "remind") return;
  const title = String(data.title || "עוזר הכיתה").slice(0, 80);
  const body = String(data.body || "").slice(0, 180);
  event.waitUntil(self.registration.showNotification(title, { body: body, lang: "he", dir: "rtl", tag: "nohw-remind" }));
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const scopePath = new URL("./", self.location).pathname;
  if (url.origin !== self.location.origin || url.pathname.indexOf(scopePath) !== 0) return;
  event.respondWith(fetch(event.request).then(function (response) {
    const copy = response.clone();
    caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
    return response;
  }).catch(function () {
    return caches.match(event.request).then(function (hit) { return hit || caches.match("./index.html"); });
  }));
});
