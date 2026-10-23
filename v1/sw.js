// Service worker: offline shell + Web Share Target (POST ./share-target). Shared photos stay on the device.
const CACHE = "nohw-v1-8";
const SHELL = ["./", "index.html", "app.js", "styles.css", "lib/core.js", "lib/merge.js", "seed/synthetic.js", "manifest.webmanifest", "icons/icon.svg", "icons/icon-192.png"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())));

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("nohw", 1);
    r.onupgradeneeded = () => { r.result.createObjectStore("photos"); r.result.createObjectStore("shares"); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function saveShare(form) {
  const files = form.getAll("media").filter((f) => f && f.size);
  const share = { title: form.get("title") || "", text: form.get("text") || "", url: form.get("url") || "", files, at: Date.now() };
  const db = await idb();
  await new Promise((res, rej) => { const tx = db.transaction("shares", "readwrite"); tx.objectStore("shares").put(share, "pending"); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
}
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === "POST" && url.pathname.endsWith("/share-target")) {
    e.respondWith((async () => { await saveShare(await e.request.formData()); return Response.redirect(new URL("./?share=1#add", self.registration.scope).href, 303); })());
    return;
  }
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/api/")) return;
  e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
