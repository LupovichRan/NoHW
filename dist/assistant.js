/* The class assistant: a chat in Hebrew. You tell it what to do ("היום בחשבון למדנו שברים, שיעורי בית עמוד 42 עד מחר")
   and it files the lesson, answers "what is there to prepare?", marks homework done and sends questions to the teacher.
   Brain: an LLM (Supabase Edge Function, see supabase/functions/assistant) when enabled, otherwise a built-in Hebrew
   parser. Either way the model only PROPOSES actions; this file validates and runs them with the existing app functions. */
const ASSIST_CFG=()=>window.NOHOMEWORK_AI||{};
const SUBJECT_WORDS={'חשבון':['חשבון','מתמטיקה'],'עברית':['עברית','לשון','הבנת הנקרא','ספרות'],'אנגלית':['אנגלית'],'מדעים':['מדעים','מדע','טבע']};
const WEEKDAYS=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const chat={history:[],busy:false,pendingSubject:null,pendingPhoto:null,lastSnapshot:null,loadedRole:null};
const $a=id=>document.getElementById(id);

// ---------- dates ----------
const dayIdx=()=>Math.min(new Date().getDay(),4);
const todayKey=()=>key(dates[dayIdx()]);
const dateKeyPlus=n=>key(new Date(Date.now()+n*864e5));
function prettyDate(k){const d=new Date(k+'T12:00:00');return `${WEEKDAYS[d.getDay()]} ${d.getDate()}.${d.getMonth()+1}`}
function parseDue(text){
 if(/מחרתיים/.test(text))return dateKeyPlus(2);
 if(/מחר/.test(text))return dateKeyPlus(1);
 const wd=text.match(/עד (?:יום )?(ראשון|שני|שלישי|רביעי|חמישי)/);
 if(wd){const target=WEEKDAYS.indexOf(wd[1]);let n=(target-new Date().getDay()+7)%7;if(n===0)n=7;return dateKeyPlus(n)}
 const dm=text.match(/עד (\d{1,2})[./](\d{1,2})/);
 if(dm){const d=new Date(new Date().getFullYear(),+dm[2]-1,+dm[1],12);return key(d)}
 return dateKeyPlus(1);
}
function dayWord(text){return /מחר/.test(text)?'tomorrow':/השבוע/.test(text)?'week':/היום/.test(text)?'today':'open'}

// ---------- subjects ----------
function subjectsIn(text){const found=[];for(const [s,words] of Object.entries(SUBJECT_WORDS)){let pos=-1;for(const w of words){const i=text.indexOf(w);if(i>=0&&(pos<0||i<pos))pos=i}if(pos>=0)found.push([s,pos])}return found.sort((a,b)=>a[1]-b[1]).map(x=>x[0])}

// ---------- local Hebrew parser ----------
function cleanDetails(seg){return seg.replace(/\s*עד (?:מחרתיים|מחר|יום \S+|\d{1,2}[./]\d{1,2})/,'').replace(/^[\s,:\-–]+|[\s,.:\-–]+$/g,'').trim()}
const hasDue=s=>/מחרתיים|מחר|עד (?:יום )?(?:ראשון|שני|שלישי|רביעי|חמישי)|עד \d{1,2}[./]\d{1,2}/.test(s);
const UPDATEISH=/למדנו|למדו|שיעורי בית|להכין|עמוד\s*\d|תרגיל|לפתור|לקרוא/;
function extractLearned(s){const m=s.match(/(?:למדנו|למדו|נלמד|למדנו על|נושא(?: השיעור)?\s*[:\-]?)\s+(.+?)(?=\s*[.,]?\s*(?:שיעורי בית|שב\b|להכין|לפתור|לקרוא|לכתוב|עמוד|תרגיל|מושגים|אין שיעורי|$))/);return m?m[1].replace(/^(?:על|את)\s+/,'').trim():''}
function extractHomework(s){const m=s.match(/(?:שיעורי בית|שב"?ב|משימה|להכין|לפתור|לקרוא|לכתוב|עמוד\s*\d|תרגיל)[\s\S]*/);return m?cleanDetails(m[0].replace(/^(?:שיעורי בית|שב"?ב|משימה)\s*[:\-]?\s*/,'')):''}
function parseLessonSegments(text){
 const parts=text.split(/\n+|[.;]\s+|\sוגם\s/).map(s=>s.trim()).filter(Boolean);
 const items=[];let current=null;
 for(const seg of parts){const subs=subjectsIn(seg);if(subs.length){current={subject:subs[0],text:seg};items.push(current)}else if(current)current.text+=' . '+seg}
 return items.map(it=>{
  const s=it.text,out={type:'save_lesson',subject:it.subject,kind:'task',details:'',due:null,topic:'',summary:'',concepts:''};
  const none=/אין שיעורי בית|בלי שיעורי בית|לא נתתי שיעורי בית|אין משימה/.test(s);
  out.summary=extractLearned(s);out.topic=out.summary.split(/\s+/).slice(0,4).join(' ');
  const concepts=s.match(/מושגים(?: חדשים)?\s*[:\-]?\s*(.+?)(?=\s*(?:שיעורי בית|$))/);if(concepts)out.concepts=concepts[1].trim();
  if(none)out.kind='none';else{out.details=extractHomework(s);if(out.details&&hasDue(s))out.due=parseDue(s)}
  if(!none&&!out.details)out.kind='ask';
  return out});
}
function listWeekTasks(filter){return classRecords().filter(r=>r.kind==='task'&&filter(r))}
function taskLine(r){return `• ${r.subject}: ${r.details}${r.due?' (עד '+prettyDate(r.due)+')':''} — ${r.done?'הוכן ✓':'ממתין'}`}
function lessonLines(day){const out=[];for(const r of classRecords().filter(r=>r.day===day)){const l=r.lesson;if(l&&(l.summary||l.topic))out.push(`• ${r.subject}: ${l.topic||''}${l.summary&&l.summary!==l.topic?' — '+l.summary:''}`)}return out}
function missingSubjects(day){const have=new Set(classRecords().filter(r=>r.day===day).map(r=>r.subject));return subjects.filter(s=>!have.has(s))}
function openSubjects(){return [...new Set(classRecords().filter(r=>r.kind==='task'&&!r.done).map(r=>r.subject))]}

// ---------- guided flows: the assistant asks one focused question at a time ----------
function newLessonFlow(prefill={}){return {type:'lesson',step:'subject',asked:{learned:!!prefill.summary||!!prefill.kind,due:false},d:{subject:null,summary:'',topic:'',concepts:'',kind:null,details:'',due:null,...prefill}}}
function lessonQuestion(f){
 const d=f.d;
 if(!d.subject){const open=missingSubjects(todayKey());return {step:'subject',reply:'לאיזה מקצוע נעדכן?',chips:[...open,...subjects.filter(s=>!open.includes(s))]}}
 if(!f.asked.learned)return {step:'learned',reply:`מה למדתם היום ב${d.subject}? אפשר לכתוב בקצרה, או לדלג.`,chips:['דלג']};
 if(d.kind===null)return {step:'hw',reply:`יש שיעורי בית ב${d.subject}? כתבו אותם, או לחצו "אין".`,chips:['אין שיעורי בית']};
 if(d.kind==='task'&&!d.due&&!f.asked.due)return {step:'due',reply:'עד מתי להכין?',chips:['מחר','מחרתיים','יום ראשון','יום שני']};
 return null}
function flowHandle(f,t0){
 const start=t0==='__start__';
 if(!start&&/^(ביטול|עזוב|תבטל|לא משנה)/.test(t0)){chat.flow=null;return {reply:'בסדר, לא שמרתי כלום.',actions:[],chips:[]}}
 if(f.type==='ask')return askFlowHandle(f,t0);
 if(f.type==='done')return doneFlowHandle(f,t0);
 if(!start)switch(f.step){
  case 'subject':{const s=subjectsIn(t0)[0];if(!s)return {reply:'לא זיהיתי מקצוע. איזה מהם?',chips:subjects,actions:[]};f.d.subject=s;break}
  case 'learned':if(!/^(דלג|אין|לא|כלום|בלי)\b/.test(t0)){f.d.summary=t0;f.d.topic=t0.split(/\s+/).slice(0,4).join(' ')}f.asked.learned=true;break;
  case 'hw':if(/^(אין|לא|בלי)/.test(t0))f.d.kind='none';else{f.d.kind='task';f.d.details=cleanDetails(t0);if(hasDue(t0)){f.d.due=parseDue(t0);f.asked.due=true}}break;
  case 'due':f.d.due=parseDue(/עד/.test(t0)?t0:'עד '+t0);f.asked.due=true;break;
 }
 const q=lessonQuestion(f);
 if(q){f.step=q.step;return {reply:q.reply,chips:q.chips,actions:[]}}
 chat.flow=null;
 return {reply:'',actions:[{type:'save_lesson',...f.d,due:f.d.kind==='task'?(f.d.due||dateKeyPlus(1)):null}],followUp:'more'};
}
function askFlowHandle(f,t0){
 if(t0!=='__start__'){if(f.step==='subject'){const s=subjectsIn(t0)[0];if(!s)return {reply:'על איזה מקצוע השאלה?',chips:subjects,actions:[]};f.d.subject=s}
 else if(f.step==='text')f.d.text=t0}
 if(!f.d.subject){f.step='subject';return {reply:'על איזה מקצוע השאלה?',chips:subjects,actions:[]}}
 if(!f.d.text){f.step='text';return {reply:'מה לשאול את המורה?',chips:[],actions:[]}}
 chat.flow=null;return {reply:'',actions:[{type:'ask_teacher',subject:f.d.subject,text:f.d.text}]};
}
function doneFlowHandle(f,t0){
 if(/^(הכול|הכל|כולם)/.test(t0)){chat.flow=null;return {reply:'',actions:openSubjects().map(s=>({type:'mark_done',subject:s}))}}
 const s=subjectsIn(t0)[0];if(!s)return {reply:'איזה מקצוע הכנת?',chips:[...openSubjects(),'הכול'],actions:[]};
 chat.flow=null;return {reply:'',actions:[{type:'mark_done',subject:s}]};
}

function localBrain(text){
 const t0=text.trim(),subs=subjectsIn(t0),teacher=role==='teacher';
 if(chat.flow)return flowHandle(chat.flow,t0);
 if(/^(עזרה|מה אפשר|מה אתה יודע)/.test(t0))return {reply:helpText(),actions:[]};
 if(/^(תודה|סיימתי|זהו|מעולה)\s*[.!]?$/.test(t0)&&teacher)return {reply:'מעולה! אני כאן כשצריך.',actions:[]};
 if(teacher){
  if(/^(עדכון|עדכן|לעדכן|נעדכן|שיעור חדש)/.test(t0)&&!UPDATEISH.test(t0)){chat.flow=newLessonFlow(subs.length?{subject:subs[0]}:{});return flowHandle(chat.flow,'__start__')}
  if(/מה (?:כבר )?(?:עודכן|נשמר)/.test(t0)){
   const rs=classRecords().filter(r=>r.day===todayKey());
   if(!rs.length)return {reply:'עוד לא עודכן כלום היום. נתחיל?',chips:['עדכון שיעור'],actions:[]};
   const miss=missingSubjects(todayKey());
   return {reply:'מה שעודכן היום:\n'+rs.map(r=>r.kind==='task'?taskLine(r).replace(/ — .*/,''):`• ${r.subject}: אין שיעורי בית`).join('\n')+(miss.length?`\n\nעוד לא עודכן: ${miss.join(', ')}.`:''),chips:miss.length?['עדכון שיעור']:[],actions:[]};
  }
  if(subs.length){
   const items=parseLessonSegments(t0);
   if(items.length===1){const it=items[0];
    if(it.kind==='ask'){chat.flow=newLessonFlow({subject:it.subject,summary:it.summary,topic:it.topic,concepts:it.concepts});return flowHandle(chat.flow,'__start__')}
    if(it.kind==='task'&&!it.due){chat.flow=newLessonFlow({subject:it.subject,summary:it.summary,topic:it.topic,concepts:it.concepts,kind:'task',details:it.details});return flowHandle(chat.flow,'__start__')}
   }
   const ready=items.filter(i=>i.kind!=='ask');
   if(ready.length)return {reply:'',actions:ready,followUp:'more'};
  }else if(UPDATEISH.test(t0)){
   chat.flow=newLessonFlow({summary:extractLearned(t0),topic:extractLearned(t0).split(/\s+/).slice(0,4).join(' '),...(extractHomework(t0)?{kind:'task',details:extractHomework(t0),...(hasDue(t0)?{due:parseDue(t0)}:{})}:{})});
   chat.flow.asked.due=!!chat.flow.d.due;return flowHandle(chat.flow,'__start__');
  }
  return {reply:'אני יכול לעדכן שיעור צעד אחר צעד. נתחיל?',chips:['עדכון שיעור'],actions:[]};
 }
 // parent / child
 if(/^(?:שאל(?:ו)? את המורה|שאלה למורה)/.test(t0)||(/\?\s*$/.test(t0)&&/(?:המורה|שאלה)/.test(t0))){
  chat.flow={type:'ask',step:subs.length?'text':'subject',d:{subject:subs[0]||null,text:t0.replace(/^(?:שאל(?:ו)? את המורה|שאלה למורה)\s*[:\-]?\s*/,'').trim()}};
  return flowHandle(chat.flow,'__start__');
 }
 if(/(?:סיימתי|הכנתי|סיים|הכין|עשיתי|עשה)/.test(t0)){
  if(subs.length)return {reply:'',actions:subs.map(s=>({type:'mark_done',subject:s}))};
  const open=openSubjects();if(!open.length)return {reply:'אין משימות פתוחות כרגע. 🎉',actions:[]};
  if(open.length===1)return {reply:'',actions:[{type:'mark_done',subject:open[0]}]};
  chat.flow={type:'done',step:'subject',d:{}};return {reply:'איזה מקצוע הכנת?',chips:[...open,'הכול'],actions:[]};
 }
 if(/מה למדו|מה למדנו|מה למדתי|סיכום (?:ה)?שיעור/.test(t0)){const lines=lessonLines(todayKey());return {reply:lines.length?'מה למדו היום:\n'+lines.join('\n'):'המורה עוד לא פרסם סיכום שיעור להיום.',actions:[]}}
 if(/(?:מה|יש|צריך|להכין|שיעורי בית|משימות)/.test(t0)){
  const w=dayWord(t0);let rs,title;
  if(w==='tomorrow'){rs=listWeekTasks(r=>r.due===dateKeyPlus(1));title='מה צריך להכין למחר'}
  else if(w==='today'){rs=listWeekTasks(r=>r.day===todayKey());title='שיעורי הבית שניתנו היום'}
  else if(w==='week'){rs=listWeekTasks(()=>true);title='שיעורי הבית של השבוע'}
  else{rs=listWeekTasks(r=>!r.done);title='מה עוד ממתין להכנה'}
  if(subs.length)rs=rs.filter(r=>subs.includes(r.subject));
  const miss=missingSubjects(todayKey());
  let reply=rs.length?title+':\n'+rs.map(taskLine).join('\n'):'אין משימות להצגה. 🎉';
  if(miss.length&&w!=='week')reply+=`\n\nעוד אין עדכון מהמורה ב: ${miss.join(', ')}.`;
  const open=openSubjects();
  return {reply,actions:[],chips:open.length?['הכנתי את '+open[0]]:[]};
 }
 return {reply:helpText(),actions:[]};
}
function helpText(){
 if(role==='teacher')return 'אני עוזר לסדר את הכיתה. אפשר לכתוב לי בחופשיות ("בחשבון למדנו שברים, שיעורי בית עמוד 42 עד מחר"), או לבקש "עדכון שיעור" ואשאל אותך צעד אחר צעד. אפשר גם לשאול "מה עודכן היום?".';
 if(role==='parent'||role==='child')return 'אפשר לשאול אותי:\n• "מה יש להכין היום?" או "מה למחר?"\n• "מה למדו היום?"\n• "הכנתי את החשבון"\n• "שאל את המורה" ואשאל מה לשאול';
 return 'כאן אפשר לשאול על הכיתות והמורים. את ההגדרות עצמן (כיתות, מורים, הזמנות) תמצאו בלשונית "ניהול".';
}

// ---------- LLM brain ----------
function assistContext(){
 const student=typeof activeStudent==='function'?activeStudent():null;
 return {role,today:{date:todayKey(),weekday:WEEKDAYS[new Date().getDay()],tomorrow:dateKeyPlus(1)},subjects,
  className:school.classes.find(c=>c.id===activeClassId())?.name||'',student:student?.name||'',
  week:classRecords().slice(0,40).map(r=>({day:r.day,subject:r.subject,kind:r.kind,details:(r.details||'').slice(0,200),due:r.due,done:!!r.done,topic:r.lesson?.topic||'',summary:(r.lesson?.summary||'').slice(0,200)}))};
}
async function llmBrain(text){
 const cfg=ASSIST_CFG();const res=await fetch(cfg.endpoint,{method:'POST',headers:{'Content-Type':'application/json',...(cfg.apiKey?{apikey:cfg.apiKey}:{})},body:JSON.stringify({message:text,history:chat.history.slice(-8).map(m=>({from:m.from,text:m.text})),context:assistContext()})});
 if(!res.ok)throw new Error('assistant '+res.status);
 const data=await res.json();if(typeof data.reply!=='string')throw new Error('bad reply');
 return {reply:data.reply,actions:Array.isArray(data.actions)?data.actions:[],chips:Array.isArray(data.suggestions)?data.suggestions.filter(x=>typeof x==='string').slice(0,5).map(x=>x.slice(0,40)):[]};
}

// ---------- validated actions ----------
const ISO=/^\d{4}-\d{2}-\d{2}$/;
const clip=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
function validSubject(s){return subjects.includes(s)?s:null}
async function saveLessonAction(a){
 if(role!=='teacher'||!teacherHasClass()||!teacherPermission('can_update_lessons'))throw new Error('רק מורה בכיתה שלו יכול לעדכן שיעורים.');
 const subject=validSubject(a.subject);if(!subject)throw new Error('לא זיהיתי את המקצוע.');
 const kind=a.kind==='none'?'none':'task',details=clip(a.details,600);if(kind==='task'&&!details)throw new Error('חסר פירוט שיעורי הבית ב'+subject+'.');
 const due=ISO.test(a.due||'')?a.due:dateKeyPlus(1);
 const lesson=(a.topic||a.summary||a.concepts)?{topic:clip(a.topic,120),summary:clip(a.summary,1500),concepts:clip(a.concepts,300)}:null;
 const teacherName=activeTeacher()?.name||'מורה';
 const day=todayKey();const original=records.find(x=>x.classId===activeClassId()&&x.day===day&&x.subject===subject);
 const r={updatedAt:new Date().toISOString(),classId:activeClassId(),teacherId:school.teacherId,completions:{},lesson:lesson||original?.lesson||null,explanation:original?.explanation||null,day,subject,teacher:teacherName,kind,details:kind==='none'?'':details,due:kind==='none'?day:due,dueTime:'08:00',audio:original?.audio||null,resources:original?.resources||[],photos:original?.photos||[],done:false};
 if(cloud.ready)await cloudSaveLesson(r);
 if(original&&original.kind===r.kind&&original.details===r.details){r.done=original.done;r.completedAt=original.completedAt||null;r.completions=original.completions||{}}
 const previous=records;records=records.filter(x=>!(x.classId===r.classId&&x.day===r.day&&x.subject===r.subject));records.push(r);
 if(!save()){records=previous;throw new Error('השמירה נכשלה.')}
 if(typeof emitLessonUpdate==='function')emitLessonUpdate(r);if(typeof trackUsage==='function')trackUsage('lesson_updated');
 render();
 return kind==='none'?`✓ ${subject}: אין שיעורי בית היום`:`✓ ${subject}: ${details}${due?' · עד '+prettyDate(due):''}${lesson?.topic?' · נלמד: '+lesson.topic:''}`;
}
async function markDoneAction(a){
 if(!['child','parent'].includes(role))throw new Error('סימון הכנה הוא לתלמיד או להורה.');
 const subject=validSubject(a.subject);if(!subject)throw new Error('לא זיהיתי את המקצוע.');
 const r=classRecords().find(x=>x.subject===subject&&x.kind==='task'&&!x.done);
 if(!r)return `ב${subject} אין משימה פתוחה.`;
 await setStudentCompletion(r,true);return `✓ סימנתי ש${subject} הוכן`;
}
async function askTeacherAction(a){
 if(role==='teacher'||!activeStudentId())throw new Error('שאלה למורה נשלחת מתלמיד או הורה.');
 const text=clip(a.text,500);if(!text)throw new Error('מה לשאול את המורה?');
 const subject=validSubject(a.subject)||classRecords()[0]?.subject||subjects[0];
 const q={id:crypto.randomUUID(),familyId:activeStudentId(),classId:activeClassId(),authorRole:role,author:role==='parent'?'הורה':'תלמיד',subject,text,createdAt:new Date().toISOString(),draft:null,answer:null};
 if(!await commitQuestions([...questions,q]))throw new Error('שליחת השאלה נכשלה.');
 renderQuestions();return `✓ השאלה נשלחה למורה (${subject})`;
}
async function runActions(actions){
 const lines=[];let undoable=false;
 if(actions.some(a=>a.type==='save_lesson'))chat.lastSnapshot=JSON.stringify(records);
 for(const a of actions.slice(0,6)){
  try{
   if(a.type==='save_lesson'){lines.push(await saveLessonAction(a));undoable=!cloud.ready}
   else if(a.type==='mark_done')lines.push(await markDoneAction(a));
   else if(a.type==='ask_teacher')lines.push(await askTeacherAction(a));
   else if(a.type==='open_tab'&&typeof showTab==='function'&&['today','more','manage','assistant'].includes(a.tab)&&(TABS_BY_ROLE[role]||[]).includes(a.tab))showTab(a.tab,true);
  }catch(e){lines.push('⚠ '+(e.message||e))}
 }
 return {lines,undoable};
}

// ---------- chat UI ----------
function chatStoreKey(){return 'homework-chat-v1:'+role}
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
 const cfg=ASSIST_CFG();$a('assistantMode').textContent=cfg.enabled&&cfg.endpoint?'מצב חכם':'מצב בסיסי';
 const chips=$a('chatChips');chips.textContent='';
 const last=chat.history[chat.history.length-1];
 const byRole={teacher:['עדכון שיעור','מה עודכן היום?','עזרה'],parent:['מה יש להכין היום?','מה למדו היום?','שאל את המורה'],child:['מה יש להכין היום?','מה למדתי היום?','הכנתי'],manager:['עזרה'],admin:['עזרה']};
 const list=(last&&last.from==='bot'&&last.chips&&last.chips.length)?last.chips:(chat.flow?[]:(byRole[role]||[]));
 for(const text of list){const b=document.createElement('button');b.type='button';b.textContent=text;b.onclick=()=>chatSend(text);chips.append(b)}
 if(chat.pendingPhoto){chips.textContent='';for(const s of subjects){const b=document.createElement('button');b.type='button';b.textContent=s;b.onclick=()=>chatPhotoSubject(s);chips.append(b)}}
}
function chatPush(m){chat.history.push({...m,at:Date.now()});chatSave();chatDraw()}
async function chatSend(raw){
 const text=(raw??$a('chatInput').value).trim();if(!text||chat.busy)return;$a('chatInput').value='';$a('chatInput').style.height='';
 chatPush({from:'me',text});chat.busy=true;chatDraw();
 let result;
 try{
  const cfg=ASSIST_CFG();
  if(cfg.enabled&&cfg.endpoint&&!chat.flow&&!/^(עדכון שיעור|עדכון|שאל את המורה|הכנתי)\b/.test(text)){try{result=await llmBrain(text)}catch(e){result=localBrain(text);if(!chat.noticed){chat.noticed=true;result.reply=(result.reply?result.reply+'\n\n':'')+'(העוזר החכם לא זמין כרגע, אני עובד במצב בסיסי)'}}}
  else result=localBrain(text);
  const {lines,undoable}=await runActions(result.actions);
  const reply=result.reply||(lines.length?'':'בסדר.');
  chat.busy=false;chatPush({from:'bot',text:reply||'סידרתי:',card:lines.length?lines:null,undo:undoable||undefined,chips:result.chips||undefined});
  if(result.followUp==='more'&&lines.some(l=>l.startsWith('✓'))){const miss=missingSubjects(todayKey());chatPush(miss.length?{from:'bot',text:'רוצים לעדכן גם מקצוע אחר?',chips:[...miss,'סיימתי']}:{from:'bot',text:'הכול מעודכן להיום. 🎉'})}
 }catch(e){chat.busy=false;chatPush({from:'bot',text:'משהו השתבש: '+(e.message||e)})}
}
function chatUndo(m){if(!chat.lastSnapshot)return;try{records=JSON.parse(chat.lastSnapshot);save();render();m.undo=false;chat.lastSnapshot=null;chatSave();chatPush({from:'bot',text:'ביטלתי את העדכון האחרון.'})}catch{}}
async function chatPhotoSubject(subject){
 const file=chat.pendingPhoto;chat.pendingPhoto=null;chatDraw();if(!file)return;
 chatPush({from:'me',text:'📷 '+subject});chat.busy=true;chatDraw();
 try{matEl('materialSubject').value=subject;matEl('materialKind').value=role==='teacher'?'board':'notebook';matEl('materialCaption').value='';await matAddFiles([file]);const status=matEl('materialsStatus').textContent||'';chat.busy=false;chatPush({from:'bot',text:status.includes('✓')?status:(status||'אין לך הרשאה להעלות חומרים. מורה יכול לסמן תלמיד כמעלה חומרים.')})}
 catch(e){chat.busy=false;chatPush({from:'bot',text:'הצילום לא נשמר: '+(e.message||e)})}
}
function assistantWelcome(){
 const day=todayKey();if(chat.history.some(m=>m.daily===day))return;
 let m;
 if(role==='teacher'){const miss=missingSubjects(day);m=miss.length?{text:`בוקר טוב! היום עוד לא עודכנו: ${miss.join(', ')}. נעדכן?`,chips:['עדכון שיעור',...miss]}:{text:'הכול מעודכן להיום. אפשר לשאול אותי כל דבר, או לצלם את הלוח.',chips:['מה עודכן היום?']}}
 else if(role==='parent'||role==='child'){const open=openSubjects();m=open.length?{text:`היי! ${open.length===1?'יש משימה אחת להכנה':'יש '+open.length+' משימות להכנה'}: ${open.join(', ')}. רוצים לראות את הפירוט?`,chips:['מה יש להכין היום?','מה למדו היום?']}:{text:'היי! אין משימות פתוחות כרגע. 🎉',chips:['מה למדו היום?']}}
 else m={text:'שלום! אני כאן לשאלות על הכיתות. את ההגדרות תמצאו בלשונית "ניהול".',chips:['עזרה']};
 chat.history.push({from:'bot',daily:day,at:Date.now(),...m});chatSave();
}
function renderAssistant(){if(!$a('assistantPanel'))return;const stu=(typeof activeStudent==='function'?activeStudent():null)?.name,cls=school.classes.find(c=>c.id===activeClassId())?.name;$a('assistantContext').textContent=[['parent','child'].includes(role)?stu:'',cls].filter(Boolean).join(' · ')||'בחירת כיתה';$a('assistantContext').onclick=()=>{if(typeof openMoreItem==='function')openMoreItem('classPickerPanel')};if(chat.loadedRole!==role){chatLoad();chat.flow=null;chat.pendingPhoto=null}assistantWelcome();chatDraw()}

$a('chatForm').onsubmit=e=>{e.preventDefault();chatSend()};
$a('chatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();chatSend()}});
$a('chatInput').addEventListener('input',e=>{e.target.style.height='auto';e.target.style.height=Math.min(140,e.target.scrollHeight)+'px'});
$a('chatPhoto').onclick=()=>$a('chatPhotoInput').click();
$a('chatPhotoInput').onchange=e=>{const f=e.target.files[0];e.target.value='';if(!f)return;chat.pendingPhoto=f;chatPush({from:'bot',text:'לאיזה מקצוע הצילום?'})};
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
if(SR){let rec=null;$a('chatMic').onclick=()=>{if(rec){rec.stop();return}rec=new SR();rec.lang='he-IL';rec.interimResults=false;rec.onresult=ev=>{$a('chatInput').value=Array.from(ev.results).map(r=>r[0].transcript).join(' ');chatSend()};rec.onend=()=>{rec=null;$a('chatMic').classList.remove('on')};rec.onerror=()=>{};$a('chatMic').classList.add('on');rec.start()}}else $a('chatMic').hidden=true;
