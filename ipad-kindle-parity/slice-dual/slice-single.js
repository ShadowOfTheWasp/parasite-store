'use strict';
/* Parasite Slice — one sample source only. The factory sample is synthesized once
   into an eight-second tape-style buffer, then sliced/pitched like a tape replay instrument.
   It is inspired by a vintage Mellotron flute, NOT a licensed original Mellotron recording.
*/
(()=>{
const $=id=>document.getElementById(id),clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||0));
const pitch=n=>Math.pow(2,(n-60)/12);
let context=null,masterGain=null,fx=null,sample=null,rawBlob=null,sourceName='Factory Mellotron-style flute',recorder=null,micStream=null,recordTimer=null,seqTimer=null,step=0;
const voices=new Set(),pattern=[60,62,64,67,69,67,64,62,60,55,57,59,62,59,57,55],enabled=Array.from({length:16},(_,i)=>i%2===0);
const state=text=>{$('state').textContent=text};
const noteNames=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
function createFactorySample(c){
 // 8 seconds of periodically imperfect, re-pitched tape-like flute at middle C.
 // Render as a single PCM buffer: ALL voices/steps use this ONE buffer.
 const sampleRate=c.sampleRate,duration=8,n=Math.round(sampleRate*duration),buffer=c.createBuffer(1,n,sampleRate);
 const out=buffer.getChannelData(0),base=261.625565,twopi=Math.PI*2;let phase=0,noiseSeed=2176741,lpNoise=0,lpAudio=0;
 for(let i=0;i<n;i++){
  const t=i/sampleRate,pre=.035,env=(1-Math.exp(-t/pre))*Math.min(1,(duration-t)/.34);
  const drift=.0021*Math.sin(twopi*.42*t)+.0011*Math.sin(twopi*3.3*t)+.00029*Math.sin(twopi*7.6*t);
  phase+=twopi*base*(1+drift)/sampleRate;
  noiseSeed=(Math.imul(noiseSeed,1664525)+1013904223)>>>0;
  const white=noiseSeed/2147483648-1;
  lpNoise=lpNoise*.96+white*.04;
  const airy=.83*Math.sin(phase)+.195*Math.sin(phase*2+.05)+.08*Math.sin(phase*3-.32)+.032*Math.sin(phase*4+.2);
  const vibrato=1+.065*Math.sin(twopi*4.9*t)+.024*Math.sin(twopi*.3*t);
  const tape=env*(airy*vibrato+lpNoise*.082+white*.012)*.55;
  // Tape loses very high frequencies. Small bias asymmetry/saturation gives an aged sound.
  lpAudio+=.39*(Math.tanh(tape*1.5)-lpAudio);
  out[i]=Math.max(-1,Math.min(1,lpAudio));
 }
 return buffer;
}
function settings(){
 const keys=['hLeft','hRight','hTime','hFeedback','hMix','echoMode','echoRate','echoIntensity','echoLevel','reverbLevel','bass','treble'];
 const o={};for(const key of keys)if($(key))o[key]=Number($(key).value);
 o.hEnable=$('hEnable').checked;o.echoOn=$('echoOn').checked;
 o.wear=Number($('tapeWear').value);o.flutter=Number($('flange').value);o.saturation=.35;
 o.hLeft=-9;o.hRight=12;return o;
}
async function startAudio(){
 if(!context){
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)throw Error('Web Audio unavailable');
  context=new Audio({latencyHint:'interactive'});
  // Store a single source buffer; replacing it replaces the whole instrument.
  if(!sample){sample=createFactorySample(context);$('sampleState').textContent='Preset 1 · Mellotron-style flute loaded (8-second tape)'}
  const limiter=context.createDynamicsCompressor();limiter.threshold.value=-12;limiter.ratio.value=9;limiter.attack.value=.004;limiter.release.value=.17;limiter.connect(context.destination);
  masterGain=context.createGain();masterGain.gain.value=Number($('master').value);
  fx=new window.OrbitEffects(context,limiter);masterGain.connect(fx.input);fx.setAll(settings());
 }
 if(context.state!=='running')await context.resume();return context
}
async function ensureSample(){
 await startAudio();
 if(!sample){sample=createFactorySample(context);sourceName='Factory Mellotron-style flute';rawBlob=null}
 return sample;
}
function stopVoice(voice,quick=false){
 if(voice.done)return;voice.done=true;voices.delete(voice);const now=context.currentTime,d=quick?.015:clamp($('release').value,.05,2.5);
 voice.gain.gain.cancelScheduledValues(now);
 voice.gain.gain.setTargetAtTime(.00001,now,Math.max(.008,d/5));
 try{voice.source.stop(now+d+.06)}catch(e){}
}
async function playSample(midi,duration=null){
 const buffer=await ensureSample(),c=context,when=c.currentTime+.007,source=c.createBufferSource();
 const rate=pitch(midi);source.buffer=buffer;source.playbackRate.value=rate;
 const start=Math.min(Math.max(0,buffer.duration-.045),buffer.duration*Number($('sliceStart').value));
 const sliceDuration=clamp(buffer.duration*Number($('sliceLength').value),.05,buffer.duration-start);
 const usable=Math.max(.05,Math.min(sliceDuration,buffer.duration-start)/rate);
 const noteLen=Math.max(.05,Math.min(usable,duration===null?usable:duration));
 const gain=c.createGain(),filter=c.createBiquadFilter(),hiss=c.createBiquadFilter();
 filter.type='lowpass';filter.frequency.value=clamp(6700-Number($('warmth').value)*4200-Number($('tapeWear').value)*1250,850,7500);
 hiss.type='highpass';hiss.frequency.value=70;
 const level=Number($('sampleLevel').value);
 gain.gain.setValueAtTime(.00001,when);
 gain.gain.linearRampToValueAtTime(Math.max(.0001,level*.63),when+Math.min(.3,Number($('attack').value)));
 gain.gain.setTargetAtTime(.00001,when+Math.max(.07,noteLen-.09),.03);
 source.connect(hiss).connect(filter).connect(gain).connect(masterGain);
 const vibrato=c.createOscillator(),depth=c.createGain();
 vibrato.type='sine';vibrato.frequency.value=5.3;depth.gain.value=.00045+.0034*Number($('flange').value);
 vibrato.connect(depth).connect(source.playbackRate);
 vibrato.start(when);
 source.start(when,start,Math.max(.045,Math.min(buffer.duration-start,usable*rate)));
 source.stop(when+noteLen+.08);vibrato.stop(when+noteLen+.08);
 const voice={source,gain,done:false,stop(force=false){stopVoice(voice,force)}};voices.add(voice);
 source.onended=()=>{voices.delete(voice);for(const node of [source,hiss,filter,gain,vibrato,depth])try{node.disconnect()}catch(e){}};
 state('PLAYING ONE SAMPLE · '+noteNames[midi%12]+(Math.floor(midi/12)-1));
 return voice;
}
function stopAll(){for(const v of [...voices])v.stop(true)}
const keys=$('keys');for(let i=0;i<24;i++){
 const note=48+i,b=document.createElement('button');b.type='button';b.className='key'+([1,3,6,8,10].includes(i%12)?' sharp':'');
 b.textContent=noteNames[i%12]+(3+Math.floor(i/12));b.setAttribute('aria-label','Play '+b.textContent);
 let held=false,v=null;
 b.addEventListener('pointerdown',async e=>{e.preventDefault();held=true;b.setPointerCapture(e.pointerId);try{const next=await playSample(note);if(!held){next.stop(true);return}v=next;b.classList.add('down')}catch(e){state(e.message)}});
 const off=()=>{held=false;v?.stop();v=null;b.classList.remove('down')};
 b.addEventListener('pointerup',off);b.addEventListener('pointercancel',off);b.addEventListener('lostpointercapture',off);keys.append(b);
}
const steps=$('steps');for(let i=0;i<16;i++){
 const b=document.createElement('button');b.className='step'+(enabled[i]?' on':'');b.type='button';b.textContent=i+1;b.setAttribute('aria-label','Step '+(i+1));b.setAttribute('aria-pressed',String(enabled[i]));
 b.onclick=()=>{enabled[i]=!enabled[i];b.classList.toggle('on',enabled[i]);b.setAttribute('aria-pressed',String(enabled[i]))};steps.append(b);
}
async function advance(){
 const pos=step;step=(step+1)%16;[...steps.children].forEach((b,i)=>b.classList.toggle('playing',i===pos));
 if(!enabled[pos])return;
 try{await playSample(pattern[pos],Math.max(.08,60_000/Number($('bpm').value)/4/1000*.86))}catch(e){state(e.message)}
}
function stopSequence(){if(seqTimer){clearInterval(seqTimer);seqTimer=null}step=0;[...steps.children].forEach(b=>b.classList.remove('playing'));$('playSeq').textContent='PLAY SEQUENCE'}
$('playSeq').onclick=async()=>{if(seqTimer){stopSequence();return}try{await ensureSample();await advance();seqTimer=setInterval(advance,60000/Number($('bpm').value)/4);$('playSeq').textContent='PAUSE SEQUENCE'}catch(e){state(e.message)}};
$('stopSeq').onclick=()=>{stopSequence();stopAll()};
$('panic').onclick=()=>{stopSequence();stopAll();state('ALL SAMPLE VOICES STOPPED')};
$('bpm').onchange=()=>{if(!seqTimer)return;clearInterval(seqTimer);seqTimer=setInterval(advance,60000/Number($('bpm').value)/4)};
for(const el of document.querySelectorAll('input[type=range]')){
 const out=el.parentElement.querySelector('output');
 const show=()=>{if(out)out.textContent=el.value};show();
 el.addEventListener('input',()=>{show();if(!context)return;if(el.id==='master')masterGain.gain.setTargetAtTime(Number(el.value),context.currentTime,.03);if(fx)fx.setAll(settings())});
}
for(const id of ['hEnable','echoOn','echoMode'])$(id).addEventListener('change',()=>{if(fx)fx.setAll(settings())});
function setSample(buf,name,blob){
 stopAll();sample=buf;sourceName=name;rawBlob=blob||null;$('sampleState').textContent='SINGLE SAMPLE · '+name+' · '+buf.duration.toFixed(1)+' sec';$('sampleTitle').textContent=name.toUpperCase();
 $('sourceInfo').textContent='One source sample for keyboard and sequencer. Edit its start and length to slice it.'
}
async function importBlob(blob,displayName='My sample'){
 if(blob.size>20*1024*1024)throw Error('Maximum file size: 20 MB');
 await startAudio();const arr=await blob.arrayBuffer(),decoded=await context.decodeAudioData(arr);
 if(decoded.duration>.2+30)throw Error('Maximum sample duration: 30 seconds');
 setSample(decoded,displayName,blob);
}
$('upload').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{await importBlob(f,f.name)}catch(error){$('sampleState').textContent='Import failed: '+error.message}e.target.value=''};
function stopRecording(){clearTimeout(recordTimer);if(recorder?.state==='recording')recorder.stop();$('record').disabled=false;$('stopRecord').disabled=true}
$('record').onclick=async()=>{
 try{if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Recording unavailable');
 micStream=await navigator.mediaDevices.getUserMedia({audio:true});const chunks=[];recorder=new MediaRecorder(micStream);
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
 recorder.onstop=async()=>{try{await importBlob(new Blob(chunks,{type:recorder.mimeType||'audio/webm'}),'Microphone recording')}catch(e){$('sampleState').textContent=e.message}finally{micStream?.getTracks().forEach(t=>t.stop());micStream=null;recorder=null}};
 recorder.start();$('record').disabled=true;$('stopRecord').disabled=false;$('sampleState').textContent='Recording one sample · up to 8 seconds';recordTimer=setTimeout(stopRecording,8000)
 }catch(e){$('sampleState').textContent=e.message}
};
$('stopRecord').onclick=stopRecording;
// IndexedDB keeps user sample bytes WITH an eight-slot preset when browser storage allows.
function db(){
 return new Promise((resolve,reject)=>{if(!('indexedDB'in window)){reject(Error('IndexedDB unavailable'));return}
 const r=indexedDB.open('parasite-slice-preset-audio',1);r.onupgradeneeded=()=>r.result.createObjectStore('samples');r.onerror=()=>reject(r.error);r.onsuccess=()=>resolve(r.result)});
}
async function saveBlob(slot,blob){const d=await db();return new Promise((res,rej)=>{const tx=d.transaction('samples','readwrite');tx.objectStore('samples').put(blob,slot);tx.oncomplete=()=>{d.close();res()};tx.onerror=()=>{d.close();rej(tx.error)}})}
async function loadBlob(slot){const d=await db();return new Promise((res,rej)=>{const tx=d.transaction('samples','readonly'),r=tx.objectStore('samples').get(slot);r.onsuccess=()=>{d.close();res(r.result||null)};r.onerror=()=>{d.close();rej(r.error)}})}
window.ParasitePresetBridge={
 id:'slice-single-sample',factoryName:'Tape flute · Mellotron-inspired',
 beforeSave:async(form,slot)=>{
  form._sampleKind=rawBlob?'user':'factory';form._sourceName=sourceName;
  if(rawBlob)await saveBlob(slot,rawBlob);else await saveBlob(slot,null);
  form._sequence=[...enabled];form._pattern=[...pattern];
 },
 beforeLoad:async(form)=>{
  stopSequence();stopAll();let blob=null;
  try{blob=form._sampleKind==='user'?await loadBlob(window.ParasitePresetBank?.getSelected()||1):null}catch(e){}
  if(blob){await importBlob(blob,form._sourceName||'Saved sample')}
  else if(form._sampleKind==='user')throw Error('Saved audio unavailable on this device');
  else{await startAudio();setSample(createFactorySample(context),'Mellotron-style tape flute · preset 1',null)}
  if(Array.isArray(form._sequence))form._sequence.forEach((v,i)=>{enabled[i]=!!v;steps.children[i]?.classList.toggle('on',!!v)});
  if(Array.isArray(form._pattern))form._pattern.forEach((v,i)=>{pattern[i]=clamp(v,36,90)});
 },
 afterLoad:async()=>{if(fx)fx.setAll(settings())}
};
$('sampleState').textContent='PRESET 1 READY · Mellotron-style tape flute · one 8-second sample';
$('sampleTitle').textContent='MELLOTRON-STYLE TAPE FLUTE · PRESET 1';
window.addEventListener('pagehide',()=>{stopSequence();stopAll();stopRecording();micStream?.getTracks().forEach(t=>t.stop())});
})();
