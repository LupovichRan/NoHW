/* Home screen for parents and children: what is tomorrow, what to prepare, the week at a glance. */
const SUBJECT_COLORS={'חשבון':'#2563eb','עברית':'#be185d','אנגלית':'#7c3aed','מדעים':'#047857','חינוך':'#b45309','חינוך גופני':'#b91c1c','אמנות':'#0e7490'};
function subjectColor(s){if(SUBJECT_COLORS[s])return SUBJECT_COLORS[s];let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))%360;return `hsl(${h} 60% 32%)`}
const home={day:null};
const hKey=d=>{const p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}`};
function nextSchoolDate(from=new Date()){const d=new Date(from.getFullYear(),from.getMonth(),from.getDate()+1);if(d.getDay()===6)d.setDate(d.getDate()+1);return d}
function homeKids(){return role==='child'?school.students.filter(s=>s.id===school.childId):school.students.filter(s=>(activeParent()?.studentIds||[]).includes(s.id))}
function homeTasksOn(cls,dateKey){return records.filter(r=>r.classId===cls&&r.kind==='task'&&r.due===dateKey)}
function homeDone(r,kid){return !!r.completions?.[kid]?.done}
function homeSummaryText(kid,date){
 const cls=kid.classIds[0],tasks=homeTasksOn(cls,hKey(date));
 const lines=[`${kid.name} · ${DAY_NAMES[date.getDay()]}`];
 const subs=ttDayFor(cls,date.getDay()).map(r=>r.subject);if(subs.length)lines.push('שיעורים: '+subs.join(', '));
 lines.push(tasks.length?'להכין:':'אין משימות להכנה.');for(const t of tasks)lines.push(`• ${t.subject}: ${t.details}${homeDone(t,kid.id)?' ✓':''}`);
 return lines.join('\n');
}
function ttDayFor(cls,wd){const all=ttLocalAll();if(!all[cls]){all[cls]=TT_SEED.flatMap((l,i)=>ttRowsFor(l,i));ttLocalSave(all)}return (all[cls]||[]).filter(r=>r.weekday===wd).sort((a,b)=>a.start.localeCompare(b.start))}
function hEl(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}

// Demo data: make sure there is something to prepare for the next school day.
function homeSeedDemo(){
 let done='';try{done=localStorage.getItem('hw-home-seed')||''}catch{}const due=hKey(nextSchoolDate());if(done===due)return;
 const mk=(classId,subject,details)=>({updatedAt:new Date().toISOString(),classId,teacherId:school.teacherId,completions:{},lesson:null,explanation:null,day:todayKey(),subject,teacher:'מיכל שפירא',kind:'task',details,due,dueTime:'08:00',audio:null,resources:[],photos:[],done:false});
 const add=[['d2','חשבון','עמוד 40 בחוברת, תרגילים 1–6'],['d2','עברית','לקרוא את הסיפור ״חברים בדרך״ ולענות על שאלה 1'],['d3','מדעים','להביא צנצנת לניסוי'],['second-d2','אנגלית','ללמוד 10 מילים מהרשימה']];
 let changed=false;for(const [c,sub,det] of add){if(!school.classes.some(x=>x.id===c))continue;if(records.some(r=>r.classId===c&&r.subject===sub&&r.due===due))continue;records.push(mk(c,sub,det));changed=true}
 if(changed)save();try{localStorage.setItem('hw-home-seed',due)}catch{}
}
function renderHome(){
 const box=document.getElementById('homePanel');if(!box)return;
 const on=role==='parent'||role==='child';box.hidden=!on;if(!on)return;
 box.textContent='';
 const kids=homeKids();
 if(!kids.length){box.append(hEl('p','',role==='parent'?'עוד לא נוספו ילדים. אפשר להוסיף בצ׳אט: "הוספת ילד".':'לא נמצא תלמיד.'));return}
 if(!kids.some(k=>k.id===school.studentId))school.studentId=kids[0].id;
 const kid=kids.find(k=>k.id===school.studentId);
 if(kids.length>1){const bar=hEl('div','homeKids');for(const k of kids){const b=hEl('button',k.id===kid.id?'button':'secondary',k.name.split(' ')[0]);b.type='button';b.onclick=()=>{school.studentId=k.id;school.classId=k.classIds[0]||'';saveSchool();render()};bar.append(b)}box.append(bar)}
 if(!kid.classIds.length){box.append(hEl('p','','הילד/ה עדיין לא משויכ/ת לכיתה. מורה יכול לחבר דרך "חיבור לכיתה נוספת".'));return}
 const cls=kid.classIds[0];
 const tomorrow=nextSchoolDate();if(!home.day||home.dayFor!==kid.id){home.day=hKey(tomorrow);home.dayFor=kid.id}
 const selDate=new Date(home.day+'T12:00:00');
 // week strip
 const strip=hEl('div','weekStrip');
 const base=new Date();base.setDate(base.getDate()-base.getDay());
 for(let i=0;i<6;i++){const d=new Date(base.getFullYear(),base.getMonth(),base.getDate()+i),k=hKey(d),open=homeTasksOn(cls,k).filter(t=>!homeDone(t,kid.id)).length;
  const b=hEl('button',k===home.day?'day on':'day');b.type='button';b.append(hEl('span','dn',DAY_NAMES[i]),hEl('span','dd',String(d.getDate())));if(open)b.append(hEl('span','dot',String(open)));
  b.onclick=()=>{home.day=k;renderHome()};strip.append(b)}
 box.append(strip);
 const isTomorrow=home.day===hKey(tomorrow);
 box.append(hEl('h2','homeTitle',(isTomorrow?'מחר · ':'')+'יום '+DAY_NAMES[selDate.getDay()]));
 // evening banner
 const tasks=homeTasksOn(cls,home.day),open=tasks.filter(t=>!homeDone(t,kid.id));
 if(isTomorrow&&open.length&&new Date().getHours()>=17)box.append(hEl('p','homeBanner',`נשארו ${open.length} משימות להכנה למחר`));
 // tasks
 box.append(hEl('h3','',tasks.length?'להכין':'אין משימות להכנה'));
 for(const t of tasks){const row=hEl('label','taskRow');row.style.setProperty('--sc',subjectColor(t.subject));const cb=document.createElement('input');cb.type='checkbox';cb.checked=homeDone(t,kid.id);cb.onchange=async()=>{await setStudentCompletion(t,cb.checked)};const txt=hEl('span','');const s=hEl('strong','',t.subject);txt.append(s,document.createTextNode(' '+t.details));row.append(cb,txt);box.append(row)}
 // lessons
 const lessons=ttDayFor(cls,selDate.getDay());
 if(lessons.length){box.append(hEl('h3','','מערכת השעות'));const list=hEl('div','lessonList');for(const r of lessons){const li=hEl('div','lessonRow');li.style.setProperty('--sc',subjectColor(r.subject));li.append(hEl('span','t',r.start),hEl('span','s',r.subject));list.append(li)}box.append(list)}
 // learned today
 const learned=records.filter(r=>r.classId===cls&&r.day===todayKey()&&r.lesson?.summary);
 if(learned.length){box.append(hEl('h3','','מה למדו היום'));for(const r of learned){const p=hEl('p','learned');p.style.setProperty('--sc',subjectColor(r.subject));p.append(hEl('strong','',r.subject+': '),document.createTextNode(r.lesson.summary));box.append(p)}}
 // actions
 const acts=hEl('div','homeActions');
 const wa=hEl('button','secondary','📤 שליחה בווטסאפ');wa.type='button';wa.onclick=()=>window.open('https://wa.me/?text='+encodeURIComponent(homeSummaryText(kid,selDate)),'_blank');acts.append(wa);
 const rem=hEl('button','secondary',homeReminderOn()?'🔔 תזכורת בערב פעילה':'🔔 תזכורת בערב');rem.type='button';rem.onclick=homeEnableReminder;acts.append(rem);
 box.append(acts);
}
function homeReminderOn(){try{return localStorage.getItem('hw-remind')==='1'&&window.Notification&&Notification.permission==='granted'}catch{return false}}
async function homeEnableReminder(){
 if(!window.Notification){alert('הדפדפן לא תומך בהתראות.');return}
 const p=Notification.permission==='granted'?'granted':await Notification.requestPermission();
 try{localStorage.setItem('hw-remind',p==='granted'?'1':'0')}catch{}
 if(p==='granted')homeReminderCheck(true);renderHome();
}
function homeReminderCheck(force){
 if(!homeReminderOn()||(role!=='parent'&&role!=='child'))return;
 const now=new Date();if(!force&&now.getHours()<17)return;
 const today=hKey(now);let last='';try{last=localStorage.getItem('hw-remind-last')||''}catch{}if(!force&&last===today)return;
 const key=hKey(nextSchoolDate());let n=0;for(const kid of homeKids())for(const t of homeTasksOn(kid.classIds[0],key))if(!homeDone(t,kid.id))n++;
 if(!n)return;
 try{localStorage.setItem('hw-remind-last',today)}catch{}
 const title='נשארו '+n+' משימות להכנה למחר',opts={body:'פותחים את "מחר" ומסמנים מה הוכן.',icon:'icons/icon-192.png',dir:'rtl',lang:'he'};
 if(navigator.serviceWorker?.ready)navigator.serviceWorker.ready.then(r=>r.showNotification(title,opts)).catch(()=>new Notification(title,opts));else new Notification(title,opts);
}
(function(){const app=document.getElementById('appContent');if(!app)return;const p=document.createElement('section');p.id='homePanel';p.className='panel';p.hidden=true;app.append(p);homeSeedDemo();setTimeout(()=>homeReminderCheck(),3000);setInterval(()=>homeReminderCheck(),10*60*1000)})();
