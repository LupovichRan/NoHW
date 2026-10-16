/* The class assistant: a chatbot that fills in the data by asking structured questions (no language model).
   It asks one question at a time with tap-to-answer buttons; free text is accepted only where a free answer is
   needed (what was learned, the homework itself, a question for the teacher). Everything it saves goes through the
   existing app functions, and the last lesson update can be undone. */
const WEEKDAYS=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const chat={history:[],busy:false,flow:null,awaitPhoto:null,pendingPhoto:null,lastSnapshot:null,loadedRole:null};
const $a=id=>document.getElementById(id);

// ---------- dates ----------
const dayIdx=()=>Math.min(new Date().getDay(),5);
const todayKey=()=>key(dates[dayIdx()]);
const dateKeyPlus=n=>key(new Date(Date.now()+n*864e5));
function prettyDate(k){const d=new Date(k+'T12:00:00');return `${WEEKDAYS[d.getDay()]} ${d.getDate()}.${d.getMonth()+1}`}
function dueOptions(){const out=[];for(let n=1;n<=9&&out.length<4;n++){const d=new Date(Date.now()+n*864e5);if(d.getDay()===6)continue;const k=key(d);out.push({label:(out.length===0?'מחר, ':'')+prettyDate(k),value:k})}return out}

// ---------- data helpers ----------
const listWeekTasks=f=>classRecords().filter(r=>r.kind==='task'&&f(r));
const taskLine=r=>`• ${r.subject}: ${r.details}${r.due?' (עד '+prettyDate(r.due)+')':''} — ${r.done?'הוכן ✓':'ממתין'}`;
function lessonLines(day){const out=[];for(const r of classRecords().filter(r=>r.day===day)){const l=r.lesson;if(l&&(l.summary||l.topic))out.push(`• ${r.subject}: ${l.topic||''}${l.summary&&l.summary!==l.topic?' — '+l.summary:''}`)}return out}
const expectedToday=()=>{const t=ttSubjectsToday().filter(s=>subjects.includes(s));return t.length?t:subjects};
const missingSubjects=day=>{const have=new Set(classRecords().filter(r=>r.day===day).map(r=>r.subject));return (day===todayKey()?expectedToday():subjects).filter(s=>!have.has(s))};
const openSubjects=()=>[...new Set(classRecords().filter(r=>r.kind==='task'&&!r.done).map(r=>r.subject))];
// ---------- class timetable: which lessons there are on each weekday (0 = Sunday ... 5 = Friday) ----------
const DAY_NAMES=['ראשון','שני','שלישי','רביעי','חמישי','שישי'];
const TT_GRID=[['08:00','08:45'],['08:50','09:35'],['10:00','10:45'],['10:50','11:35'],['11:50','12:35'],['12:40','13:25']];
const TT_SEED=[['חשבון','עברית','אנגלית','מדעים','חינוך'],['עברית','חשבון','חינוך גופני','אנגלית','אמנות'],['חשבון','מדעים','עברית','אנגלית','חינוך גופני'],['אנגלית','עברית','חשבון','אמנות','מדעים'],['חשבון','עברית','מדעים','אנגלית'],['עברית','חשבון','חינוך']];
const tt={classId:'',rows:[],at:0};
function ttLocalAll(){try{return JSON.parse(localStorage.getItem('homework-timetable-v2'))||{}}catch{return{}}}
function ttLocalSave(all){try{localStorage.setItem('homework-timetable-v2',JSON.stringify(all))}catch{}}
function ttRowsFor(list,wd){return list.map((subject,i)=>({weekday:wd,start:TT_GRID[Math.min(i,TT_GRID.length-1)][0],end:TT_GRID[Math.min(i,TT_GRID.length-1)][1],subject}))}
async function ttLoad(force){
 const cls=activeClassId();if(!cls)return;if(!force&&tt.classId===cls&&Date.now()-tt.at<20000)return;
 if(cloud.ready){try{const rows=await cloudResult(cloud.client.from('school_timetable').select('*').eq('class_id',cls));tt.rows=rows.map(r=>({weekday:r.weekday,start:r.start_time.slice(0,5),end:r.end_time.slice(0,5),subject:r.subject}))}catch{tt.rows=[]}}
 else{const all=ttLocalAll();if(!all[cls]){all[cls]=TT_SEED.flatMap((l,wd)=>ttRowsFor(l,wd));ttLocalSave(all)}tt.rows=all[cls]}
 tt.classId=cls;tt.at=Date.now();
}
const ttDay=wd=>tt.classId===activeClassId()?tt.rows.filter(r=>r.weekday===wd).sort((a,b)=>a.start.localeCompare(b.start)):[];
const ttLine=r=>`${r.start}–${r.end}  ${r.subject}`;
const schoolWeekday=d=>d.getDay()<=5?d.getDay():null;
const todayWeekday=()=>schoolWeekday(new Date());
function ttSubjectsToday(){const wd=todayWeekday();return wd===null?[]:[...new Set(ttDay(wd).map(r=>r.subject))]}
function ttTextForDay(wd,label){const rows=ttDay(wd);return rows.length?`${label} במערכת:\n`+rows.map(ttLine).join('\n'):`${label} אין שיעורים במערכת.`}
async function ttSaveDay(wd,list){
 const cls=activeClassId(),rows=ttRowsFor(list,wd);
 if(cloud.ready){await cloudResult(cloud.client.from('school_timetable').delete().eq('class_id',cls).eq('weekday',wd));if(rows.length)await cloudResult(cloud.client.from('school_timetable').insert(rows.map(r=>({class_id:cls,weekday:wd,start_time:r.start,end_time:r.end,subject:r.subject}))))}
 else{const all=ttLocalAll();all[cls]=[...(all[cls]||[]).filter(r=>r.weekday!==wd),...rows];ttLocalSave(all)}
 await ttLoad(true);
}
const clip=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const ISO=/^\d{4}-\d{2}-\d{2}$/;

// ---------- the structured flows ----------
const YES_NO=(q)=>({text:q,chips:['יש','אין']});
const FLOWS={
 lesson:{steps:[
  {key:'subject',ask:()=>{const open=missingSubjects(todayKey());const wd=todayWeekday();const line=wd!==null&&ttDay(wd).length?'\nהיום במערכת: '+[...new Set(ttDay(wd).map(r=>r.subject))].join(', '):'';return {text:'לאיזה מקצוע נעדכן?'+line,chips:[...open,...subjects.filter(s=>!open.includes(s))]}},accept:(d,t)=>subjects.includes(t)?(d.subject=t,null):{error:'בחרו מקצוע מהרשימה.'}},
  {key:'learned',ask:d=>({text:`מה למדו היום ב${d.subject}? אפשר לכתוב בקצרה, או לדלג.`,chips:['דלג'],free:true}),accept:(d,t)=>{d.learned=t==='דלג'?'':clip(t,1500);return null}},
  {key:'concepts',when:d=>!!d.learned,ask:()=>({text:'יש מושגים חדשים? כתבו אותם עם פסיקים, או לדלג.',chips:['דלג'],free:true}),accept:(d,t)=>{d.concepts=t==='דלג'?'':clip(t,300);return null}},
  {key:'hasHw',ask:d=>YES_NO(`יש שיעורי בית ב${d.subject}?`),accept:(d,t)=>t==='יש'?(d.kind='task',null):t==='אין'?(d.kind='none',null):{error:'בחרו "יש" או "אין".'}},
  {key:'details',when:d=>d.kind==='task',ask:()=>({text:'מה צריך להכין? (למשל: עמוד 42 תרגילים 1–6)',chips:[],free:true}),accept:(d,t)=>{const v=clip(t,600);if(!v)return {error:'כתבו מה להכין.'};d.details=v;return null}},
  {key:'due',when:d=>d.kind==='task',ask:d=>{d._due=dueOptions();return {text:'עד מתי להכין?',chips:d._due.map(o=>o.label)}},accept:(d,t)=>{const o=(d._due||dueOptions()).find(o=>o.label===t||o.label.endsWith(t)||prettyDate(o.value)===t);if(!o)return {error:'בחרו תאריך מהרשימה.'};d.due=o.value;return null}},
  {key:'confirm',ask:d=>({text:'סיכום העדכון:\n'+lessonSummary(d)+'\n\nלשמור?',chips:['שמירה','התחלה מחדש','ביטול']}),accept:(d,t)=>t==='שמירה'?{commit:true}:t==='התחלה מחדש'?{restart:true}:{error:'בחרו שמירה, התחלה מחדש או ביטול.'}},
 ],actions:d=>[{type:'save_lesson',subject:d.subject,kind:d.kind,details:d.details||'',due:d.due||null,topic:(d.learned||'').split(/\s+/).slice(0,4).join(' '),summary:d.learned||'',concepts:d.concepts||''}],followUp:'more'},
 done:{steps:[
  {key:'subject',ask:()=>({text:'איזה מקצוע הכנתם?',chips:[...openSubjects(),'הכול']}),accept:(d,t)=>{if(t==='הכול'){d.subjects=openSubjects();return null}if(openSubjects().includes(t)){d.subjects=[t];return null}return {error:'בחרו מקצוע מהרשימה.'}}},
 ],actions:d=>d.subjects.map(s=>({type:'mark_done',subject:s}))},
 ask:{steps:[
  {key:'subject',ask:()=>({text:'על איזה מקצוע השאלה?',chips:subjects}),accept:(d,t)=>subjects.includes(t)?(d.subject=t,null):{error:'בחרו מקצוע מהרשימה.'}},
  {key:'text',ask:()=>({text:'מה לשאול את המורה?',chips:[],free:true}),accept:(d,t)=>{const v=clip(t,500);if(!v)return {error:'כתבו את השאלה.'};d.text=v;return null}},
  {key:'confirm',ask:d=>({text:`לשלוח למורה (${d.subject}):\n"${d.text}"`,chips:['שליחה','ביטול']}),accept:(d,t)=>t==='שליחה'?{commit:true}:{error:'בחרו שליחה או ביטול.'}},
 ],actions:d=>[{type:'ask_teacher',subject:d.subject,text:d.text}]},
 tasks:{steps:[
  {key:'when',ask:()=>({text:'לאיזה יום להציג?',chips:['מה שעוד ממתין','מחר','היום','כל השבוע']}),accept:(d,t)=>{
   const w={'מה שעוד ממתין':['מה עוד ממתין להכנה',r=>!r.done],'מחר':['מה צריך להכין למחר',r=>r.due===dateKeyPlus(1)],'היום':['שיעורי הבית שניתנו היום',r=>r.day===todayKey()],'כל השבוע':['שיעורי הבית של השבוע',()=>true]}[t];
   if(!w)return {error:'בחרו אחת מהאפשרויות.'};const rs=listWeekTasks(w[1]);const miss=missingSubjects(todayKey());
   const tm=t==='מחר'?(()=>{let n=1,wd=null;while(n<=3){wd=schoolWeekday(new Date(Date.now()+n*864e5));if(wd!==null)break;n++}return wd===null?'':'\n\nב'+(n===1?'מחר':'יום '+DAY_NAMES[wd])+' במערכת: '+([...new Set(ttDay(wd).map(r=>r.subject))].join(', ')||'אין שיעורים')})():'';
   return {show:(rs.length?w[0]+':\n'+rs.map(taskLine).join('\n'):'אין משימות להצגה. 🎉')+tm+(miss.length&&t!=='כל השבוע'?`\n\nעוד אין עדכון מהמורה ב: ${miss.join(', ')}.`:''),chips:openSubjects().length?['סימון הכנה',...menuLabels().filter(x=>x!=='סימון הכנה')]:[]}}},
 ]},
 timetable:{steps:[
  {key:'day',ask:()=>({text:'איזה יום להציג?',chips:['היום','מחר',...DAY_NAMES.map(n=>'יום '+n),'כל השבוע']}),accept:(d,t)=>{
   if(t==='כל השבוע')return {show:DAY_NAMES.map((n,i)=>`יום ${n}: `+(ttDay(i).map(r=>r.subject).join(', ')||'אין')).join('\n'),chips:menuLabels()};
   if(t==='היום'){const wd=todayWeekday();return {show:wd===null?'היום אין לימודים (שבת).':ttTextForDay(wd,'היום (יום '+DAY_NAMES[wd]+')'),chips:menuLabels()}}
   if(t==='מחר'){let n=1,w=null;while(n<=3){w=schoolWeekday(new Date(Date.now()+n*864e5));if(w!==null)break;n++}return {show:(n>1?'מחר אין לימודים (שבת). היום הבא: ':'')+ttTextForDay(w,'יום '+DAY_NAMES[w]),chips:menuLabels()}}
   const i=DAY_NAMES.findIndex(n=>t==='יום '+n||t===n);if(i<0)return {error:'בחרו יום מהרשימה.'};return {show:ttTextForDay(i,'יום '+DAY_NAMES[i]),chips:menuLabels()}}},
 ]},
 ttEdit:{steps:[
  {key:'day',ask:()=>({text:'לאיזה יום לעדכן את המערכת?',chips:DAY_NAMES.map(n=>'יום '+n)}),accept:(d,t)=>{const i=DAY_NAMES.findIndex(n=>t==='יום '+n||t===n);if(i<0)return {error:'בחרו יום מהרשימה.'};d.weekday=i;return null}},
  {key:'list',ask:d=>({text:`מה השיעורים ביום ${DAY_NAMES[d.weekday]}? כתבו לפי הסדר, מופרדים בפסיק (למשל: חשבון, עברית, אנגלית). השעות לפי הצלצולים הרגילים.${ttDay(d.weekday).length?'\n\nכרגע:\n'+ttDay(d.weekday).map(ttLine).join('\n'):''}`,chips:ttDay(d.weekday).length?['ללא שיעורים']:[],free:true}),accept:(d,t)=>{if(t==='ללא שיעורים'){d.list=[];return null}const list=t.split(/[,،\n]+/).map(x=>clip(x,40)).filter(Boolean).slice(0,TT_GRID.length);if(!list.length)return {error:'כתבו לפחות שיעור אחד.'};d.list=list;return null}},
  {key:'confirm',ask:d=>({text:`מערכת יום ${DAY_NAMES[d.weekday]}:\n`+(d.list.length?ttRowsFor(d.list,d.weekday).map(ttLine).join('\n'):'אין שיעורים')+'\n\nלשמור?',chips:['שמירה','התחלה מחדש','ביטול']}),accept:(d,t)=>t==='שמירה'?{commit:true}:t==='התחלה מחדש'?{restart:true}:{error:'בחרו שמירה, התחלה מחדש או ביטול.'}},
 ],actions:d=>[{type:'save_timetable',weekday:d.weekday,list:d.list}]},
 people:{steps:[
  {key:'who',ask:()=>({text:'את מי להוסיף?',chips:PEOPLE_BY_ROLE[role]||[]}),accept:(d,t)=>(PEOPLE_BY_ROLE[role]||[]).includes(t)?(d.who=t,null):{error:'בחרו מהרשימה.'}},
  {key:'school',when:d=>d.who==='מנהל בית ספר',ask:()=>({text:'לאיזה בית ספר?',chips:school.schools.map(withCode)}),accept:(d,t)=>{const x=school.schools.find(y=>withCode(y)===t||y.name===t);if(!x)return {error:'בחרו בית ספר מהרשימה.'};d.schoolId=x.id;return null}},
  {key:'student',when:d=>d.who==='הורה',ask:()=>({text:'ההורה של איזה תלמיד?',chips:studentsOfClass().map(withCode)}),accept:(d,t)=>{const x=studentsOfClass().find(y=>withCode(y)===t||y.name===t);if(!x)return {error:'בחרו תלמיד מהרשימה.'};d.studentId=x.id;d.studentName=x.name;return null}},
  {key:'name',ask:d=>({text:d.who==='בית ספר'?'מה שם בית הספר?':(d.who==='תלמיד'||d.who==='ילד')?'מה שם התלמיד?':'מה השם המלא?',chips:[],free:true}),accept:(d,t)=>{const v=clip(t,80);if(!v)return {error:'כתבו שם.'};d.name=v;return null}},
  {key:'email',when:d=>personNeedsEmail(d),ask:()=>({text:'מה כתובת האימייל? ההזמנה תהיה מוגבלת לכתובת הזו.',chips:[],free:true}),accept:(d,t)=>{const v=clip(t,120).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))return {error:'כתובת האימייל אינה תקינה.'};d.email=v;return null}},
  {key:'confirm',ask:d=>({text:'להוסיף?\n'+personSummary(d),chips:['הוספה','ביטול']}),accept:(d,t)=>t==='הוספה'?{commit:true}:{error:'בחרו הוספה או ביטול.'}},
 ],actions:d=>[{type:'add_person',who:d.who,name:d.name,email:d.email||'',schoolId:d.schoolId||null,studentId:d.studentId||null}]},
 link:{steps:[
  {key:'who',ask:()=>({text:'את מי לחבר לכיתה נוספת?',chips:role==='teacher'?['תלמיד']:['תלמיד','מורה']}),accept:(d,t)=>['תלמיד','מורה'].includes(t)&&(role!=='teacher'||t==='תלמיד')?(d.who=t,null):{error:'בחרו מהרשימה.'}},
  {key:'code',ask:d=>({text:`מה הקוד המזהה (3 ספרות, ליד השם) של ה${d.who}?`,chips:[],free:true}),accept:(d,t)=>{const c=String(t).replace(/\D/g,'').padStart(3,'0');const list=linkPool(d.who).filter(x=>entityCode(x.id)===c);if(!list.length)return {error:'לא נמצא אדם עם הקוד הזה.'};if(list.length>1)return {error:'יש כמה אנשים עם הקוד הזה. כתבו את השם המלא.'};d.personId=list[0].id;d.personName=list[0].name;return null}},
  {key:'class',ask:d=>({text:`לאיזו כיתה לחבר את ${d.personName}?`,chips:linkClasses(d).map(withCode)}),accept:(d,t)=>{const x=linkClasses(d).find(y=>withCode(y)===t||y.name===t);if(!x)return {error:'בחרו כיתה מהרשימה.'};d.classId=x.id;d.className=x.name;return null}},
  {key:'confirm',ask:d=>({text:`לחבר את ${d.personName} #${entityCode(d.personId)} לכיתה ${d.className}?`,chips:['חיבור','ביטול']}),accept:(d,t)=>t==='חיבור'?{commit:true}:{error:'בחרו חיבור או ביטול.'}},
 ],actions:d=>[{type:'link_person',who:d.who,personId:d.personId,classId:d.classId}]},
 quick:{steps:[
  {key:'text',ask:()=>({text:'כתבו מקצוע ושיעורי בית בשורה אחת, למשל:\nחשבון: עמוד 40 תרגילים 1-6\nאפשר גם "אנגלית: אין".',chips:[],free:true}),accept:(d,t)=>{const m=String(t).match(/^\s*([^:\-–—]+?)\s*[:\-–—]\s*(.+)$/s);if(!m)return {error:'כתבו בצורה: מקצוע: שיעורי בית.'};const sub=subjects.find(x=>m[1].trim()===x||x.startsWith(m[1].trim()));if(!sub)return {error:'לא זיהיתי את המקצוע. מקצועות: '+subjects.join(', ')};const rest=clip(m[2],600);d.subject=sub;d.kind=/^(אין|ללא)(\s|$|\.)/.test(rest)?'none':'task';d.details=d.kind==='none'?'':rest;return {commit:true}}},
 ],actions:d=>[{type:'save_lesson',subject:d.subject,kind:d.kind,details:d.details,due:null,topic:'',summary:'',concepts:''}],followUp:'more'},
 photo:{steps:[
  {key:'subject',ask:()=>({text:'לאיזה מקצוע הצילום?',chips:subjects}),accept:(d,t)=>subjects.includes(t)?(d.subject=t,null):{error:'בחרו מקצוע מהרשימה.'}},
  {key:'shoot',ask:()=>({text:'מוכנים? לחצו על "צילום" ואפשר לצלם את הלוח או דף מהמחברת.',chips:['📷 צילום','ביטול']}),accept:(d,t)=>({awaitPhoto:d.subject})},
 ]},
};
const PEOPLE_BY_ROLE={admin:['בית ספר','מנהל בית ספר','מורה','הורה','תלמיד'],manager:['מורה','הורה','תלמיד'],teacher:['הורה','תלמיד'],parent:['ילד']};
const PEOPLE_ALLOWED={'בית ספר':['admin'],'מנהל בית ספר':['admin'],'מורה':['admin','manager'],'הורה':['admin','manager','teacher'],'תלמיד':['admin','manager','teacher'],'ילד':['parent']};
const studentsOfClass=()=>school.students.filter(s=>s.classIds.includes(activeClassId()));
const personNeedsEmail=()=>false; // email invitations are disabled for the demo
function personSummary(d){const l=[`• ${d.who}: ${d.name}`];if(d.studentName)l.push(`• של התלמיד: ${d.studentName}`);if(d.email)l.push(`• אימייל: ${d.email}`);if(d.who==='תלמיד'||d.who==='ילד'){const c=school.classes.find(x=>x.id===activeClassId());if(c)l.push(`• כיתה: ${c.name}`)}return l.join('\n')}
function lessonSummary(d){const l=[`• מקצוע: ${d.subject}`];if(d.learned)l.push(`• נלמד: ${d.learned}`);if(d.concepts)l.push(`• מושגים: ${d.concepts}`);l.push(d.kind==='task'?`• שיעורי בית: ${d.details}`:'• שיעורי בית: אין');if(d.kind==='task'&&d.due)l.push(`• להכין עד: ${prettyDate(d.due)}`);return l.join('\n')}

// ---------- menu per role ----------
function menu(){
 if(role==='teacher')return [['quick','עדכון מהיר'],['lesson','עדכון שיעור'],['today','מה עודכן היום'],['timetable','מערכת השעות'],['ttEdit','עריכת מערכת השעות'],['people','הוספת אנשים'],['link','חיבור לכיתה נוספת'],['photo','צילום לוח או מחברת']];
 if(role==='parent'||role==='child'){const m=[['tasks','מה יש להכין'],['learned',role==='child'?'מה למדתי':'מה למדו'],['done','סימון הכנה'],['timetable','מערכת השעות'],['ask','שאלה למורה']];if(role==='parent')m.push(['people','הוספת ילד']);if(typeof matCanUpload==='function'&&matCanUpload())m.push(['photo','צילום לחומרי הכיתה']);return m}
 return [['people','הוספת אנשים'],['link','חיבור לכיתה נוספת'],['admin','איפה מגדירים כיתות ומורים?']];
}
const menuLabels=()=>menu().map(m=>m[1]);
function startMenuItem(id){
 if(id==='today'){const rs=classRecords().filter(r=>r.day===todayKey());const miss=missingSubjects(todayKey());
  return {reply:rs.length?'מה שעודכן היום:\n'+rs.map(r=>r.kind==='task'?taskLine(r).replace(/ — .*/,''):`• ${r.subject}: אין שיעורי בית`).join('\n')+(miss.length?`\n\nעוד לא עודכן: ${miss.join(', ')}.`:''):'עוד לא עודכן כלום היום.',chips:miss.length?['עדכון שיעור']:menuLabels()}}
 if(id==='learned'){const lines=lessonLines(todayKey());return {reply:lines.length?'מה למדו היום:\n'+lines.join('\n'):'המורה עוד לא פרסם סיכום שיעור להיום.',chips:menuLabels()}}
 if(id==='admin')return {reply:'את הגדרת הכיתות, המורים וההזמנות עושים בלשונית "ניהול". אפשר לפתוח אותה מכאן.',chips:['פתיחת ניהול']};
 if(id==='done'&&!openSubjects().length)return {reply:'אין משימות פתוחות כרגע. 🎉',chips:menuLabels()};
 if(id==='done'&&openSubjects().length===1){return {reply:'',actions:[{type:'mark_done',subject:openSubjects()[0]}]}}
 chat.flow={name:id,d:id==='people'&&role==='parent'?{who:'ילד'}:{},asked:id==='people'&&role==='parent'?{who:true}:{},cur:null};return flowNext();
}
function flowNext(){
 const f=chat.flow,def=FLOWS[f.name];
 for(const st of def.steps){if(st.when&&!st.when(f.d))continue;if(f.asked[st.key])continue;f.cur=st;const q=st.ask(f.d);return {reply:q.text,chips:q.chips||[],free:!!q.free}}
 return flowFinish();
}
function flowFinish(){const f=chat.flow,def=FLOWS[f.name];chat.flow=null;return {reply:'',actions:def.actions?def.actions(f.d):[],followUp:def.followUp}}
function flowAnswer(text){
 const f=chat.flow;if(/^ביטול$/.test(text)){chat.flow=null;return {reply:'בסדר, לא שמרתי כלום.',chips:menuLabels()}}
 const r=f.cur.accept(f.d,text);
 if(r&&r.error){const q=f.cur.ask(f.d);return {reply:r.error+'\n\n'+q.text,chips:q.chips||[],free:!!q.free}}
 if(r&&r.restart){chat.flow={name:f.name,d:{},asked:{},cur:null};return flowNext()}
 if(r&&r.show){chat.flow=null;return {reply:r.show,chips:r.chips&&r.chips.length?r.chips:menuLabels()}}
 if(r&&r.awaitPhoto){chat.flow=null;chat.awaitPhoto={subject:r.awaitPhoto};$a('chatPhotoInput').click();return {reply:'פותח את המצלמה…',chips:[]}}
 f.asked[f.cur.key]=true;
 if(r&&r.commit)return flowFinish();
 return flowNext();
}
function botTurn(text){
 const t0=text.trim();
 if(chat.flow)return flowAnswer(t0);
 if(t0==='פתיחת ניהול'){if(typeof showTab==='function')showTab('manage',true);return {reply:'פתחתי את לשונית הניהול.',chips:menuLabels()}}
 if(t0==='סימון הכנה')return startMenuItem('done');
 if(t0==='📤 שליחה בווטסאפ'){if(chat.lastShare)window.open('https://wa.me/?text='+encodeURIComponent(chat.lastShare),'_blank');return {reply:'נפתח ווטסאפ עם ההודעה. בוחרים את קבוצת הכיתה ושולחים.',chips:menuLabels()}}
 if(t0==='📷 צילום'){$a('chatPhotoInput').click();return {reply:'',chips:menuLabels()}}
 const item=menu().find(m=>m[1]===t0||t0.startsWith(m[1]));
 if(item)return startMenuItem(item[0]);
 return {reply:'אני עובד בשאלות קצרות. בחרו מה לעשות:',chips:menuLabels()};
}

// ---------- validated actions ----------
async function saveLessonAction(a){
 if(role!=='teacher'||!teacherHasClass()||!teacherPermission('can_update_lessons'))throw new Error('רק מורה בכיתה שלו יכול לעדכן שיעורים.');
 if(!subjects.includes(a.subject))throw new Error('לא זיהיתי את המקצוע.');
 const subject=a.subject,kind=a.kind==='none'?'none':'task',details=clip(a.details,600);if(kind==='task'&&!details)throw new Error('חסר פירוט שיעורי הבית ב'+subject+'.');
 const due=ISO.test(a.due||'')?a.due:dateKeyPlus(1);
 const lesson=(a.topic||a.summary||a.concepts)?{topic:clip(a.topic,120),summary:clip(a.summary,1500),concepts:clip(a.concepts,300)}:null;
 const day=todayKey();const original=records.find(x=>x.classId===activeClassId()&&x.day===day&&x.subject===subject);
 const r={updatedAt:new Date().toISOString(),classId:activeClassId(),teacherId:school.teacherId,completions:{},lesson:lesson||original?.lesson||null,explanation:original?.explanation||null,day,subject,teacher:activeTeacher()?.name||'מורה',kind,details:kind==='none'?'':details,due:kind==='none'?day:due,dueTime:'08:00',audio:original?.audio||null,resources:original?.resources||[],photos:original?.photos||[],done:false};
 if(cloud.ready)await cloudSaveLesson(r);
 if(original&&original.kind===r.kind&&original.details===r.details){r.done=original.done;r.completedAt=original.completedAt||null;r.completions=original.completions||{}}
  chat.lastShare=[`📚 ${subject} · ${school.classes.find(c=>c.id===r.classId)?.name||''}`,r.lesson?.summary?'נלמד: '+r.lesson.summary:'',kind==='task'?'שיעורי בית: '+r.details:'אין שיעורי בית',kind==='task'?'להכין עד: '+r.due:''].filter(Boolean).join('\n');
 const previous=records;records=records.filter(x=>!(x.classId===r.classId&&x.day===r.day&&x.subject===r.subject));records.push(r);
 if(!save()){records=previous;throw new Error('השמירה נכשלה.')}
 if(typeof emitLessonUpdate==='function')emitLessonUpdate(r);if(typeof trackUsage==='function')trackUsage('lesson_updated');
 render();
 return kind==='none'?`✓ ${subject}: אין שיעורי בית היום`:`✓ ${subject}: ${details} · עד ${prettyDate(due)}${lesson?.topic?' · נלמד: '+lesson.topic:''}`;
}
async function markDoneAction(a){
 if(!['child','parent'].includes(role))throw new Error('סימון הכנה הוא לתלמיד או להורה.');
 if(!subjects.includes(a.subject))throw new Error('לא זיהיתי את המקצוע.');
 const r=classRecords().find(x=>x.subject===a.subject&&x.kind==='task'&&!x.done);
 if(!r)return `ב${a.subject} אין משימה פתוחה.`;
 await setStudentCompletion(r,true);return `✓ סימנתי ש${a.subject} הוכן`;
}
async function askTeacherAction(a){
 if(role==='teacher'||!activeStudentId())throw new Error('שאלה למורה נשלחת מתלמיד או הורה.');
 const text=clip(a.text,500);if(!text)throw new Error('מה לשאול את המורה?');
 const subject=subjects.includes(a.subject)?a.subject:subjects[0];
 const q={id:crypto.randomUUID(),familyId:activeStudentId(),classId:activeClassId(),authorRole:role,author:role==='parent'?'הורה':'תלמיד',subject,text,createdAt:new Date().toISOString(),draft:null,answer:null};
 if(!await commitQuestions([...questions,q]))throw new Error('שליחת השאלה נכשלה.');
 renderQuestions();return `✓ השאלה נשלחה למורה (${subject})`;
}
async function createInvitation(){throw new Error('הזמנה באימייל מושבתת בשלב ההדגמה.')}
async function createInvitationDisabled({invite_role,email,class_id,student_id,school_id}){
 const rec={school_id,class_id:class_id||null,student_id:student_id||null,invite_role,email,created_by:cloud.ready?cloud.user.id:adminId()};
 let token;
 if(cloud.ready){const row=await cloudResult(cloud.client.from('school_invitations').insert(rec).select('token').single());token=row.token}
 else{token=crypto.randomUUID();localInvitations.push({...rec,id:crypto.randomUUID(),token,status:'pending',expires_at:new Date(Date.now()+7*864e5).toISOString()});saveLocalInvites()}
 chat.lastInviteUrl=location.origin+location.pathname+'#invite='+token;return chat.lastInviteUrl;
}
const linkPool=who=>who==='מורה'?school.teachers:school.students;
const linkClasses=d=>{const person=linkPool(d.who).find(x=>x.id===d.personId);const mine=role==='teacher'?(activeTeacher()?.classIds||[]):role==='manager'?school.classes.filter(c=>(activeManager()?.schoolIds||[]).includes(c.schoolId)).map(c=>c.id):school.classes.map(c=>c.id);return school.classes.filter(c=>mine.includes(c.id)&&!(person?.classIds||[]).includes(c.id))};
async function linkPersonAction(a){
 if(!['admin','manager','teacher'].includes(role)||(a.who==='מורה'&&role==='teacher'))throw new Error('אין לך הרשאה לחבר '+a.who+'.');
 const cls=school.classes.find(c=>c.id===a.classId);if(!cls)throw new Error('הכיתה לא נמצאה.');
 if(cloud.ready){await cloudResult(cloud.client.rpc('link_person_to_class',{p_person:a.personId,p_class:a.classId}));await cloudRefresh()}
 else{const p=linkPool(a.who).find(x=>x.id===a.personId);if(!p)throw new Error('האדם לא נמצא.');p.classIds=[...new Set([...(p.classIds||[]),a.classId])];saveSchool();render()}
 return `✓ ${a.who==='מורה'?'המורה':'התלמיד'} חובר לכיתה ${cls.name}`;
}
async function addPersonAction(a){
 if(!(PEOPLE_ALLOWED[a.who]||[]).includes(role))throw new Error('אין לך הרשאה להוסיף '+a.who+'.');
 const name=clip(a.name,80);if(!name)throw new Error('חסר שם.');
 const classId=activeClassId(),cls=school.classes.find(c=>c.id===classId),schoolId=a.schoolId||cls?.schoolId||activeSchoolId();
 const needClass=()=>{if(!classId)throw new Error('בחרו כיתה קודם (בלשונית "עוד").')};
 const addLocalStudent=()=>{needClass();const id=crypto.randomUUID();school.students.push({id,name,classIds:[classId]});school.studentId=id;saveSchool();render()};
 if(a.who==='בית ספר'){if(cloud.ready){await cloudResult(cloud.client.from('school_schools').insert({name,owner_teacher_id:cloud.user.id}));await cloudRefresh()}else{const id=crypto.randomUUID();school.schools.push({id,name,ownerId:adminId()});school.schoolId=id;school.classId='';school.studentId='';saveSchool();render()}return `✓ נוסף בית הספר ${name}`}
 if(!cloud.ready&&a.who!=='בית ספר'&&a.who!=='תלמיד'){
  const id=crypto.randomUUID();
  if(a.who==='ילד'){const parent=activeParent();if(!parent)throw new Error('בחרו הורה (החלפת תפקיד).');school.students.push({id,name,classIds:[]});parent.studentIds.push(id);school.studentId=id;saveSchool();render();return `✓ נוסף ${name} (קוד #${entityCode(id)}). אפשר לחבר אותו לכיתה דרך המורה.`}
  if(a.who==='הורה'){if(!a.studentId)throw new Error('חסר תלמיד.');school.parents.push({id,name,studentIds:[a.studentId]});saveSchool();render();return `✓ נוסף ההורה ${name} (קוד #${entityCode(id)}), הורה של ${a.studentName||'התלמיד'}`}
  if(a.who==='מורה'){school.teachers.push({id,name,classIds:[]});school.staff.push({schoolId,userId:id,role:'teacher'});saveSchool();render();return `✓ נוסף המורה ${name} (קוד #${entityCode(id)}). לשיוך לכיתה: "חיבור לכיתה נוספת".`}
  if(a.who==='מנהל בית ספר'){school.managers.push({id,name,schoolIds:[schoolId]});school.staff.push({schoolId,userId:id,role:'manager'});saveSchool();render();return `✓ נוסף מנהל בית הספר ${name} (קוד #${entityCode(id)})`}
 }
 if(a.who==='ילד'){if(cloud.ready){await cloudResult(cloud.client.rpc('create_managed_child',{child_name:name}));await cloudRefresh()}else addLocalStudent();return `✓ נוסף ${name}. ${cloud.ready?'אפשר להצטרף לכיתה עם קוד מהמורה.':''}`.trim()}
 if(a.who==='תלמיד'){if(!cloud.ready){addLocalStudent();return `✓ נוסף התלמיד ${name} לכיתה ${cls?.name||''}`}needClass();const url=await createInvitation({invite_role:'student',email:clip(a.email,120),class_id:classId,school_id:schoolId});return [`✓ נוצרה הזמנה לתלמיד ${name}`,'קישור: '+url]}
 if(a.who==='הורה'){if(!a.studentId)throw new Error('חסר תלמיד.');const url=await createInvitation({invite_role:'parent',email:clip(a.email,120),class_id:classId,student_id:a.studentId,school_id:schoolId});return [`✓ נוצרה הזמנה להורה ${name}`,'קישור: '+url]}
 if(a.who==='מורה'){const url=await createInvitation({invite_role:'teacher',email:clip(a.email,120),class_id:null,school_id:schoolId});return [`✓ נוצרה הזמנה למורה ${name}`,'קישור: '+url]}
 if(a.who==='מנהל בית ספר'){const url=await createInvitation({invite_role:'manager',email:clip(a.email,120),class_id:null,school_id:schoolId});return [`✓ נוצרה הזמנה למנהל ${name}`,'קישור: '+url]}
 throw new Error('סוג לא מוכר.');
}
async function runActions(actions){
 const lines=[];let undoable=false;
 chat.lastShare='';
 if(actions.some(a=>a.type==='save_lesson'))chat.lastSnapshot=JSON.stringify(records);
 for(const a of actions.slice(0,6)){
  try{
   if(a.type==='save_lesson'){lines.push(await saveLessonAction(a));undoable=!cloud.ready}
   else if(a.type==='mark_done')lines.push(await markDoneAction(a));
   else if(a.type==='ask_teacher')lines.push(await askTeacherAction(a));
   else if(a.type==='link_person'){lines.push(await linkPersonAction(a))}
   else if(a.type==='add_person'){const r=await addPersonAction(a);if(Array.isArray(r))lines.push(...r);else lines.push(r)}
   else if(a.type==='save_timetable'){if(role!=='teacher')throw new Error('רק מורה יכול לעדכן את מערכת השעות.');await ttSaveDay(a.weekday,(a.list||[]).map(x=>clip(x,40)).filter(Boolean));lines.push(`✓ מערכת יום ${DAY_NAMES[a.weekday]} נשמרה`)}
  }catch(e){lines.push('⚠ '+(e.message||e))}
 }
 return {lines,undoable};
}

// ---------- chat UI ----------
const chatStoreKey=()=>'homework-chat-v1:'+role;
function chatLoad(){try{chat.history=JSON.parse(localStorage.getItem(chatStoreKey()))||[]}catch{chat.history=[]}chat.loadedRole=role}
function chatSave(){try{localStorage.setItem(chatStoreKey(),JSON.stringify(chat.history.slice(-40)))}catch{}}
function chatBubble(m){
 const b=document.createElement('div');b.className='bubble '+(m.from==='me'?'me':'bot');
 const p=document.createElement('p');p.textContent=m.text;b.append(p);
 if(m.card&&m.card.length){const c=document.createElement('div');c.className='botCard';for(const l of m.card){const x=document.createElement('div');x.textContent=l;c.append(x)}b.append(c)}
 if(m.undo){const u=document.createElement('button');u.type='button';u.className='undo';u.textContent='ביטול';u.onclick=()=>chatUndo(m);b.append(u)}
 return b}
function chatDraw(){
 const log=$a('chatLog');log.textContent='';for(const m of chat.history)log.append(chatBubble(m));
 if(chat.busy){const t=document.createElement('div');t.className='bubble bot typing';t.textContent='…';log.append(t)}
 log.scrollTop=log.scrollHeight;
 $a('assistantMode').textContent='שאלון מובנה';
 const chips=$a('chatChips');chips.textContent='';
 const last=chat.history[chat.history.length-1];
 let list=[];
 if(chat.pendingPhoto)list=subjects;
 else if(last&&last.from==='bot'&&last.chips)list=last.chips;
 else if(!chat.flow)list=menuLabels();
 for(const text of list){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>chat.pendingPhoto?chatPhotoSubject(text):chatSend(text);chips.append(b)}
 // free text is only for the questions that need it
 const free=chat.flow&&last&&last.free;
 $a('chatInput').placeholder=free?'כתבו את התשובה…':'בחרו אפשרות למעלה…';
}
function chatPush(m){chat.history.push({...m,at:Date.now()});chatSave();chatDraw()}
async function chatSend(raw){
 const text=(raw??$a('chatInput').value).trim();if(!text||chat.busy)return;$a('chatInput').value='';$a('chatInput').style.height='';
 chatPush({from:'me',text});chat.busy=true;chatDraw();
 try{
  const result=botTurn(text);
  const {lines,undoable}=await runActions(result.actions||[]);
  chat.busy=false;
  if(chat.lastShare){result.chips=['📤 שליחה בווטסאפ',...menuLabels()]}
  const reply=result.reply||(lines.length?'סידרתי:':'');
  if(reply||lines.length)chatPush({from:'bot',text:reply,card:lines.length?lines:null,undo:undoable||undefined,chips:result.chips,free:result.free});
  if(result.followUp==='more'&&lines.some(l=>l.startsWith('✓'))){const miss=missingSubjects(todayKey());chatPush(miss.length?{from:'bot',text:'רוצים לעדכן גם מקצוע אחר?',chips:['עדכון שיעור','סיימתי']}:{from:'bot',text:'הכול מעודכן להיום. 🎉',chips:menuLabels()})}
  else if(lines.length&&!result.followUp)chatPush({from:'bot',text:'מה עוד?',chips:menuLabels()});
 }catch(e){chat.busy=false;chatPush({from:'bot',text:'משהו השתבש: '+(e.message||e),chips:menuLabels()})}
}
function chatUndo(m){if(!chat.lastSnapshot)return;try{records=JSON.parse(chat.lastSnapshot);save();render();m.undo=false;chat.lastSnapshot=null;chatSave();chatPush({from:'bot',text:'ביטלתי את העדכון האחרון.',chips:menuLabels()})}catch{}}
async function chatPhotoSubject(subject){
 const file=chat.pendingPhoto;chat.pendingPhoto=null;chatDraw();if(!file)return;
 chatPush({from:'me',text:'📷 '+subject});chat.busy=true;chatDraw();
 try{matEl('materialSubject').value=subject;matEl('materialKind').value=role==='teacher'?'board':'notebook';matEl('materialCaption').value='';await matAddFiles([file]);const status=matEl('materialsStatus').textContent||'';chat.busy=false;chatPush({from:'bot',text:status.includes('✓')?status:(status||'אין הרשאה להעלות חומרים. מורה יכול לסמן תלמיד כמעלה חומרים.'),chips:menuLabels()})}
 catch(e){chat.busy=false;chatPush({from:'bot',text:'הצילום לא נשמר: '+(e.message||e),chips:menuLabels()})}
}
function assistantWelcome(){
 const day=todayKey();if(chat.history.some(m=>m.daily===day))return;
 let m;
 if(role==='teacher'){const miss=missingSubjects(day),sub=ttSubjectsToday();m=miss.length?{text:`בוקר טוב! ${sub.length?'היום במערכת: '+sub.join(', ')+'. ':''}עוד לא עודכנו: ${miss.join(', ')}. נעדכן?`,chips:menuLabels()}:{text:'הכול מעודכן להיום. מה תרצו לעשות?',chips:menuLabels()}}
 else if(role==='parent'||role==='child'){const open=openSubjects(),sub=ttSubjectsToday();m=open.length?{text:`היי! ${sub.length?'היום בכיתה: '+sub.join(', ')+'. ':''}${open.length===1?'יש משימה אחת להכנה':'יש '+open.length+' משימות להכנה'}: ${open.join(', ')}.`,chips:menuLabels()}:{text:'היי! אין משימות פתוחות כרגע. 🎉',chips:menuLabels()}}
 else m={text:'שלום! כאן אפשר לשאול איפה מגדירים כיתות ומורים.',chips:menuLabels()};
 chat.history.push({from:'bot',daily:day,at:Date.now(),...m});chatSave();
}
function renderAssistant(){
 if(!$a('assistantPanel'))return;
 const stu=(typeof activeStudent==='function'?activeStudent():null)?.name,cls=school.classes.find(c=>c.id===activeClassId())?.name;
 $a('assistantContext').textContent=[['parent','child'].includes(role)?stu:'',cls].filter(Boolean).join(' · ')||'בחירת כיתה';
 $a('assistantContext').onclick=()=>{if(typeof openMoreItem==='function')openMoreItem('classPickerPanel')};
 if(chat.loadedRole!==role){chatLoad();chat.flow=null;chat.pendingPhoto=null;chat.awaitPhoto=null}
 chatDraw();ttLoad(false).then(()=>{assistantWelcome();chatDraw()});
}

$a('chatForm').onsubmit=e=>{e.preventDefault();chatSend()};
$a('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();chatSend()}});
$a('chatInput').addEventListener('input',e=>{e.target.style.height='auto';e.target.style.height=Math.min(140,e.target.scrollHeight)+'px'});
$a('chatPhoto').onclick=()=>$a('chatPhotoInput').click();
$a('chatPhotoInput').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
 if(chat.awaitPhoto){const s=chat.awaitPhoto.subject;chat.awaitPhoto=null;chat.pendingPhoto=f;chatPhotoSubject(s);return}
 chat.pendingPhoto=f;chatPush({from:'bot',text:'לאיזה מקצוע הצילום?',chips:subjects})};
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){let rec=null;$a('chatMic').onclick=()=>{if(rec){rec.stop();return}rec=new SR();rec.lang='he-IL';rec.interimResults=false;rec.onresult=ev=>{$a('chatInput').value=Array.from(ev.results).map(r=>r[0].transcript).join(' ');chatSend()};rec.onend=()=>{rec=null;$a('chatMic').classList.remove('on')};rec.onerror=()=>{};$a('chatMic').classList.add('on');rec.start()}}else $a('chatMic').hidden=true;
