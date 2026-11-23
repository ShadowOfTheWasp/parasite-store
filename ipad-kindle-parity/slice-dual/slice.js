'use strict';
(()=>{
const $=id=>document.getElementById(id),clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,Number(v)||0)),midi=n=>440*2**((n-69)/12);
let context=null,fx=null,level=null,noiseBuffer=null,sample=null,recorder=null,stream=null,recordTimeout=null,seqTimer=null,stepIndex=0;
const active=new Set(),sequence=Array.from({length:16},(_,i)=>i%2===0),pattern=[60,62,64,67,69,67,64,62,60,55,57,59,62,59,57,55];
function state(t){$('state').textContent=t}
function bufferNoise(){const b=context.createBuffer(1,context.sampleRate*2,context.sampleRate),a=b.getChannelData(0);let seed=1767;for(let i=0;i<a.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;a[i]=(seed/2147483648-1)}return b}
function settings(){return {hEnable:$('hEnable').checked,hLeft:-9,hRight:12,hTime:Number($('hTime').value),hFeedback:Number($('hFeedback').value),hMix:Number($('hMix').value),echoOn:$('echoOn').checked,echoMode:Number($('echoMode').value),echoRate:Number($('echoRate').value),echoIntensity:Number($('echoIntensity').value),echoLevel:Number($('echoLevel').value),reverbLevel:Number($('reverbLevel').value),bass:Number($('bass').value),treble:Number($('treble').value),wear:Number($('tapeWear').value),flutter:.35,saturation:.35}}
async function init(){
 if(!context){const C=window.AudioContext||window.webkitAudioContext;if(!C)throw Error('Web Audio is not available');
 context=new C({latencyHint:'interactive'});noiseBuffer=bufferNoise();
 const limiter=context.createDynamicsCompressor();limiter.threshold.value=-9;limiter.ratio.value=10;limiter.attack.value=.004;limiter.release.value=.14;limiter.connect(context.destination);
 level=context.createGain();level.gain.value=Number($('master').value);fx=new window.OrbitEffects(context,limiter);level.connect(fx.input);fx.setAll(settings());
 }
 if(context.state!=='running')await context.resume();return context
}
function cleanup(nodes){for(const n of nodes){try{n.disconnect()}catch(e){}}}
function factoryVoice(kind,note,volume){
 const c=context,now=c.currentTime,out=c.createGain(),filter=c.createBiquadFilter(),nodes=[out,filter],oscs=[];
 let released=false;
 out.gain.setValueAtTime(.0001,now);
 const release=(kind==='sitar'?.52:1.25),attack=(kind==='sitar'?.006:kind==='choir'?.15:.11);
 out.gain.exponentialRampToValueAtTime(Math.max(.001,volume*.24),now+attack);
 out.connect(filter);filter.connect(level);filter.type='lowpass';filter.frequency.value=kind==='sitar'?6100:3400*(1-.38*Number($('tapeWear').value));
 if(kind==='sample'&&sample){
  const source=c.createBufferSource();source.buffer=sample;source.playbackRate.value=midi(note)/midi(60);
  const start=Math.min(sample.duration-.02,sample.duration*Number($('sliceStart').value));
  const dur=Math.max(.02,Math.min(sample.duration-start,sample.duration*Number($('sliceLength').value)));
  source.connect(out);source.start(now,start,dur);oscs.push(source);nodes.push(source);
 }else{
  const sourceKind=kind==='sample'?'mellotron':kind;
  const voices=sourceKind==='sitar'?[[1,'sawtooth',.47],[2,'sawtooth',.23],[.5,'triangle',.24],[4,'square',.06]]:sourceKind==='choir'?[[1,'sawtooth',.35],[1.003,'triangle',.35],[.5,'sine',.3]]:[[1,'sawtooth',.29],[.996,'triangle',.38],[1.005,'sawtooth',.23],[.5,'sine',.16]];
  for(const [ratio,wave,amp] of voices){const osc=c.createOscillator(),g=c.createGain();osc.type=wave;osc.frequency.value=midi(note)*ratio;
   g.gain.value=sourceKind==='sitar'&&ratio===2?amp*Number($('octave').value):amp;
   osc.connect(g).connect(out);osc.start(now);nodes.push(osc,g);oscs.push(osc);
  }
  if(sourceKind==='sitar'){
   // Plucked decay, metallic buzz, octave harmonic and slow short-delay modulation.
   out.gain.cancelScheduledValues(now);out.gain.setValueAtTime(Math.max(.001,volume*.32),now);
   out.gain.exponentialRampToValueAtTime(Math.max(.0001,volume*.03),now+.6);
   const resonance=c.createBiquadFilter();resonance.type='peaking';resonance.frequency.value=Math.min(7200,midi(note)*4);resonance.Q.value=8;resonance.gain.value=10;
   out.disconnect();out.connect(resonance).connect(filter);nodes.push(resonance);
   const delay=c.createDelay(.025),send=c.createGain(),mod=c.createOscillator(),depth=c.createGain();
   delay.delayTime.value=.004;send.gain.value=Number($('flange').value)*.4;mod.frequency.value=.48;depth.gain.value=.0022*Number($('flange').value);
   filter.connect(delay);delay.connect(send).connect(level);mod.connect(depth).connect(delay.delayTime);mod.start(now);
   oscs.push(mod);nodes.push(delay,send,mod,depth);
  }
 }
 const voice={stop(force=false){if(released)return;released=true;const t=c.currentTime,d=force?.035:release;
   out.gain.cancelScheduledValues(t);out.gain.setTargetAtTime(.00001,t,Math.max(.006,d/5));
   for(const osc of oscs){try{osc.stop(t+d+.13)}catch(e){}}
   active.delete(voice);setTimeout(()=>cleanup(nodes),(d+.25)*1000)
 }};
 active.add(voice);return voice;
}
async function playBoth(note){await init();const v=[];
 for(const side of ['A','B']){const gain=Number($('level'+side).value),name=$('voice'+side).value;if(gain>.001)v.push(factoryVoice(name,note,gain))}
 state('PLAYING '+v.length+' VOICE'+(v.length===1?'':'S')+' · NOTE '+note);
 return v
}
function clearAll(){for(const v of [...active])v.stop(true)}
$('panic').onclick=()=>{stopSeq();clearAll();state('All voices stopped')};
const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const keys=$('keys');for(let i=0;i<24;i++){
 const b=document.createElement('button'),note=48+i;b.type='button';b.className='key'+([1,3,6,8,10].includes(i%12)?' sharp':'');b.textContent=names[i%12]+(3+Math.floor(i/12));b.setAttribute('aria-label','Play '+b.textContent);
 let playing=[],held=false;
 b.addEventListener('pointerdown',async e=>{e.preventDefault();held=true;b.setPointerCapture(e.pointerId);try{const p=await playBoth(note);if(!held){p.forEach(v=>v.stop());return}playing=p;b.classList.add('down')}catch(err){state(err.message)}});
 const up=()=>{held=false;playing.forEach(v=>v.stop());playing=[];b.classList.remove('down')};
 b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);keys.append(b);
}
const steps=$('steps');for(let i=0;i<16;i++){const b=document.createElement('button');b.type='button';b.className='step'+(sequence[i]?' on':'');b.textContent=i+1;
 b.setAttribute('aria-label','Step '+(i+1));b.setAttribute('aria-pressed',String(sequence[i]));
 b.onclick=()=>{sequence[i]=!sequence[i];b.classList.toggle('on',sequence[i]);b.setAttribute('aria-pressed',String(sequence[i]))};steps.append(b)}
function updatePlayhead(){[...steps.children].forEach((b,i)=>b.classList.toggle('playing',i===stepIndex))}
async function advance(){updatePlayhead();const pos=stepIndex;stepIndex=(stepIndex+1)%16;if(!sequence[pos])return;
 try{const voices=await playBoth(pattern[pos]);setTimeout(()=>voices.forEach(v=>v.stop()),Math.max(80,60000/Number($('bpm').value)/4*.84))}catch(e){state(e.message)}}
function stopSeq(){if(seqTimer){clearInterval(seqTimer);seqTimer=null}stepIndex=0;[...steps.children].forEach(b=>b.classList.remove('playing'));$('playSeq').textContent='PLAY SEQUENCE'}
$('playSeq').onclick=async()=>{if(seqTimer){stopSeq();return}try{await init();await advance();seqTimer=setInterval(advance,60000/Number($('bpm').value)/4);$('playSeq').textContent='PAUSE SEQUENCE'}catch(e){state(e.message)}};
$('stopSeq').onclick=()=>{stopSeq();clearAll()};
$('bpm').onchange=()=>{if(!seqTimer)return;clearInterval(seqTimer);seqTimer=setInterval(advance,60000/Number($('bpm').value)/4)};
for(const el of document.querySelectorAll('input[type=range]')){const output=el.parentElement.querySelector('output');function display(){if(output)output.textContent=el.value}display();el.addEventListener('input',()=>{display();if(!fx)return;if(el.id==='master')level.gain.setTargetAtTime(Number(el.value),context.currentTime,.03);else if(['hMix','hTime','hFeedback','echoRate','echoIntensity','echoLevel','reverbLevel','bass','treble','tapeWear'].includes(el.id))fx.setAll(settings())})}
for(const id of ['hEnable','echoOn','echoMode'])$(id).addEventListener('change',()=>{if(fx)fx.setAll(settings())});
async function importAudio(blob){if(blob.size>20*1024*1024)throw Error('File must be smaller than 20 MB');await init();const b=await blob.arrayBuffer(),decoded=await context.decodeAudioData(b);if(decoded.duration>30)throw Error('Audio is limited to 30 seconds');sample=decoded;$('sampleState').textContent='Recording loaded: '+decoded.duration.toFixed(1)+' seconds. Select My recording in either voice.'}
$('upload').onchange=async e=>{const file=e.target.files?.[0];if(file)try{await importAudio(file)}catch(error){$('sampleState').textContent=error.message}e.target.value=''};
$('record').onclick=async()=>{try{if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Mic recording unavailable here');
 stream=await navigator.mediaDevices.getUserMedia({audio:true});const chunks=[];recorder=new MediaRecorder(stream);
 recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data)};
 recorder.onstop=async()=>{try{await importAudio(new Blob(chunks,{type:recorder.mimeType||'audio/webm'}))}catch(e){$('sampleState').textContent=e.message}finally{stream?.getTracks().forEach(t=>t.stop());stream=null;recorder=null}};
 recorder.start();$('record').disabled=true;$('stopRecord').disabled=false;$('sampleState').textContent='Recording… maximum 8 seconds';recordTimeout=setTimeout(stopRecording,8000)
 }catch(error){$('sampleState').textContent=error.message}};
function stopRecording(){clearTimeout(recordTimeout);if(recorder?.state==='recording')recorder.stop();$('record').disabled=false;$('stopRecord').disabled=true}
$('stopRecord').onclick=stopRecording;
window.addEventListener('pagehide',()=>{stopSeq();clearAll();stopRecording();stream?.getTracks().forEach(t=>t.stop())});
})();
