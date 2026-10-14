const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements={};const calls=[];const element=()=>({value:'',textContent:'',hidden:false});
function query(table){const q={};for(const method of ['select','single','eq','delete','insert','upsert','update'])q[method]=(...args)=>{calls.push({table,method,args});return q};q.then=(resolve,reject)=>Promise.resolve({data:table==='school_lessons'?{id:'lesson1'}:null,error:null}).then(resolve,reject);return q}
const client={from:query,rpc:async(name,args)=>{calls.push({rpc:name,args});return{data:null,error:null}}};
const c=vm.createContext({document:{getElementById:id=>elements[id]||(elements[id]=element())},window:{addEventListener(){}},setInterval(){},Error,Date,JSON,Set,Map,Promise,questions:[],client});
vm.runInContext(fs.readFileSync('/workspace/sites/homework/dist/supabase.js','utf8'),c);vm.runInContext("cloud.ready=true;cloud.client=client;cloud.user={id:'student1'};cloud.profile={role:'student'}",c);
(async()=>{
 c.record={classId:'class1',subject:'חשבון',day:'2026-10-14',teacher:'מורה',kind:'task',due:'2026-10-15',dueTime:'08:00',completions:{student2:{done:true}},explanation:{status:'draft',text:'טיוטה סודית'}};
 await vm.runInContext('cloudSaveLesson(record)',c);const save=calls.find(x=>x.table==='school_lessons'&&x.method==='upsert').args[0];assert.equal(save.published_content.explanation,null);assert.equal('completions' in save.published_content,false);assert(calls.some(x=>x.table==='school_ai_drafts'&&x.method==='upsert'));
 calls.length=0;c.lesson={id:'lesson1'};await vm.runInContext('cloudCompleteLesson(lesson,true)',c);const done=calls.find(x=>x.table==='school_completions'&&x.method==='upsert').args[0];assert.equal(done.student_id,'student1');
 vm.runInContext("cloud.profile.role='parent'",c);await assert.rejects(()=>vm.runInContext('cloudCompleteLesson(lesson,true)',c));
 c.questions=[{id:'q1',classId:'class1',familyId:'student1',answer:null}];c.next=[{...c.questions[0],answer:{text:'תשובה בדוקה',visibility:'class',publicQuestion:'שאלה בלי פרטים אישיים',publishedAt:'2026-10-14T10:00:00Z'}}];
 await vm.runInContext('cloudSaveQuestions(next)',c);const publish=calls.find(x=>x.rpc==='publish_school_answer');assert.equal(publish.args.class_wide,true);assert.equal(publish.args.class_question,'שאלה בלי פרטים אישיים');console.log('Passed cloud adapter: draft exclusion, private draft storage, student-only completion and atomic answer publication. Supabase mocked.');
})();
