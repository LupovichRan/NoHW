/* Managed children (no email) for parents, and class join codes/requests for teachers. Cloud mode only. */
function childEl(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e}
function myChildren(){if(!cloud.ready)return[];return cloud.profiles.filter(p=>p.managed_by===cloud.user?.id&&cloud.guardians?.some(g=>g.parent_id===cloud.user.id&&g.student_id===p.id))}
async function childAction(statusId,fn,okText){const status=document.getElementById(statusId);try{status.textContent='';await fn();await cloudRefresh();status.textContent=okText?'✓ '+t(okText):''}catch(e){status.textContent=e.message}}
function renderChildren(){
 const box=document.getElementById('childrenManager'),joinBox=document.getElementById('joinManager');if(!box||!joinBox)return;
 box.hidden=!(cloud.ready&&role==='parent');joinBox.hidden=!(cloud.ready&&['teacher','manager','admin'].includes(role));
 if(!box.hidden){
  const list=document.getElementById('childrenList');list.textContent='';const kids=myChildren();
  if(!kids.length)list.append(childEl('p',t('עדיין לא הוספתם ילדים.')));
  for(const kid of kids){
   const card=childEl('div','', 'side-row');card.style.cssText='flex-direction:column;gap:8px;align-items:stretch';
   const title=childEl('b',kid.display_name);title.setAttribute('data-user-content','');card.append(title);
   const classes=school.classes.filter(c=>school.students.find(s=>s.id===kid.id)?.classIds.includes(c.id));
   const requests=(cloud.joinRequests||[]).filter(r=>r.student_id===kid.id&&r.status==='pending');
   const info=childEl('span',classes.length?t('כיתות:')+' '+classes.map(c=>c.name).join(', '):t('עדיין לא בכיתה.'));info.style.color='var(--muted)';card.append(info);
   if(requests.length)card.append(childEl('span',t('בקשת הצטרפות ממתינה לאישור המורה.')))
   const input=document.createElement('input');input.placeholder=t('קוד כיתה מהמורה');input.setAttribute('aria-label',t('קוד כיתה מהמורה'));input.dir='ltr';input.maxLength=20;
   const send=childEl('button',t('בקשת הצטרפות לכיתה'),'secondary');send.type='button';
   send.onclick=()=>childAction('childrenStatus',async()=>{await cloudResult(cloud.client.rpc('request_class_join',{child:kid.id,join_code:input.value}));input.value=''},'הבקשה נשלחה למורה.');
   card.append(input,send);list.append(card)}
  document.getElementById('addManagedChild').disabled=kids.length>=4;
 }
 if(!joinBox.hidden){
  const sel=document.getElementById('joinClass'),prev=sel.value;fillAdminSelect(sel,school.classes.filter(c=>c.schoolId===activeSchoolId()),prev||activeClassId());
  const code=(cloud.joinCodes||[]).find(c=>c.class_id===sel.value);document.getElementById('joinCodeValue').textContent=code?code.code:'—';
  const reqs=document.getElementById('joinRequests');reqs.textContent='';const pending=(cloud.joinRequests||[]).filter(r=>r.status==='pending');
  if(!pending.length)reqs.append(childEl('p',t('אין בקשות הצטרפות ממתינות.')));
  for(const r of pending){const row=childEl('div','','side-row');const cls=school.classes.find(c=>c.id===r.class_id);const who=cloud.profiles.find(p=>p.id===r.student_id)?.display_name||'';const label=childEl('span',who+' · '+(cls?.name||''));label.setAttribute('data-user-content','');const actions=childEl('span');
   for(const [approve,text] of [[true,'אישור'],[false,'דחייה']]){const b=childEl('button',t(text),approve?'button':'secondary');b.type='button';b.onclick=()=>childAction('joinStatus',()=>cloudResult(cloud.client.rpc('decide_class_join_request',{request_id:r.id,approve})),approve?'הבקשה אושרה.':'הבקשה נדחתה.');actions.append(b)}
   row.append(label,actions);reqs.append(row)}
 }
}
document.getElementById('addManagedChild').onclick=()=>{const input=document.getElementById('newChildName');childAction('childrenStatus',async()=>{await cloudResult(cloud.client.rpc('create_managed_child',{child_name:input.value}));input.value=''},'הילד נוסף.')};
document.getElementById('joinClass').onchange=()=>renderChildren();
document.getElementById('createJoinCode').onclick=()=>childAction('joinStatus',()=>cloudResult(cloud.client.rpc('create_class_join_code',{target_class:document.getElementById('joinClass').value})),'הקוד נוצר.');
renderChildren();
