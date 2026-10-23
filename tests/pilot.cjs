const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const ctx=vm.createContext({Math,Date,JSON,TextEncoder,TextDecoder,Uint8Array,Set,Map,Object,Array,String,Number,Error,isNaN,encodeURIComponent,decodeURIComponent});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','dist','pilot-model.js'),'utf8'),ctx);
function demoSchool(){
 return {organizations:[{id:'org1',name:'עיריית הדגמה'}],schools:[{id:'s1',name:'אופק',orgId:'org1',ownerId:'m1'},{id:'s2',name:'ניצנים',orgId:null,ownerId:'m2'}],classes:[{id:'c1',name:'ה׳1',schoolId:'s1',grade:5,joinCode:'AAAAAA'},{id:'c2',name:'ה׳2',schoolId:'s1',grade:5,joinCode:'BBBBBB'},{id:'c3',name:'ו׳1',schoolId:'s2',grade:6,joinCode:'CCCCCC'}],students:[{id:'st1',name:'נועם',classIds:['c1'],parentCode:'PPPPPP'},{id:'st2',name:'מאיה',classIds:['c3'],parentCode:'QQQQQQ'}],teachers:[{id:'t1',name:'מיכל',classIds:['c1','c2']}],parents:[{id:'p1',name:'דנה',studentIds:['st1','st2']}],managers:[{id:'m1',name:'יוסי',schoolIds:['s1']},{id:'m2',name:'שרה',schoolIds:['s2']}],staff:[],invites:[]};
}

// Tree: organization is optional, search keeps the branch, recent list, scope follows the node.
ctx.school=demoSchool();
const all=vm.runInContext('treeNodes(school)',ctx);
assert.ok(all.some(n=>n.type==='organization'&&n.label==='עיריית הדגמה'));
assert.ok(all.some(n=>n.type==='school'&&n.label==='ניצנים'&&n.parentId===null),'a school works without an organization');
assert.equal(all.find(n=>n.label==='ה׳1').parentId,'school:s1');
const parentNodes=vm.runInContext("treeNodes(school,{role:'parent',parentId:'p1'})",ctx);
assert.ok(parentNodes.some(n=>n.schoolId==='s1')&&parentNodes.some(n=>n.schoolId==='s2'),'a parent with children in two schools sees both');
const teacherNodes=vm.runInContext("treeNodes(school,{role:'teacher',teacherId:'t1'})",ctx);
assert.ok(teacherNodes.some(n=>n.classId==='c2'));
assert.ok(!teacherNodes.some(n=>n.schoolId==='s2'));
const found=vm.runInContext("searchTree(treeNodes(school),'ה׳2')",ctx);
assert.deepEqual([...found.map(n=>n.label)],['עיריית הדגמה','אופק','ה׳2']);
const lone=vm.runInContext("searchTree(treeNodes(school),'ו׳1')",ctx);
assert.ok(lone.some(n=>n.label==='ניצנים')&&!lone.some(n=>n.type==='organization'));
assert.deepEqual([...vm.runInContext("rememberRecent(['c1'],'c2')",ctx)],['c2','c1']);
assert.equal(vm.runInContext("rememberRecent(['a','b','c','d','e','f'],'a',5).length",ctx),5);
const scope=vm.runInContext("scopeOf(treeNodes(school).find(n=>n.classId==='c1'))",ctx);
assert.equal(scope.type,'class');assert.equal(scope.classId,'c1');assert.equal(scope.schoolId,'s1');assert.equal(scope.orgId,'org1');
const orgIds=vm.runInContext("classIdsInScope(school,{type:'organization',orgId:'org1'})",ctx);
assert.deepEqual([...orgIds].sort(),['c1','c2']);
assert.ok(!orgIds.includes('c3'));

// Template: grades 4-6, three classes each.
const template=vm.runInContext('buildClassTemplate({fromGrade:4,toGrade:6,perGrade:3})',ctx);
assert.equal(template.length,9);
assert.equal(template[0].name,'ד׳1');
assert.equal(template[template.length-1].name,'ו׳3');
assert.deepEqual([...new Set(template.map(x=>x.grade))],[4,5,6]);

// Explicit no-homework versus a missing update.
const day='2026-10-25',tomorrow='2026-10-26';
ctx.records=[{classId:'c1',day,subject:'חשבון',kind:'task',due:tomorrow,details:'עמוד 1'},{classId:'c1',day,subject:'עברית',kind:'none',due:day},{classId:'c1',day,subject:'מדעים',kind:''}];
assert.equal(vm.runInContext(`subjectDayStatus(records,{classId:'c1',day:'${day}',subject:'חשבון'})`,ctx),'homework');
assert.equal(vm.runInContext(`subjectDayStatus(records,{classId:'c1',day:'${day}',subject:'עברית'})`,ctx),'no_homework');
assert.equal(vm.runInContext(`subjectDayStatus(records,{classId:'c1',day:'${day}',subject:'אנגלית'})`,ctx),'not_updated');
assert.notEqual(vm.runInContext(`subjectDayStatus(records,{classId:'c1',day:'${day}',subject:'אנגלית'})`,ctx),'no_homework');
assert.equal(vm.runInContext(`subjectDayStatus(records,{classId:'c1',day:'${day}',subject:'מדעים'})`,ctx),'not_updated');
assert.equal(vm.runInContext(`statusLabel(subjectDayStatus(records,{classId:'c1',day:'${day}',subject:'אנגלית'}))`,ctx),'לא עודכן');
assert.equal(vm.runInContext(`statusLabel('no_homework')`,ctx),'אין שיעורי בית');
assert.equal(vm.runInContext(`eveningStatus(records,{classId:'c1',subject:'חשבון',day:'${tomorrow}'}).status`,ctx),'homework');
assert.equal(vm.runInContext(`eveningStatus(records,{classId:'c1',subject:'עברית',day:'${day}'}).status`,ctx),'no_homework');
assert.equal(vm.runInContext(`eveningStatus(records,{classId:'c1',subject:'עברית',day:'${tomorrow}'}).status`,ctx),'not_updated','an explicit none for one day is not no-homework on the next day');
assert.equal(vm.runInContext(`eveningStatus(records,{classId:'c1',subject:'אנגלית',day:'${tomorrow}'}).status`,ctx),'not_updated');

// Class-code join: first name only, parent link code, no identity number.
const joined=vm.runInContext("joinStudent(school,{code:'aaaaaa',firstName:'  יונתן  '})",ctx);
assert.equal(joined.ok,true);
assert.equal(joined.student.name,'יונתן');
assert.ok(joined.student.classIds.includes('c1'));
assert.equal(joined.student.idNumber,undefined);
assert.equal(joined.student.nationalId,undefined);
assert.ok(!Object.keys(joined.student).some(k=>/idnumber|national|teudat|tz/i.test(k)));
assert.equal(vm.runInContext("joinStudent(school,{code:'AAAAAA',firstName:'123456789'}).ok",ctx),false);
assert.equal(vm.runInContext("joinStudent(school,{code:'NOPE',firstName:'יונתן'}).ok",ctx),false);
vm.runInContext("joinStudent(school,{code:'AAAAAA',firstName:'יונתן'})",ctx);
assert.equal(vm.runInContext("school.students.filter(s=>s.name==='יונתן').length",ctx),1);
const linked=vm.runInContext("linkParent(school,{code:school.students.find(s=>s.name==='יונתן').parentCode,name:'רונית'})",ctx);
assert.equal(linked.ok,true);
assert.ok(linked.parent.studentIds.includes(joined.student.id));
assert.equal(vm.runInContext("linkParent(school,{code:'ZZZZZZ',name:'רונית'}).ok",ctx),false);

// Owner setup has no email, and a teacher invite is a code plus a WhatsApp message.
ctx.blank={};
const org=vm.runInContext("createOrganization(blank,'רשת הדגמה')",ctx);
assert.equal(org.ok,true);
assert.equal(org.organization.email,undefined);
const claimed=vm.runInContext("claimSchool(blank,{name:'בית ספר הרצל',orgId:blank.organizations[0].id,ownerId:'owner1',ownerName:'דנה מנהלת'})",ctx);
assert.equal(claimed.ok,true);
assert.equal(claimed.school.ownerId,'owner1');
assert.equal(claimed.school.email,undefined);
const made=vm.runInContext("addClassesFromTemplate(blank,blank.schools[0].id,{fromGrade:5,toGrade:6,perGrade:3},null)",ctx);
assert.equal(made.ok,true);
assert.equal(made.classes.length,6);
assert.ok(made.classes.every(c=>c.joinCode&&c.grade>=5&&c.grade<=6));
const invite=vm.runInContext("createTeacherInvite(blank,{schoolId:blank.schools[0].id,classIds:blank.classes.slice(0,2).map(c=>c.id),subjects:['חשבון'],permissions:{lessons:true,answers:true,publicAnswers:false},origin:'https://demo.example/'})",ctx);
assert.equal(invite.ok,true);
assert.equal(invite.invite.email,undefined);
assert.match(invite.text,/חשבון/);
assert.ok(invite.text.includes(invite.invite.code));
ctx.inviteText=invite.text;
assert.ok(vm.runInContext('whatsAppUrl(inviteText)',ctx).startsWith('https://wa.me/?text='));
const redeemed=vm.runInContext("redeemTeacherInvite(blank,{code:blank.invites[0].code,firstName:'יעל'})",ctx);
assert.equal(redeemed.ok,true);
assert.ok(redeemed.teacher.classIds.includes(made.classes[0].id));
assert.equal(redeemed.permissions[0].can_update_lessons,true);
assert.equal(redeemed.permissions[0].can_publish_class_answers,false);

// Share pack round-trip, including Hebrew, without a backend.
ctx.packed=vm.runInContext("encodePack({name:'ה׳2',records:[{classId:'c1',day:'2026-10-25',subject:'עברית',kind:'none'}]})",ctx);
const unpacked=vm.runInContext('decodePack(packed)',ctx);
assert.equal(unpacked.name,'ה׳2');
assert.equal(unpacked.records[0].kind,'none');
const merged=vm.runInContext("mergeRecords([{classId:'c1',day:'2026-10-25',subject:'אנגלית',kind:'task'}],[{classId:'c1',day:'2026-10-25',subject:'אנגלית',kind:'none'}])",ctx);
assert.equal(merged.length,1);
assert.equal(merged[0].kind,'none');

// Ministry rule: no student-facing AI explanations in grades 4-7. Teacher voice and OCR stay on.
for(const grade of [4,5,6,7])assert.equal(vm.runInContext(`studentFacingAiAllowed(${grade})`,ctx),false,`grade ${grade}`);
for(const grade of [8,9,10,12])assert.equal(vm.runInContext(`studentFacingAiAllowed(${grade})`,ctx),true);
assert.equal(vm.runInContext('studentFacingAiAllowed(null)',ctx),false);
assert.equal(vm.runInContext("studentFacingAiAllowed('ה׳')",ctx),false);
assert.equal(vm.runInContext('studentFacingAiAllowed(3)',ctx),false);
assert.equal(vm.runInContext('teacherVoiceAndOcrAllowed(4)',ctx),true);
assert.equal(vm.runInContext('teacherVoiceAndOcrAllowed(8)',ctx),true);
assert.equal(vm.runInContext("gradeFromName('ד׳2')",ctx),4);
assert.equal(vm.runInContext("gradeFromName('ה׳2')",ctx),5);
assert.equal(vm.runInContext("gradeFromName('ו׳1')",ctx),6);
assert.equal(vm.runInContext("gradeFromName('חשבון')",ctx),null);

console.log('Passed tree picker, not-updated rule, class-code join, owner invites and AI grade gate.');
