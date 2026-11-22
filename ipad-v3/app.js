'use strict';
(()=>{
const $=id=>document.getElementById(id),engine=window.parasiteEngine;
const intervals={},held=new Map(),rootNames=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const chordShapes={maj:[0,4,7],min:[0,3,7],maj7:[0,4,7,11],min7:[0,3,7,10],dom7:[0,4,7,10],sus2:[0,2,7],sus4:[0,5,7],dim:[0,3,6],fifth:[0,7]};
const fxControls=['hEnabled','hPitchL','hPitchR','hDelay','hFeedback','hMix','reEnabled','reMode','reRate','reIntensity','reEcho','reSpring','reBass','reTreble'];
let activeInstrument='orbit',seqTimer=null,seqStep=0,sequence=Array.from({length:16},(_,i)=>i%4===0),recording=null,recordChunks=[],recordStream=null,recordStopTimeout=null;
function status(message){$('engineBadge').textContent=message}
function setPage(name){for(const id of ['home','hub','invent','mixer','play'])$(id).classList.toggle('hidden',id!==name);
 document.querySelectorAll('[data-page]').forEach(b=>b.classList.toggle('active',b.dataset.page===name));
 if(name==='mixer')renderMixer();scrollTo(0,0)}
async function addInstrument(id){await engine.add(id);renderMixer();status(id.toUpperCase()+' ACTIVE');}
async function openInstrument(id){
 activeInstrument=id;await addInstrument(id);setPage('play');$('instrumentTitle').textContent=id;$('instrumentType').textContent='PARASITE / '+id.toUpperCase();
 for(const kind of ['orbit','melt','slice'])$(kind).classList.toggle('hidden',kind!==id);
 $('fxUnit').textContent=id.toUpperCase()+' · CHANNEL EFFECTS';
 syncRack();
}
function bindSlider(id){const input=$(id),out=input?.parentElement?.querySelector('output');if(!input||!out)return;
 const update=()=>{out.textContent=(Number(input.value)>=0&&Number(input.value)<2?Number(input.value).toFixed(2):input.value)};input.addEventListener('input',update);update()}
document.querySelectorAll('input[type=range]').forEach(el=>bindSlider(el.id));
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>setPage(b.dataset.page)));
document.querySelectorAll('[data-instrument]').forEach(b=>b.addEventListener('click',()=>openInstrument(b.dataset.instrument).catch(error=>status(error.message))));
document.querySelectorAll('[data-add]').forEach(b=>b.addEventListener('click',()=>addInstrument(b.dataset.add).catch(e=>{$('mixerStatus').textContent=e.message})));
$('addCurrent').onclick=()=>addInstrument('orbit');$('addMelt').onclick=()=>addInstrument('melt');$('addSlice').onclick=()=>addInstrument('slice');
$('stop').onclick=()=>{stopSequencer();engine.stopAll();status('ALL VOICES STOPPED')};
$('masterStop').onclick=()=>{stopSequencer();engine.stopAll();$('mixerStatus').textContent='All voices stopped'};
$('masterLevel').oninput=e=>{engine.masterLevel(e.target.value);$('masterLevelValue').textContent=Math.round(e.target.value*100)+'%'};
$('remote').onclick=()=>window.open('https://parasite-creator.vercel.app','_blank','noopener,noreferrer');
function renderMixer(){
 const target=$('mixerChannels');target.replaceChildren();
 for(const [id,ch] of engine.channels){
  const el=document.createElement('div');el.className='mix-strip'+(ch.mute?' muted-strip':'');
  const title=document.createElement('h3');title.textContent=id.toUpperCase();el.append(title);
  const actions=document.createElement('div');actions.className='bar';
  const select=document.createElement('button');select.className='button small';select.textContent='PLAY + FX';select.onclick=()=>openInstrument(id).catch(console.error);actions.append(select);
  const mute=document.createElement('button');mute.className='button small'+(ch.mute?' active':'');mute.textContent='MUTE';mute.setAttribute('aria-pressed',String(ch.mute));
  mute.onclick=()=>{ch.mute=!ch.mute;engine.updateFaders();renderMixer()};actions.append(mute);
  const solo=document.createElement('button');solo.className='button small'+(ch.solo?' active':'');solo.textContent='SOLO';solo.setAttribute('aria-pressed',String(ch.solo));
  solo.onclick=()=>{ch.solo=!ch.solo;engine.updateFaders();renderMixer()};actions.append(solo);el.append(actions);
  const level=document.createElement('input');level.type='range';level.min='0';level.max='1';level.step='.01';level.value=String(ch.volume);
  level.setAttribute('aria-label',id+' level');level.oninput=()=>{ch.setFader(Number(level.value));value.textContent=Math.round(Number(level.value)*100)+'%'};
  const value=document.createElement('span');value.className='mini-status';value.textContent=Math.round(ch.volume*100)+'%';
  const label=document.createElement('p');label.className='mini';label.textContent='CHANNEL LEVEL';el.append(label,level,value);
  const remove=document.createElement('button');remove.className='button small';remove.style.marginTop='12px';remove.textContent='REMOVE';remove.onclick=()=>{if(activeInstrument===id)engine.stopAll();engine.remove(id);renderMixer()};
  el.append(remove);target.append(el);
 }
 $('mixerStatus').textContent=engine.channels.size+' active instrument'+(engine.channels.size===1?'':'s')+' · independent effects per channel';
}
function syncRack(){const ch=engine.get(activeInstrument);if(!ch)return;
 for(const id of fxControls){const el=$(id);const key=id.slice(id.startsWith('h')?1:2);const data=id.startsWith('h')?ch.h:ch.re;const camel=key.charAt(0).toLowerCase()+key.slice(1);if(el.type==='checkbox')el.checked=data[camel];else el.value=data[camel];if(el.type==='range')el.dispatchEvent(new Event('input',{bubbles:false}))}}
for(const id of fxControls){$(id).addEventListener('input',()=>{
 const ch=engine.get(activeInstrument);if(!ch)return;const data=id.startsWith('h')?ch.h:ch.re,k=id.slice(id.startsWith('h')?1:2),key=k[0].toLowerCase()+k.slice(1);
 data[key]=$(id).type==='checkbox'?$(id).checked:Number($(id).value);ch.setFx();
 })}
// Root MIDI selected in semitones from C3.
const root=$('orbitRoot');rootNames.forEach((name,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=name+'3';root.append(o)});root.value='0';
const midiToFreq=n=>440*Math.pow(2,(n-69)/12);
function playChord(pitchOffset){
 const base=48+Number(root.value)+pitchOffset;
 const intervals=chordShapes[$('orbitChord').value]||chordShapes.maj;
 const ensemble=Number($('orbitStrings').value);
 return Promise.all(intervals.map(n=>engine.note('orbit',midiToFreq(base+n),{type:'strings',attack:Number($('orbitAttack').value),release:1.7,level:.065+ensemble*.015,tone:2500+ensemble*3500})))
}
function drawOrbit(){
 const el=$('orbits');el.replaceChildren();const changes=[0,2,4,5,7,9];
 changes.forEach((offset,i)=>{
  const b=document.createElement('button');b.className='planet';b.setAttribute('aria-label','Chord planet '+(i+1));
  const angle=2*Math.PI*i/6-Math.PI/2;b.style.left=(50+34*Math.cos(angle))+'%';b.style.top=(50+34*Math.sin(angle))+'%';
  let vs=[],lastOffset=offset,y=0;
  async function down(e){e.preventDefault();b.setPointerCapture(e.pointerId);y=e.clientY;lastOffset=offset;
   try{vs=await playChord(offset);b.classList.add('on');}catch(error){status(error.message)}}
  b.addEventListener('pointerdown',down);b.addEventListener('pointermove',e=>{
   if(!b.hasPointerCapture(e.pointerId)||vs.length===0)return;
   const shifted=offset+Math.round((y-e.clientY)/21);
   if(shifted===lastOffset)return;lastOffset=shifted;
   const chord=chordShapes[$('orbitChord').value]||chordShapes.maj,base=48+Number(root.value)+shifted;
   vs.forEach((v,j)=>v?.setFrequency?.(midiToFreq(base+chord[j]),Number($('orbitGlide').value)))});
  const up=()=>{vs.forEach(v=>v?.stop?.());vs=[];b.classList.remove('on')};
  b.addEventListener('pointerup',up);b.addEventListener('pointercancel',up);b.addEventListener('lostpointercapture',up);
  el.append(b);
 })}
// Keyboard layout: 12 chromatic notes C4-B4.
const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
function buildKeys(id,channel,optionsFactory){
 const el=$(id);el.replaceChildren();
 for(let i=0;i<12;i++){
  let key=document.createElement('button');key.className='key'+([1,3,6,8,10].includes(i)?' sharp':'');key.textContent=names[i];key.setAttribute('aria-label',names[i]+'4');let v=null;
  key.addEventListener('pointerdown',async e=>{
   e.preventDefault();key.setPointerCapture(e.pointerId);
   const o=optionsFactory();try{v=await engine.note(channel,midiToFreq(60+i),o);key.classList.add('on')}
   catch(error){status(error.message)}});
  const release=()=>{v?.stop?.();v=null;key.classList.remove('on')};
  key.addEventListener('pointerup',release);key.addEventListener('pointercancel',release);key.addEventListener('lostpointercapture',release);el.append(key)
 }
}
buildKeys('meltKeys','melt',()=>({wave:$('meltWave').value,attack:Number($('meltAttack').value),release:Number($('meltRelease').value),level:.21,glide:Number($('meltGlide').value)}));
function sliceVoiceSettings(kind,level){return {type:kind,attack:kind==='choir'?.22:kind==='strings'?.12:.01,release:kind==='sitar'?.65:1.6,level:level*(kind==='sitar'?.20:.15),start:Number($('sliceStart').value),length:Number($('sliceLength').value),octave:Number($('sitarOctave').value),flanger:Number($('sitarFlanger').value),tone:kind==='sitar'?6000:4500}}
async function playSlice(freq){const a=$('voiceA').value,b=$('voiceB').value;const promises=[];
 if(Number($('levelA').value)>.005)promises.push(engine.note('slice',freq,sliceVoiceSettings(a,Number($('levelA').value))));
 if(Number($('levelB').value)>.005)promises.push(engine.note('slice',freq,sliceVoiceSettings(b,Number($('levelB').value))));
 return Promise.all(promises)}
buildKeys('sliceKeys','slice',()=>({type:'strings',release:1.1,level:.15}));
/* Override the generic slice keyboard with a true dual-voice keyboard. */
{const el=$('sliceKeys');for(const [i,key] of [...el.children].entries()){const replacement=key.cloneNode(true);key.replaceWith(replacement);let heldVoices=[];
 replacement.addEventListener('pointerdown',async e=>{e.preventDefault();replacement.setPointerCapture(e.pointerId);try{heldVoices=await playSlice(midiToFreq(60+i));replacement.classList.add('on')}catch(error){status(error.message)}});
 const up=()=>{heldVoices.forEach(v=>v?.stop?.());heldVoices=[];replacement.classList.remove('on')};
 replacement.addEventListener('pointerup',up);replacement.addEventListener('pointercancel',up);replacement.addEventListener('lostpointercapture',up)}}
function drawSteps(){const el=$('steps');el.replaceChildren();for(let i=0;i<16;i++){
 const b=document.createElement('button');b.className='step'+(sequence[i]?' on':'');b.textContent=String(i+1);
 b.setAttribute('aria-label','Step '+(i+1));b.setAttribute('aria-pressed',String(sequence[i]));
 b.onclick=()=>{sequence[i]=!sequence[i];b.classList.toggle('on',sequence[i]);b.setAttribute('aria-pressed',String(sequence[i]))};el.append(b)}}
function stopSequencer(){if(seqTimer){clearInterval(seqTimer);seqTimer=null}seqStep=0;document.querySelectorAll('.step.playing').forEach(x=>x.classList.remove('playing'));$('seqStart').textContent='PLAY SEQUENCE'}
async function advance(){const pos=seqStep%16,children=$('steps').children;for(const [i,b] of [...children].entries())b.classList.toggle('playing',i===pos);
 if(sequence[pos]){const notes=[60,64,67,72,67,64,60,62,65,69,72,69,65,62,60,55];try{const voices=await playSlice(midiToFreq(notes[pos]));setTimeout(()=>voices.forEach(v=>v?.stop?.()),Math.min(340,60000/Number($('seqBpm').value)*.65))}catch(e){status(e.message)}}
 seqStep++;
}
$('seqStart').onclick=async()=>{if(seqTimer){stopSequencer();return}await addInstrument('slice');await advance();seqTimer=setInterval(advance,60000/Number($('seqBpm').value)/4);$('seqStart').textContent='PAUSE SEQUENCE'};
$('seqStop').onclick=stopSequencer;
$('seqBpm').addEventListener('change',()=>{if(!seqTimer)return;clearInterval(seqTimer);seqTimer=setInterval(advance,60000/Number($('seqBpm').value)/4)});
// Recording and importing are local only. Browser microphone permission requires HTTPS and a gesture.
async function importAudio(blob){
 if(blob.size>20*1024*1024)throw Error('File too large (20MB maximum)');
 const arr=await blob.arrayBuffer(),duration=await engine.decode(arr);
 $('sampleStatus').textContent='User tape loaded · '+duration.toFixed(1)+'s · select “My recording” in Voice A or B.';
}
$('fileInput').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;try{await importAudio(file)}catch(error){$('sampleStatus').textContent=error.message}e.target.value=''});
async function stopRecording(){
 clearTimeout(recordStopTimeout);if(recording&&recording.state==='recording')recording.stop();
 $('record').disabled=false;$('stopRecord').disabled=true;
}
$('record').onclick=async()=>{try{
 if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Microphone recording is unavailable in this browser');
 recordStream=await navigator.mediaDevices.getUserMedia({audio:true});recording=new MediaRecorder(recordStream);recordChunks=[];
 recording.ondataavailable=e=>{if(e.data.size)recordChunks.push(e.data)};
 recording.onstop=async()=>{try{const blob=new Blob(recordChunks,{type:recording.mimeType||'audio/webm'});await importAudio(blob)}
 catch(e){$('sampleStatus').textContent=e.message}finally{recordStream?.getTracks().forEach(t=>t.stop());recordStream=null;recording=null}};
 recording.start();$('record').disabled=true;$('stopRecord').disabled=false;$('sampleStatus').textContent='Recording... maximum 8 seconds';recordStopTimeout=setTimeout(stopRecording,8000);
 }catch(e){$('sampleStatus').textContent=e.message}};
$('stopRecord').onclick=stopRecording;
window.addEventListener('pagehide',()=>{stopSequencer();engine.stopAll();if(recording?.state==='recording')recording.stop();recordStream?.getTracks().forEach(t=>t.stop())});
$('online').textContent=navigator.onLine?'ONLINE / AUDIO LOCAL':'OFFLINE / AUDIO LOCAL';
window.addEventListener('online',()=>$('online').textContent='ONLINE / AUDIO LOCAL');
window.addEventListener('offline',()=>$('online').textContent='OFFLINE / AUDIO LOCAL');
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
drawOrbit();drawSteps();setPage('home');
})();