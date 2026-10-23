/* Offline app shell and the CDN libraries used for teacher voice and OCR.
   There is no push handler: reminders are local, while the app is open or installed. */
/* Shell paths are relative to this script, so a worker at /NoHW/sw.js stays inside /NoHW/. */
const CACHE='nohomework-v1.5.1';
const SHELL=[
 './','./index.html','./privacy.html','./accessibility.html','./manifest.webmanifest',
 './theme.css','./a11y.css','./mobile.css','./calm.css','./pilot.css','./light.css',
 './version.js','./translations.js','./translations-extra.js','./translations-pilot.js','./i18n.js',
 './poc-config.js','./cloud-stub.js','./classes.js','./lesson-summary.js','./ai-explanation.js','./ai-explanation-worker.js',
 './resources.js','./app.js','./ocr.js','./questions.js','./school-notifications.js','./admin.js','./materials.js',
 './assistant.js','./home.js','./tabs.js','./roles.js','./permissions.js','./management.js','./a11y.js',
 './pilot-model.js','./pilot-ui.js','./pwa.js','./transcription-worker.js','./sw.js',
 './icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png','./icons/apple-touch-icon.png'
];
const CDN=[
 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/+esm',
 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.2/+esm',
 'https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&display=swap'
];
const CDN_HOSTS=new Set(['cdn.jsdelivr.net','fonts.googleapis.com','fonts.gstatic.com']);

self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.all(SHELL.map(url=>cache.add(url).catch(()=>{})));
  await Promise.all(CDN.map(url=>cache.add(url).catch(()=>{})));
  await self.skipWaiting();
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const req=event.request;if(req.method!=='GET')return;
 const url=new URL(req.url);
 if(CDN_HOSTS.has(url.host)){
  event.respondWith((async()=>{
   const cache=await caches.open(CACHE);
   const hit=await cache.match(req);
   const fresh=fetch(req).then(response=>{if(response&&(response.ok||response.type==='opaque'))cache.put(req,response.clone());return response}).catch(()=>hit);
   return hit||fresh;
  })());
  return;
 }
 if(url.origin!==location.origin)return;
 if(req.mode==='navigate'){
  event.respondWith(fetch(req).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy));return response}).catch(()=>caches.match(req).then(hit=>hit||caches.match('./index.html'))));
  return;
 }
 event.respondWith(caches.match(req).then(hit=>{
  const fresh=fetch(req).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(req,copy))}return response}).catch(()=>hit);
  return hit||fresh;
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{
  const open=clients.find(client=>'focus' in client);
  if(open)return open.focus();
  if(self.clients.openWindow)return self.clients.openWindow('./');
 }));
});
