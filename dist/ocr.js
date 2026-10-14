let boardPhotos=[],ocrBusy=false,photosLoading=false,boardGeneration=0,tesseractPromise=null;
const filesInput=document.getElementById('boardFiles'),boardPreview=document.getElementById('boardPreview'),ocrButton=document.getElementById('runOcr'),ocrStatus=document.getElementById('ocrStatus'),ocrText=document.getElementById('ocrText'),appendButton=document.getElementById('appendOcr');
function resetBoard(){boardGeneration++;boardPhotos=[];filesInput.value='';boardPreview.replaceChildren();ocrText.value='';document.getElementById('ocrReview').hidden=true;appendButton.hidden=true;ocrStatus.textContent='';ocrButton.disabled=true;}
function showBoardPhotos(){boardPreview.replaceChildren();boardPhotos.forEach((photo,i)=>{const row=el('div');const img=el('img');img.src=photo.src;img.alt=photo.name;img.style.cssText='max-width:100%;max-height:180px;display:block;margin:10px 0;border-radius:8px';const remove=el('button','הסרת צילום '+(i+1),'secondary');remove.type='button';remove.disabled=ocrBusy||photosLoading;remove.onclick=()=>{boardPhotos.splice(i,1);showBoardPhotos()};const caption=el('input');caption.type='text';caption.maxLength=120;caption.placeholder='כיתוב לחומר העזר, למשל: דוגמה לפתרון';caption.value=photo.caption||'';caption.setAttribute('aria-label','כיתוב לצילום '+(i+1));caption.oninput=()=>{photo.caption=caption.value};row.append(img,caption,remove);boardPreview.append(row)});ocrButton.disabled=!boardPhotos.length||ocrBusy||photosLoading;}
async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp','image/bmp'].includes(file.type))throw new Error('בחרו תמונת PNG, JPG, WebP או BMP.');
 if(file.size>15*1024*1024)throw new Error('תמונה גדולה מדי. הגודל המרבי הוא 15 MB.');
 const url=URL.createObjectURL(file);
 try{const img=new Image();img.src=url;await img.decode();if(!img.naturalWidth||!img.naturalHeight)throw new Error('לא ניתן לקרוא את התמונה.');const scale=Math.min(1,2000/Math.max(img.naturalWidth,img.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);return {src:canvas.toDataURL('image/jpeg',0.9),name:file.name||'צילום לוח'};}finally{URL.revokeObjectURL(url)}
}
async function addBoardPhotos(files){
 if(ocrBusy||photosLoading){ocrStatus.textContent='המתינו לסיום הפעולה הנוכחית.';return}
 const generation=boardGeneration;photosLoading=true;showBoardPhotos();filesInput.disabled=true;
 try{for(const file of files){if(boardPhotos.length>=4){ocrStatus.textContent='אפשר לצרף עד ארבע תמונות.';break}const photo=await preparePhoto(file);if(generation!==boardGeneration)return;boardPhotos.push(photo);ocrStatus.textContent='הצילום צורף כחומר עזר. אפשר להוסיף כיתוב או להמיר לטקסט.';}}
 catch(e){if(generation===boardGeneration)ocrStatus.textContent=e.message}
 finally{photosLoading=false;filesInput.disabled=false;showBoardPhotos();filesInput.value=''}
}
filesInput.onchange=()=>addBoardPhotos(Array.from(filesInput.files));
document.getElementById('boardPanel').addEventListener('paste',e=>{const images=Array.from(e.clipboardData?.items||[]).filter(x=>x.kind==='file'&&x.type.startsWith('image/')).map(x=>x.getAsFile()).filter(Boolean);if(images.length){e.preventDefault();addBoardPhotos(images)}});
function loadTesseract(){
 if(!tesseractPromise)tesseractPromise=new Promise((resolve,reject)=>{if(window.Tesseract){resolve(window.Tesseract);return}const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';script.onload=()=>window.Tesseract?resolve(window.Tesseract):reject(new Error('ספריית OCR לא נטענה.'));script.onerror=()=>{script.remove();reject(new Error('הורדת OCR נכשלה. בדקו חיבור לאינטרנט ונסו שוב.'))};document.head.append(script)}).catch(e=>{tesseractPromise=null;throw e});
 return tesseractPromise;
}
ocrButton.onclick=async()=>{
 if(ocrBusy||photosLoading||!boardPhotos.length)return;
 if(form.elements.kind.value==='none'){ocrStatus.textContent='בחרו ״יש שיעורי בית״ כדי להוסיף הוראות מהלוח.';return}
 const generation=boardGeneration,ocrClass=activeClassId(),photos=boardPhotos.slice();let worker=null;ocrBusy=true;filesInput.disabled=true;showBoardPhotos();appendButton.disabled=true;ocrStatus.textContent='מוריד וטוען OCR בעברית ובאנגלית. בהפעלה הראשונה נדרש אינטרנט…';
 try{const Tesseract=await loadTesseract();worker=await Tesseract.createWorker(document.getElementById('ocrLanguage').value,1,{logger:p=>{if(generation===boardGeneration)ocrStatus.textContent=p.status==='recognizing text'?`מזהה טקסט: ${Math.round((p.progress||0)*100)}%`:'טוען את מנוע הזיהוי ושפות הזיהוי…';}});const texts=[];for(let i=0;i<photos.length;i++){if(generation!==boardGeneration)return;const result=await worker.recognize(photos[i].src);texts.push(result.data.text.trim())}if(generation!==boardGeneration)return;ocrText.value=texts.filter(Boolean).join('\n\n');if(ocrText.value&&typeof trackUsage==='function')trackUsage('ocr_used',ocrClass);document.getElementById('ocrReview').hidden=!ocrText.value;appendButton.hidden=!ocrText.value;ocrStatus.textContent=ocrText.value?'✓ הטקסט זוהה. בדקו אותו ואז הוסיפו לפירוט המשימה.':'לא זוהה טקסט. נסו צילום קרוב, חד וישר יותר.';}
 catch(e){if(generation===boardGeneration)ocrStatus.textContent='זיהוי הטקסט נכשל: '+e.message+' הצילומים נשארו ואפשר לנסות שוב.'}
 finally{if(worker)try{await worker.terminate()}catch{}ocrBusy=false;filesInput.disabled=false;appendButton.disabled=false;showBoardPhotos()}
};
appendButton.onclick=()=>{const text=ocrText.value.trim();if(!text)return;if(form.elements.kind.value==='none'){ocrStatus.textContent='בחרו ״יש שיעורי בית״ כדי להוסיף טקסט.';return}const details=form.elements.details;const combined=[details.value.trim(),text].filter(Boolean).join('\n\n');if(combined.length>details.maxLength){ocrStatus.textContent='הטקסט ארוך מדי. קצרו אותו לפני ההוספה.';return}details.value=combined;appendButton.hidden=true;ocrStatus.textContent='✓ הטקסט נוסף לפירוט המשימה. אפשר לערוך אותו לפני השמירה.';};
