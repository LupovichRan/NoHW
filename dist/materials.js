/* Class materials: photos of the whiteboard / notebook pages.
   Teachers publish at once; students the teacher appointed (or their parent) upload for approval.
   Local demo: IndexedDB on this device. Cloud: school_materials / school_class_uploaders (backend/class-materials.sql). */
const MATERIAL_KINDS={board:'צילום לוח',notebook:'דף מחברת',other:'אחר'};
const mat={items:[],uploaders:[],loadedKey:'',loadedAt:0,busy:false,failed:false};
const matEl=id=>document.getElementById(id);
const matIsCloud=()=>!!cloud.ready;
const matCanTeach=()=>['teacher','manager','admin'].includes(role);
function matActingStudent(){return activeStudentId()}
function matCanActFor(studentId){if(!matIsCloud())return true;if(role==='child')return studentId===cloud.user?.id;if(role==='parent')return cloud.profiles.find(p=>p.id===studentId)?.managed_by===cloud.user?.id;return false}
function matIsUploader(studentId){return mat.uploaders.includes(studentId)}
function matCanUpload(){if(!activeClassId())return false;if(matCanTeach())return true;return ['child','parent'].includes(role)&&matIsUploader(matActingStudent())&&matCanActFor(matActingStudent())}
function matStudentsOfClass(){return school.students.filter(s=>s.classIds.includes(activeClassId()))}
function matName(id){return school.students.find(s=>s.id===id)?.name||school.teachers.find(t=>t.id===id)?.name||cloud.profiles?.find(p=>p.id===id)?.display_name||''}

// ---------- local store (IndexedDB) ----------
function matDb(){return new Promise((res,rej)=>{const r=indexedDB.open('nohomework-materials',1);r.onupgradeneeded=()=>r.result.createObjectStore('m',{keyPath:'id'});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function matIdb(mode,fn){const db=await matDb();return new Promise((res,rej)=>{const tx=db.transaction('m',mode);const req=fn(tx.objectStore('m'));tx.oncomplete=()=>{db.close();res(req?.result)};tx.onerror=()=>{db.close();rej(tx.error)};tx.onabort=()=>{db.close();rej(tx.error||new Error('IndexedDB'))}})}
function matLocalUploaders(){try{return JSON.parse(localStorage.getItem('homework-uploaders-v1'))||{}}catch{return{}}}
function matSaveLocalUploaders(v){try{localStorage.setItem('homework-uploaders-v1',JSON.stringify(v))}catch{}}
function matSeeded(){try{return JSON.parse(localStorage.getItem('homework-materials-seeded'))||[]}catch{return[]}}
function matMarkSeeded(list){try{localStorage.setItem('homework-materials-seeded',JSON.stringify(list))}catch{}}

// Sample photos for the demo, drawn on a canvas so the gallery is never empty.
function matDrawSample(kind,title,lines){const c=document.createElement('canvas');c.width=1000;c.height=700;const x=c.getContext('2d');
 if(kind==='board'){x.fillStyle='#1f4d3f';x.fillRect(0,0,1000,700);x.strokeStyle='#8b6b3d';x.lineWidth=18;x.strokeRect(9,9,982,682);x.fillStyle='#f3f6f4'}
 else{x.fillStyle='#fffdf4';x.fillRect(0,0,1000,700);x.strokeStyle='#c9d6ee';x.lineWidth=2;for(let y=120;y<700;y+=56){x.beginPath();x.moveTo(0,y);x.lineTo(1000,y);x.stroke()}x.strokeStyle='#e58b8b';x.beginPath();x.moveTo(940,0);x.lineTo(940,700);x.stroke();x.fillStyle='#1d3f8a'}
 x.direction='rtl';x.textAlign='right';x.font='700 56px Heebo, Arial, sans-serif';x.fillText(title,920,100);x.font='500 44px Heebo, Arial, sans-serif';lines.forEach((l,i)=>x.fillText(l,920,200+i*70));
 return c.toDataURL('image/jpeg',0.7)}
async function matSeedClass(classId){
 const done=matSeeded();if(done.includes(classId))return;
 const base={classId,uploaderId:school.teacherId,uploaderName:matName(school.teacherId)||'',onBehalfOf:null,status:'approved',createdAt:Date.now(),seed:true};
 const items=[{...base,id:'seed-b-'+classId,subject:'חשבון',kind:'board',caption:'שברים: מונה ומכנה',image:matDrawSample('board','שברים',['1/2 + 1/4 = 3/4','מונה ומכנה','תרגילים 1–6'])},
  {...base,id:'seed-n-'+classId,subject:'עברית',kind:'notebook',caption:'סיכום הסיפור',image:matDrawSample('notebook','סיכום הסיפור',['חברים בדרך','מי הדמויות?','מה קרה בסוף?']),createdAt:Date.now()-3600e3}];
 const kid=matStudentsOfClass()[0]||school.students.find(s=>s.classIds.includes(classId));
 if(kid){items.push({...base,id:'seed-p-'+classId,uploaderId:kid.id,uploaderName:kid.name,onBehalfOf:kid.id,status:'pending',subject:'מדעים',kind:'notebook',caption:'דף הנסוי שלי',image:matDrawSample('notebook','המדעים שלי',['צמחים צריכים אור','ומים']),createdAt:Date.now()-600e3});
  const u=matLocalUploaders();u[classId]=[...new Set([...(u[classId]||[]),kid.id])];matSaveLocalUploaders(u)}
 for(const it of items)await matIdb('readwrite',s=>s.put(it));
 matMarkSeeded([...done,classId]);
}
async function matLoadLocal(classId){await matSeedClass(classId);const all=await matIdb('readonly',s=>s.getAll());mat.items=(all||[]).filter(m=>m.classId===classId).sort((a,b)=>b.createdAt-a.createdAt);mat.uploaders=matLocalUploaders()[classId]||[]}

// ---------- cloud store ----------
async function matLoadCloud(classId){
 const [rows,ups]=await Promise.all([cloudResult(cloud.client.from('school_materials').select('*').eq('class_id',classId).order('created_at',{ascending:false}).limit(60)),cloudResult(cloud.client.from('school_class_uploaders').select('*').eq('class_id',classId))]);
 mat.items=rows.map(r=>({id:r.id,classId:r.class_id,subject:r.subject,kind:r.kind,caption:r.caption||'',image:r.image,uploaderId:r.uploaded_by,uploaderName:matName(r.on_behalf_of||r.uploaded_by),onBehalfOf:r.on_behalf_of,status:r.status,createdAt:new Date(r.created_at).getTime()}));
 mat.uploaders=ups.map(u=>u.student_id)}

async function matLoad(force){
 const classId=activeClassId();if(!classId)return;const key=(matIsCloud()?'c:':'l:')+classId;
 if(!force&&mat.loadedKey===key&&Date.now()-mat.loadedAt<20000)return;
 if(mat.busy)return;mat.busy=true;
 try{if(matIsCloud())await matLoadCloud(classId);else await matLoadLocal(classId);mat.loadedKey=key;mat.loadedAt=Date.now();mat.failed=false}
 catch(e){mat.items=[];mat.uploaders=[];mat.failed=true}
 finally{mat.busy=false}
}

// ---------- image preparation ----------
async function matPrepare(file){
 if(!file.type.startsWith('image/'))throw new Error(t('בחרו קובץ תמונה.'));
 if(file.size>25*1024*1024)throw new Error(t('תמונה גדולה מדי. הגודל המרבי הוא 15 MB.'));
 const url=URL.createObjectURL(file);
 try{const img=new Image();img.src=url;await img.decode();if(!img.naturalWidth)throw new Error(t('לא ניתן לקרוא את התמונה.'));
  const scale=Math.min(1,1400/Math.max(img.naturalWidth,img.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));
  const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);
  let q=0.74,out=c.toDataURL('image/jpeg',q);while(out.length>900000&&q>0.4){q-=0.1;out=c.toDataURL('image/jpeg',q)}return out}
 finally{URL.revokeObjectURL(url)}
}

// ---------- actions ----------
function matStatus(text,ok){const s=matEl('materialsStatus');s.textContent=text?(ok?'✓ ':'')+text:''}
async function matAddFiles(files){
 if(!files.length)return;if(!matCanUpload()){matStatus(t('אין הרשאה להעלות חומרים.'));return}
 const subject=matEl('materialSubject').value,kind=matEl('materialKind').value,caption=matEl('materialCaption').value.trim().slice(0,120),classId=activeClassId();
 const teacher=matCanTeach();let added=0;
 try{for(const file of files.slice(0,6)){matStatus(t('מעבדים תמונה…'));const image=await matPrepare(file);
   const onBehalfOf=teacher?null:matActingStudent(),status=teacher?'approved':'pending';
   if(matIsCloud()){const row={class_id:classId,subject,kind,caption:caption||null,image,status};if(onBehalfOf)row.on_behalf_of=onBehalfOf;await cloudResult(cloud.client.from('school_materials').insert(row))}
   else await matIdb('readwrite',s=>s.put({id:crypto.randomUUID?crypto.randomUUID():String(Date.now()+Math.random()),classId,subject,kind,caption,image,uploaderId:teacher?school.teacherId:matActingStudent(),uploaderName:teacher?matName(school.teacherId):matName(matActingStudent()),onBehalfOf,status,createdAt:Date.now()}));
   added++}}
 catch(e){matStatus((e&&e.message)||String(e))}
 matEl('materialCaption').value='';await matLoad(true);drawMaterials();
 if(added)matStatus(t(teacher?'התמונה פורסמה לכיתה.':'התמונה נשלחה לאישור המורה.'),true);
}
async function matDecide(item,approve){try{if(matIsCloud())await cloudResult(cloud.client.rpc('decide_material',{material_id:item.id,approve}));else await matIdb('readwrite',s=>s.put({...item,status:approve?'approved':'rejected'}));await matLoad(true);drawMaterials();matStatus(t(approve?'התמונה אושרה ופורסמה.':'התמונה נדחתה.'),true)}catch(e){matStatus(e.message)}}
async function matRemove(item){if(!confirm(t('למחוק את התמונה?')))return;try{if(matIsCloud())await cloudResult(cloud.client.from('school_materials').delete().eq('id',item.id));else await matIdb('readwrite',s=>s.delete(item.id));await matLoad(true);drawMaterials()}catch(e){matStatus(e.message)}}
async function matToggleUploader(studentId,on){const classId=activeClassId();try{
  if(matIsCloud()){if(on)await cloudResult(cloud.client.from('school_class_uploaders').insert({class_id:classId,student_id:studentId}));else await cloudResult(cloud.client.from('school_class_uploaders').delete().eq('class_id',classId).eq('student_id',studentId))}
  else{const u=matLocalUploaders();const cur=new Set(u[classId]||[]);on?cur.add(studentId):cur.delete(studentId);u[classId]=[...cur];matSaveLocalUploaders(u)}
  await matLoad(true);drawMaterials()}catch(e){matStatus(e.message)}}

// ---------- viewer ----------
function matOpenViewer(item){
 let d=matEl('photoViewer');if(!d){d=document.createElement('dialog');d.id='photoViewer';d.className='viewer';d.addEventListener('click',e=>{if(e.target===d)d.close()});document.body.append(d)}
 d.textContent='';const img=document.createElement('img');img.src=item.image;img.alt=item.caption||t(MATERIAL_KINDS[item.kind]||'');
 const cap=el('p',[t(MATERIAL_KINDS[item.kind]||''),item.subject&&t(item.subject),item.caption].filter(Boolean).join(' · '));cap.setAttribute('data-user-content','');
 const close=el('button',t('סגירה'),'button');close.type='button';close.onclick=()=>d.close();d.append(img,cap,close);d.showModal();
}

// ---------- drawing ----------
function matCard(item,pending){
 const card=el('figure','','materialCard');const img=document.createElement('img');img.src=item.image;img.alt=item.caption||t(MATERIAL_KINDS[item.kind]||'');img.loading='lazy';
 const open=el('button','');open.type='button';open.className='materialThumb';open.setAttribute('aria-label',t('פתיחת צילום:')+' '+(item.caption||t(MATERIAL_KINDS[item.kind]||'')));open.append(img);open.onclick=()=>matOpenViewer(item);
 const meta=el('figcaption');const line1=el('b',t(MATERIAL_KINDS[item.kind]||'')+' · '+t(item.subject));const line2=el('span',[item.caption,item.uploaderName,new Date(item.createdAt).toLocaleDateString(siteLocale())].filter(Boolean).join(' · '));line2.setAttribute('data-user-content','');meta.append(line1,line2);
 card.append(open,meta);
 const actions=el('div','','materialActions');
 if(pending&&matCanTeach()){const ok=el('button',t('אישור'),'button');ok.type='button';ok.onclick=()=>matDecide(item,true);const no=el('button',t('דחייה'),'secondary');no.type='button';no.onclick=()=>matDecide(item,false);actions.append(ok,no)}
 if(matCanTeach()||(!matIsCloud()&&matCanActFor(item.onBehalfOf)&&item.onBehalfOf&&item.onBehalfOf===matActingStudent())||(matIsCloud()&&item.uploaderId===cloud.user?.id)){const del=el('button',t('מחיקה'),'secondary');del.type='button';del.onclick=()=>matRemove(item);actions.append(del)}
 if(actions.childNodes.length)card.append(actions);
 return card}
function drawMaterials(){
 const panel=matEl('materialsPanel');if(!panel)return;
 const classId=activeClassId();panel.hidden=!classId||(matIsCloud()&&mat.failed);if(panel.hidden)return;
 const teacher=matCanTeach(),canUp=matCanUpload();
 const subjectSel=matEl('materialSubject');if(!subjectSel.options.length)for(const s of subjects){const o=document.createElement('option');o.value=s;subjectSel.append(o)}
 for(const o of subjectSel.options)o.textContent=t(o.value);
 matEl('materialsUpload').hidden=!canUp;
 matEl('materialsIntro').textContent=t(teacher?'צלמו את הלוח או דף מהמחברת וההמחשה תופיע לכל הכיתה. תלמידים שמינתם יכולים להעלות גם, באישורכם.':canUp?'מינו אותך להעלות חומרים לכיתה. התמונה תופיע לכולם אחרי שהמורה יאשר.':'תמונות לוח ומחברת של הכיתה, כפי שפרסם המורה.');
 const approved=mat.items.filter(m=>m.status==='approved'),mine=mat.items.filter(m=>m.status!=='approved'&&!teacher);
 const gallery=matEl('materialsGallery');gallery.textContent='';
 if(!approved.length)gallery.append(el('p',t('עדיין לא הועלו חומרים לכיתה.')));
 for(const m of approved)gallery.append(matCard(m,false));
 const pendingBox=matEl('materialsPending'),pendingList=matEl('materialsPendingList');pendingList.textContent='';
 const pendingItems=teacher?mat.items.filter(m=>m.status==='pending'):mine;
 pendingBox.hidden=!pendingItems.length;matEl('materialsPendingTitle').textContent=t(teacher?'ממתין לאישור שלכם':'ההעלאות שלי, ממתינות לאישור');
 for(const m of pendingItems)pendingList.append(matCard(m,m.status==='pending'));
 const manager=matEl('uploaderManager');manager.hidden=!teacher;
 if(teacher){const list=matEl('uploaderList');list.textContent='';const students=matStudentsOfClass();if(!students.length)list.append(el('p',t('אין תלמידים בכיתה.')));
  for(const s of students){const label=el('label','','uploaderRow');const box=document.createElement('input');box.type='checkbox';box.checked=matIsUploader(s.id);box.onchange=()=>matToggleUploader(s.id,box.checked);const name=el('span',s.name);name.setAttribute('data-user-content','');label.append(box,name);list.append(label)}}
 if(typeof translateInterface==='function')translateInterface();
}
async function renderMaterials(){const panel=matEl('materialsPanel');if(!panel)return;drawMaterials();await matLoad(false);drawMaterials()}

matEl('materialCamera').onclick=()=>matEl('materialCameraInput').click();
matEl('materialGallery').onclick=()=>matEl('materialGalleryInput').click();
for(const id of ['materialCameraInput','materialGalleryInput'])matEl(id).onchange=e=>{const files=Array.from(e.target.files);e.target.value='';matAddFiles(files)};
