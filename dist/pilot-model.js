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
function mergePilotState(local,incoming){
 ensureLists(local);ensureLists(incoming);
 for(const key of ['organizations','schools','classes','students','teachers','parents','managers','invites'])local[key]=mergeById(local[key],incoming[key]);
 const staffKey=row=>row.schoolId+'|'+row.userId+'|'+row.role;const staff=new Map(local.staff.map(row=>[staffKey(row),row]));
 for(const row of incoming.staff)if(row)staff.set(staffKey(row),row);local.staff=[...staff.values()];return local}
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
 return {v:1,organizations:school.organizations,schools:school.schools,classes:school.classes.map(row=>({id:row.id,name:row.name,schoolId:row.schoolId,grade:row.grade??null,joinCode:row.joinCode,subjects:row.subjects||PILOT_SUBJECTS.slice()})),students:school.students.map(row=>({id:row.id,name:row.name,classIds:row.classIds,parentCode:row.parentCode})),teachers:school.teachers,parents:school.parents,managers:school.managers,staff:school.staff,invites:school.invites,records:(records||[]).map(row=>({classId:row.classId,day:row.day,subject:row.subject,teacher:row.teacher,kind:row.kind,details:row.details,due:row.due,dueTime:row.dueTime,completions:row.completions,lesson:row.lesson}))}}
