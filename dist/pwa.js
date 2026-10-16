/* Phone app shell: service worker, install prompt, and a reset button for the local demo data. */
(function(){
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('sw.js').catch(()=>{});
const demo=document.querySelector('.demo');
if(window.NOHOMEWORK_POC?.enabled&&demo&&!document.getElementById('pocReset')){
 const b=document.createElement('button');b.type='button';b.id='pocReset';b.textContent='איפוס נתוני דמו';
 b.onclick=()=>{if(!confirm(typeof t==='function'?t('לאפס את נתוני הדמו במכשיר הזה?'):'Reset?'))return;try{for(const k of Object.keys(localStorage))if(k.startsWith('homework-')&&k!=='homework-language')localStorage.removeItem(k)}catch{}const done=()=>location.reload();try{const r=indexedDB.deleteDatabase('nohomework-materials');r.onsuccess=r.onerror=r.onblocked=done}catch{done()}};
 demo.append(b);
}
if(standalone)return;
const bar=document.createElement('div');bar.id='installBar';bar.hidden=true;
const msg=document.createElement('span'),go=document.createElement('button'),x=document.createElement('button');
go.type=x.type='button';go.textContent='התקנה';x.className='x';x.textContent='×';x.setAttribute('aria-label','סגירה');
bar.append(msg,go,x);document.body.prepend(bar);
let saved=null;try{saved=localStorage.getItem('nohomework-install-dismissed')}catch{}
const close=()=>{bar.hidden=true;try{localStorage.setItem('nohomework-install-dismissed','1')}catch{}};x.onclick=close;
let deferred=null;
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(saved)return;msg.textContent='התקינו את Nohomework כאפליקציה במסך הבית';go.hidden=false;bar.hidden=false;if(typeof translateInterface==='function')translateInterface()});
go.onclick=async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice.catch(()=>{});deferred=null;bar.hidden=true};
if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!saved){msg.textContent='להתקנה כאפליקציה: לחצו על שיתוף ואז על "הוספה למסך הבית"';go.hidden=true;bar.hidden=false}
if(typeof translateInterface==='function')translateInterface();
})();
