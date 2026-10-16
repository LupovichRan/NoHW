/* Simple navigation: one task per screen. The existing sections are moved into tab panes (same DOM nodes,
   so all their logic keeps working); a bottom tab bar shows only the tabs that matter for the current role.
   In the demo a header chip switches role. */
const TAB_DEFS={today:['📅','השבוע'],questions:['💬','שאלות'],materials:['📷','חומרים'],family:['👪','הילדים'],class:['🏫','הכיתה'],manage:['⚙️','ניהול'],more:['☰','עוד']};
const TABS_BY_ROLE={parent:['today','questions','materials','family','more'],child:['today','questions','materials','more'],teacher:['today','materials','questions','class','more'],manager:['manage','class','today','more'],admin:['manage','class','today','more']};
const TAB_HOME={parent:'today',child:'today',teacher:'today',manager:'manage',admin:'manage'};
const ROLE_CHOICES=[['parent','👪','הורה'],['child','🎒','ילד'],['teacher','📚','מורה'],['manager','🏫','מנהל בית ספר','מנהל'],['admin','🛡️','אדמין']];
const tabState={role:null,active:null,built:false};
const tabsEl=id=>document.getElementById(id);

// Long admin forms become collapsible groups: every direct <h3> starts a closed <details>.
function accordionize(box,opts={}){if(!box)return;let group=null;const mk=(title,open,before)=>{const g=document.createElement('details');g.className='acc';g.open=!!open;const s=document.createElement('summary');s.textContent=title;g.append(s);box.insertBefore(g,before);return g};
 for(const node of Array.from(box.children)){if(node.tagName==='SUMMARY')continue;if(node.tagName==='H3'){group=mk(node.textContent,opts.open?.includes(node.textContent),node);node.remove()}else if(group)group.append(node);else if(opts.lead){group=mk(opts.lead,false,node);group.append(node)}}}
// Two heavy panels in one pane: a segmented control shows one at a time (class toggle, so the panels' own hidden logic is untouched).
function segment(pane,items){const bar=document.createElement('div');bar.className='segment';const apply=id=>{for(const [pid] of items)tabsEl(pid)?.classList.toggle('seg-off',pid!==id);for(const b of bar.children)b.setAttribute('aria-pressed',String(b.dataset.seg===id))};for(const [pid,label] of items){const b=document.createElement('button');b.type='button';b.dataset.seg=pid;b.textContent=label;b.onclick=()=>apply(pid);bar.append(b)}pane.prepend(bar);apply(items[0][0])}
function buildTabs(){
 const app=tabsEl('appContent');if(!app||tabState.built)return;
 const panes={};for(const k of Object.keys(TAB_DEFS)){const d=document.createElement('div');d.className='tabPane';d.dataset.pane=k;d.hidden=true;panes[k]=d;app.append(d)}
 const layout=app.querySelector('.layout'),aside=layout?.querySelector('aside');
 const put=(pane,node)=>{if(node)panes[pane].append(node)};
 put('today',app.querySelector('.top'));put('today',app.querySelector('.stats'));put('today',layout);
 put('questions',tabsEl('questionsPanel'));put('materials',tabsEl('materialsPanel'));
 put('family',tabsEl('childrenManager'));
 const admin=tabsEl('classAdministration');if(admin)admin.open=true;
 put('class',admin);put('class',tabsEl('joinManager'));
 put('manage',tabsEl('managementConsole'));put('manage',tabsEl('adminDashboard'));
 put('more',aside);put('more',tabsEl('notificationPanel'));put('more',tabsEl('pricingPanel'));put('more',app.querySelector(':scope > .footer'));
 const nav=document.createElement('nav');nav.id='tabNav';nav.setAttribute('aria-label','ניווט ראשי');document.body.append(nav);
 // header chip + role sheet (demo only)
 const chip=document.createElement('button');chip.type='button';chip.id='roleChip';chip.setAttribute('aria-haspopup','dialog');
 const header=document.querySelector('header');header.insertBefore(chip,header.querySelector('label'));
 const sheet=document.createElement('dialog');sheet.id='roleSheet';sheet.className='sheet';document.body.append(sheet);
 chip.onclick=()=>{sheet.textContent='';const h=document.createElement('h2');h.textContent=t('החלפת תפקיד (תצוגת דמו)');sheet.append(h);
  for(const [r,icon,label] of ROLE_CHOICES){const b=document.createElement('button');b.type='button';b.className=r===role?'button':'secondary';b.textContent=icon+' '+t(label);b.onclick=()=>{sheet.close();document.querySelector(`.roles[aria-label] [data-role="${r}"]`)?.click()};sheet.append(b)}
  const x=document.createElement('button');x.type='button';x.className='plain';x.textContent=t('סגירה');x.onclick=()=>sheet.close();sheet.append(x);sheet.showModal();if(typeof translateInterface==='function')translateInterface()};
 sheet.addEventListener('click',e=>{if(e.target===sheet)sheet.close()});
 accordionize(tabsEl('adminDashboard'));accordionize(admin,{lead:'הוספת בית ספר, כיתה, תלמיד ומורה',open:['התקדמות תלמידי הכיתה']});
 segment(panes.manage,[['adminDashboard','הגדרת בית ספר'],['managementConsole','התראות ושימוש']]);
 tabState.panes=panes;tabState.nav=nav;tabState.chip=chip;tabState.built=true;
}
function showTab(name,scroll){
 tabState.active=name;
 for(const [k,p] of Object.entries(tabState.panes))p.hidden=k!==name;
 for(const b of tabState.nav.querySelectorAll('button'))b.setAttribute('aria-current',String(b.dataset.tab===name));
 if(scroll)window.scrollTo({top:0});
}
function renderTabs(){
 if(!tabsEl('appContent'))return;buildTabs();
 const tabs=TABS_BY_ROLE[role]||TABS_BY_ROLE.parent;
 const roleChanged=tabState.role!==role;
 if(roleChanged||!tabs.includes(tabState.active)){tabState.role=role;tabState.active=TAB_HOME[role]||tabs[0]}
 // the class / user picker lives where it is useful for the role
 const picker=tabsEl('classPickerPanel');
 if(picker){const home=({parent:'family',child:'more'})[role]||'today';const pane=tabState.panes[home];if(picker.parentNode!==pane)pane.prepend(picker)}
 // nav
 tabState.nav.textContent='';
 for(const k of tabs){const [icon,label]=TAB_DEFS[k];const b=document.createElement('button');b.type='button';b.dataset.tab=k;const i=document.createElement('span');i.className='ti';i.textContent=icon;const l=document.createElement('span');l.textContent=t(label);b.append(i,l);b.onclick=()=>showTab(k,true);tabState.nav.append(b)}
 // role chip: only when the demo role switcher exists
 const demoRoles=document.querySelector('.roles[aria-label]');const info=ROLE_CHOICES.find(r=>r[0]===role);
 tabState.chip.hidden=!!cloud.enabled;tabState.chip.textContent=info?info[1]+' '+t(info[3]||info[2])+' ▾':'';
 showTab(tabState.active,roleChanged);
 if(typeof translateInterface==='function')translateInterface();
}
