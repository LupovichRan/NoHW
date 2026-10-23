let interfaceLanguage='he';try{interfaceLanguage=localStorage.getItem('homework-language')||'he'}catch{}if(!['he','en','ru','ar'].includes(interfaceLanguage))interfaceLanguage='he';
const originalText=new WeakMap(),originalAttributes=new WeakMap();
let prefixKeys=null;
function t(text){
 const dict=window.NOHOMEWORK_TRANSLATIONS||{},hit=dict[text]?.[interfaceLanguage];if(hit)return hit;
 if(interfaceLanguage==='he'||typeof text!=='string')return text;
 for(const [re,forms] of window.NOHOMEWORK_PATTERNS||[]){const m=text.match(re);if(m&&forms[interfaceLanguage])return forms[interfaceLanguage](...m.slice(1))}
 if(text.includes(' · ')){const parts=text.split(' · '),out=parts.map(x=>t(x));if(out.some((x,i)=>x!==parts[i]))return out.join(' · ')}
 prefixKeys??=Object.keys(dict).filter(k=>/[:—·]$/.test(k)).sort((a,b)=>b.length-a.length);
 for(const k of prefixKeys)if(text.length>k.length&&text.startsWith(k)){const tr=dict[k]?.[interfaceLanguage];if(tr)return tr+text.slice(k.length)}
 return text}
function siteLocale(){return {he:'he-IL',en:'en-US',ru:'ru-RU',ar:'ar'}[interfaceLanguage]}
function languageName(){return{he:'עברית',en:'English',ru:'Русский',ar:'العربية'}[interfaceLanguage]}
function translateInterface(){
 if(!document.body)return;
 observer?.disconnect();document.documentElement.lang=interfaceLanguage;document.documentElement.dir=['he','ar'].includes(interfaceLanguage)?'rtl':'ltr';
 for(const option of document.querySelectorAll('option:not([value])'))option.value=option.textContent;
 const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node;
 while(node=walker.nextNode()){if(!node.parentElement||node.parentElement.closest('script,style,textarea,[data-user-content],#interfaceLanguage'))continue;const current=node.nodeValue,record=originalText.get(node);const original=record&&current===record.last?record.original:current;const trimmed=original.trim();const translated=t(trimmed);const result=translated!==trimmed?original.replace(trimmed,translated):original;originalText.set(node,{original,last:result});if(current!==result)node.nodeValue=result;}
 for(const item of document.querySelectorAll('[placeholder],[aria-label]')){const previous=originalAttributes.get(item)||{};for(const name of ['placeholder','aria-label']){if(!item.hasAttribute(name))continue;const current=item.getAttribute(name),record=previous[name],original=record&&current===record.last?record.original:current,last=t(original);previous[name]={original,last};if(current!==last)item.setAttribute(name,last)}originalAttributes.set(item,previous)}
 observer?.observe(document.body,{subtree:true,childList:true,characterData:true});
}
let queued=false;const observer=typeof MutationObserver==='function'?new MutationObserver(()=>{if(!queued){queued=true;queueMicrotask(()=>{queued=false;translateInterface()})}}):null;
const selector=document.getElementById('interfaceLanguage');
if(selector){selector.value=interfaceLanguage;selector.onchange=()=>{interfaceLanguage=selector.value;try{localStorage.setItem('homework-language',interfaceLanguage)}catch{}if(typeof render==='function')render();translateInterface()};}
window.addEventListener('load',translateInterface);

function localizedGreeting(name){return{he:`היי ${name}, עושים קצת ומסיימים ☀`,en:`Hi ${name}, let’s get started ☀`,ru:`Привет, ${name}, приступим ☀`,ar:`مرحبًا ${name}، لنبدأ ☀`}[interfaceLanguage]}
