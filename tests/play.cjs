const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const ctx=vm.createContext({Math,Date,JSON,TextEncoder,TextDecoder,Uint8Array,Set,Map,Object,Array,String,Number,Error,isNaN,encodeURIComponent,decodeURIComponent,URL});
vm.runInContext(fs.readFileSync(path.join(__dirname,'..','dist','pilot-model.js'),'utf8'),ctx);
function blank(){return {organizations:[],schools:[{id:'s1',name:'אופק'}],classes:[{id:'c1',name:'ה׳1',schoolId:'s1',grade:5,subjects:['חשבון','עברית']}],students:[{id:'st1',name:'נועם',classIds:['c1']},{id:'st2',name:'מאיה',classIds:['c1']}],teachers:[{id:'t1',name:'מיכל',classIds:['c1']}],parents:[{id:'p1',name:'דנה',studentIds:['st1']}],managers:[],staff:[],invites:[]}}
function task(day,subject,done){const completions={};if(done)for(const id of done)completions[id]={done:true};return {classId:'c1',day,subject,kind:'task',due:day,completions}}

assert.equal(vm.runInContext("previousSchoolDay('2026-10-25')",ctx),'2026-10-23');
assert.equal(vm.runInContext("previousSchoolDay('2026-10-23')",ctx),'2026-10-22');
assert.equal(vm.runInContext("previousSchoolDay('2026-10-26')",ctx),'2026-10-25');
assert.equal(vm.runInContext('levelFromXp(0).level',ctx),1);
assert.equal(vm.runInContext('levelFromXp(50).level',ctx),2);
assert.equal(vm.runInContext('levelFromXp(50).ratio',ctx),0);
assert.equal(vm.runInContext('levelFromXp(25).ratio',ctx),0.5);

ctx.school=blank();
ctx.records=[task('2026-10-22','חשבון'),task('2026-10-22','עברית')];
assert.equal(vm.runInContext('ensurePlay(school).effects',ctx),false);
let view=vm.runInContext("syncStudentDay(school,records,{studentId:'st1',classId:'c1',day:'2026-10-22',hour:15,markChecked:true})",ctx);
assert.equal(view.streak,0);
assert.equal(view.xp,0);
assert.equal(view.nothingLeft,false);
ctx.records[0].completions.st1={done:true};
view=vm.runInContext("syncStudentDay(school,records,{studentId:'st1',classId:'c1',day:'2026-10-22',hour:15,markChecked:true})",ctx);
assert.equal(view.xp,10);
assert.equal(view.streak,0,'one subject left, so the day is not complete');
ctx.records[1].completions.st1={done:true};
view=vm.runInContext("syncStudentDay(school,records,{studentId:'st1',classId:'c1',day:'2026-10-22',hour:15,markChecked:true})",ctx);
assert.equal(view.justCompleted,true);
assert.equal(view.streak,1);
assert.equal(view.xp,20);
assert.equal(view.nothingLeft,true);
assert.ok(view.badges.includes('all-done'));
assert.ok(view.badges.includes('early-bird'));
view=vm.runInContext("syncStudentDay(school,records,{studentId:'st1',classId:'c1',day:'2026-10-22',hour:15,markChecked:true})",ctx);
assert.equal(view.xp,20,'a repeated tick does not grant more stars');
assert.equal(view.justCompleted,false);

ctx.records.push(task('2026-10-23','חשבון',['st1']),task('2026-10-23','עברית',['st1']));
view=vm.runInContext("syncStudentDay(school,records,{studentId:'st1',classId:'c1',day:'2026-10-23',hour:18,markChecked:true})",ctx);
assert.equal(view.streak,2);
assert.ok(vm.runInContext("studentPlay(school,'st1').badges",ctx).includes('early-bird'));
ctx.records.push(task('2026-10-26','חשבון',['st2']),task('2026-10-26','עברית',['st2']));
const late=vm.runInContext("syncStudentDay(school,records,{studentId:'st2',classId:'c1',day:'2026-10-26',hour:18,markChecked:true})",ctx);
assert.equal(late.justCompleted,true);
assert.ok(!late.badges.includes('early-bird'));

ctx.school=blank();
ctx.records=[];
for(const day of ['2026-10-22','2026-10-23','2026-10-25','2026-10-26','2026-10-27']){
 ctx.records.push(task(day,'חשבון',['st1']),task(day,'עברית',['st1']));
 const step=vm.runInContext(`syncStudentDay(school,records,{studentId:'st1',classId:'c1',day:'${day}',hour:18,markChecked:true})`,ctx);
 assert.ok(step.justCompleted,day);
}
assert.equal(vm.runInContext("anchorStreak(studentPlay(school,'st1'),'2026-10-27','lastComplete')",ctx),5);
assert.ok(vm.runInContext("studentPlay(school,'st1').badges",ctx).includes('streak-5'));
assert.ok(vm.runInContext("studentPlay(school,'st1').badges",ctx).includes('first-week'));

ctx.school=blank();
ctx.records=[task('2026-10-22','חשבון',['st1']),task('2026-10-22','עברית',['st1']),task('2026-10-25','חשבון',['st1']),task('2026-10-25','עברית',['st1'])];
vm.runInContext("syncStudentDay(school,records,{studentId:'st1',classId:'c1',day:'2026-10-22',hour:10,markChecked:true})",ctx);
view=vm.runInContext("syncStudentDay(school,records,{studentId:'st1',classId:'c1',day:'2026-10-25',hour:10,markChecked:true})",ctx);
assert.equal(view.streak,1,'a missed school day starts the streak again');

ctx.school=blank();
ctx.records=[task('2026-10-23','חשבון',['st1'])];
const goal=vm.runInContext("classWeekGoal(school,records,'c1','2026-10-23')",ctx);
assert.equal(goal.posted,2);
assert.equal(goal.done,1);
assert.equal(goal.ratio,0.5);
assert.equal(goal.met,false);
assert.ok(!Object.keys(goal).some(key=>/student|name|rank/i.test(key)));
ctx.records[0].completions.st2={done:true};
const met=vm.runInContext("classWeekGoal(school,records,'c1','2026-10-23')",ctx);
assert.equal(met.met,true);
assert.equal(vm.runInContext("typeof rankStudents",ctx),'undefined');

ctx.school=blank();
ctx.records=[{classId:'c1',day:'2026-10-23',subject:'חשבון',kind:'none'}];
let teacher=vm.runInContext("syncTeacherDay(school,records,{teacherId:'t1',classIds:['c1'],day:'2026-10-23'})",ctx);
assert.equal(teacher.updated,false);
assert.equal(teacher.streak,0);
ctx.records.push({classId:'c1',day:'2026-10-23',subject:'עברית',kind:'none'});
teacher=vm.runInContext("syncTeacherDay(school,records,{teacherId:'t1',classIds:['c1'],day:'2026-10-23'})",ctx);
assert.equal(teacher.updated,true);
assert.equal(teacher.streak,1);
ctx.records.push({classId:'c1',day:'2026-10-25',subject:'חשבון',kind:'none'},{classId:'c1',day:'2026-10-25',subject:'עברית',kind:'none'});
teacher=vm.runInContext("syncTeacherDay(school,records,{teacherId:'t1',classIds:['c1'],day:'2026-10-25'})",ctx);
assert.equal(teacher.streak,2);

ctx.school=blank();
const once=vm.runInContext("addKudos(school,{studentId:'st1',parentId:'p1',emoji:'🌟',day:'2026-10-23'})",ctx);
const twice=vm.runInContext("addKudos(school,{studentId:'st1',parentId:'p1',emoji:'🌟',day:'2026-10-23'})",ctx);
assert.equal(once.ok,true);
assert.equal(twice.reused,true);
assert.equal(vm.runInContext('school.play.kudos.length',ctx),1);
assert.equal(vm.runInContext('school.play.effects',ctx),false);
ctx.packed=vm.runInContext('packSnapshot(school,[])',ctx);
ctx.blank={};
const merged=vm.runInContext('mergePilotState(blank,packed)',ctx);
assert.equal(merged.play.kudos.length,1);
assert.equal(merged.play.kudos[0].emoji,'🌟');
assert.equal(merged.play.effects,false);
assert.equal(vm.runInContext("mergePilotState(blank,packed).play.kudos.length",ctx),1);

console.log('Passed streak, XP, badges, class goal, teacher check and local kudos.');
