const cloud={roleRequests:[],client:null,user:null,profile:null,ready:false,enabled:false,busy:false,notificationPolicies:[],permissions:[],profiles:[],staff:[],invitations:[],subscriptions:[],publicQuestionIds:new Set()};
const cloudStatus=document.getElementById('cloudStatus');
function cloudMessage(text){cloudStatus.textContent=text}
function cloudConfigured(){const c=window.NOHOMEWORK_SUPABASE||{};return !!(c.url&&c.publishableKey)}
function cloudGuard(){if(!cloud.ready)throw new Error('אין חשבון מחובר.');return cloud.client}
async function cloudResult(promise){const result=await promise;if(result.error)throw new Error(result.error.message);return result.data}
async function cloudRefresh(){
 if(!cloud.user)return;const c=cloud.client;const enabled=await cloudResult(c.rpc('school_account_enabled'));if(!enabled){cloud.ready=false;document.getElementById('appContent').hidden=true;throw new Error('החשבון הושבת. פנו לאדמין.');}
 const profile=await cloudResult(c.from('school_profiles').select('*').eq('id',cloud.user.id).single());cloud.profile=profile;try{cloud.roleRequests=await cloudResult(c.from('school_role_requests').select('*'))}catch{cloud.roleRequests=[]}cloud.permissions=await cloudResult(c.from('school_class_permissions').select('*'));cloud.notificationPolicies=await cloudResult(c.from('school_notification_settings').select('*'));
 const [institutions,classes,members,profiles,guardians,lessons,completions,privateQuestions,publicAnswers,drafts]=await Promise.all([
 cloudResult(c.from('school_schools').select('*')),cloudResult(c.from('school_classes').select('*')),cloudResult(c.from('school_members').select('*')),cloudResult(c.from('school_profiles').select('*')),cloudResult(c.from('school_guardians').select('*')),
 cloudResult(c.from('school_lessons').select('*').order('lesson_date',{ascending:false}).limit(500)),cloudResult(c.from('school_completions').select('*')),
 cloudResult(c.from('school_questions').select('*').order('created_at',{ascending:false}).limit(500)),cloudResult(c.from('school_class_answers').select('*').order('created_at',{ascending:false}).limit(500)),cloudResult(c.from('school_ai_drafts').select('*'))
 ]);
 role=profile.role==='student'?'child':profile.role;cloud.staff=await cloudResult(c.from('school_staff').select('*'));cloud.invitations=['admin','manager'].includes(role)?await cloudResult(c.from('school_invitations').select('*').order('created_at',{ascending:false})):[];
 cloud.profiles=profiles;const oldSchool=school.schoolId,oldClass=school.classId,oldStudent=school.studentId;const names=new Map(profiles.map(p=>[p.id,p.display_name]));
 const students=profiles.filter(p=>p.role==='student').map(p=>({id:p.id,name:p.display_name,classIds:members.filter(m=>m.user_id===p.id&&m.member_role==='student').map(m=>m.class_id)}));
 const teacherIds=new Set([...members.filter(m=>m.member_role==='teacher').map(m=>m.user_id),...classes.map(c=>c.owner_teacher_id),...cloud.staff.filter(s=>s.staff_role==='teacher').map(s=>s.user_id)]);
 if(role==='teacher')teacherIds.add(profile.id);
 const teachers=[...teacherIds].map(id=>({id,name:names.get(id)||'מורה',classIds:classes.filter(c=>c.owner_teacher_id===id||members.some(m=>m.class_id===c.id&&m.user_id===id&&m.member_role==='teacher')).map(c=>c.id)}));
 const allowedStudents=['teacher','admin','manager'].includes(role)?students:students.filter(s=>role==='child'?s.id===profile.id:guardians.some(g=>g.parent_id===profile.id&&g.student_id===s.id));
 school={staff:cloud.staff.map(s=>({schoolId:s.school_id,userId:s.user_id,role:s.staff_role})),schools:institutions.map(s=>({id:s.id,name:s.name,ownerId:s.owner_teacher_id})),schoolId:institutions.some(s=>s.id===oldSchool)?oldSchool:institutions[0]?.id||'',classes:classes.map(c=>({id:c.id,name:c.name,schoolId:c.school_id})),students:allowedStudents,teachers,classId:classes.some(c=>c.id===oldClass)?oldClass:classes[0]?.id||'',studentId:allowedStudents.some(s=>s.id===oldStudent)?oldStudent:allowedStudents[0]?.id||'',teacherId:role==='teacher'?profile.id:teachers[0]?.id||''};
 records=lessons.map(l=>({...l.published_content,id:l.id,classId:l.class_id,subject:l.subject,day:l.lesson_date,teacherId:l.teacher_id,teacher:l.published_content.teacher||names.get(l.teacher_id)||'מורה',completions:Object.fromEntries(completions.filter(x=>x.lesson_id===l.id).map(x=>[x.student_id,{done:!!x.completed_at,completedAt:x.completed_at}]))}));
 if(role==='teacher'){for(const d of drafts.filter(d=>d.lesson_id)){const r=records.find(r=>r.id===d.lesson_id);if(r)try{r.explanation=JSON.parse(d.draft)}catch{}}}
 const draftMap=new Map(drafts.filter(d=>d.question_id).map(d=>{let data=null;try{data=JSON.parse(d.draft)}catch{}return[d.question_id,data]}));
 questions=privateQuestions.map(q=>({id:q.id,classId:q.class_id,familyId:q.student_id,authorRole:q.author_id===profile.id?role:(profiles.find(p=>p.id===q.author_id)?.role==='parent'?'parent':'child'),author:q.author_id===profile.id?(role==='parent'?'הורה':'תלמיד'):'שואל',subject:q.subject,text:q.question,createdAt:q.created_at,draft:draftMap.get(q.id)||null,answer:q.approved_answer?{status:'published',text:q.approved_answer,visibility:'private',teacher:names.get(q.answered_by)||'מורה',publishedAt:q.answered_at}:null}));
 for(const answer of publicAnswers){const original=questions.find(q=>q.id===answer.question_id);const value={status:'published',visibility:'class',text:answer.approved_answer,publicQuestion:answer.public_question,teacher:names.get(answer.teacher_id)||'מורה',publishedAt:answer.created_at};if(original)original.answer=value;else questions.push({id:answer.question_id,classId:answer.class_id,familyId:null,authorRole:null,author:'שאלה לכיתה',subject:answer.subject,text:answer.public_question,createdAt:answer.created_at,draft:null,answer:value,publicOnly:true})}
 cloud.publicQuestionIds=new Set(questions.filter(q=>q.publicOnly).map(q=>q.id));
 if(typeof notificationState!=='undefined'){
 const slots=await cloudResult(c.from('school_lesson_slots').select('*'));notificationState.slots=slots.map(s=>({id:s.id,classId:s.class_id,teacherId:s.teacher_id,subject:s.subject,weekday:s.weekday,endTime:s.end_time.slice(0,5)}));
 for(const r of records){if(r.updatedAt&&!notificationState.events.some(e=>e.id==='cloud:'+r.id+':'+r.updatedAt)){notificationState.events.push({id:'cloud:'+r.id+':'+r.updatedAt,classId:r.classId,roles:['child','parent'],title:'עדכון מהמורה',body:r.subject+' · '+r.teacher,createdAt:r.updatedAt})}}
 notificationState.events=notificationState.events.slice(-200);
 }
 cloud.subscriptions=await cloudResult(c.from('school_family_subscriptions').select('*'));
 cloud.ready=true;
 document.querySelector('.roles[aria-label]').hidden=true;document.getElementById('teacherSelector').hidden=true;
 document.querySelector('.demo').textContent='מחובר/ת ל־Supabase · '+profile.display_name;
 document.getElementById('cloudLogin').hidden=true;document.getElementById('authSetupNote').hidden=true;document.getElementById('cloudLogout').hidden=false;
 document.getElementById('cloudAccount').textContent=profile.display_name+' · '+({teacher:'מורה',parent:'הורה',child:'תלמיד',manager:'מנהל בית ספר',admin:'אדמין'}[role]);
 document.getElementById('cloudAccount').hidden=false;cloudMessage(classes.length?'הנתונים משותפים ומוגנים לפי הרשאות החשבון.':'החשבון מחובר. מנהל המערכת צריך לשייך אותך לכיתה.');render();
 document.getElementById('teacherSelector').hidden=true;document.getElementById('activeTeacher').disabled=true;
 // Class selector describes authorized classes; students never choose another child.
 document.getElementById('activeStudent').disabled=role==='child';if(role==='teacher'){document.getElementById('addSchool').hidden=true;document.getElementById('addClass').hidden=true;document.getElementById('addStudent').hidden=true;document.getElementById('addTeacher').hidden=true;document.getElementById('teacherAssignments').hidden=true;}
 const admin=document.getElementById('classAdministration');admin.querySelectorAll('[data-cloud-admin]').forEach(e=>e.hidden=true);
 document.getElementById('localPrivacyNote').textContent='שאלות פרטיות גלויות רק לשואל ולמורי הכיתה. פרסום לכיתה דורש אישור מורה.';
 document.getElementById('classDemoNote').textContent='כיתות ומשתמשים משויכים לחשבון שלך; הרשאות נאכפות במסד הנתונים.';
 document.getElementById('notificationModeNote').textContent='עדכוני שיעור משותפים בין חשבונות. התראות דפדפן דורשות שהאתר יהיה פתוח; אין עדיין Push כשהוא סגור.';
 if(cloud.pendingInviteError)cloudMessage('החשבון מחובר, אך ההזמנה לא התקבלה: '+cloud.pendingInviteError);
 document.getElementById('questionsPrivacyNote').textContent='תשובות מתפרסמות רק לאחר אישור המורה. בחירה בפרטי משאירה אותן לשואל ולמורים.';
}
async function cloudSaveLesson(r){const c=cloudGuard();r.teacher=cloud.profile.display_name;r.teacherId=cloud.user.id;if(r.explanation?.status==='approved')r.explanation.approvedBy=r.teacher;const publicContent={...r};delete publicContent.completions;delete publicContent.id;
 // Unapproved AI content must never be readable by students via the database.
 if(publicContent.explanation?.status!=='approved')publicContent.explanation=null;
 const row=await cloudResult(c.from('school_lessons').upsert({class_id:r.classId,subject:r.subject,lesson_date:r.day,teacher_id:cloud.user.id,published_content:publicContent,due_at:r.kind==='task'?new Date(r.due+'T'+r.dueTime).toISOString():null},{onConflict:'class_id,subject,lesson_date'}).select('id').single());r.id=row.id;
 if(r.explanation?.status==='draft')await cloudResult(c.from('school_ai_drafts').upsert({class_id:r.classId,teacher_id:cloud.user.id,kind:'lesson',lesson_id:row.id,draft:JSON.stringify(r.explanation)},{onConflict:'lesson_id'}));else await cloudResult(c.from('school_ai_drafts').delete().eq('lesson_id',row.id));
 return row;
}
async function cloudCompleteLesson(r,done){const c=cloudGuard();if(cloud.profile.role!=='student')throw new Error('רק תלמיד יכול לסמן את הכנת השיעורים שלו.');await cloudResult(c.from('school_completions').upsert({lesson_id:r.id,student_id:cloud.user.id,completed_at:done?new Date().toISOString():null},{onConflict:'lesson_id,student_id'}))}
async function cloudSaveQuestions(next){const c=cloudGuard();for(const q of next){const old=questions.find(x=>x.id===q.id);if(JSON.stringify(old)===JSON.stringify(q))continue;if(q.publicOnly)continue;
 if(!old){await cloudResult(c.from('school_questions').insert({id:q.id,class_id:q.classId,student_id:q.familyId,author_id:cloud.user.id,subject:q.subject,question:q.text}));continue}
 if(q.draft){await cloudResult(c.from('school_ai_drafts').upsert({class_id:q.classId,teacher_id:cloud.user.id,kind:'answer',question_id:q.id,draft:JSON.stringify(q.draft)},{onConflict:'question_id'}))}
 if(q.answer&&JSON.stringify(q.answer)!==JSON.stringify(old.answer)){
 await cloudResult(c.rpc('publish_school_answer',{question_id:q.id,answer_text:q.answer.text,class_wide:q.answer.visibility==='class',class_question:q.answer.publicQuestion||null}));
 }
}}
async function cloudAdmin(action){const c=cloudGuard();if(cloud.profile.role!=='teacher')return;try{
 if(action==='school'){const name=document.getElementById('newSchoolName').value.trim();if(!name)return;const row=await cloudResult(c.from('school_schools').insert({name,owner_teacher_id:cloud.user.id}).select('id').single());school.schoolId=row.id;school.classId='';}
 if(action==='class'){const name=document.getElementById('newClassName').value.trim();if(!name)return;await cloudResult(c.from('school_classes').insert({name,owner_teacher_id:cloud.user.id,school_id:activeSchoolId()}));}
 if(action==='student'||action==='teacher'){const id=prompt('מזהה UUID של חשבון '+(action==='student'?'התלמיד':'המורה')+' שכבר נרשם למערכת:');if(!id)return;if(!/^[0-9a-f-]{36}$/i.test(id))throw new Error('נדרש UUID תקין של חשבון רשום.');await cloudResult(c.from('school_members').insert({class_id:activeClassId(),user_id:id,member_role:action}));}
 await cloudRefresh();}catch(e){cloudMessage('הפעולה לא הושלמה: '+e.message)}}
async function cloudSlot(slot,remove=false){const c=cloudGuard();if(remove)await cloudResult(c.from('school_lesson_slots').delete().eq('id',slot.id));else await cloudResult(c.from('school_lesson_slots').insert({id:slot.id,class_id:slot.classId,teacher_id:cloud.user.id,subject:slot.subject,weekday:slot.weekday,end_time:slot.endTime}))}
async function initializeCloud(){
 if(!cloudConfigured()){cloudMessage('מצב הדגמה מקומי. לחיבור משותף הגדירו Project URL ומפתח ציבורי בקובץ cloud-config.js.');document.getElementById('cloudLogin').hidden=false;return}document.getElementById('authSetupNote').hidden=true;document.querySelector('.demo')?.setAttribute('hidden','');
 cloud.enabled=true;document.getElementById('appContent').hidden=true;document.querySelector('.roles[aria-label]').hidden=true;
 try{const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm');const config=window.NOHOMEWORK_SUPABASE;cloud.client=createClient(config.url,config.publishableKey);
 const session=await cloudResult(cloud.client.auth.getSession());cloud.user=session.session?.user||null;cloud.client.auth.onAuthStateChange(event=>{if(event==='PASSWORD_RECOVERY'){document.getElementById('passwordRecovery').hidden=false;document.getElementById('cloudLogin').hidden=true;document.getElementById('appContent').hidden=true;}if(event==='SIGNED_OUT'){cloud.ready=false;cloud.user=null;document.getElementById('appContent').hidden=true;document.getElementById('cloudLogin').hidden=false;document.getElementById('cloudLogout').hidden=true;document.getElementById('cloudAccount').hidden=true;cloudMessage('יצאת מהחשבון. היכנסו כדי להמשיך.')}});
 if(cloud.user){if(location.pathname.endsWith('/reset-password')){document.getElementById('passwordRecovery').hidden=false;document.getElementById('cloudLogin').hidden=true;return}await redeemPendingInvitation();await cloudRefresh();document.getElementById('appContent').hidden=false}else cloudMessage('היכנסו לחשבון או הירשמו כדי להתחבר לכיתה.');
 }catch(e){cloudMessage('החיבור לא הושלם: '+e.message)}
}
document.getElementById('cloudSignIn').onclick=async()=>{if(!cloud.client){cloudMessage(t('כניסה אמיתית דורשת חיבור Supabase.'));return;}try{const email=document.getElementById('cloudEmail').value.trim(),password=document.getElementById('cloudPassword').value;const data=await cloudResult(cloud.client.auth.signInWithPassword({email,password}));cloud.user=data.user;await redeemPendingInvitation();await cloudRefresh();document.getElementById('appContent').hidden=false;document.getElementById('cloudPassword').value='';document.getElementById('cloudPasswordConfirm').value='';}catch(e){cloudMessage('לא ניתן להיכנס: '+e.message)}};
document.getElementById('cloudLogout').onclick=async()=>{if(cloud.client)await cloud.client.auth.signOut();location.reload()};
setInterval(async()=>{if(!cloud.ready||cloud.busy||editor.open||answerGenerating||aiGenerating||document.activeElement?.matches('input,textarea,select'))return;cloud.busy=true;try{await cloudRefresh()}catch(e){cloudMessage('רענון הנתונים נכשל: '+e.message)}finally{cloud.busy=false}},30000);
window.addEventListener('load',initializeCloud);
