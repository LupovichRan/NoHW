// Browser walkthrough of every role/persona. Needs Playwright (global) and: cd dist && python3 -m http.server 8099
const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const assert=require('assert');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const p=await b.newPage({viewport:{width:390,height:800}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8099/');await p.waitForTimeout(800);
const ev=(f,a)=>p.evaluate(f,a);
const setRole=async(r,id)=>{await ev(x=>document.querySelector(`button[data-role="${x}"]`).click(),r);if(id)await ev(([r,id])=>{personaSet(r,id);render()},[r,id]);await p.waitForTimeout(200)};
const say=async t=>{await ev(x=>chatSend(x),t);await p.waitForTimeout(220)};
const menu=()=>ev(()=>menu().map(m=>m[1]));
const flow=async(name,answers)=>{await say(name);for(const a of answers)await say(a);};
const chips=()=>ev(()=>[...document.querySelectorAll('#chatLog button, #chatChips button, .chips button')].map(e=>e.textContent));
const lastBot=()=>ev(()=>{const m=[...document.querySelectorAll('#chatLog > *')];return m.slice(-3).map(e=>e.textContent).join(' | ')});
const data=()=>ev(()=>JSON.parse(JSON.stringify({s:school.students.length,t:school.teachers.length,p:school.parents.length,m:school.managers.length,sc:school.schools.length,c:school.classes.length})));
const res=[];const ok=(n,c)=>{res.push((c?'PASS ':'FAIL ')+n);if(!c)process.exitCode=1};

// ---- TEACHER michal
await setRole('teacher','michal');
let m=await menu();ok('teacher menu has add people',m.includes('הוספת אנשים'));
let who=await ev(()=>FLOWS.people.steps[0].ask().chips);ok('teacher may add only parent/student: '+who,JSON.stringify(who)==='["הורה","תלמיד"]');
ok('teacher sees own classes only',(await ev(()=>school.classes.filter(c=>activeTeacher().classIds.includes(c.id)).length))===3);
let d0=await data();
await say('הוספת אנשים');await say('תלמיד');await say('דנית בדיקה');await say('הוספה');
let d1=await data();ok('teacher added student',d1.s===d0.s+1);
await say('הוספת אנשים');await say('הורה');
const stuChip=(await ev(()=>studentsOfClass().map(withCode)))[0];await say(stuChip);await say('אמא בדיקה');await say('הוספה');
let d2=await data();ok('teacher added parent',d2.p===d1.p+1);
ok('teacher cannot create school',await ev(()=>{const before=school.schools.length;try{document.getElementById('addSchool').onclick()}catch{}return school.schools.length===before}));
// teacher yael has fewer classes
await setRole('teacher','yael');
ok('persona yael only class d2',JSON.stringify(await ev(()=>school.classes.filter(c=>activeTeacher().classIds.includes(c.id)).map(c=>c.id)))==='["d2"]'&&(await ev(()=>activeClassId()))==='d2');

// ---- MANAGER yossi (school-demo)
await setRole('manager','yossi-mgr');
ok('manager sees only his school',JSON.stringify(await ev(()=>[...document.getElementById('activeSchool').options].map(o=>o.value)))==='["school-demo"]');
who=await ev(()=>FLOWS.people.steps[0].ask().chips);ok('manager adds: '+who,JSON.stringify(who)==='["מורה","הורה","תלמיד"]');
d0=await data();
await say('הוספת אנשים');await say('מורה');await say('מורה חדש');await say('הוספה');
d1=await data();ok('manager added teacher',d1.t===d0.t+1);
await say('חיבור לכיתה נוספת');await say('מורה');
const newT=await ev(()=>entityCode(school.teachers[school.teachers.length-1].id));await say(newT);
const cls=await ev(()=>linkClasses({who:'מורה',personId:school.teachers[school.teachers.length-1].id}).map(withCode));ok('manager link classes only own school: '+cls.length,cls.length===2);
await say(cls[0]);await say('חיבור');
ok('teacher linked to class',(await ev(()=>school.teachers[school.teachers.length-1].classIds.length))===1);
ok('manager cannot add manager/school',!(await ev(()=>PEOPLE_BY_ROLE.manager.includes('מנהל בית ספר')||PEOPLE_BY_ROLE.manager.includes('בית ספר'))));
await setRole('manager','sara-mgr');
ok('manager sara sees ניצנים only',JSON.stringify(await ev(()=>[...document.getElementById('activeSchool').options].map(o=>o.value)))==='["school-second"]');

// ---- ADMIN
await setRole('admin');
who=await ev(()=>FLOWS.people.steps[0].ask().chips);ok('admin adds all: '+who.length,who.length===5);
d0=await data();
await say('הוספת אנשים');await say('בית ספר');await say('בית ספר חדש');await say('הוספה');
d1=await data();ok('admin added school',d1.sc===d0.sc+1);
await say('הוספת אנשים');await say('מנהל בית ספר');
const sch=await ev(()=>school.schools.map(withCode));await say(sch[sch.length-1]);await say('מנהל חדש');await say('הוספה');
d2=await data();ok('admin added manager',d2.m===d1.m+1);

// ---- PARENT dana (2 kids, two classes)
await setRole('parent','dana-demo');
const kids=await ev(()=>[...document.getElementById('activeStudent').options].map(o=>o.value));
ok('parent dana sees both her kids: '+kids,JSON.stringify(kids.slice(0,2))==='["noam-demo","tal-demo"]');
const allKids=await ev(()=>school.students.filter(s=>activeParent().studentIds.includes(s.id)).length);ok('dana has 2+ kids',allKids>=2);
d0=await data();
await say('הוספת ילד');await say('גל הקטן');await say('הוספה');
d1=await data();ok('parent added child',d1.s===d0.s+1);
ok('parent menu lacks people other than child',(await ev(()=>PEOPLE_BY_ROLE.parent.join()))==='ילד');
ok('parent ronit does not see dana kids',await (async()=>{await setRole('parent','ronit-demo');return (await ev(()=>[...document.getElementById('activeStudent').options].map(o=>o.value))).every(k=>k==='maya-demo')})());

// ---- CHILD
await setRole('child','noam-demo');
ok('child sees only himself',JSON.stringify(await ev(()=>[...document.getElementById('activeStudent').options].map(o=>o.value)))==='["noam-demo"]');
ok('child cannot add people',!(await menu()).some(x=>x.includes('הוספ')));
console.log(res.join('\n'));console.log('errors',errs);await b.close()})();
