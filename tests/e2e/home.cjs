// Needs Playwright (global) and: cd dist && python3 -m http.server 8099
const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
(async()=>{const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const ctx=await b.newContext({viewport:{width:390,height:800}});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8099/');await p.waitForTimeout(800);
const ev=(f,a)=>p.evaluate(f,a);const res=[];const ok=(n,c)=>{res.push((c?'PASS ':'FAIL ')+n);if(!c)process.exitCode=1};
const setRole=async(r,id)=>{await ev(x=>document.querySelector(`button[data-role="${x}"]`).click(),r);if(id)await ev(([r,id])=>{personaSet(r,id);render()},[r,id]);await p.waitForTimeout(250)};
const say=async t=>{await ev(x=>chatSend(x),t);await p.waitForTimeout(250)};
// teacher quick update in class d2 (noam's class)
await setRole('teacher','michal');
await ev(()=>{school.classId='d2';render()});
await say('עדכון מהיר');await say('חשבון: עמוד 77 תרגילים 1-3');
const rec=await ev(()=>records.find(r=>r.classId==='d2'&&r.subject==='חשבון'&&r.details.includes('77')));
ok('quick update saved a task',!!rec&&rec.kind==='task');
ok('share chip offered',(await ev(()=>chat.lastShare)).includes('עמוד 77'));
await say('📤 שליחה בווטסאפ');
await say('עדכון מהיר');await say('אנגלית: אין');
ok('quick none saved',!!(await ev(()=>records.find(r=>r.classId==='d2'&&r.subject==='אנגלית'&&r.kind==='none'&&r.day===todayKey()))));
// parent home
await setRole('parent','dana-demo');
const tabs=await ev(()=>[...document.querySelectorAll('#tabNav button')].map(b=>b.textContent));
ok('parent tabs start with home: '+tabs.join('|'),tabs[0].includes('מחר'));
ok('home visible by default',await ev(()=>!document.getElementById('homePanel').hidden&&document.querySelector('[data-pane="home"]')&&!document.querySelector('[data-pane="home"]').hidden));
const txt=await ev(()=>document.getElementById('homePanel').innerText);
ok('home shows week strip + lessons',txt.includes('שישי')&&txt.includes('מערכת השעות'));
// make the quick task due tomorrow-school-day for visibility: select the due day
const due=await ev(()=>records.find(r=>r.details.includes('77')).due);
await ev(d=>{home.day=d;renderHome()},due);
const txt2=await ev(()=>document.getElementById('homePanel').innerText);
ok('task visible on its due day for noam',txt2.includes('עמוד 77'));
await ev(()=>{const cb=document.querySelector('#homePanel .taskRow input');cb.click()});await p.waitForTimeout(300);
ok('checkbox marks done',await ev(()=>records.find(r=>r.details.includes('77')).completions['noam-demo']?.done===true));
// kids switch
await ev(()=>[...document.querySelectorAll('#homePanel .homeKids button')].pop().click());await p.waitForTimeout(250);
ok('switch to second kid',(await ev(()=>activeStudent().id))==='tal-demo');
// child sees only own
await setRole('child','maya-demo');
ok('child home no kid switcher',await ev(()=>!document.querySelector('#homePanel .homeKids')));
// teacher has no home tab
await setRole('teacher','michal');
ok('teacher has no home tab',!(await ev(()=>[...document.querySelectorAll('#tabNav button')].map(b=>b.textContent))).some(t=>t.includes('מחר')));
console.log(res.join('\n'));console.log('errors',errs);await p.screenshot({path:process.argv[2]+'/t.png'});
await setRole('parent','dana-demo');await p.waitForTimeout(300);await p.screenshot({path:process.argv[2]+'/home2.png'});await b.close()})();
