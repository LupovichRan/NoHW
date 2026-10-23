/* Navigation: the chat assistant is the home screen. Three tabs only; everything else lives in "more" as collapsible items.
   Existing sections are moved (same DOM nodes), so all of their logic keeps working.
   In the demo a header chip switches role. */
const TAB_DEFS={tree:['⌂','עץ'],home:['☀','מחר'],assistant:['✦','עוזר'],today:['☰','עדכון'],manage:['⚙','ניהול'],more:['⋯','עוד']};
const TABS_BY_ROLE={parent:['home','tree','more'],child:['home','tree','more'],teacher:['tree','today','more'],manager:['tree','more'],admin:['tree','more']};
const TAB_HOME={parent:'home',child:'home',teacher:'tree',manager:'tree',admin:'tree'};
const ROLE_CHOICES=[['parent','👪','הורה'],['child','🎒','ילד'],['teacher','📚','מורה'],['manager','🏫','מנהל בית ספר','מנהל'],['admin','🛡️','אדמין']];
const MORE_ITEMS=[['classPickerPanel','בחירת כיתה ותלמיד',['parent','child','teacher','manager','admin'],'pick'],['questionsPanel','שאלות ותשובות',['parent','child','teacher']],['materialsPanel','חומרי כיתה (צילומי לוח ומחברת)',['parent','child','teacher']],['childrenManager','הילדים שלי',['parent']],['classAdministration','ניהול הכיתה',['teacher','manager','admin']],['joinManager','קוד הצטרפות לכיתה',['teacher','manager','admin']],['aside','התמונה היומית והתראות לפני השיעור',['parent','child','teacher']],['notificationPanel','התראות',['parent','child','teacher','manager','admin']]];
const tabState={role:null,active:null,built:false,items:[]};
const tabsEl=id=>document.getElementById(id);

// Long admin forms become collapsible groups: every direct <h3> starts a <details>.
function accordionize(box,opts={}){if(!box)return;let group=null;const mk=(title,open,before)=>{const g=document.createElement('details');g.className='acc';g.open=!!open;const s=document.createElement('summary');s.textContent=title;g.append(s);box.insertBefore(g,before);return g};
 for(const node of Array.from(box.children)){if(node.tagName==='SUMMARY')continue;if(node.tagName==='H3'){group=mk(node.textContent,opts.open?.includes(node.textContent),node);node.remove()}else if(group)group.append(node);else if(opts.lead){group=mk(opts.lead,false,node);if(opts.hideLead)group.hidden=true;group.append(node)}}}
// Two heavy panels in one pane: a segmented control shows one at a time (class toggle, so the panels' own hidden logic is untouched).
function segment(pane,items){const bar=document.createElement('div');bar.className='segment';const apply=id=>{for(const [pid] of items)tabsEl(pid)?.classList.toggle('seg-off',pid!==id);for(const b of bar.children)b.setAttribute('aria-pressed',String(b.dataset.seg===id))};for(const [pid,label] of items){const b=document.createElement('button');b.type='button';b.dataset.seg=pid;b.textContent=label;b.onclick=()=>apply(pid);bar.append(b)}pane.prepend(bar);apply(items[0][0])}
function buildTabs(){
 const app=tabsEl('appContent');if(!app||tabState.built)return;
 const panes={};for(const k of Object.keys(TAB_DEFS)){const d=document.createElement('div');d.className='tabPane';d.dataset.pane=k;d.hidden=true;panes[k]=d;app.append(d)}
 const layout=app.querySelector('.layout'),aside=layout?.querySelector('aside');
 const put=(pane,node)=>{if(node)panes[pane].append(node)};
 put('home',tabsEl('homePanel'));put('assistant',tabsEl('assistantPanel'));
 put('today',app.querySelector('.top'));put('today',app.querySelector('.stats'));put('today',layout);
 put('manage',tabsEl('managementConsole'));put('manage',tabsEl('adminDashboard'));
 const admin=tabsEl('classAdministration');if(admin)accordionize(admin,{lead:'הוספת בית ספר, כיתה, תלמיד ומורה',hideLead:false,open:['התקדמות תלמידי הכיתה']});
 accordionize(tabsEl('adminDashboard'));
 segment(panes.manage,[['adminDashboard','הגדרת בית ספר'],['managementConsole','התראות ושימוש']]);
 // "more": one collapsible item per section
 for(const [id,title,roles] of MORE_ITEMS){const node=id==='aside'?aside:tabsEl(id);if(!node)continue;
  const d=document.createElement('details');d.className='acc moreItem';d.dataset.roles=roles.join(',');if(id==='classAdministration')d.open=false;
  const s=document.createElement('summary');s.textContent=title;d.append(s,node);if(node.tagName==='DETAILS'){node.open=true}
  if(id==='classPickerPanel')d.id='pickerItem';panes.more.append(d);tabState.items.push(d)}
 put('more',app.querySelector(':scope > .footer'));
 const nav=document.createElement('nav');nav.id='tabNav';nav.setAttribute('aria-label','ניווט ראשי');document.body.append(nav);
 // header chip + role sheet (demo only)
 const chip=document.createElement('button');chip.type='button';chip.id='roleChip';chip.setAttribute('aria-haspopup','dialog');
 const header=document.querySelector('header');header.append(chip);
 const sheet=document.createElement('dialog');sheet.id='roleSheet';sheet.className='sheet';document.body.append(sheet);
 const pickPersona=r=>{sheet.textContent='';const h=document.createElement('h2');h.textContent='בתור מי להמשיך?';sheet.append(h);for(const person of personaList(r)){const b=document.createElement('button');b.type='button';b.className=person.id===personaId(r)?'button':'secondary';b.textContent=withCode(person)+(r==='parent'?' · '+(person.studentIds.length===1?'ילד אחד':person.studentIds.length+' ילדים'):'');b.onclick=()=>{personaSet(r,person.id);sheet.close();render()};sheet.append(b)}const x=document.createElement('button');x.type='button';x.className='plain';x.textContent='סגירה';x.onclick=()=>sheet.close();sheet.append(x)};
 chip.onclick=()=>{sheet.textContent='';const h=document.createElement('h2');h.textContent='החלפת תפקיד (תצוגת דמו)';sheet.append(h);
  for(const [r,icon,label] of ROLE_CHOICES){const b=document.createElement('button');b.type='button';b.className=r===role?'button':'secondary';b.textContent=icon+' '+label;b.onclick=()=>{document.querySelector(`.roles[aria-label] [data-role="${r}"]`)?.click();if(cloud.ready||!personaList(r).length){sheet.close();return}pickPersona(r)};sheet.append(b)}
  const x=document.createElement('button');x.type='button';x.className='plain';x.textContent='סגירה';x.onclick=()=>sheet.close();sheet.append(x);sheet.showModal()};
 sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close()});
 tabState.panes=panes;tabState.nav=nav;tabState.chip=chip;tabState.built=true;
}
function showTab(name,scroll){
 tabState.active=name;
 for(const [k,p] of Object.entries(tabState.panes))p.hidden=k!==name;
 for(const b of tabState.nav.querySelectorAll('button'))b.setAttribute('aria-current',String(b.dataset.tab===name));
 if(scroll)window.scrollTo({top:0});
}
function openMoreItem(id){showTab('more',false);const d=tabsEl(id)?.closest('details.moreItem');if(d){d.open=true;d.scrollIntoView({block:'start'})}}
function renderTabs(){
 if(!tabsEl('appContent'))return;buildTabs();
 const tabs=TABS_BY_ROLE[role]||TABS_BY_ROLE.parent;
 const roleChanged=tabState.role!==role;
 if(roleChanged||!tabs.includes(tabState.active)){tabState.role=role;tabState.active=TAB_HOME[role]||tabs[0]}
 for(const d of tabState.items){const cloudOnly=['childrenManager','joinManager'].some(id=>d.contains(tabsEl(id)));d.hidden=!d.dataset.roles.split(',').includes(role)||(cloudOnly&&!cloud.ready)}
 tabState.nav.textContent='';
 for(const k of tabs){const [icon,label]=TAB_DEFS[k];const b=document.createElement('button');b.type='button';b.dataset.tab=k;const i=document.createElement('span');i.className='ti';i.textContent=icon;const l=document.createElement('span');l.textContent=label;b.append(i,l);b.onclick=()=>showTab(k,true);tabState.nav.append(b)}
 const info=ROLE_CHOICES.find(r=>r[0]===role);
 tabState.chip.hidden=!!cloud.enabled;tabState.chip.textContent=info?info[1]+' '+(personaName()||info[3]||info[2])+' ▾':'';
 showTab(tabState.active,roleChanged);
}
