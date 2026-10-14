/* Accessibility menu: user-controlled display adjustments, saved on this device only. */
(function(){
const KEY='nohomework-a11y';
const MODES=[['contrast-dark','ניגודיות גבוהה כהה'],['contrast-light','ניגודיות גבוהה בהירה'],['grayscale','גווני אפור'],['invert','היפוך צבעים'],['links','הדגשת קישורים'],['headings','הדגשת כותרות'],['font','גופן קריא'],['spacing','ריווח שורות ומילים'],['cursor','סמן עכבר גדול'],['motion','עצירת אנימציות'],['focus','הדגשת מיקוד מקלדת']];
const EXCLUSIVE=['contrast-dark','contrast-light','grayscale','invert'];
let state={size:0,modes:[]};
try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(saved&&Array.isArray(saved.modes))state={size:Math.max(-1,Math.min(4,+saved.size||0)),modes:saved.modes.filter(m=>MODES.some(x=>x[0]===m))}}catch{}
const root=document.documentElement;
const tr=s=>typeof t==='function'?t(s):s;
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
function apply(){for(const [m] of MODES)root.classList.toggle('a11y-'+m,state.modes.includes(m));root.style.fontSize=state.size?(100+state.size*12.5)+'%':'';for(const b of panel.querySelectorAll('button[data-mode]'))b.setAttribute('aria-pressed',String(state.modes.includes(b.dataset.mode)))}
function el(tag,attrs={},text){const e=document.createElement(tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);if(text)e.textContent=text;return e}
const toggle=el('button',{id:'a11yToggle',type:'button','aria-label':'תפריט נגישות','aria-haspopup':'dialog','aria-expanded':'false','aria-controls':'a11yPanel'},'♿');
const panel=el('div',{id:'a11yPanel',role:'dialog','aria-label':'תפריט נגישות',hidden:''});
panel.append(el('h2',{},'תפריט נגישות'));
const grid=el('div',{class:'grid'});
const bigger=el('button',{type:'button',class:'opt'},'הגדלת טקסט'),smaller=el('button',{type:'button',class:'opt'},'הקטנת טקסט');
bigger.onclick=()=>{state.size=Math.min(4,state.size+1);save();apply()};smaller.onclick=()=>{state.size=Math.max(-1,state.size-1);save();apply()};
grid.append(bigger,smaller);
for(const [m,label] of MODES){const b=el('button',{type:'button',class:'opt','data-mode':m,'aria-pressed':'false'},label);b.onclick=()=>{const on=state.modes.includes(m);if(on)state.modes=state.modes.filter(x=>x!==m);else{if(EXCLUSIVE.includes(m))state.modes=state.modes.filter(x=>!EXCLUSIVE.includes(x));state.modes.push(m)}save();apply()};grid.append(b)}
panel.append(grid);
const row=el('div',{class:'row'});const reset=el('button',{type:'button',class:'reset'},'איפוס הגדרות');reset.onclick=()=>{state={size:0,modes:[]};save();apply()};row.append(reset);panel.append(row);
panel.append(el('a',{href:'accessibility.html'},'הצהרת נגישות'));
document.body.append(toggle,panel);
function open(v){panel.hidden=!v;toggle.setAttribute('aria-expanded',String(v));if(v)panel.querySelector('button').focus();else toggle.focus()}
toggle.onclick=()=>open(panel.hidden);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)open(false)});
apply();
if(typeof translateInterface==='function')translateInterface();
})();
