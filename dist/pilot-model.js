/* Local-first pilot model. No accounts, no email, no server.
   Organization is optional. A missing homework update is "not updated", never "no homework".
   Student-facing AI explanations are off for grades 4-7. */
const GRADE_LABEL={1:'א׳',2:'ב׳',3:'ג׳',4:'ד׳',5:'ה׳',6:'ו׳',7:'ז׳',8:'ח׳',9:'ט׳',10:'י׳',11:'י״א',12:'י״ב'};
const PILOT_SUBJECTS=['חשבון','עברית','אנגלית','מדעים'];
const CODE_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function fnv(seed){let h=2166136261;const s=String(seed);for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return h>>>0}
function makeJoinCode(seed,taken){
 let n=0,code='';
 do{let h=fnv(String(seed)+'#'+n);code='';for(let i=0;i<6;i++){code+=CODE_ALPHABET[h%CODE_ALPHABET.length];h=Math.imul(h^(i+1),16777619)>>>0}n++}while(taken&&taken.has&&taken.has(code)&&n<50);
 return code}
function normalizeCode(code){return String(code||'').trim().toUpperCase().replace(/[^A-Z0-9]/g,'')}
function ensureLists(school){for(const key of ['organizations','schools','classes','students','teachers','parents','managers','staff','invites'])if(!Array.isArray(school[key]))school[key]=[];return school}
function mergeById(local,incoming){const map=new Map((local||[]).map(row=>[row.id,row]));for(const row of incoming||[])if(row&&row.id!=null)map.set(row.id,{...map.get(row.id),...row});return [...map.values()]}

function gradeFromName(name){
 const s=String(name||'');
 const rules=[[/י״ב|י"ב|יב/,12],[/י״א|י"א|יא/,11],[/י['׳]/,10],[/ט['׳]/,9],[/ח['׳]/,8],[/ז['׳]/,7],[/ו['׳]/,6],[/ה['׳]/,5],[/ד['׳]/,4],[/ג['׳]/,3],[/ב['׳]/,2],[/א['׳]/,1]];
 for(const [re,grade] of rules)if(re.test(s))return grade;
 return null}
function studentFacingAiAllowed(grade){const g=Number(grade);return Number.isInteger(g)&&g>=8&&g<=12}
function teacherVoiceAndOcrAllowed(){return true}

function buildClassTemplate({fromGrade,toGrade,perGrade}){
 const out=[];
 for(let grade=fromGrade;grade<=toGrade;grade++)for(let section=1;section<=perGrade;section++)out.push({grade,section,name:(GRADE_LABEL[grade]||String(grade))+section});
 return out}

function validatePersonName(raw){
 const name=String(raw||'').replace(/\s+/g,' ').trim();
 if(!name)return {ok:false,error:'צריך שם פרטי'};
 if(name.length>40)return {ok:false,error:'השם ארוך מדי'};
 if(/^\d+$/.test(name)||/\d{7,}/.test(name)||/תעודת זהות|ת\.ז/.test(name))return {ok:false,error:'בלי מספר זהות — רק שם פרטי'};
 return {ok:true,name}}

function visibleSchools(school,ctx){
 ensureLists(school);
 if(!ctx||ctx.role==='admin'||!ctx.role)return school.schools;
 if(ctx.role==='manager'){
  const ids=new Set(school.managers.find(m=>m.id===ctx.managerId)?.schoolIds||[]);
  for(const row of school.staff)if(row.userId===ctx.managerId&&row.role==='manager')ids.add(row.schoolId);
  for(const row of school.schools)if(row.ownerId===ctx.managerId)ids.add(row.id);
  return school.schools.filter(row=>ids.has(row.id))}
 if(ctx.role==='teacher'){
  const teacher=school.teachers.find(row=>row.id===ctx.teacherId);
  const classIds=new Set(teacher?.classIds||[]);
  const ids=new Set(school.classes.filter(row=>classIds.has(row.id)).map(row=>row.schoolId));
  for(const row of school.schools)if(row.ownerId===ctx.teacherId)ids.add(row.id);
  return school.schools.filter(row=>ids.has(row.id))}
 if(ctx.role==='parent'||ctx.role==='child'){
  const kidIds=ctx.role==='child'?[ctx.childId]:(school.parents.find(row=>row.id===ctx.parentId)?.studentIds||[]);
  const classIds=new Set(school.students.filter(row=>kidIds.includes(row.id)).flatMap(row=>row.classIds||[]));
  const ids=new Set(school.classes.filter(row=>classIds.has(row.id)).map(row=>row.schoolId));
  return school.schools.filter(row=>ids.has(row.id))}
 return school.schools}

function treeNodes(school,ctx){
 ensureLists(school);
 const schools=ctx?visibleSchools(school,ctx):school.schools;
 const schoolIds=new Set(schools.map(row=>row.id));
 let classes=school.classes.filter(row=>schoolIds.has(row.schoolId));
 if(ctx?.role==='teacher'){const mine=new Set(school.teachers.find(row=>row.id===ctx.teacherId)?.classIds||[]);classes=classes.filter(row=>mine.has(row.id)||school.schools.some(s=>s.id===row.schoolId&&s.ownerId===ctx.teacherId))}
 if(ctx?.role==='parent'||ctx?.role==='child'){
  const kidIds=ctx.role==='child'?[ctx.childId]:(school.parents.find(row=>row.id===ctx.parentId)?.studentIds||[]);
  const mine=new Set(school.students.filter(row=>kidIds.includes(row.id)).flatMap(row=>row.classIds||[]));
  classes=classes.filter(row=>mine.has(row.id))}
 const orgIds=new Set(schools.map(row=>row.orgId).filter(Boolean));
 const nodes=[];
 for(const org of school.organizations)if(orgIds.has(org.id))nodes.push({id:'org:'+org.id,type:'organization',label:org.name,parentId:null,orgId:org.id,schoolId:null,classId:null});
 for(const row of schools)nodes.push({id:'school:'+row.id,type:'school',label:row.name,parentId:row.orgId&&orgIds.has(row.orgId)?'org:'+row.orgId:null,orgId:row.orgId||null,schoolId:row.id,classId:null});
 for(const row of classes){const parent=schools.find(item=>item.id===row.schoolId);nodes.push({id:'class:'+row.id,type:'class',label:row.name,parentId:'school:'+row.schoolId,orgId:parent?.orgId||null,schoolId:row.schoolId,classId:row.id,code:row.joinCode||'',grade:row.grade??null})}
 return nodes}

function searchTree(nodes,query){
 const q=String(query||'').trim().toLowerCase();
 if(!q)return nodes;
 const byId=Object.fromEntries(nodes.map(node=>[node.id,node]));
 const children={};
 for(const node of nodes)if(node.parentId)(children[node.parentId]||=[]).push(node.id);
 const keep=new Set();
 const addDesc=id=>{keep.add(id);for(const child of children[id]||[])addDesc(child)};
 for(const node of nodes){
  const hay=(node.label+' '+(node.code||'')+' '+(node.grade??'')).toLowerCase();
  if(!hay.includes(q))continue;
  keep.add(node.id);let parent=node.parentId;while(parent){keep.add(parent);parent=byId[parent]?.parentId}addDesc(node.id)}
 return nodes.filter(node=>keep.has(node.id))}

function mayAdd(role,kind){return kind==='school'&&role==='admin'||kind==='class'&&role==='manager'||kind==='person'&&role==='teacher'}
function managedTree(school,ctx){
 ensureLists(school);
 const role=ctx?.role||'admin';
 const base=treeNodes(school,role==='admin'?{role:'admin'}:ctx).filter(node=>node.type!=='organization');
 const nodes=[];
 if(role==='admin')nodes.push({id:'root',type:'root',label:'Nohomework',parentId:null,orgId:null,schoolId:null,classId:null,canAdd:'school'});
 for(const node of base){
  const copy={...node,canAdd:null};
  if(role==='admin'&&copy.type==='school')copy.parentId='root';
  if(role!=='admin'&&copy.type==='school')copy.parentId=null;
  if(mayAdd(role,'class')&&copy.type==='school')copy.canAdd='class';
  if(mayAdd(role,'person')&&copy.type==='class')copy.canAdd='person';
  nodes.push(copy);
  if(copy.type!=='class')continue;
  for(const student of school.students.filter(row=>(row.classIds||[]).includes(copy.classId))){
   if(role==='child'&&student.id!==ctx?.childId)continue;
   if(role==='parent'&&!(school.parents.find(row=>row.id===ctx?.parentId)?.studentIds||[]).includes(student.id))continue;
   const studentNode={id:'student:'+student.id+':'+copy.classId,type:'student',label:student.name,parentId:copy.id,orgId:copy.orgId,schoolId:copy.schoolId,classId:copy.classId,studentId:student.id,canAdd:null};
   nodes.push(studentNode);
   if(role==='child')continue;
   for(const parent of school.parents.filter(row=>(row.studentIds||[]).includes(student.id))){
    if(role==='parent'&&parent.id!==ctx?.parentId)continue;
    nodes.push({id:'parent:'+parent.id+':'+student.id+':'+copy.classId,type:'parent',label:parent.name,parentId:studentNode.id,orgId:copy.orgId,schoolId:copy.schoolId,classId:copy.classId,studentId:student.id,canAdd:null});
   }
  }
 }
 return nodes}
function addManagedSchool(school,{role,name,principalName}={}){
 ensureLists(school);
 if(!mayAdd(role,'school'))return {ok:false,error:'רק אדמין מוסיף בית ספר'};
 const principal=validatePersonName(principalName);if(!principal.ok)return {ok:false,error:principal.error==='צריך שם פרטי'?'צריך מנהל':principal.error};
 const existing=school.managers.find(row=>row.name===principal.name);
 const ownerId=existing?existing.id:'mgr-'+makeJoinCode(principal.name+'|'+school.managers.length,new Set(school.managers.map(row=>row.id)));
 const claimed=claimSchool(school,{name,orgId:null,ownerId,ownerName:principal.name});
 if(!claimed.ok)return claimed;
 return {ok:true,school:claimed.school,managerId:ownerId}}
function addManagedClass(school,{role,schoolId,name,teacherName,managerId}={}){
 ensureLists(school);
 if(!mayAdd(role,'class'))return {ok:false,error:'רק מנהל מוסיף כיתה'};
 const clean=String(name||'').trim();if(!clean)return {ok:false,error:'צריך שם כיתה'};
 const teacherNameCheck=validatePersonName(teacherName);if(!teacherNameCheck.ok)return {ok:false,error:teacherNameCheck.error==='צריך שם פרטי'?'צריך מורה':teacherNameCheck.error};
 if(!school.schools.some(row=>row.id===schoolId))return {ok:false,error:'בית הספר לא נמצא'};
 const manager=school.managers.find(row=>row.id===managerId);
 const owns=!!manager&&((manager.schoolIds||[]).includes(schoolId)||school.schools.some(row=>row.id===schoolId&&row.ownerId===managerId));
 if(!owns)return {ok:false,error:'אין הרשאה לבית הספר'};
 if(school.classes.some(row=>row.schoolId===schoolId&&row.name===clean))return {ok:false,error:'הכיתה כבר קיימת'};
 const taken=new Set(school.classes.map(row=>row.joinCode).filter(Boolean));
 const id='cls-'+makeJoinCode(schoolId+'|'+clean+'|'+school.classes.length);
 const row={id,name:clean,schoolId,grade:gradeFromName(clean),joinCode:makeJoinCode('join|'+id,taken),subjects:PILOT_SUBJECTS.slice()};
 school.classes.push(row);
 let teacher=school.teachers.find(item=>item.name===teacherNameCheck.name);
 if(!teacher){teacher={id:'tch-'+makeJoinCode(teacherNameCheck.name+'|'+school.teachers.length),name:teacherNameCheck.name,classIds:[id],subjects:PILOT_SUBJECTS.slice()};school.teachers.push(teacher)}
 else if(!teacher.classIds.includes(id))teacher.classIds.push(id);
 row.ownerId=teacher.id;
 if(!school.staff.some(item=>item.schoolId===schoolId&&item.userId===teacher.id&&item.role==='teacher'))school.staff.push({schoolId,userId:teacher.id,role:'teacher'});
 return {ok:true,class:row,teacher}}
function addManagedPeople(school,{role,classId,studentName,parentName,teacherId}={}){
 ensureLists(school);
 if(!mayAdd(role,'person'))return {ok:false,error:'רק מורה מוסיף תלמיד'};
 const classroom=school.classes.find(row=>row.id===classId);
 if(!classroom)return {ok:false,error:'הכיתה לא נמצאה'};
 const teacher=school.teachers.find(row=>row.id===teacherId);
 if(!teacher||!(teacher.classIds||[]).includes(classId))return {ok:false,error:'אין הרשאה לכיתה'};
 const joined=joinStudent(school,{code:classroom.joinCode,firstName:studentName});
 if(!joined.ok)return joined;
 let parent=null;
 if(String(parentName||'').trim()){
  const linked=linkParent(school,{code:joined.student.parentCode,name:parentName});
  if(!linked.ok)return linked;
  parent=linked.parent}
 return {ok:true,student:joined.student,parent,class:classroom}}
function rememberRecent(list,id,limit=6){return [id,...(list||[]).filter(item=>item!==id)].slice(0,limit)}
function scopeOf(node){return {type:node.type,orgId:node.orgId||null,schoolId:node.schoolId||null,classId:node.classId||null,nodeId:node.id,label:node.label}}
function classIdsInScope(school,scope){
 ensureLists(school);
 if(!scope)return school.classes.map(row=>row.id);
 if(scope.type==='class'&&scope.classId)return school.classes.some(row=>row.id===scope.classId)?[scope.classId]:[];
 if(scope.type==='school'&&scope.schoolId)return school.classes.filter(row=>row.schoolId===scope.schoolId).map(row=>row.id);
 if(scope.type==='organization'&&scope.orgId){const ids=new Set(school.schools.filter(row=>row.orgId===scope.orgId).map(row=>row.id));return school.classes.filter(row=>ids.has(row.schoolId)).map(row=>row.id)}
 return []}

function subjectDayStatus(records,{classId,day,subject}){
 const hits=(records||[]).filter(row=>row&&row.classId===classId&&row.day===day&&row.subject===subject);
 if(!hits.length)return 'not_updated';
 const row=hits[hits.length-1];
 if(row.kind==='none')return 'no_homework';
 if(row.kind==='task')return 'homework';
 return 'not_updated'}
function statusLabel(status){if(status==='no_homework')return 'אין שיעורי בית';if(status==='homework')return 'יש שיעורי בית';return 'לא עודכן'}
function eveningStatus(records,{classId,subject,day}){
 const related=(records||[]).filter(row=>row&&row.classId===classId&&row.subject===subject&&(row.day===day||row.due===day));
 const task=related.find(row=>row.kind==='task'&&(row.due===day||row.day===day));
 if(task)return {status:'homework',record:task};
 const none=related.find(row=>row.kind==='none'&&(row.day===day||row.due===day));
 if(none)return {status:'no_homework',record:none};
 return {status:'not_updated',record:null}}
function subjectsForClass(school,classId){const row=school.classes.find(item=>item.id===classId);return row?.subjects?.length?row.subjects.slice():PILOT_SUBJECTS.slice()}
function scopeSummary(school,records,scope,day){
 const ids=classIdsInScope(school,scope);let notUpdated=0,none=0,homework=0;
 for(const classId of ids)for(const subject of subjectsForClass(school,classId)){const status=subjectDayStatus(records,{classId,day,subject});if(status==='not_updated')notUpdated++;else if(status==='no_homework')none++;else homework++}
 return {classes:ids.length,notUpdated,none,homework}}
function rate(part,whole){return whole?part/whole:0}
function tallyScope(school,records,classIds,day){
 const students=new Set();let slots=0,updated=0,notUpdated=0,homework=0,none=0,done=0,posted=0;
 for(const classId of classIds){
  const kids=school.students.filter(row=>(row.classIds||[]).includes(classId));
  for(const kid of kids)students.add(kid.id);
  for(const subject of subjectsForClass(school,classId)){
   slots++;
   const info=eveningStatus(records,{classId,subject,day});
   if(info.status==='not_updated')notUpdated++;
   else{updated++;if(info.status==='homework'){homework++;posted+=kids.length;done+=kids.filter(kid=>info.record?.completions?.[kid.id]?.done).length}else none++}
  }
 }
 return {slots,updated,notUpdated,homework,none,students:students.size,done,posted,updateRate:rate(updated,slots),notUpdatedShare:rate(notUpdated,slots),doneRate:rate(done,posted)}}
function classPanelStats(school,records,classId,day){
 ensureLists(school);
 const kids=school.students.filter(row=>(row.classIds||[]).includes(classId));
 const subjects=subjectsForClass(school,classId);
 const perSubject=subjects.map(subject=>{
  const info=eveningStatus(records,{classId,subject,day});
  const done=kids.filter(kid=>info.record?.completions?.[kid.id]?.done).length;
  return {subject,status:info.status,posted:info.status==='homework'?1:0,done,students:kids.length,doneRate:rate(done,info.status==='homework'?kids.length:0)};
 });
 const perStudent=kids.map(kid=>{
  let posted=0,done=0,missing=0;
  for(const subject of subjects){const info=eveningStatus(records,{classId,subject,day});if(info.status==='not_updated')missing++;if(info.status==='homework'){posted++;if(info.record?.completions?.[kid.id]?.done)done++}}
  return {id:kid.id,name:kid.name,posted,done,missing,doneRate:rate(done,posted),parents:school.parents.filter(row=>(row.studentIds||[]).includes(kid.id)).map(row=>row.name)};
 });
 return {...tallyScope(school,records,[classId],day),perSubject,perStudent}}
function schoolPanelStats(school,records,schoolId,day){
 ensureLists(school);
 const classes=school.classes.filter(row=>row.schoolId===schoolId);
 const perClass=classes.map(row=>({id:row.id,name:row.name,teacher:school.teachers.find(item=>(item.classIds||[]).includes(row.id))?.name||'',...tallyScope(school,records,[row.id],day)}));
 return {...tallyScope(school,records,classes.map(row=>row.id),day),perClass}}
function adminPanelStats(school,records,day){
 ensureLists(school);
 const perSchool=school.schools.map(row=>{
  const ids=school.classes.filter(item=>item.schoolId===row.id).map(item=>item.id);
  const principal=school.managers.find(item=>(item.schoolIds||[]).includes(row.id));
  return {id:row.id,name:row.name,principal:principal?.name||'',...tallyScope(school,records,ids,day)};
 });
 return {...tallyScope(school,records,school.classes.map(row=>row.id),day),schools:school.schools.length,perSchool}}
function editManagedSchool(school,{role,schoolId,name}={}){
 ensureLists(school);
 if(role!=='admin')return {ok:false,error:'רק אדמין עורך בית ספר'};
 const row=school.schools.find(item=>item.id===schoolId);if(!row)return {ok:false,error:'בית הספר לא נמצא'};
 const clean=String(name||'').trim();if(!clean)return {ok:false,error:'צריך שם'};
 row.name=clean;return {ok:true,school:row}}
function assignPrincipal(school,{role,schoolId,principalName}={}){
 ensureLists(school);
 if(role!=='admin')return {ok:false,error:'רק אדמין ממנה מנהל'};
 const row=school.schools.find(item=>item.id===schoolId);if(!row)return {ok:false,error:'בית הספר לא נמצא'};
 const person=validatePersonName(principalName);if(!person.ok)return {ok:false,error:person.error==='צריך שם פרטי'?'צריך מנהל':person.error};
 let manager=school.managers.find(item=>item.name===person.name);
 if(!manager){manager={id:'mgr-'+makeJoinCode(person.name+'|'+school.managers.length,new Set(school.managers.map(item=>item.id))),name:person.name,schoolIds:[]};school.managers.push(manager)}
 for(const other of school.managers)if(other.id!==manager.id)other.schoolIds=(other.schoolIds||[]).filter(id=>id!==schoolId);
 if(!manager.schoolIds.includes(schoolId))manager.schoolIds.push(schoolId);
 row.ownerId=manager.id;
 school.staff=school.staff.filter(item=>!(item.schoolId===schoolId&&item.role==='manager'&&item.userId!==manager.id));
 if(!school.staff.some(item=>item.schoolId===schoolId&&item.userId===manager.id&&item.role==='manager'))school.staff.push({schoolId,userId:manager.id,role:'manager'});
 return {ok:true,manager}}
function assignClassTeacher(school,{role,classId,teacherName,managerId}={}){
 ensureLists(school);
 if(!mayAdd(role,'class'))return {ok:false,error:'רק מנהל ממנה מורה'};
 const classroom=school.classes.find(row=>row.id===classId);if(!classroom)return {ok:false,error:'הכיתה לא נמצאה'};
 const manager=school.managers.find(row=>row.id===managerId);
 if(!manager||!(manager.schoolIds||[]).includes(classroom.schoolId))return {ok:false,error:'אין הרשאה לבית הספר'};
 const person=validatePersonName(teacherName);if(!person.ok)return {ok:false,error:person.error==='צריך שם פרטי'?'צריך מורה':person.error};
 let teacher=school.teachers.find(row=>row.name===person.name);
 if(!teacher){teacher={id:'tch-'+makeJoinCode(person.name+'|'+school.teachers.length),name:person.name,classIds:[classId],subjects:PILOT_SUBJECTS.slice()};school.teachers.push(teacher)}
 else if(!teacher.classIds.includes(classId))teacher.classIds.push(classId);
 for(const other of school.teachers)if(other.id!==teacher.id)other.classIds=(other.classIds||[]).filter(id=>id!==classId);
 classroom.ownerId=teacher.id;
 if(!school.staff.some(item=>item.schoolId===classroom.schoolId&&item.userId===teacher.id&&item.role==='teacher'))school.staff.push({schoolId:classroom.schoolId,userId:teacher.id,role:'teacher'});
 return {ok:true,teacher,class:classroom}}

function createOrganization(school,name){
 ensureLists(school);const clean=String(name||'').trim();if(!clean)return {ok:false,error:'צריך שם'};
 const existing=school.organizations.find(row=>row.name===clean);if(existing)return {ok:true,organization:existing,reused:true};
 const organization={id:'org-'+makeJoinCode(clean,new Set(school.organizations.map(row=>row.id.slice(4)))),name:clean};
 school.organizations.push(organization);return {ok:true,organization}}
function claimSchool(school,{name,orgId,ownerId,ownerName}){
 ensureLists(school);const clean=String(name||'').trim();
 if(!clean)return {ok:false,error:'צריך שם בית ספר'};
 if(!ownerId)return {ok:false,error:'צריך בעלים'};
 if(orgId&&!school.organizations.some(row=>row.id===orgId))return {ok:false,error:'הארגון לא נמצא'};
 const row={id:'sch-'+makeJoinCode(clean+'|'+String(orgId||'')+'|'+school.schools.length),name:clean,ownerId,orgId:orgId||null};
 school.schools.push(row);
 let manager=school.managers.find(item=>item.id===ownerId);
 if(!manager)school.managers.push({id:ownerId,name:ownerName||'בעל הבית',schoolIds:[row.id]});
 else{if(ownerName)manager.name=ownerName;if(!manager.schoolIds.includes(row.id))manager.schoolIds.push(row.id)}
 if(!school.staff.some(item=>item.schoolId===row.id&&item.userId===ownerId&&item.role==='manager'))school.staff.push({schoolId:row.id,userId:ownerId,role:'manager'});
 return {ok:true,school:row}}
function addClassesFromTemplate(school,schoolId,opts,teacherId){
 ensureLists(school);
 if(!school.schools.some(row=>row.id===schoolId))return {ok:false,error:'בית הספר לא נמצא',classes:[]};
 const from=Number(opts?.fromGrade),to=Number(opts?.toGrade),per=Number(opts?.perGrade);
 if(!(from>=1&&to<=12&&to>=from&&per>=1&&per<=8))return {ok:false,error:'תבנית לא תקינה',classes:[]};
 const taken=new Set(school.classes.map(row=>row.joinCode).filter(Boolean)),created=[];
 for(const spec of buildClassTemplate({fromGrade:from,toGrade:to,perGrade:per})){
  if(school.classes.some(row=>row.schoolId===schoolId&&row.name===spec.name))continue;
  const id='cls-'+makeJoinCode(schoolId+'|'+spec.name),joinCode=makeJoinCode('join|'+id,taken);taken.add(joinCode);
  const row={id,name:spec.name,schoolId,grade:spec.grade,section:spec.section,joinCode,subjects:PILOT_SUBJECTS.slice()};
  school.classes.push(row);created.push(row)}
 if(teacherId){const teacher=school.teachers.find(row=>row.id===teacherId);if(teacher)for(const row of created)if(!teacher.classIds.includes(row.id))teacher.classIds.push(row.id)}
 return {ok:true,classes:created}}

function classShareText({schoolName,className,code,link}){return [`הצטרפות לכיתה ${className}${schoolName?' ב'+schoolName:''} — Nohomework`,`קוד כיתה: ${code}`,'שם פרטי בלבד, בלי מספר זהות.',link||''].filter(Boolean).join('\n')}
function parentShareText({studentName,code,link}){return [`קישור הורה אל ${studentName} — Nohomework`,`קוד הורה: ${code}`,'בלי אימייל ובלי מספר זהות.',link||''].filter(Boolean).join('\n')}
function teacherShareText(school,invite,origin){
 const names=invite.classIds.map(id=>school.classes.find(row=>row.id===id)?.name||id).join(', ');
 const schoolName=school.schools.find(row=>row.id===invite.schoolId)?.name||'';
 const perms=[];if(invite.permissions?.lessons)perms.push('עדכון שיעורים');if(invite.permissions?.answers)perms.push('מענה לשאלות');if(invite.permissions?.publicAnswers)perms.push('פרסום לכיתה');
 const link=origin?String(origin).replace(/#.*$/,'')+'#teach='+invite.code:'';
 return [`הזמנת מורה ל-${schoolName} — Nohomework`,`כיתות: ${names}`,`מקצועות: ${(invite.subjects||[]).join(', ')}`,`הרשאות: ${perms.join(', ')||'צפייה'}`,`קוד: ${invite.code}`,link].filter(Boolean).join('\n')}
function whatsAppUrl(text){return 'https://wa.me/?text='+encodeURIComponent(text)}

function createTeacherInvite(school,{schoolId,classIds,subjects,permissions,origin}){
 ensureLists(school);
 const ids=(classIds||[]).filter(id=>school.classes.some(row=>row.id===id&&row.schoolId===schoolId));
 if(!schoolId||!ids.length)return {ok:false,error:'בחרו כיתה'};
 const code=makeJoinCode('teach|'+schoolId+'|'+ids.join(',')+'|'+school.invites.length,new Set(school.invites.map(row=>row.code)));
 const invite={id:'inv-'+code,code,kind:'teacher',schoolId,classIds:ids,subjects:subjects?.length?subjects.slice():PILOT_SUBJECTS.slice(),permissions:{lessons:permissions?.lessons!==false,answers:!!permissions?.answers,publicAnswers:!!permissions?.publicAnswers},createdAt:new Date().toISOString()};
 school.invites.push(invite);return {ok:true,invite,text:teacherShareText(school,invite,origin)}}
function redeemTeacherInvite(school,{code,firstName}){
 ensureLists(school);
 const invite=school.invites.find(row=>row.code===normalizeCode(code)&&row.kind==='teacher');
 if(!invite)return {ok:false,error:'קוד מורה לא נמצא'};
 const person=validatePersonName(firstName);if(!person.ok)return person;
 let teacher=school.teachers.find(row=>row.name===person.name);
 if(!teacher){teacher={id:'tch-'+makeJoinCode(person.name+'|'+invite.code),name:person.name,classIds:[],subjects:invite.subjects.slice()};school.teachers.push(teacher)}
 for(const id of invite.classIds)if(!teacher.classIds.includes(id))teacher.classIds.push(id);
 teacher.subjects=[...new Set([...(teacher.subjects||[]),...invite.subjects])];
 if(!school.staff.some(row=>row.schoolId===invite.schoolId&&row.userId===teacher.id&&row.role==='teacher'))school.staff.push({schoolId:invite.schoolId,userId:teacher.id,role:'teacher'});
 return {ok:true,teacher,permissions:invite.classIds.map(class_id=>({class_id,user_id:teacher.id,can_update_lessons:!!invite.permissions.lessons,can_answer_questions:!!invite.permissions.answers,can_publish_class_answers:!!invite.permissions.publicAnswers}))}}

function joinStudent(school,{code,firstName}){
 ensureLists(school);
 const classroom=school.classes.find(row=>row.joinCode===normalizeCode(code));
 if(!classroom)return {ok:false,error:'קוד כיתה לא נמצא'};
 const person=validatePersonName(firstName);if(!person.ok)return person;
 let student=school.students.find(row=>row.name===person.name&&row.classIds.includes(classroom.id));
 if(!student){
  const taken=new Set(school.students.map(row=>row.parentCode).filter(Boolean));
  student={id:'stu-'+makeJoinCode(person.name+'|'+classroom.id+'|'+school.students.length),name:person.name,classIds:[classroom.id],parentCode:makeJoinCode('parent|'+person.name+'|'+classroom.id,taken)};
  school.students.push(student)}
 return {ok:true,student,class:classroom,schoolId:classroom.schoolId}}
function linkParent(school,{code,name}){
 ensureLists(school);
 const student=school.students.find(row=>row.parentCode===normalizeCode(code));
 if(!student)return {ok:false,error:'קוד הורה לא נמצא'};
 const person=validatePersonName(name);if(!person.ok)return person;
 let parent=school.parents.find(row=>row.name===person.name);
 if(!parent){parent={id:'par-'+makeJoinCode(person.name+'|'+student.id),name:person.name,studentIds:[student.id]};school.parents.push(parent)}
 else if(!parent.studentIds.includes(student.id))parent.studentIds.push(student.id);
 return {ok:true,parent,student}}
function lookupCode(school,code){
 ensureLists(school);const norm=normalizeCode(code);if(!norm)return {kind:'unknown'};
 const classroom=school.classes.find(row=>row.joinCode===norm);if(classroom)return {kind:'class',class:classroom};
 const student=school.students.find(row=>row.parentCode===norm);if(student)return {kind:'parent',student};
 const invite=school.invites.find(row=>row.code===norm);if(invite)return {kind:'teacher',invite};
 return {kind:'unknown'}}

function utf8Bytes(text){if(typeof TextEncoder!=='undefined')return new TextEncoder().encode(text);const bin=unescape(encodeURIComponent(text));const out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
function utf8Text(bytes){if(typeof TextDecoder!=='undefined')return new TextDecoder().decode(bytes);let bin='';for(const b of bytes)bin+=String.fromCharCode(b);return decodeURIComponent(escape(bin))}
function base64urlEncode(bytes){const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';let out='';for(let i=0;i<bytes.length;i+=3){const a=bytes[i],b=i+1<bytes.length?bytes[i+1]:0,c=i+2<bytes.length?bytes[i+2]:0,n=(a<<16)|(b<<8)|c;out+=chars[(n>>>18)&63]+chars[(n>>>12)&63];if(i+1<bytes.length)out+=chars[(n>>>6)&63];if(i+2<bytes.length)out+=chars[n&63]}return out}
function base64urlDecode(text){const chars='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';const map=new Map([...chars].map((ch,i)=>[ch,i]));const clean=String(text||'').replace(/=+$/,'');const bytes=[];for(let i=0;i<clean.length;i+=4){const n=((map.get(clean[i])||0)<<18)|((map.get(clean[i+1])||0)<<12)|((i+2<clean.length?map.get(clean[i+2])||0:0)<<6)|(i+3<clean.length?map.get(clean[i+3])||0:0);bytes.push((n>>>16)&255);if(i+2<clean.length)bytes.push((n>>>8)&255);if(i+3<clean.length)bytes.push(n&255)}return new Uint8Array(bytes)}
function encodePack(obj){return base64urlEncode(utf8Bytes(JSON.stringify(obj)))}
function decodePack(text){try{return JSON.parse(utf8Text(base64urlDecode(text)))}catch{return null}}
const XP_PER_TICK=10;
const LEVEL_STEP=50;
function parseISODate(day){const [y,m,d]=String(day||'').split('-').map(Number);return new Date(y,(m||1)-1,d||1)}
function formatISODate(date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`}
function todayISO(){return formatISODate(new Date())}
function previousSchoolDay(day){const date=parseISODate(day);date.setDate(date.getDate()-1);if(date.getDay()===6)date.setDate(date.getDate()-1);return formatISODate(date)}
function ensurePlay(school){
 if(!school.play||typeof school.play!=='object')school.play={students:{},teachers:{},kudos:[],effects:false};
 school.play.students=school.play.students||{};
 school.play.teachers=school.play.teachers||{};
 if(!Array.isArray(school.play.kudos))school.play.kudos=[];
 if(school.play.effects!==true)school.play.effects=false;
 return school.play}
function studentPlay(school,studentId){
 const play=ensurePlay(school);
 if(!play.students[studentId])play.students[studentId]={xp:0,streak:0,lastComplete:null,checked:{},credited:{},badges:[],completeDays:0,celebrated:null};
 const row=play.students[studentId];
 row.checked=row.checked||{};row.credited=row.credited||{};row.badges=row.badges||[];
 row.xp=row.xp||0;row.streak=row.streak||0;row.completeDays=row.completeDays||0;
 return row}
function teacherPlay(school,teacherId){
 const play=ensurePlay(school);
 if(!play.teachers[teacherId])play.teachers[teacherId]={streak:0,lastPost:null};
 return play.teachers[teacherId]}
function levelFromXp(xp){const n=Math.max(0,Number(xp)||0);const level=Math.floor(n/LEVEL_STEP)+1;const into=n%LEVEL_STEP;return {level,into,span:LEVEL_STEP,ratio:into/LEVEL_STEP,xp:n}}
function homeworkSlots(school,records,classId,day,studentId,subjects){
 const slots=[];
 for(const subject of (subjects?.length?subjects:subjectsForClass(school,classId))){
  const info=eveningStatus(records,{classId,subject,day});
  if(info.status==='homework')slots.push({subject,done:!!info.record?.completions?.[studentId]?.done});
 }
 return slots}
function anchorStreak(row,day,field){const last=row&&row[field];if(!last)return 0;if(last===day||last===previousSchoolDay(day))return row.streak||0;return 0}
function addBadge(row,id){if(id&&!row.badges.includes(id))row.badges.push(id)}
function syncStudentDay(school,records,{studentId,classId,day,hour,markChecked,subjects}={}){
 const row=studentPlay(school,studentId);
 let changed=false;
 if(markChecked&&!row.checked[day]){row.checked[day]=true;changed=true}
 const slots=homeworkSlots(school,records,classId,day,studentId,subjects);
 let granted=0;
 for(const slot of slots)if(slot.done){const key=day+'|'+slot.subject;if(!row.credited[key]){row.credited[key]=true;row.xp+=XP_PER_TICK;granted+=XP_PER_TICK;changed=true}}
 const complete=!!row.checked[day]&&slots.every(slot=>slot.done);
 let justCompleted=false;
 if(complete&&row.lastComplete!==day){
  row.streak=row.lastComplete===previousSchoolDay(day)?row.streak+1:1;
  row.lastComplete=day;row.completeDays+=1;justCompleted=true;changed=true;
  if(slots.length)addBadge(row,'all-done');
  if(row.streak>=5)addBadge(row,'streak-5');
  if(row.completeDays>=5)addBadge(row,'first-week');
  if(hour!=null&&Number(hour)<16)addBadge(row,'early-bird');
 }
 return {xp:row.xp,level:levelFromXp(row.xp),streak:anchorStreak(row,day,'lastComplete'),badges:row.badges.slice(),justCompleted,nothingLeft:complete,pending:slots.filter(slot=>!slot.done).length,granted,changed}}
function markCelebrated(school,studentId,day){studentPlay(school,studentId).celebrated=day}
function classWeekGoal(school,records,classId,day){
 ensureLists(school);
 const date=parseISODate(day);const start=new Date(date);start.setDate(date.getDate()-date.getDay());
 const kids=school.students.filter(row=>(row.classIds||[]).includes(classId));
 let posted=0,done=0;
 for(let i=0;i<6;i++){
  const cursor=new Date(start);cursor.setDate(start.getDate()+i);const key=formatISODate(cursor);
  for(const subject of subjectsForClass(school,classId)){
   const info=eveningStatus(records,{classId,subject,day:key});
   if(info.status!=='homework')continue;
   for(const kid of kids){posted++;if(info.record?.completions?.[kid.id]?.done)done++}
  }
 }
 const ratio=posted?done/posted:0;
 return {done,posted,ratio,goal:0.8,met:posted>0&&ratio>=0.8}}
function classUpdatedToday(school,records,classId,day){return subjectsForClass(school,classId).every(subject=>subjectDayStatus(records,{classId,day,subject})!=='not_updated')}
function syncTeacherDay(school,records,{teacherId,classIds,day}={}){
 const ids=(classIds||[]).filter(Boolean);
 const updated=ids.length>0&&ids.every(id=>classUpdatedToday(school,records,id,day));
 const row=teacherPlay(school,teacherId);
 let changed=false;
 if(updated&&row.lastPost!==day){row.streak=row.lastPost===previousSchoolDay(day)?row.streak+1:1;row.lastPost=day;changed=true}
 return {updated,streak:anchorStreak(row,day,'lastPost'),changed}}
function addKudos(school,{studentId,parentId,emoji,day}={}){
 const play=ensurePlay(school);
 const mark=emoji||'🌟';
 const existing=play.kudos.find(row=>row.studentId===studentId&&row.parentId===parentId&&row.day===day);
 if(existing)return {ok:true,kudos:existing,reused:true};
 const kudos={id:'kudos-'+studentId+'-'+parentId+'-'+day,studentId,parentId,emoji:mark,day};
 play.kudos.push(kudos);
 return {ok:true,kudos,reused:false}}
function mergePlay(local,incoming){
 const play=ensurePlay(local);const extra=incoming?.play;if(!extra)return play;
 for(const [id,row] of Object.entries(extra.students||{})){
  const mine=studentPlay(local,id);
  if((row.xp||0)>mine.xp)mine.xp=row.xp;
  if((row.completeDays||0)>mine.completeDays)mine.completeDays=row.completeDays;
  if((row.streak||0)>mine.streak){mine.streak=row.streak;mine.lastComplete=row.lastComplete||mine.lastComplete}
  mine.badges=[...new Set([...(mine.badges||[]),...(row.badges||[])])];
  mine.checked={...mine.checked,...(row.checked||{})};
  mine.credited={...mine.credited,...(row.credited||{})};
 }
 for(const [id,row] of Object.entries(extra.teachers||{})){
  const mine=teacherPlay(local,id);
  if((row.streak||0)>mine.streak){mine.streak=row.streak;mine.lastPost=row.lastPost||mine.lastPost}
 }
 const seen=new Set(play.kudos.map(row=>row.id));
 for(const row of extra.kudos||[])if(row?.id&&!seen.has(row.id))play.kudos.push(row);
 play.effects=false;
 return play}
function mergePilotState(local,incoming){
 ensureLists(local);ensureLists(incoming);
 for(const key of ['organizations','schools','classes','students','teachers','parents','managers','invites'])local[key]=mergeById(local[key],incoming[key]);
 const staffKey=row=>row.schoolId+'|'+row.userId+'|'+row.role;const staff=new Map(local.staff.map(row=>[staffKey(row),row]));
 for(const row of incoming.staff||[])if(row)staff.set(staffKey(row),row);local.staff=[...staff.values()];
 mergePlay(local,incoming);return local}
function mergeRecords(local,incoming){
 const key=row=>row.classId+'|'+row.day+'|'+row.subject;const map=new Map();
 for(const row of local||[])if(row&&row.classId&&row.day&&row.subject)map.set(key(row),row);
 for(const row of incoming||[])if(row&&row.classId&&row.day&&row.subject)map.set(key(row),{...map.get(key(row)),...row});
 return [...map.values()]}
function appDirectory(href){
 const url=new URL(href);
 if(!url.pathname.endsWith('/')){
  const parts=url.pathname.split('/');
  const last=parts[parts.length-1]||'';
  if(/\.[a-z0-9]+$/i.test(last))parts.pop();else parts.push('');
  url.pathname=parts.join('/')||'/';
  if(!url.pathname.endsWith('/'))url.pathname+='/';
 }
 url.search='';url.hash='';
 return url.href}
function packSnapshot(school,records){
 ensureLists(school);
 return {v:1,organizations:school.organizations,schools:school.schools,classes:school.classes.map(row=>({id:row.id,name:row.name,schoolId:row.schoolId,grade:row.grade??null,joinCode:row.joinCode,subjects:row.subjects||PILOT_SUBJECTS.slice()})),students:school.students.map(row=>({id:row.id,name:row.name,classIds:row.classIds,parentCode:row.parentCode})),teachers:school.teachers,parents:school.parents,managers:school.managers,staff:school.staff,invites:school.invites,play:ensurePlay(school),records:(records||[]).map(row=>({classId:row.classId,day:row.day,subject:row.subject,teacher:row.teacher,kind:row.kind,details:row.details,due:row.due,dueTime:row.dueTime,completions:row.completions,lesson:row.lesson}))}}
