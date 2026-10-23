/* Pilot screens on top of the local demo. No accounts and no server. */
const treeOpen=new Set();
let treeReady=false;
let addOpen=null;
let statsOpen=false;
const wiz={step:0,orgId:null,schoolId:null};

function pilotEl(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!=null)node.textContent=text;return node}
function pilotStore(key,value){try{localStorage.setItem(key,value)}catch{}}
function pilotRead(key){try{return localStorage.getItem(key)}catch{return null}}
function readRecent(){try{return JSON.parse(pilotRead('homework-tree-recent')||'[]')}catch{return []}}
function writeRecent(list){pilotStore('homework-tree-recent',JSON.stringify(list))}
function consentGiven(){return pilotRead('homework-parent-consent')==='1'}
function pageBase(){return appDirectory(document.baseURI)}
function activeClassGrade(){const row=school.classes.find(item=>item.id===school.classId);if(!row)return null;if(row.grade!=null&&row.grade!=='')return Number(row.grade);return gradeFromName(row.name)}
function pilotPersona(){return {role,teacherId:school.teacherId,parentId:school.parentId,childId:school.childId,managerId:school.managerId}}
function canShareClass(){return role==='admin'||role==='manager'||role==='teacher'}

function ensurePilotShape(){
 school.organizations=school.organizations||[];
 school.invites=school.invites||[];
 if(pilotRead('homework-pilot-shaped')!=='1'){
  if(!school.organizations.some(row=>row.id==='org-ofek'))school.organizations.push({id:'org-ofek',name:'רשת אופק'});
  const demo=school.schools.find(row=>row.id==='school-demo');
  if(demo&&!demo.orgId)demo.orgId='org-ofek';
  const tal=school.students.find(row=>row.id==='tal-demo');
  if(tal&&school.classes.some(row=>row.id==='second-d2')&&!tal.classIds.includes('second-d2'))tal.classIds.push('second-d2');
  pilotStore('homework-pilot-shaped','1');
 }
 const taken=new Set(school.classes.map(row=>row.joinCode).filter(Boolean));
 for(const row of school.classes){
  if(row.grade==null){const grade=gradeFromName(row.name);if(grade)row.grade=grade}
  if(!row.joinCode){row.joinCode=makeJoinCode('class:'+row.id,taken);taken.add(row.joinCode)}
  if(!row.subjects)row.subjects=PILOT_SUBJECTS.slice();
 }
 const parentTaken=new Set(school.students.map(row=>row.parentCode).filter(Boolean));
 for(const row of school.students)if(!row.parentCode){row.parentCode=makeJoinCode('parent:'+row.id,parentTaken);parentTaken.add(row.parentCode)}
 if(!school.scope||!school.scope.type)school.scope={type:'root',nodeId:'root',orgId:null,schoolId:school.schoolId,classId:school.classId,label:'Nohomework'};
 saveSchool();
}

function selectTreeNode(node){
 statsOpen=false;
 school.scope=scopeOf(node);
 if(node.schoolId)school.schoolId=node.schoolId;
 if(node.classId)school.classId=node.classId;
 if(node.studentId){school.studentId=node.studentId;if(role==='child')school.childId=node.studentId}
 if(node.type==='school'){const classroom=school.classes.find(row=>row.schoolId===node.schoolId);if(classroom)school.classId=classroom.id}
 writeRecent(rememberRecent(readRecent(),node.id));
 saveSchool();render();
 if(typeof showTab==='function')showTab(role==='parent'||role==='child'?'home':'tree',false);
}

const TREE_ICON={root:'⌂',school:'▣',class:'○',student:'•',parent:'◦'};
function renderTree(root,nodes,query){
 root.textContent='';
 const shown=searchTree(nodes,query);
 if(!shown.length){const empty=pilotEl('p','emptyState','אין תוצאות');root.append(empty);return}
 if(!treeReady){for(const node of nodes)if(node.type!=='student'&&node.type!=='parent')treeOpen.add(node.id);treeReady=true}
 const open=query?new Set(shown.filter(node=>node.type!=='student'&&node.type!=='parent').map(node=>node.id)):treeOpen;
 const kids=new Map();
 for(const node of shown){const key=node.parentId||'';if(!kids.has(key))kids.set(key,[]);kids.get(key).push(node)}
 const draw=(parentId,depth)=>{
  const wrap=pilotEl('div','treeLevel');
  for(const node of kids.get(parentId)||[]){
   const row=pilotEl('div','treeRow'+(school.scope?.nodeId===node.id?' is-on':''));
   row.style.paddingInlineStart=(depth*16)+'px';
   const children=kids.get(node.id)||[];
   if(children.length||node.canAdd){
    const twist=pilotEl('button','twisty',open.has(node.id)?'▾':'▸');
    twist.type='button';twist.setAttribute('aria-expanded',String(open.has(node.id)));twist.setAttribute('aria-label',node.label);
    twist.onclick=()=>{if(treeOpen.has(node.id))treeOpen.delete(node.id);else treeOpen.add(node.id);renderPilot()};
    row.append(twist);
   }else row.append(pilotEl('span','twisty spacer','·'));
   const icon=pilotEl('span','treeIcon',TREE_ICON[node.type]||'·');icon.setAttribute('aria-hidden','true');
   const button=pilotEl('button','treeLabel',node.label);
   button.type='button';button.setAttribute('data-user-content','');
   button.onclick=()=>selectTreeNode(node);
   row.append(icon,button);
   wrap.append(row);
   if(children.length&&open.has(node.id))wrap.append(draw(node.id,depth+1));
  }
  return wrap};
 root.append(draw('',0));
}
function field(label,opts={}){const wrap=pilotEl('label','miniField',label);const input=document.createElement('input');input.maxLength=opts.max||40;input.required=!!opts.required;if(opts.value)input.value=opts.value;wrap.append(input);return {wrap,input}}
function addForm(node){
 const form=document.createElement('form');form.className='addForm';form.style.paddingInlineStart='36px';
 const status=pilotEl('p','');status.setAttribute('role','status');
 let first;
 if(node.canAdd==='school'){
  const schoolName=field('בית ספר',{required:true,max:80});const principal=field('מנהל',{required:true});
  first=schoolName.input;form.append(schoolName.wrap,principal.wrap);
  form.onsubmit=event=>{event.preventDefault();const result=addManagedSchool(school,{role,name:schoolName.input.value,principalName:principal.input.value});status.textContent=result.ok?'':(result.error||'');if(!result.ok)return;school.schoolId=result.school.id;addOpen=null;saveSchool();render()};
 }else if(node.canAdd==='class'){
  const className=field('כיתה',{required:true,max:40});const teacher=field('מורה',{required:true});
  first=className.input;form.append(className.wrap,teacher.wrap);
  form.onsubmit=event=>{event.preventDefault();const result=addManagedClass(school,{role,schoolId:node.schoolId,name:className.input.value,teacherName:teacher.input.value,managerId:school.managerId});status.textContent=result.ok?'':(result.error||'');if(!result.ok)return;school.classId=result.class.id;school.schoolId=node.schoolId;addOpen=null;saveSchool();render()};
 }else{
  const student=field('תלמיד',{required:true});const parent=field('הורה');
  const info=pilotEl('button','infoBtn','i');info.type='button';info.title='שם פרטי בלבד, בלי מספר זהות';info.setAttribute('aria-label','שם פרטי בלבד, בלי מספר זהות');
  first=student.input;form.append(student.wrap,parent.wrap,info);
  form.onsubmit=event=>{event.preventDefault();const result=addManagedPeople(school,{role,classId:node.classId,studentName:student.input.value,parentName:parent.input.value,teacherId:school.teacherId});status.textContent=result.ok?'':(result.error||'');if(!result.ok)return;addOpen=null;saveSchool();render()};
 }
 const submit=pilotEl('button','button','הוספה');submit.type='submit';form.append(submit,status);
 queueMicrotask(()=>first&&first.focus());
 return form}

function shareWhatsApp(text){window.open(whatsAppUrl(text),'_blank','noopener')}
function copyText(text,status){const done=()=>{if(status)status.textContent='הקישור הועתק'};if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).then(done).catch(()=>status&&(status.textContent=text));else if(status)status.textContent=text}

function renderClassShare(box){
 box.textContent='';
 if(!canShareClass()||!school.classId)return;
 const classroom=school.classes.find(row=>row.id===school.classId);if(!classroom)return;
 const schoolName=school.schools.find(row=>row.id===classroom.schoolId)?.name||'';
 const link=pageBase()+'#join='+classroom.joinCode;
 const row=pilotEl('div','shareRow');
 const code=pilotEl('code','ltr',classroom.joinCode);code.dir='ltr';
 row.append(pilotEl('span','',`קוד כיתה ${classroom.name}: `),code);
 const wa=pilotEl('button','secondary','שליחה בוואטסאפ');wa.type='button';wa.onclick=()=>shareWhatsApp(classShareText({schoolName,className:classroom.name,code:classroom.joinCode,link}));
 const copy=pilotEl('button','secondary','העתקה');copy.type='button';copy.onclick=()=>copyText(link,document.getElementById('pilotNote'));
 row.append(wa,copy);box.append(row);
 if(role!=='child'&&role!=='parent'){
  for(const student of school.students.filter(item=>item.classIds.includes(classroom.id)).slice(0,6)){
   const parent=pilotEl('div','shareRow');
   const pcode=pilotEl('code','ltr',student.parentCode);pcode.dir='ltr';
   const name=pilotEl('span','',student.name+' · ');name.setAttribute('data-user-content','');
   parent.append(pilotEl('span','','קוד הורה · '),name,pcode);
   const button=pilotEl('button','secondary','וואטסאפ');button.type='button';
   button.onclick=()=>shareWhatsApp(parentShareText({studentName:student.name,code:student.parentCode,link:pageBase()+'#parent='+student.parentCode}));
   parent.append(button);box.append(parent);
  }
 }
}

function dayKeySelected(){try{return key(dates[selected])}catch{const now=new Date();return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`}}

function renderPilot(){
 ensurePilotShape();
 const app=document.getElementById('appContent');if(!app)return;
 let bar=document.getElementById('pilotBar');
 if(!bar){
  bar=pilotEl('section','panel');bar.id='pilotBar';
  bar.innerHTML='<nav id="pilotCrumbs" aria-label="ניווט מעלה"></nav><p id="pilotNote" role="status"></p><section id="levelPanel"></section><div class="pilotSpare" hidden><input id="pilotSearch" type="search" placeholder="חיפוש" aria-label="חיפוש בית ספר או כיתה"><div id="pilotTree" role="tree"></div><button type="button" id="openJoin" aria-label="הצטרפות עם קוד">⌗</button><button type="button" id="openPack" aria-label="שיתוף בין מכשירים">↗</button><button type="button" id="openIosGuide" aria-label="הוספה למסך הבית">＋</button></div>';
  const host=document.querySelector('[data-pane="tree"]')||app;
  host.prepend(bar);
  bar.querySelector('#pilotSearch').oninput=()=>renderPilot();
  bar.querySelector('#openJoin').onclick=()=>openJoin('student','');
  bar.querySelector('#openPack').onclick=openPack;
  bar.querySelector('#openIosGuide').onclick=()=>window.showIosAlertsGuide&&window.showIosAlertsGuide();
 }
 let nodes=managedTree(school,pilotPersona());
 if(!nodes.some(node=>node.id===school.scope?.nodeId)){
  const home=nodes.find(node=>node.type===(role==='admin'?'root':role==='manager'?'school':'class'))||nodes[0];
  if(home)school.scope=scopeOf(home);
 }
 const query=document.getElementById('pilotSearch')?.value||'';
 renderTree(document.getElementById('pilotTree'),nodes,query);
 renderLevelPanel(nodes);
 renderTeacherBoard();
 syncAiGate();
}
function crumbTrail(nodes,node){const out=[];let current=node;const byId=Object.fromEntries(nodes.map(item=>[item.id,item]));while(current){out.unshift(current);current=current.parentId?byId[current.parentId]:null}return out}
function meter(ratio,tone){const bar=pilotEl('div','meter');if(tone)bar.dataset.tone=tone;const fill=pilotEl('div','meterFill');fill.style.width=Math.round(Math.max(0,Math.min(1,ratio||0))*100)+'%';bar.append(fill);return bar}
function statCard(label,value,ratio,tone){const card=pilotEl('article','statCard');card.append(pilotEl('span','statLabel',label),pilotEl('strong','',value));if(ratio!=null)card.append(meter(ratio,tone));return card}
function statLine(label,hint,ratio,tone){const row=pilotEl('div','statLine');const top=pilotEl('div','statLineTop');top.append(pilotEl('span','',label),pilotEl('span','statHint',hint));row.append(top);if(ratio!=null)row.append(meter(ratio,tone));return row}
function panelHead(title,user){const head=pilotEl('div','panelHead');const h=pilotEl('h2','',title);if(user)h.setAttribute('data-user-content','');head.append(h);return head}
function ownsSchool(schoolId){return role==='manager'&&(school.managers.find(item=>item.id===school.managerId)?.schoolIds||[]).includes(schoolId)}
function openSheet(title,fill){
 const dialog=dialogShell('setupSheet',title);dialog.className='sheet';
 const status=pilotEl('p','');status.setAttribute('role','status');
 fill(dialog,status);dialog.append(status,closeBtn(dialog));
 if(!dialog.open)dialog.showModal()}
function sheetForm(dialog,status,fields,onOk){
 const form=document.createElement('form');form.className='setupBox';
 const inputs=fields.map(spec=>field(spec.label,spec));
 form.onsubmit=event=>{event.preventDefault();const result=onOk(inputs);status.textContent=result?.ok===false?(result.error||''):'';if(result?.ok===false)return;dialog.close();saveSchool();render()};
 const go=pilotEl('button','button','הוספה');go.type='submit';
 form.append(...inputs.map(item=>item.wrap),go);dialog.append(form)}
function openAddSchool(){openSheet('בית ספר',(dialog,status)=>sheetForm(dialog,status,[{label:'בית ספר',required:true,max:80},{label:'מנהל',required:true}],inputs=>{const result=addManagedSchool(school,{role,name:inputs[0].input.value,principalName:inputs[1].input.value});if(result.ok)school.schoolId=result.school.id;return result}))}
function openEditSchool(schoolId,name,principal){openSheet('בית ספר',(dialog,status)=>sheetForm(dialog,status,[{label:'שם',value:name,max:80},{label:'מנהל',value:principal,max:40}],inputs=>{const renamed=editManagedSchool(school,{role,schoolId,name:inputs[0].input.value});if(!renamed.ok)return renamed;if(inputs[1].input.value.trim())return assignPrincipal(school,{role,schoolId,principalName:inputs[1].input.value});return renamed}))}
function openAddClass(schoolId){openSheet('כיתה',(dialog,status)=>sheetForm(dialog,status,[{label:'כיתה',required:true,max:40},{label:'מורה',required:true}],inputs=>{const result=addManagedClass(school,{role,schoolId,name:inputs[0].input.value,teacherName:inputs[1].input.value,managerId:school.managerId});if(result.ok){school.classId=result.class.id;school.schoolId=schoolId}return result}))}
function openAssignTeacher(classId,teacherName){openSheet('מורה',(dialog,status)=>sheetForm(dialog,status,[{label:'מורה',value:teacherName,required:true}],inputs=>assignClassTeacher(school,{role,classId,teacherName:inputs[0].input.value,managerId:school.managerId})))}
function openAddPeople(classId){
 const classroom=school.classes.find(row=>row.id===classId);
 openSheet('תלמיד',(dialog,status)=>{
  const form=document.createElement('form');form.className='setupBox';
  const student=field('תלמיד',{required:true});const parent=field('הורה');
  const info=pilotEl('button','infoBtn','i');info.type='button';info.title='שם פרטי בלבד, בלי מספר זהות';info.setAttribute('aria-label','שם פרטי בלבד, בלי מספר זהות');
  form.onsubmit=event=>{event.preventDefault();const result=addManagedPeople(school,{role,classId,studentName:student.input.value,parentName:parent.input.value,teacherId:school.teacherId});status.textContent=result.ok?'':(result.error||'');if(!result.ok)return;dialog.close();saveSchool();render()};
  const go=pilotEl('button','button','הוספה');go.type='submit';
  form.append(student.wrap,parent.wrap,info,go);
  if(classroom){
   const code=pilotEl('code','joinCode ltr',classroom.joinCode);code.dir='ltr';
   const share=pilotEl('button','secondary','וואטסאפ');share.type='button';share.setAttribute('aria-label','שליחה בוואטסאפ');
   share.onclick=event=>{event.preventDefault();shareWhatsApp(classShareText({schoolName:school.schools.find(row=>row.id===classroom.schoolId)?.name||'',className:classroom.name,code:classroom.joinCode,link:pageBase()+'#join='+classroom.joinCode}))};
   form.append(code,share);
  }
  dialog.append(form);
 })}
function openShareStudent(student){openSheet('הורה',dialog=>{const share=pilotEl('button','button','וואטסאפ');share.type='button';share.setAttribute('aria-label','שיתוף קוד הורה');share.onclick=()=>shareWhatsApp(parentShareText({studentName:student.name,code:student.parentCode,link:pageBase()+'#parent='+student.parentCode}));dialog.append(share)})}
function stripButton(pct,label,marked){
 const button=pilotEl('button','strip');button.type='button';button.setAttribute('aria-expanded',String(statsOpen));
 const top=pilotEl('div','stripTop');top.append(pilotEl('strong','',Math.round((pct||0)*100)+'%'),pilotEl('span','',label));
 const bar=meter(pct);if(marked)bar.append(pilotEl('span','goalMark',''));
 button.append(top,bar);button.onclick=()=>{statsOpen=!statsOpen;renderPilot()};return button}
function navCard(name,pct,onTap){
 const button=pilotEl('button','navCard');button.type='button';
 const label=pilotEl('span','navName',name);label.setAttribute('data-user-content','');
 button.append(label,pilotEl('strong','navPct',Math.round((pct||0)*100)+'%'),pilotEl('span','chev','‹'));
 button.onclick=onTap;return button}
function fab(label,onClick){const button=pilotEl('button','fab','+');button.type='button';button.setAttribute('aria-label',label);button.onclick=onClick;return button}
function goSchool(id){const target=managedTree(school,pilotPersona()).find(item=>item.type==='school'&&item.schoolId===id);if(target)selectTreeNode(target)}
function goClass(id){const target=managedTree(school,pilotPersona()).find(item=>item.type==='class'&&item.classId===id);if(target)selectTreeNode(target)}
function renderLevelPanel(nodes){
 const panel=document.getElementById('levelPanel');const crumbs=document.getElementById('pilotCrumbs');
 if(!panel||!crumbs)return;
 const simple=role==='parent'||role==='child';
 panel.hidden=simple;crumbs.hidden=simple;
 crumbs.textContent='';panel.textContent='';
 if(simple)return;
 const node=nodes.find(item=>item.id===school.scope?.nodeId)||nodes.find(item=>item.type==='root')||nodes[0];
 if(!node){panel.append(pilotEl('p','emptyState','אין נתונים'));return}
 const trail=crumbTrail(nodes,node);const parent=trail.length>1?trail[trail.length-2]:null;
 if(parent){const back=pilotEl('button','crumb',parent.label);back.type='button';back.setAttribute('data-user-content','');back.onclick=()=>selectTreeNode(parent);crumbs.append(back)}
 const day=dayKeySelected();
 if(node.type==='root')renderAdminPanel(panel,day);
 else if(node.type==='school')renderSchoolPanel(panel,node,day);
 else if(node.type==='class'||node.type==='student'||node.type==='parent')renderClassPanel(panel,node.classId?node:nodes.find(item=>item.classId===school.classId&&item.type==='class'),day,node.studentId);
 else panel.append(pilotEl('p','emptyState','אין נתונים'));
}
function renderAdminPanel(panel,day){
 const stats=adminPanelStats(school,records,day);
 panel.append(panelHead('בתי ספר'),stripButton(stats.updateRate,'עדכון'));
 const drawer=pilotEl('div','statDrawer');drawer.hidden=!statsOpen;
 drawer.append(statLine('לא עודכן',Math.round(stats.notUpdatedShare*100)+'%',stats.notUpdatedShare,'not_updated'),statLine('תלמידים',String(stats.students)));
 panel.append(drawer);
 const list=pilotEl('div','navList');
 if(!stats.perSchool.length)list.append(pilotEl('p','emptyState','אין בתי ספר'));
 for(const row of stats.perSchool)list.append(navCard(row.name,row.updateRate,()=>goSchool(row.id)));
 panel.append(list);
 if(role==='admin')panel.append(fab('הוספת בית ספר',openAddSchool));
}
function renderSchoolPanel(panel,node,day){
 const stats=schoolPanelStats(school,records,node.schoolId,day);
 panel.append(panelHead(node.label,true),stripButton(stats.updateRate,'עדכון'));
 const drawer=pilotEl('div','statDrawer');drawer.hidden=!statsOpen;
 drawer.append(statLine('לא עודכן',Math.round(stats.notUpdatedShare*100)+'%',stats.notUpdatedShare,'not_updated'),statLine('תלמידים',String(stats.students)));
 panel.append(drawer);
 const list=pilotEl('div','navList');
 if(!stats.perClass.length)list.append(pilotEl('p','emptyState','אין כיתות'));
 for(const row of stats.perClass)list.append(navCard(row.name,row.updateRate,()=>goClass(row.id)));
 panel.append(list);
 if(ownsSchool(node.schoolId))panel.append(fab('הוספת כיתה',()=>openAddClass(node.schoolId)));
 else if(role==='admin'){const principal=school.managers.find(item=>(item.schoolIds||[]).includes(node.schoolId))?.name||'';panel.append(fab('שמירה',()=>openEditSchool(node.schoolId,node.label,principal)))}
}
function renderClassPanel(panel,node,day,focusId){
 if(!node){panel.append(pilotEl('p','emptyState','אין כיתה'));return}
 const stats=classPanelStats(school,records,node.classId,day);
 const classroom=school.classes.find(row=>row.id===node.classId);
 const goal=classWeekGoal(school,records,node.classId,day);
 panel.append(panelHead(classroom?.name||node.label,true),stripButton(goal.ratio,'שבוע',true));
 const drawer=pilotEl('div','statDrawer');drawer.hidden=!statsOpen;
 for(const row of stats.perSubject){const ratio=row.status==='homework'?row.doneRate:row.status==='no_homework'?1:0;drawer.append(statLine(row.subject,statusLabel(row.status),ratio,row.status))}
 panel.append(drawer);
 const list=pilotEl('div','navList');
 const mine=role==='teacher'&&(school.teachers.find(row=>row.id===school.teacherId)?.classIds||[]).includes(node.classId);
 if(!stats.perStudent.length)list.append(pilotEl('p','emptyState','אין תלמידים'));
 for(const row of stats.perStudent){
  const card=navCard(row.name,row.doneRate,()=>{if(!mine)return;const student=school.students.find(item=>item.id===row.id);if(student?.parentCode)openShareStudent(student)});
  if(row.id===focusId)card.classList.add('is-on');
  list.append(card);
 }
 panel.append(list);
 if(mine)panel.append(fab('הוספת תלמיד',()=>openAddPeople(node.classId)));
 else if(classroom&&ownsSchool(classroom.schoolId))panel.append(fab('מורה',()=>openAssignTeacher(node.classId,school.teachers.find(item=>(item.classIds||[]).includes(node.classId))?.name||'')));
}

function renderTeacherBoard(){
 const pane=document.querySelector('[data-pane="today"]')||document.getElementById('appContent');
 if(!pane)return;
 let board=document.getElementById('teacherBoard');
 if(!board){board=pilotEl('section','panel');board.id='teacherBoard';pane.prepend(board)}
 board.hidden=role!=='teacher';
 if(board.hidden)return;
 const classroom=school.classes.find(row=>row.id===school.classId);
 board.textContent='';
 if(!classroom){board.append(pilotEl('p','emptyState','בחרו כיתה'));return}
 const day=dayKeySelected();
 const play=syncTeacherDay(school,records,{teacherId:school.teacherId,classIds:[classroom.id],day});
 if(play.changed)saveSchool();
 const goal=classWeekGoal(school,records,classroom.id,day);
 const head=pilotEl('div','playRow');
 head.append(pilotEl('span','flame','🔥'),pilotEl('strong','',String(play.streak)));
 if(play.updated)head.append(pilotEl('span','doneCheck','✓'));
 board.append(head,goalBar(goal));
 let subjects=classroom.subjects||PILOT_SUBJECTS;
 try{const lessons=ttDayFor(classroom.id,new Date(day+'T12:00:00').getDay());if(lessons.length)subjects=[...new Set(lessons.map(row=>row.subject))]}catch{}
 const mine=activeTeacher()?.subjects;if(mine?.length)subjects=subjects.filter(subject=>mine.includes(subject));
 for(const subject of subjects){
  const status=subjectDayStatus(records,{classId:classroom.id,day,subject});
  const row=pilotEl('div','teacherRow');row.style.setProperty('--sc',typeof subjectColor==='function'?subjectColor(subject):'#0f766e');row.dataset.status=status;
  row.append(pilotEl('strong','',subject),pilotEl('span','badge st-'+status,statusLabel(status)));
  const task=pilotEl('button','button','יש שיעורי בית');task.type='button';task.onclick=()=>openTeacherEditor(subject,'task');
  const none=pilotEl('button','secondary','אין שיעורי בית');none.type='button';none.onclick=()=>postExplicit(subject,'none');
  row.append(task,none);board.append(row);
 }
}

function openTeacherEditor(subject,kind){
 const add=document.getElementById('add');if(!add)return;add.click();
 const form=document.getElementById('form');
 if(form.elements.subject.querySelector(`option[value="${subject}"]`)||[...form.elements.subject.options].some(option=>option.textContent===subject)){
  const match=[...form.elements.subject.options].find(option=>option.value===subject||option.textContent===subject);
  if(match)form.elements.subject.value=match.value;
 }
 form.elements.kind.value=kind;form.elements.kind.onchange();
}
function postExplicit(subject,kind){
 const note=document.getElementById('pilotNote');
 if(role!=='teacher'||!teacherHasClass()||(typeof teacherPermission==='function'&&!teacherPermission('can_update_lessons'))){if(note)note.textContent='אין הרשאה לעדכן את הכיתה הזו.';return}
 const day=dayKeySelected();
 const record={updatedAt:new Date().toISOString(),classId:activeClassId(),teacherId:school.teacherId,completions:{},lesson:null,explanation:null,day,subject,teacher:activeTeacher()?.name||'',kind,details:'',due:day,dueTime:'08:00',audio:null,resources:[],photos:[],done:false};
 const previous=records.slice();
 records=records.filter(row=>!(row.classId===record.classId&&row.day===record.day&&row.subject===record.subject));
 records.push(record);
 if(!save()){records=previous;return}
 if(note)note.textContent=kind==='none'?'סומן: אין שיעורי בית. זה לא יופיע במקצוע אחר שלא עודכן.':'העדכון נשמר.';
 render();
}

function syncAiGate(){
 const button=document.getElementById('generateExplanation');if(!button)return;
 const section=button.closest('section');if(!section)return;
 let note=document.getElementById('aiGradeNote');
 if(!note){note=pilotEl('p','notice');note.id='aiGradeNote';section.prepend(note)}
 const blocked=!studentFacingAiAllowed(activeClassGrade());
 note.hidden=!blocked;
 note.textContent=blocked?'הסבר AI לתלמידים כבוי בכיתות ד׳–ז׳. תמלול קולי וזיהוי טקסט מהצילום נשארים אצל המורה.':'';
}
function installAiGate(){
 if(typeof renderExplanation!=='function'||renderExplanation._gated)return;
 const original=renderExplanation;
 const gated=function(container,explanation,currentRole){
  const student=currentRole==='child'||currentRole==='parent';
  if(student&&!studentFacingAiAllowed(activeClassGrade()))return;
  return original(container,explanation,currentRole);
 };
 gated._gated=true;renderExplanation=gated;
}

function appendConsent(box){
 if(consentGiven())return;
 const card=pilotEl('section','notice');card.id='consentCard';
 const head=pilotEl('div','consentHead');head.append(pilotEl('b','','הסכמת הורה'));
 const link=pilotEl('a','','מדיניות הפרטיות');link.href='privacy.html';head.append(link);card.append(head);
 const label=pilotEl('label','');
 const boxInput=document.createElement('input');boxInput.type='checkbox';boxInput.id='consentTick';
 label.append(boxInput,document.createTextNode(' קראתי את מדיניות הפרטיות ואני מסכים/ה לשמור במכשיר הזה שם פרטי של הילד, בלי מספר זהות.'));
 const go=pilotEl('button','button','המשך');go.type='button';go.disabled=true;
 boxInput.onchange=()=>{go.disabled=!boxInput.checked};
 go.onclick=()=>{if(!boxInput.checked)return;pilotStore('homework-parent-consent','1');render()};
 card.append(label,go);box.prepend(card);
}
const BADGE_ICON={'first-week':'📅','streak-5':'🔥','all-done':'⭐','early-bird':'🌅'};
function goalBar(goal){const row=pilotEl('div','goal');row.append(pilotEl('strong','',Math.round(goal.ratio*100)+'%'));const bar=meter(goal.ratio);bar.append(pilotEl('span','goalMark',''));row.append(bar);return row}
function renderPlayHeader(view){
 const row=pilotEl('div','playRow');
 const flame=pilotEl('div','flame');flame.append(pilotEl('span','','🔥'),pilotEl('strong','',String(view.streak)));
 const ring=pilotEl('div','ring');ring.style.setProperty('--p',Math.round(view.level.ratio*100)+'%');ring.append(pilotEl('span','',String(view.level.level)));
 const stars=pilotEl('span','stars','★ '+view.xp);
 const badges=pilotEl('div','badges');
 for(const id of view.badges)badges.append(pilotEl('span','badgeIcon',BADGE_ICON[id]||'★'));
 row.append(flame,ring,stars,badges);return row}
function celebrate(view,studentId,day){
 if(!view.justCompleted||role!=='child')return;
 markCelebrated(school,studentId,day);saveSchool();
 if(document.getElementById('confetti'))return;
 const layer=pilotEl('div','');layer.id='confetti';
 for(let i=0;i<16;i++){const bit=document.createElement('i');bit.style.left=(8+Math.random()*84)+'%';bit.style.background=['#3B82F6','#38BDF8','#FBBF24','#34D399','#F472B6'][i%5];bit.style.animationDelay=(Math.random()*0.15)+'s';layer.append(bit)}
 document.body.append(layer);setTimeout(()=>layer.remove(),2200);
 if(ensurePlay(school).effects&&navigator.vibrate)navigator.vibrate(12)}
function appendEveningBoard(box,classId,day){
 const classroom=school.classes.find(row=>row.id===classId);
 let subjects=classroom?.subjects||PILOT_SUBJECTS.slice();
 try{const lessons=ttDayFor(classId,new Date(day+'T12:00:00').getDay());if(lessons.length)subjects=[...new Set(lessons.map(row=>row.subject))]}catch{}
 const kid=typeof activeStudentId==='function'?activeStudentId():school.studentId;
 if(kid&&classId){
  const view=syncStudentDay(school,records,{studentId:kid,classId,day,hour:new Date().getHours(),markChecked:role==='child',subjects});
  if(view.changed)saveSchool();
  box.append(renderPlayHeader(view));
  celebrate(view,kid,day);
  if(view.nothingLeft)box.append(pilotEl('p','happy','הכל מוכן'));
 }
 box.append(pilotEl('h3','','ערב'));
 for(const subject of subjects){
  const info=eveningStatus(records,{classId,subject,day});
  const row=pilotEl('div','eveningRow');row.dataset.status=info.status;
  const name=pilotEl('strong','',subject);if(typeof subjectColor==='function')name.style.color=subjectColor(subject);
  row.append(name,pilotEl('span','badge st-'+info.status,statusLabel(info.status)));
  if(info.status==='homework'){
   const details=pilotEl('span','',info.record.details||'');details.setAttribute('data-user-content','');
   const check=document.createElement('input');check.type='checkbox';check.checked=!!(info.record.completions?.[kid]?.done);
   check.setAttribute('aria-label','הוכן '+subject);
   check.onchange=()=>setStudentCompletion(info.record,check.checked);
   row.append(details,check);
  }
  box.append(row);
 }
}
function appendParentWeek(box){
 const kid=school.studentId;
 const classId=school.students.find(row=>row.id===kid)?.classIds?.[0];
 if(!classId)return;
 const today=todayISO();
 const view=syncStudentDay(school,records,{studentId:kid,classId,day:today,markChecked:false});
 if(view.changed)saveSchool();
 box.append(renderPlayHeader(view));
 const kudos=pilotEl('button','kudos','🌟');kudos.type='button';kudos.setAttribute('aria-label','כל הכבוד');
 const sent=(ensurePlay(school).kudos||[]).some(row=>row.studentId===kid&&row.parentId===school.parentId&&row.day===today);
 kudos.setAttribute('aria-pressed',String(sent));
 kudos.onclick=()=>{addKudos(school,{studentId:kid,parentId:school.parentId,emoji:'🌟',day:today});saveSchool();render()};
 box.append(kudos);
 box.append(pilotEl('h3','','שבוע'));
 const wrap=pilotEl('div','');wrap.id='parentWeek';
 const base=new Date();base.setDate(base.getDate()-base.getDay());
 const names=['ראשון','שני','שלישי','רביעי','חמישי','שישי'];
 for(let i=0;i<6;i++){
  const date=new Date(base.getFullYear(),base.getMonth(),base.getDate()+i);
  const day=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const block=pilotEl('div','weekBlock');block.append(pilotEl('b','',names[i]+' '+date.getDate()));
  for(const subject of subjectsForClass(school,classId)){
   const info=eveningStatus(records,{classId,subject,day});
   const done=info.status==='homework'&&!!info.record.completions?.[kid]?.done;
   const line=pilotEl('div','weekLine',subject+' — '+statusLabel(info.status)+(done?' · הוכן':''));
   line.dataset.status=info.status;block.append(line);
  }
  wrap.append(block);
 }
 box.append(wrap);
}

function dialogShell(id,title){
 let dialog=document.getElementById(id);
 if(!dialog){dialog=document.createElement('dialog');dialog.id=id;document.body.append(dialog)}
 dialog.innerHTML='';dialog.append(pilotEl('h2','',title));return dialog}
function closeBtn(dialog){const button=pilotEl('button','secondary','סגירה');button.type='button';button.onclick=()=>dialog.close();return button}

function openJoin(kind,code){
 const dialog=dialogShell('joinDialog','הצטרפות עם קוד');
 const tabs=pilotEl('div','roles');
 for(const [id,label] of [['student','תלמיד/ה'],['parent','הורה'],['teacher','מורה']]){
  const button=pilotEl('button',id===kind?'active':'',label);button.type='button';button.onclick=()=>openJoin(id,dialog.querySelector('input.ltr')?.value||code);tabs.append(button);
 }
 dialog.append(tabs);
 const form=document.createElement('form');
 const codeLabel=pilotEl('label','',kind==='parent'?'קוד הורה':kind==='teacher'?'קוד מורה':'קוד כיתה');
 const codeInput=document.createElement('input');codeInput.className='ltr';codeInput.dir='ltr';codeInput.value=code||'';codeInput.required=true;codeInput.maxLength=12;codeLabel.append(codeInput);
 const nameLabel=pilotEl('label','',kind==='parent'?'השם שלכם':'שם פרטי');
 const nameInput=document.createElement('input');nameInput.maxLength=40;nameInput.required=true;nameInput.autocomplete='given-name';nameLabel.append(nameInput);
 const status=pilotEl('p','');status.setAttribute('role','status');
 if(kind==='parent'){
  const consent=pilotEl('label','');const tick=document.createElement('input');tick.type='checkbox';tick.required=true;consent.append(tick,document.createTextNode(' קראתי את מדיניות הפרטיות ואני מסכים/ה'));
  const policy=pilotEl('a','','מדיניות הפרטיות');policy.href='privacy.html';consent.append(document.createTextNode(' · '),policy);form.append(codeLabel,nameLabel,consent);
 }else form.append(codeLabel,nameLabel);
 form.append(pilotEl('p','','בלי אימייל ובלי מספר זהות. הנתונים נשמרים במכשיר הזה, או במכשיר שייבא את קישור השיתוף.'));
 const submit=pilotEl('button','button','הצטרפות');submit.type='submit';form.append(submit,status);
 form.onsubmit=event=>{
  event.preventDefault();
  if(kind==='student'){
   const result=joinStudent(school,{code:codeInput.value,firstName:nameInput.value});
   status.textContent=result.ok?`שלום ${result.student.name}, הצטרפתם לכיתה ${result.class.name}.`:(result.error||'ההצטרפות נכשלה');
   if(!result.ok)return;
   school.childId=result.student.id;school.studentId=result.student.id;school.classId=result.class.id;school.schoolId=result.schoolId;
   school.scope={type:'class',classId:result.class.id,schoolId:result.schoolId,orgId:school.schools.find(row=>row.id===result.schoolId)?.orgId||null,nodeId:'class:'+result.class.id};
   role='child';saveSchool();dialog.close();render();return;
  }
  if(kind==='parent'){
   if(!form.querySelector('input[type=checkbox]').checked){status.textContent='צריך לסמן הסכמה.';return}
   const result=linkParent(school,{code:codeInput.value,name:nameInput.value});
   status.textContent=result.ok?`קושרתם אל ${result.student.name}.`:(result.error||'הקישור נכשל');
   if(!result.ok)return;
   pilotStore('homework-parent-consent','1');
   school.parentId=result.parent.id;school.studentId=result.student.id;school.classId=result.student.classIds[0]||school.classId;
   school.schoolId=school.classes.find(row=>row.id===school.classId)?.schoolId||school.schoolId;role='parent';saveSchool();dialog.close();render();return;
  }
  const result=redeemTeacherInvite(school,{code:codeInput.value,firstName:nameInput.value});
  status.textContent=result.ok?`שלום ${result.teacher.name}, שויכתם לכיתות.`:(result.error||'הקוד לא נמצא');
  if(!result.ok)return;
  if(typeof demoClassPermissions!=='undefined'){
   for(const row of result.permissions)demoClassPermissions=demoClassPermissions.filter(item=>item.class_id!==row.class_id||item.user_id!==row.user_id).concat(row);
   try{localStorage.setItem('homework-class-permissions',JSON.stringify(demoClassPermissions))}catch{}
  }
  school.teacherId=result.teacher.id;school.classId=result.teacher.classIds[0]||school.classId;
  school.schoolId=school.classes.find(row=>row.id===school.classId)?.schoolId||school.schoolId;role='teacher';saveSchool();dialog.close();render();
 };
 dialog.append(form,closeBtn(dialog));if(!dialog.open)dialog.showModal();nameInput.focus();
}

function ownerIdentity(){
 if(role==='manager'&&school.managerId)return {id:school.managerId,name:activeManager()?.name||''};
 if(role==='teacher'&&school.teacherId)return {id:school.teacherId,name:activeTeacher()?.name||''};
 return {id:'owner-'+makeJoinCode('owner|'+school.schools.length),name:''};
}
function openOwnerSetup(){
 return;
 const dialog=dialogShell('ownerDialog','הקמת בית ספר');
 const steps=['ארגון','בית ספר','כיתות','מורים','קודי כיתה'];
 const nav=pilotEl('div','wizardSteps');steps.forEach((label,index)=>nav.append(pilotEl('span',index===wiz.step?'on':'',String(index+1)+'. '+label)));
 dialog.append(nav);
 const status=pilotEl('p','');status.setAttribute('role','status');
 const body=pilotEl('div','');
 if(wiz.step===0){
  body.append(pilotEl('p','','אפשר לדלג. בית ספר אחד לא צריך ארגון.'));
  const label=pilotEl('label','','שם הארגון (רשות)');const input=document.createElement('input');input.maxLength=80;label.append(input);body.append(label);
  const row=pilotEl('div','wizardNav');
  const skip=pilotEl('button','secondary','דילוג — בית ספר בלי ארגון');skip.type='button';skip.onclick=()=>{wiz.orgId=null;wiz.step=1;openOwnerSetup()};
  const make=pilotEl('button','button','יצירת הארגון');make.type='button';make.onclick=()=>{const result=createOrganization(school,input.value);if(!result.ok){status.textContent=result.error;return}wiz.orgId=result.organization.id;saveSchool();wiz.step=1;openOwnerSetup()};
  row.append(skip,make);body.append(row);
 }else if(wiz.step===1){
  const who=ownerIdentity();
  const schoolLabel=pilotEl('label','','שם בית הספר');const schoolInput=document.createElement('input');schoolInput.maxLength=100;schoolInput.required=true;schoolLabel.append(schoolInput);
  const ownerLabel=pilotEl('label','','שם הבעלים (מנהל/ת, בלי אימייל)');const ownerInput=document.createElement('input');ownerInput.maxLength=80;ownerInput.value=who.name;ownerLabel.append(ownerInput);
  body.append(schoolLabel,ownerLabel);
  const make=pilotEl('button','button','יצירת בית הספר');make.type='button';make.onclick=()=>{
   const owner=ownerIdentity();const result=claimSchool(school,{name:schoolInput.value,orgId:wiz.orgId,ownerId:owner.id,ownerName:ownerInput.value.trim()||owner.name||'בעל הבית'});
   if(!result.ok){status.textContent=result.error;return}
   wiz.schoolId=result.school.id;school.schoolId=result.school.id;school.classId='';
   if(role==='manager')school.managerId=owner.id;saveSchool();wiz.step=2;openOwnerSetup();
  };
  body.append(make);
 }else if(wiz.step===2){
  body.append(pilotEl('p','','תבנית: כיתות ה׳–ו׳, שלוש כיתות בכל שכבה. אפשר לשנות.'));
  const from=document.createElement('select'),to=document.createElement('select'),per=document.createElement('select');
  for(let grade=4;grade<=8;grade++){from.append(new Option(GRADE_LABEL[grade],grade));to.append(new Option(GRADE_LABEL[grade],grade))}
  for(let n=1;n<=6;n++)per.append(new Option(String(n),n));
  from.value='5';to.value='6';per.value='3';
  const preview=pilotEl('div','classPreview');
  const draw=()=>{preview.textContent='';for(const spec of buildClassTemplate({fromGrade:Number(from.value),toGrade:Number(to.value),perGrade:Number(per.value)}))preview.append(pilotEl('span','',spec.name))};
  from.onchange=to.onchange=per.onchange=draw;draw();
  const row=pilotEl('div','wizardNav');
  const fromLabel=pilotEl('label','','משכבה ');fromLabel.append(from);
  const toLabel=pilotEl('label','','עד ');toLabel.append(to);
  const perLabel=pilotEl('label','','כיתות בשכבה ');perLabel.append(per);
  row.append(fromLabel,toLabel,perLabel);
  body.append(row,preview);
  const make=pilotEl('button','button','יצירת הכיתות');make.type='button';make.onclick=()=>{
   const schoolId=wiz.schoolId||school.schoolId;
   const result=addClassesFromTemplate(school,schoolId,{fromGrade:Number(from.value),toGrade:Number(to.value),perGrade:Number(per.value)},role==='teacher'?school.teacherId:null);
   if(!result.ok){status.textContent=result.error;return}
   if(result.classes[0])school.classId=result.classes[0].id;
   school.scope={type:'school',schoolId,orgId:school.schools.find(row=>row.id===schoolId)?.orgId||null,classId:null,nodeId:'school:'+schoolId};
   saveSchool();wiz.step=3;openOwnerSetup();
  };
  body.append(make);
 }else if(wiz.step===3){
  const schoolId=wiz.schoolId||school.schoolId;
  const classes=school.classes.filter(row=>row.schoolId===schoolId);
  body.append(pilotEl('p','','בחרו כיתות, מקצועות והרשאות. השיתוף הוא קישור וואטסאפ או קוד, בלי אימייל.'));
  const classBox=pilotEl('div','');const subjectBox=pilotEl('div','');
  for(const row of classes){const label=pilotEl('label','');const input=document.createElement('input');input.type='checkbox';input.checked=true;input.value=row.id;input.className='inviteClass';label.append(input,document.createTextNode(' '+row.name));classBox.append(label)}
  for(const subject of PILOT_SUBJECTS){const label=pilotEl('label','');const input=document.createElement('input');input.type='checkbox';input.checked=subject==='חשבון';input.value=subject;input.className='inviteSubject';label.append(input,document.createTextNode(' '+subject));subjectBox.append(label)}
  const lessons=document.createElement('input');lessons.type='checkbox';lessons.checked=true;const answers=document.createElement('input');answers.type='checkbox';
  body.append(classBox,subjectBox);
  const perm=pilotEl('div','');
  const lessonsLabel=pilotEl('label','');lessonsLabel.append(lessons,document.createTextNode(' עדכון שיעורים'));
  const answersLabel=pilotEl('label','');answersLabel.append(answers,document.createTextNode(' מענה לשאלות'));
  perm.append(lessonsLabel,answersLabel);body.append(perm);
  const share=pilotEl('button','button','שליחה בוואטסאפ');share.type='button';share.onclick=()=>{
   const classIds=[...classBox.querySelectorAll('input:checked')].map(input=>input.value);
   const subjects=[...subjectBox.querySelectorAll('input:checked')].map(input=>input.value);
   const result=createTeacherInvite(school,{schoolId,classIds,subjects,permissions:{lessons:lessons.checked,answers:answers.checked,publicAnswers:false},origin:pageBase()});
   if(!result.ok){status.textContent=result.error;return}
   saveSchool();status.textContent='קוד מורה: '+result.invite.code;shareWhatsApp(result.text);
  };
  const next=pilotEl('button','secondary','אל קודי הכיתות');next.type='button';next.onclick=()=>{wiz.step=4;openOwnerSetup()};
  body.append(share,next);
 }else{
  const schoolId=wiz.schoolId||school.schoolId;
  for(const row of school.classes.filter(item=>item.schoolId===schoolId)){
   const line=pilotEl('div','shareRow');
   line.append(pilotEl('b','',row.name+' '),pilotEl('code','ltr',row.joinCode));
   const button=pilotEl('button','secondary','וואטסאפ');button.type='button';
   button.onclick=()=>shareWhatsApp(classShareText({schoolName:school.schools.find(item=>item.id===schoolId)?.name||'',className:row.name,code:row.joinCode,link:pageBase()+'#join='+row.joinCode}));
   line.append(button);body.append(line);
  }
  const done=pilotEl('button','button','סיום');done.type='button';done.onclick=()=>{wiz.step=0;dialog.close();render()};
  body.append(done);
 }
 dialog.append(body,status,closeBtn(dialog));
 if(!dialog.open)dialog.showModal();
}

function openPack(){
 const dialog=dialogShell('packDialog','שיתוף בין מכשירים');
 dialog.append(pilotEl('p','','אין שרת. קובץ או קישור מעבירים את בית הספר, הכיתות והעדכונים (בלי הקלטות ובלי תמונות) למכשיר אחר.'));
 const status=pilotEl('p','');status.setAttribute('role','status');
 const file=document.createElement('input');file.type='file';file.accept='application/json';
 file.onchange=()=>{const reader=new FileReader();reader.onload=()=>{try{applyPack(JSON.parse(reader.result));status.textContent='הקובץ יובא למכשיר הזה.';dialog.close();render()}catch{status.textContent='הקובץ לא נקרא'}};reader.readAsText(file.files[0])};
 const download=pilotEl('button','button','הורדת קובץ');download.type='button';download.onclick=()=>{const blob=new Blob([JSON.stringify(packSnapshot(school,records))],{type:'application/json'});const url=URL.createObjectURL(blob);const link=pilotEl('a','','');link.href=url;link.download='nohomework-pilot.json';link.click();URL.revokeObjectURL(url)};
 const encoded=encodePack(packSnapshot(school,records));
 const linkText=pageBase()+'#pack='+encoded;
 const copy=pilotEl('button','secondary','העתקת קישור');copy.type='button';
 const wa=pilotEl('button','secondary','וואטסאפ');wa.type='button';
 if(linkText.length>1800){copy.disabled=wa.disabled=true;status.textContent='החבילה ארוכה מדי לקישור. השתמשו בקובץ.'}
 else{copy.onclick=()=>copyText(linkText,status);wa.onclick=()=>shareWhatsApp('Nohomework — חבילת בית ספר\n'+linkText)}
 const row=pilotEl('div','wizardNav');row.append(download,copy,wa);dialog.append(row);
 const importLabel=pilotEl('label','','ייבוא קובץ');importLabel.append(file);
 dialog.append(importLabel,status,closeBtn(dialog));dialog.showModal();
}
function applyPack(data){
 if(!data||typeof data!=='object')throw new Error('empty');
 mergePilotState(school,data);
 if(Array.isArray(data.records))records=mergeRecords(records,data.records);
 save();saveSchool();
}

function consumeHash(){
 const hash=location.hash||'';
 const pack=hash.match(/^#pack=([A-Za-z0-9_-]+)/);
 const join=hash.match(/^#join=([A-Za-z0-9]+)/i);
 const parent=hash.match(/^#parent=([A-Za-z0-9]+)/i);
 const teach=hash.match(/^#teach=([A-Za-z0-9]+)/i);
 if(!pack&&!join&&!parent&&!teach)return false;
 if(pack){const data=decodePack(pack[1]);if(data)applyPack(data)}
 render();
 if(join)openJoin('student',join[1]);
 else if(parent)openJoin('parent',parent[1]);
 else if(teach)openJoin('teacher',teach[1]);
 history.replaceState(null,'',location.pathname+location.search);
 return true;
}

installAiGate();
if(typeof render==='function'){
 const baseRender=render;
 render=function(){baseRender();try{renderPilot()}catch(error){console.error(error)}};
 if(!consumeHash())render();
}
