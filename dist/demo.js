/* Demo sandbox: sign in as one of four real demo accounts (see backend/demo-mode.sql) and switch between them. */
const DEMO_ACCOUNTS=[['parent','demo-parent@nohomework-demo.test','הורה','👪'],['child','demo-child@nohomework-demo.test','ילד','🎒'],['teacher','demo-teacher@nohomework-demo.test','מורה','📚'],['manager','demo-manager@nohomework-demo.test','מנהל בית ספר','🏫']];
function demoEnabledByConfig(){return !!window.NOHOMEWORK_DEMO?.enabled}
async function demoSignIn(email){
 const status=document.getElementById('demoStatus');status.textContent=t('נכנסים לדמו…');
 try{const data=await cloudResult(cloud.client.auth.signInWithPassword({email,password:window.NOHOMEWORK_DEMO.password}));cloud.user=data.user;await cloudRefresh();document.getElementById('appContent').hidden=false;status.textContent=''}
 catch(e){status.textContent=t('הדמו אינו זמין כרגע.')+' '+e.message}
}
function demoButtons(container,current){container.textContent='';for(const [kind,email,label,icon] of DEMO_ACCOUNTS){const b=document.createElement('button');b.type='button';b.className=current===email?'button':'secondary';b.textContent=icon+' '+t(label);if(current===email)b.setAttribute('aria-current','true');b.onclick=()=>demoSignIn(email);container.append(b)}}
function renderDemoBar(){
 const bar=document.getElementById('demoBar');if(!bar)return;
 const active=cloud.ready&&cloud.profile?.is_demo;bar.hidden=!active;if(!active)return;
 demoButtons(document.getElementById('demoBarRoles'),cloud.user?.email);
}
async function initDemo(){
 const entry=document.getElementById('demoEntry');if(!entry||!demoEnabledByConfig()||!cloud.client||cloud.user)return;
 try{const on=await cloudResult(cloud.client.rpc('demo_status'));entry.hidden=!on;if(on)demoButtons(document.getElementById('demoEntryRoles'),null)}catch{entry.hidden=true}
}
document.getElementById('demoReset')?.addEventListener('click',async()=>{const status=document.getElementById('demoStatus');try{await cloudResult(cloud.client.rpc('reset_demo_data'));await cloudRefresh();status.textContent='✓ '+t('נתוני הדמו אופסו.')}catch(e){status.textContent=e.message}});
document.getElementById('demoExit')?.addEventListener('click',async()=>{if(cloud.client)await cloud.client.auth.signOut();location.reload()});
