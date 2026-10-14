// Model and runtime downloads only. Audio remains inside this worker.
let pipelinePromise=null,loadedModel=null;
const models={small:'Xenova/whisper-small',base:'Xenova/whisper-base'};
async function getTranscriber(id,model){
 if(pipelinePromise&&loadedModel!==model){const previous=await pipelinePromise;await previous.dispose();pipelinePromise=null;}
 loadedModel=model;
 if(!pipelinePromise){
  pipelinePromise=(async()=>{
   const {pipeline,env}=await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');
   env.allowLocalModels=false;
   env.useBrowserCache=true;
   env.backends.onnx.wasm.numThreads=1;
   return pipeline('automatic-speech-recognition',models[model],{
    quantized:true,
    progress_callback:p=>self.postMessage({id,type:'progress',file:p.file||'',progress:p.progress||0,status:p.status})
   });
  })().catch(e=>{pipelinePromise=null;throw e});
 }
 return pipelinePromise;
}
self.onmessage=async({data})=>{
 const {id,audio}=data;const model=data.model||'small';const language=data.language||'hebrew';if(!['hebrew','english','russian','arabic'].includes(language)){self.postMessage({id,type:'error',message:'unsupported_language'});return;}
 try{
  if(!models[model])throw new Error('unsupported_model');
  if(!(audio instanceof Float32Array)||!audio.length)throw new Error('empty_audio');
  const transcriber=await getTranscriber(id,model);
  self.postMessage({id,type:'running'});
  const result=await transcriber(audio,{language,task:'transcribe',chunk_length_s:30,stride_length_s:5,return_timestamps:false});
  self.postMessage({id,type:'result',text:result.text||''});
 }catch(e){self.postMessage({id,type:'error',message:String(e.message||e)})}
};
