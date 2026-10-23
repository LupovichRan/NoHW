const CACHE = "nohw-simple-v10";
const SHELL = ["./","index.html","app.css","app.js","logic.js","demo.js","media.js","manifest.webmanifest","icon-192.png","icon-512.png"];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); }));
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) { return key.indexOf("nohw-simple-") === 0 && key !== CACHE; }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  const host = new URL(event.request.url).host;
  if (host === "fonts.googleapis.com" || host === "fonts.gstatic.com") {
    event.respondWith(caches.open(CACHE).then(function (cache) {
      return cache.match(event.request).then(function (hit) {
        const fresh = fetch(event.request).then(function (response) {
          if (response && response.ok) cache.put(event.request, response.clone());
          return response;
        }).catch(function () { return hit; });
        return hit || fresh;
      });
    }));
    return;
  }
  event.respondWith(fetch(event.request).then(function (response) {
    const copy = response.clone();
    caches.open(CACHE).then(function (cache) { cache.put(event.request, copy); });
    return response;
  }).catch(function () {
    return caches.match(event.request).then(function (hit) { return hit || caches.match("./index.html"); });
  }));
});
