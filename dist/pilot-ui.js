/* Pilot screens on top of the local demo. No accounts and no server. */
const treeOpen=new Set();
let treeReady=false;
let addOpen=null;
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
  bar.innerHTML='<div class="pilotHead"><div><b>עץ</b></div><button type="button" class="infoBtn" id="treeInfo" title="אדמין מוסיף בית ספר. מנהל מוסיף כיתה. מורה מוסיף תלמיד והורה." aria-label="אדמין מוסיף בית ספר. מנהל מוסיף כיתה. מורה מוסיף תלמיד והורה.">i</button></div><nav id="pilotCrumbs" aria-label="ניווט מעלה"></nav><input id="pilotSearch" type="search" placeholder="חיפוש" aria-label="חיפוש בית ספר או כיתה"><div id="pilotTree" role="tree"></div><p id="pilotNote" role="status"></p><section id="levelPanel"></section><div class="pilotActions"><button type="button" class="iconBtn" id="openJoin" title="הצטרפות עם קוד" aria-label="הצטרפות עם קוד">⌗</button><button type="button" class="iconBtn" id="openPack" title="שיתוף בין מכשירים" aria-label="שיתוף בין מכשירים">↗</button><button type="button" class="iconBtn" id="openIosGuide" title="הוספה למסך הבית" aria-label="הוספה למסך הבית">＋</button></div>';
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
function renderLevelPanel(nodes){
 const panel=document.getElementById('levelPanel');const crumbs=document.getElementById('pilotCrumbs');
 if(!panel||!crumbs)return;
 const simple=role==='parent'||role==='child';
 panel.hidden=simple;crumbs.hidden=simple;
 crumbs.textContent='';panel.textContent='';
 if(simple)return;
 const node=nodes.find(item=>item.id===school.scope?.nodeId)||nodes.find(item=>item.type==='root')||nodes[0];
 if(!node){panel.append(pilotEl('p','emptyState','אין נתונים'));return}
 for(const crumb of crumbTrail(nodes,node)){
  const button=pilotEl('button','crumb',crumb.label);button.type='button';button.setAttribute('data-user-content','');
  if(crumb.id===node.id)button.setAttribute('aria-current','page');
  button.onclick=()=>selectTreeNode(crumb);
  crumbs.append(button);
 }
 const day=dayKeySelected();
 if(node.type==='root')renderAdminPanel(panel,day);
 else if(node.type==='school')renderSchoolPanel(panel,node,day);
 else if(node.type==='class'||node.type==='student'||node.type==='parent')renderClassPanel(panel,node.classId?node:nodes.find(item=>item.classId===school.classId&&item.type==='class'),day,node.studentId);
 else panel.append(pilotEl('p','emptyState','אין נתונים'));
}
function renderAdminPanel(panel,day){
 const stats=adminPanelStats(school,records,day);
 panel.append(panelHead('בתי ספר'));
 const cards=pilotEl('div','statGrid');
 cards.append(statCard('עדכון',Math.round(stats.updateRate*100)+'%',stats.updateRate),statCard('לא עודכן',Math.round(stats.notUpdatedShare*100)+'%',stats.notUpdatedShare,'not_updated'),statCard('תלמידים',String(stats.students)));
 panel.append(cards);
 if(role==='admin'){
  const setup=pilotEl('form','setupBox');setup.append(pilotEl('h3','','הוספה'));
  const name=field('בית ספר',{required:true,max:80});const principal=field('מנהל',{required:true});
  const status=pilotEl('p','');status.setAttribute('role','status');
  setup.onsubmit=event=>{event.preventDefault();const result=addManagedSchool(school,{role,name:name.input.value,principalName:principal.input.value});status.textContent=result.ok?'':(result.error||'');if(!result.ok)return;school.schoolId=result.school.id;saveSchool();render()};
  const go=pilotEl('button','button','+');go.type='submit';go.setAttribute('aria-label','הוספת בית ספר');
  setup.append(name.wrap,principal.wrap,go,status);panel.append(setup);
 }
 const list=pilotEl('div','statList');
 if(!stats.perSchool.length)list.append(pilotEl('p','emptyState','אין בתי ספר'));
 for(const row of stats.perSchool){
  const block=pilotEl('div','setupRow');
  const title=pilotEl('button','treeLabel',row.name);title.type='button';title.setAttribute('data-user-content','');
  title.onclick=()=>{const target=managedTree(school,pilotPersona()).find(item=>item.type==='school'&&item.schoolId===row.id);if(target)selectTreeNode(target)};
  const who=pilotEl('span','statHint',row.principal||'');who.setAttribute('data-user-content','');
  block.append(title,who,statLine('עדכון',Math.round(row.updateRate*100)+'%',row.updateRate),statLine('לא עודכן',Math.round(row.notUpdatedShare*100)+'%',row.notUpdatedShare,'not_updated'),statLine('תלמידים',String(row.students)));
  if(role==='admin'){
   const edit=document.createElement('form');edit.className='inlineEdit';
   const schoolName=field('שם',{value:row.name,max:80});const who=field('מנהל',{value:row.principal,max:40});
   edit.onsubmit=event=>{event.preventDefault();const renamed=editManagedSchool(school,{role,schoolId:row.id,name:schoolName.input.value});if(!renamed.ok)return;if(who.input.value.trim()){const assigned=assignPrincipal(school,{role,schoolId:row.id,principalName:who.input.value});if(!assigned.ok)return}saveSchool();render()};
   const save=pilotEl('button','secondary','✓');save.type='submit';save.setAttribute('aria-label','שמירה');
   edit.append(schoolName.wrap,who.wrap,save);block.append(edit);
  }
  list.append(block);
 }
 panel.append(list);
}
function renderSchoolPanel(panel,node,day){
 const stats=schoolPanelStats(school,records,node.schoolId,day);
 panel.append(panelHead(node.label,true));
 const cards=pilotEl('div','statGrid');
 cards.append(statCard('עדכון',Math.round(stats.updateRate*100)+'%',stats.updateRate),statCard('לא עודכן',Math.round(stats.notUpdatedShare*100)+'%',stats.notUpdatedShare,'not_updated'),statCard('תלמידים',String(stats.students)));
 panel.append(cards);
 const owns=role==='manager'&&(school.managers.find(item=>item.id===school.managerId)?.schoolIds||[]).includes(node.schoolId);
 if(owns){
  const setup=pilotEl('form','setupBox');setup.append(pilotEl('h3','','הוספה'));
  const name=field('כיתה',{required:true,max:40});const teacher=field('מורה',{required:true});
  const status=pilotEl('p','');status.setAttribute('role','status');
  setup.onsubmit=event=>{event.preventDefault();const result=addManagedClass(school,{role,schoolId:node.schoolId,name:name.input.value,teacherName:teacher.input.value,managerId:school.managerId});status.textContent=result.ok?'':(result.error||'');if(!result.ok)return;school.classId=result.class.id;school.schoolId=node.schoolId;saveSchool();render()};
  const go=pilotEl('button','button','+');go.type='submit';go.setAttribute('aria-label','הוספת כיתה');
  setup.append(name.wrap,teacher.wrap,go,status);panel.append(setup);
 }
 const list=pilotEl('div','statList');
 if(!stats.perClass.length)list.append(pilotEl('p','emptyState','אין כיתות'));
 for(const row of stats.perClass){
  const block=pilotEl('div','setupRow');
  const title=pilotEl('button','treeLabel',row.name);title.type='button';title.setAttribute('data-user-content','');
  title.onclick=()=>{const target=managedTree(school,pilotPersona()).find(item=>item.type==='class'&&item.classId===row.id);if(target)selectTreeNode(target)};
  const who=pilotEl('span','statHint',row.teacher||'');who.setAttribute('data-user-content','');
  block.append(title,who,statLine('עדכון',Math.round(row.updateRate*100)+'%',row.updateRate),statLine('לא עודכן',Math.round(row.notUpdatedShare*100)+'%',row.notUpdatedShare,'not_updated'),statLine('תלמידים',String(row.students)));
  if(owns){
   const edit=document.createElement('form');edit.className='inlineEdit';
   const who=field('מורה',{value:row.teacher});
   edit.onsubmit=event=>{event.preventDefault();const result=assignClassTeacher(school,{role,classId:row.id,teacherName:who.input.value,managerId:school.managerId});if(!result.ok)return;saveSchool();render()};
   const save=pilotEl('button','secondary','✓');save.type='submit';save.setAttribute('aria-label','שמירת מורה');
   edit.append(who.wrap,save);block.append(edit);
  }
  list.append(block);
 }
 panel.append(list);
}
function renderClassPanel(panel,node,day,focusId){
 if(!node){panel.append(pilotEl('p','emptyState','אין כיתה'));return}
 const stats=classPanelStats(school,records,node.classId,day);
 const classroom=school.classes.find(row=>row.id===node.classId);
 panel.append(panelHead(classroom?.name||node.label,true));
 const cards=pilotEl('div','statGrid');
 cards.append(statCard('פורסם',String(stats.homework),stats.homework?stats.updateRate:0,'homework'),statCard('הוכן',stats.posted?Math.round(stats.doneRate*100)+'%':'0%',stats.doneRate,'homework'),statCard('לא עודכן',Math.round(stats.notUpdatedShare*100)+'%',stats.notUpdatedShare,'not_updated'));
 panel.append(cards);
 const mine=role==='teacher'&&(school.teachers.find(row=>row.id===school.teacherId)?.classIds||[]).includes(node.classId);
 if(mine&&classroom){
  const setup=pilotEl('form','setupBox');setup.append(pilotEl('h3','','הוספה'));
  const student=field('תלמיד',{required:true});const parent=field('הורה');
  const info=pilotEl('button','infoBtn','i');info.type='button';info.title='שם פרטי בלבד, בלי מספר זהות';info.setAttribute('aria-label','שם פרטי בלבד, בלי מספר זהות');
  const status=pilotEl('p','');status.setAttribute('role','status');
  setup.onsubmit=event=>{event.preventDefault();const result=addManagedPeople(school,{role,classId:node.classId,studentName:student.input.value,parentName:parent.input.value,teacherId:school.teacherId});status.textContent=result.ok?'':(result.error||'');if(!result.ok)return;saveSchool();render()};
  const go=pilotEl('button','button','+');go.type='submit';go.setAttribute('aria-label','הוספת תלמיד');
  const code=pilotEl('code','joinCode ltr',classroom.joinCode);code.dir='ltr';code.title='קוד כיתה';
  const share=pilotEl('button','secondary','וואטסאפ');share.type='button';share.setAttribute('aria-label','שליחה בוואטסאפ');
  share.onclick=event=>{event.preventDefault();shareWhatsApp(classShareText({schoolName:school.schools.find(row=>row.id===classroom.schoolId)?.name||'',className:classroom.name,code:classroom.joinCode,link:pageBase()+'#join='+classroom.joinCode}))};
  setup.append(student.wrap,parent.wrap,info,code,go,share,status);panel.append(setup);
 }
 const subjects=pilotEl('div','statList');
 for(const row of stats.perSubject){
  const ratio=row.status==='homework'?row.doneRate:row.status==='no_homework'?1:0;
  subjects.append(statLine(row.subject,statusLabel(row.status),ratio,row.status));
 }
 const people=pilotEl('div','statList');
 if(!stats.perStudent.length)people.append(pilotEl('p','emptyState','אין תלמידים'));
 for(const row of stats.perStudent){
  const line=statLine(row.name+(row.parents.length?' · '+row.parents.join(', '):''),row.posted?row.done+'/'+row.posted:'—',row.doneRate,'homework');
  if(row.id===focusId)line.classList.add('is-on');
  line.querySelector('span').setAttribute('data-user-content','');
  if(mine){
   const student=school.students.find(item=>item.id===row.id);
   if(student?.parentCode){
    const share=pilotEl('button','iconBtn','↗');share.type='button';share.setAttribute('aria-label','שיתוף קוד הורה');
    share.onclick=()=>shareWhatsApp(parentShareText({studentName:student.name,code:student.parentCode,link:pageBase()+'#parent='+student.parentCode}));
    line.querySelector('.statLineTop').append(share);
   }
  }
  people.append(line);
 }
 panel.append(subjects,people);
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
 board.append(pilotEl('h2','','עדכון'));
 if(!classroom){board.append(pilotEl('p','emptyState','בחרו כיתה'));return}
 const day=dayKeySelected();
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
function appendEveningBoard(box,classId,day){
 const classroom=school.classes.find(row=>row.id===classId);
 let subjects=classroom?.subjects||PILOT_SUBJECTS.slice();
 try{const lessons=ttDayFor(classId,new Date(day+'T12:00:00').getDay());if(lessons.length)subjects=[...new Set(lessons.map(row=>row.subject))]}catch{}
 box.append(pilotEl('h3','','ערב'));
 const kid=typeof activeStudentId==='function'?activeStudentId():school.studentId;
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
