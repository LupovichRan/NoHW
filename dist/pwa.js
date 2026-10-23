/* Phone app shell: service worker, install prompt, iOS home-screen guide, local evening reminders.
   There is no server push. Alerts are requested from a tap, after the app is on the home screen. */
(function(){
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const ios=/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
 const root=typeof appDirectory==='function'?appDirectory(document.baseURI):new URL('./',document.baseURI).href;
 navigator.serviceWorker.register(new URL('sw.js',root).href,{scope:new URL(root).pathname}).catch(()=>{});
}
const demo=document.querySelector('.demo');
if(window.NOHOMEWORK_POC?.enabled&&demo&&!document.getElementById('pocReset')){
 const b=document.createElement('button');b.type='button';b.id='pocReset';b.textContent='איפוס נתוני דמו';
 b.onclick=()=>{if(!confirm(typeof t==='function'?t('לאפס את נתוני הדמו במכשיר הזה?'):'Reset?'))return;try{for(const k of Object.keys(localStorage))if(k.startsWith('homework-')&&k!=='homework-language')localStorage.removeItem(k)}catch{}const done=()=>location.reload();try{const r=indexedDB.deleteDatabase('nohomework-materials');r.onsuccess=r.onerror=r.onblocked=done}catch{done()}};
 demo.append(b);
}
function dismissed(key){try{return localStorage.getItem(key)==='1'}catch{return false}}
function dismiss(key){try{localStorage.setItem(key,'1')}catch{}}
function guide(){
 let dialog=document.getElementById('iosGuide');
 if(!dialog){dialog=document.createElement('dialog');dialog.id='iosGuide';document.body.append(dialog)}
 dialog.innerHTML='';
 const title=document.createElement('h2');title.textContent=standalone?'הפעלת תזכורות ערב':'הוספה למסך הבית, ואז תזכורות';
 const list=document.createElement('ol');
 const steps=standalone?[]:['לחצו על כפתור השיתוף בספארי (הריבוע עם החץ למעלה).','בחרו «הוספה למסך הבית» ואשרו.','פתחו את Nohomework מהאייקון החדש, לא מהלשונית.'];
 steps.push('לחצו כאן על «הפעלת תזכורות ערב». זו תזכורת מקומית במכשיר, בלי שרת. באייפון זה עובד רק אחרי ההוספה למסך הבית.');
 for(const step of steps){const item=document.createElement('li');item.textContent=step;list.append(item)}
 const enable=document.createElement('button');enable.type='button';enable.className='button';enable.textContent='הפעלת תזכורות ערב';
 const status=document.createElement('p');
 enable.onclick=async()=>{
  if(!('Notification' in window)){status.textContent='הדפדפן הזה לא מציג התראות. התזכורת נשארת בתוך המסך.';return}
  try{const permission=await Notification.requestPermission();try{localStorage.setItem('hw-remind',permission==='granted'?'1':'0')}catch{}status.textContent=permission==='granted'?'התזכורת המקומית פעילה כשהאפליקציה פתוחה או שחוזרים אליה בערב.':'בלי אישור, התזכורת מוצגת רק בתוך המסך.';if(typeof homeReminderCheck==='function'&&permission==='granted')homeReminderCheck(true)}catch{status.textContent='צריך לפתוח מהמסך הבית וללחוץ שוב.'}
 };
 const close=document.createElement('button');close.type='button';close.className='secondary';close.textContent='סגירה';close.onclick=()=>{dismiss('nohomework-ios-guide');dialog.close()};
 dialog.append(title,list,enable,status,close);dialog.showModal();
}
window.showIosAlertsGuide=guide;
if(!standalone){
 const bar=document.createElement('div');bar.id='installBar';bar.hidden=true;
 const msg=document.createElement('span'),go=document.createElement('button'),help=document.createElement('button'),x=document.createElement('button');
 go.type=help.type=x.type='button';go.textContent='התקנה';help.textContent='הוספה למסך הבית';help.className='secondary';x.className='x';x.textContent='×';x.setAttribute('aria-label','סגירה');
 bar.append(msg,go,help,x);document.body.prepend(bar);
 const saved=dismissed('nohomework-install-dismissed');
 const closeBar=()=>{bar.hidden=true;dismiss('nohomework-install-dismissed')};x.onclick=closeBar;
 let deferred=null;
 addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;if(saved)return;msg.textContent='התקינו את Nohomework כאפליקציה במסך הבית';go.hidden=false;help.hidden=true;bar.hidden=false;if(typeof translateInterface==='function')translateInterface()});
 go.onclick=async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice.catch(()=>{});deferred=null;bar.hidden=true};
 help.onclick=guide;help.hidden=!ios;
 if(ios&&!saved){msg.textContent='באייפון: שיתוף, ואז «הוספה למסך הבית». אחר כך מפעילים תזכורות.';go.hidden=true;bar.hidden=false}
 if(!ios)help.hidden=true;
 if(ios&&!dismissed('nohomework-ios-guide'))guide();
 if(typeof translateInterface==='function')translateInterface();
}else if(!dismissed('nohomework-alerts-shown')){
 dismiss('nohomework-alerts-shown');
 if(!('Notification' in window)||Notification.permission!=='granted')guide();
}
})();
