import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import * as nativeOrt from 'onnxruntime-node';

const root=path.dirname(new URL(import.meta.url).pathname);
const engine=path.join(root,'engine');
const cache=path.join(process.env.RUNNER_TEMP || root,'.voice-models');
fs.mkdirSync(cache,{recursive:true});
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
let source=process.argv[2];
if(!source) {
  const event=JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'));
  const jobs=(event.head_commit?.added || []).filter(p=>/^jobs\/[a-f0-9-]{36}\.json$/.test(p));
  if(jobs.length!==1) throw new Error('Expected one job per submission commit.');
  source=jobs[0];
}
const job=JSON.parse(fs.readFileSync(source,'utf8'));
if(!uuid.test(job.id || '') || typeof job.script!=='string' || !job.script.trim() || job.script.length>12000) throw new Error('Invalid voice job.');
const wav=Buffer.from(job.reference,'base64');
if(wav.length<44 || wav.length>576044 || wav.toString('ascii',0,4)!=='RIFF' || wav.toString('ascii',8,12)!=='WAVE' ||
 wav.readUInt16LE(20)!==1 || wav.readUInt16LE(22)!==1 || wav.readUInt32LE(24)!==24000 || wav.readUInt16LE(34)!==16 ||
 wav.readUInt32LE(40)!==wav.length-44) throw new Error('Invalid voice WAV.');
const reference=new Float32Array((wav.length-44)/2);
if(reference.length<72000) throw new Error('Voice reference must be at least three seconds.');
for(let i=0;i<reference.length;i++) reference[i]=wav.readInt16LE(44+i*2)/32768;

globalThis.self=globalThis;
globalThis.location={href:new URL('./engine/pocket-worker.js',import.meta.url).href};
globalThis.require=createRequire(import.meta.url);
globalThis.__dirname=engine;
Object.defineProperty(globalThis,'navigator',{value:{userAgent:'Parasite GitHub CPU',platform:'Linux',hardwareConcurrency:2},configurable:true});
nativeOrt.env.logLevel='error';
globalThis.ort={
  Tensor:nativeOrt.Tensor,
  env:{wasm:{},logLevel:'error'},
  InferenceSession:{
    async create(url,options={}) {
      let local=url;
      if(/^https:\/\//.test(url)) {
        const target=new URL(url);
        if(target.hostname!=='huggingface.co') throw new Error('Unexpected model host.');
        local=path.join(cache,crypto.createHash('sha256').update(url).digest('hex')+'.onnx');
        if(!fs.existsSync(local)) {
          const response=await fetch(url);
          if(!response.ok) throw new Error('Could not load a voice model ('+response.status+').');
          const temporary=local+'.tmp';
          const fd=fs.openSync(temporary,'w');
          try {for await(const block of response.body) fs.writeSync(fd,block);}finally{fs.closeSync(fd);}
          fs.renameSync(temporary,local);
        }
      }
      return nativeOrt.InferenceSession.create(local,{...options,executionProviders:['cpu'],intraOpNumThreads:2,interOpNumThreads:1});
    }
  }
};
globalThis.importScripts=(...urls)=>{
  for(const url of urls) {
    if(!url.startsWith('./sentencepiece.js')) throw new Error('Unexpected script import.');
    const sandbox={console,fetch,TextEncoder,TextDecoder,WebAssembly,setTimeout,clearTimeout,atob,btoa,crypto:globalThis.crypto,Buffer,location:globalThis.location,importScripts(){}};
    sandbox.self=sandbox;
    try {
      vm.runInNewContext(fs.readFileSync(path.join(engine,'sentencepiece.js'),'utf8'),sandbox,{filename:'voice-tokenizer.js'});
      globalThis.SentencePieceProcessor=sandbox.SentencePieceProcessor;
    } catch(error) { throw new Error('Tokenizer initialization failed: '+error.message); }
  }
};
const output=process.argv[3] || 'output';
fs.mkdirSync(output,{recursive:true});
const fd=fs.openSync(path.join(output,'narration.wav'),'w');
fs.writeSync(fd,Buffer.alloc(44));
let frames=0,modelError;
globalThis.postMessage=message=>{
  if(message.type==='error') {modelError=new Error(message.error);return;}
  if(message.type==='audio_chunk') {
    const pcm=Buffer.allocUnsafe(message.data.length*2);
    for(let i=0;i<message.data.length;i++) {
      const sample=Math.max(-1,Math.min(1,message.data[i]));
      pcm.writeInt16LE(Math.round(sample*(sample<0?32768:32767)),i*2);
    }
    fs.writeSync(fd,pcm);frames+=message.data.length;
  }
};
try {
  vm.runInThisContext(fs.readFileSync(path.join(engine,'pocket-worker.js'),'utf8'),{filename:path.join(engine,'pocket-worker.js')});
  await self.onmessage({data:{type:'load',data:{audio:reference}}});
  if(modelError) throw modelError;
  const sections=job.script.trim().split(/\n\s*\n/u);
  let completed=0;
  fs.writeFileSync(path.join(output,'progress.json'),JSON.stringify({progress:0,total:sections.length}));
  for(const paragraph of sections) {
    if(!paragraph.trim()) continue;
    await self.onmessage({data:{type:'generate',data:{text:paragraph.trim(),voice:'custom',steps:job.quality==='refined'?4:1}}});
    if(modelError) throw modelError;
    const silence=Buffer.alloc(19200);
    fs.writeSync(fd,silence);frames+=9600;
    completed++;fs.writeFileSync(path.join(output,'progress.json'),JSON.stringify({progress:completed,total:sections.length}));
    if(frames*2>50331600)throw new Error('Take exceeds 48 MB. Split the script into parts.');
  }
  const header=Buffer.alloc(44);
  header.write('RIFF',0);header.writeUInt32LE(36+frames*2,4);header.write('WAVE',8);header.write('fmt ',12);
  header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);
  header.writeUInt32LE(24000,24);header.writeUInt32LE(48000,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);
  header.write('data',36);header.writeUInt32LE(frames*2,40);
  fs.writeSync(fd,header,0,44,0);
  fs.writeFileSync(path.join(output,'result.json'),JSON.stringify({job_id:job.id,seconds:frames/24000,sample_rate:24000,engine:'Pocket TTS / ONNX CPU',quality:job.quality}));
  console.log('Voice job complete. Duration '+(frames/24000).toFixed(1)+' seconds.');
}finally{fs.closeSync(fd);}
