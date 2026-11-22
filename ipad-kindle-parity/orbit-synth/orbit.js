'use strict';
(()=>{
const $=id=>document.getElementById(id),clamp=(x,a,b)=>Math.min(b,Math.max(a,Number(x)||0));
const oscIDs=Array.from({length:4},(_,i)=>i+1);
const get=(id)=>$(id)?.type==='checkbox'?$(id).checked:$(id)?.value;
const num=id=>Number(get(id));
const semis={major:[0,4,7],minor:[0,3,7],maj7:[0,4,7,11],min7:[0,3,7,10],dom7:[0,4,7,10],sus2:[0,2,7],sus4:[0,5,7],dim:[0,3,6],fifth:[0,7]};
const notes=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];
const midi=n=>440*Math.pow(2,(n-69)/12);
const oscDefaults=[{wave:'sawtooth',oct:0,detune:-6,level:.65},{wave:'square',oct:0,detune:7,level:.45},{wave:'sawtooth',oct:-1,detune:-2,level:.3},{wave:'triangle',oct:1,detune:3,level:.17}];
const presets={
 nebula:{name:'Nebula Strings',osc:oscDefaults,noise:.13,cutoff:3400,res:1.3,filterAmount:.38,ampAttack:.3,ampRelease:2.3,ampSustain:.8,chorus:.64,echoMode:8,echoLevel:.31,reverbLevel:.25,echoRate:.29},
 brass:{osc:[{wave:'sawtooth',oct:0,detune:-3,level:.8},{wave:'sawtooth',oct:0,detune:5,level:.74},{wave:'square',oct:-1,detune:0,level:.3},{wave:'triangle',oct:1,detune:0,level:.13}],noise:.07,cutoff:1900,res:2.4,filterAmount:.8,filterAttack:.02,filterDecay:.38,filterSustain:.23,ampAttack:.015,ampRelease:.42,chorus:.18,echoMode:5,echoLevel:.21},
 noise:{osc:[{wave:'square',oct:0,detune:-25,level:.55},{wave:'sawtooth',oct:1,detune:31,level:.4},{wave:'triangle',oct:-2,detune:-14,level:.6},{wave:'square',oct:2,detune:45,level:.28}],noise:.62,noiseTone:6500,cutoff:1300,res:8.6,filterAmount:.75,drive:.65,lfoTarget:'filter',lfoRate:5.2,lfoDepth:.65,ampRelease:.8,echoMode:11,echoIntensity:.6,wear:.74,flutter:.67},
 space:{osc:[{wave:'sawtooth',oct:-1,detune:-12,level:.65},{wave:'triangle',oct:0,detune:15,level:.52},{wave:'sine',oct:1,detune:3,level:.36},{wave:'square',oct:2,detune:-7,level:.1}],noise:.25,cutoff:2800,res:2.7,ampAttack:1.4,ampRelease:4.5,chorus:.83,echoMode:11,echoIntensity:.52,echoLevel:.62,reverbLevel:.6,echoRate:.44,wear:.7},
 bass:{osc:[{wave:'sawtooth',oct:-1,detune:0,level:.8},{wave:'square',oct:-1,detune:3,level:.72},{wave:'sine',oct:-2,detune:0,level:.65},{wave:'sawtooth',oct:0,detune:0,level:.15}],noise:.02,cutoff:550,res:1.2,filterAmount:.83,filterAttack:.007,filterDecay:.21,filterSustain:.13,ampAttack:.008,ampDecay:.25,ampSustain:.7,ampRelease:.3,chorus:.06,echoOn:false}
};
function applyPatch(name){const patch=presets[name];if(!patch)return;patch.osc?.forEach((o,i)=>{const id=i+1;for(const [prop,suffix] of [['wave','Wave'],['oct','Oct'],['detune','Detune'],['level','Level']]){const el=$('osc'+id+suffix);if(el)el.value=o[prop];}$('osc'+id+'On').checked=true;});
 for(const [key,val]of Object.entries(patch)){if(key==='osc'||key==='name')continue;let el=$(key);if(!el)continue;if(el.type==='checkbox')el.checked=val;else el.value=val}
 updateOutputs();if(engine)engine.effects.setAll(currentFx());engine?.updateMaster();
}
function currentFx(){const obj={};for(const key of ['hEnable','hLeft','hRight','hTime','hFeedback','hMix','echoOn','echoMode','echoRate','echoIntensity','echoLevel','reverbLevel','bass','treble','wear','flutter','saturation'])obj[key]=typeof get(key)==='boolean'?get(key):num(key);return obj}
let engine=null;
class OrbitVoice{
 constructor(synth,note){
  this.synth=synth;this.ctx=synth.ctx;this.c=this.ctx;this.note=note;this.started=this.c.currentTime;this.nodes=[];this.oscs=[];this.finished=false;this.on=true;
  const now=this.started;
  this.amp=this.c.createGain();this.amp.gain.setValueAtTime(.00001,now);
  const att=clamp(num('ampAttack'),.005,5),dec=clamp(num('ampDecay'),.01,5),sus=clamp(num('ampSustain'),0,1);
  this.amp.gain.exponentialRampToValueAtTime(.13,now+att);this.amp.gain.setTargetAtTime(.13*Math.max(sus,.001),now+att,dec/3+.006);
  this.f1=this.c.createBiquadFilter();this.f2=this.c.createBiquadFilter();
  this.f1.type=this.f2.type=get('filterMode');this.f1.Q.value=clamp(num('res'),.1,14);this.f2.Q.value=clamp(num('res')*.4,.1,6);
  this.bus=this.c.createGain();this.bus.gain.value=.18;
  this.bus.connect(this.f1).connect(this.f2).connect(this.amp).connect(synth.preEffects);
  this.nodes.push(this.bus,this.f1,this.f2,this.amp);
  this.setFilter(true);
  for(const i of oscIDs){
   if(!get('osc'+i+'On'))continue;
   const o=this.c.createOscillator(),g=this.c.createGain(),pan=this.c.createStereoPanner();
   o.type=get('osc'+i+'Wave');const oct=num('osc'+i+'Oct'),cents=num('osc'+i+'Detune')+num('masterTune');
   const ratio=Math.pow(2,oct+cents/1200);o.frequency.value=midi(note)*ratio;g.gain.value=num('osc'+i+'Level');
   pan.pan.value=(i-2.5)/2.5*clamp(num('spread'),0,1)*.85;
   o.connect(g).connect(pan).connect(this.bus);o.start(now);
   this.oscs.push({o,g,pan,ratio});this.nodes.push(o,g,pan);
  }
  if(num('noise')>.001){const white=this.c.createBufferSource(),n=this.c.createGain(),f=this.c.createBiquadFilter();white.buffer=synth.noiseBuffer;white.loop=true;white.playbackRate.value=.9;
   f.type='lowpass';f.frequency.value=clamp(num('noiseTone'),200,11000);n.gain.value=num('noise')*.6;white.connect(f).connect(n).connect(this.bus);white.start(now);
   this.noise={white,f,n};this.nodes.push(white,f,n)}
  const lfo=this.c.createOscillator(),amount=this.c.createGain();lfo.type=get('lfoWave');lfo.frequency.value=num('lfoRate');
  amount.gain.setValueAtTime(0,now);const depth=num('lfoDepth');const target=get('lfoTarget');
  const fade=clamp(num('lfoDelay'),0,3);
  amount.gain.linearRampToValueAtTime(target==='pitch'?depth*11:target==='filter'?depth*1500:depth*.026,now+Math.max(.01,fade));
  lfo.connect(amount);
  if(target==='pitch'){for(const x of this.oscs)amount.connect(x.o.detune)}
  if(target==='filter'){amount.connect(this.f1.frequency);amount.connect(this.f2.frequency)}
  if(target==='amp'){amount.connect(this.amp.gain)}
  lfo.start(now);this.lfo=lfo;this.nodes.push(lfo,amount);
 }
 setFilter(initial=false){
  const c=this.c,now=c.currentTime,p=this.note,base=clamp(num('cutoff')*Math.pow(2,(p-60)/12*num('keytrack')) ,60,14000);
  const attack=clamp(num('filterAttack'),.005,5),dec=clamp(num('filterDecay'),.01,5),sus=clamp(num('filterSustain'),0,1),amt=clamp(num('filterAmount'),-1,1);
  const peak=clamp(base*Math.pow(2,amt*3),60,17000),end=clamp(base*Math.pow(2,amt*3*sus),60,17000);
  for(const f of [this.f1,this.f2]){f.frequency.cancelScheduledValues(now);f.frequency.setValueAtTime(base,now);f.frequency.exponentialRampToValueAtTime(peak,now+attack);f.frequency.setTargetAtTime(end,now+attack,dec/3+.005)}
 }
 slide(note){if(this.finished)return;this.note=note;const now=this.c.currentTime,g=clamp(num('glide'),0,2);for(const x of this.oscs){x.o.frequency.cancelScheduledValues(now);const dest=midi(note)*x.ratio;if(g>.015)x.o.frequency.setTargetAtTime(dest,now,g/4);else x.o.frequency.setValueAtTime(dest,now)}}
 release(quick=false){if(this.finished)return;this.finished=true;const c=this.c,now=c.currentTime,release=quick?.025:clamp(num('ampRelease'),.03,9),frel=quick?.025:clamp(num('filterRelease'),.03,8);
  this.amp.gain.cancelScheduledValues(now);this.amp.gain.setTargetAtTime(.000001,now,Math.max(.01,release/5));for(const f of [this.f1,this.f2]){f.frequency.cancelScheduledValues(now);f.frequency.setTargetAtTime(clamp(num('cutoff'),70,12000),now,Math.max(.01,frel/4))}
  for(const x of this.oscs){try{x.o.stop(now+release+.12)}catch(e){}}
  if(this.noise)try{this.noise.white.stop(now+release+.12)}catch(e){}
  try{this.lfo.stop(now+release+.12)}catch(e){}
  this.synth.voices=this.synth.voices.filter(x=>x!==this);
  setTimeout(()=>{for(const node of this.nodes)try{node.disconnect()}catch(e){}},(release+.3)*1000);
 }
}
class OrbitSynth{
 constructor(c){
  this.ctx=c;this.voices=[];this.noiseBuffer=this.makeNoise();
  this.preEffects=c.createGain();this.preEffects.gain.value=.67;
  this.chorusDry=c.createGain(),this.chorusWet=c.createGain(),this.chorusMerge=c.createChannelMerger(2);
  this.preEffects.connect(this.chorusDry);
  this.chorusD=[0,1].map((i)=>{const d=c.createDelay(.05),l=c.createOscillator(),g=c.createGain(),pan=c.createStereoPanner(),wet= c.createGain();wet.gain.value=.2;
   d.delayTime.value=.018+i*.004;l.frequency.value=i?.93:.71;g.gain.value=.0025;l.connect(g).connect(d.delayTime);
   this.preEffects.connect(d);pan.pan.value=i?.82:-.82;d.connect(pan).connect(wet);l.start();return{d,l,g,pan,wet}});
  this.master=c.createGain();this.master.gain.value=.66;
  this.chorusDry.connect(this.master);this.chorusD.forEach(x=>x.wet.connect(this.master));
  this.limiter=c.createDynamicsCompressor();this.limiter.threshold.value=-11;this.limiter.ratio.value=10;this.limiter.attack.value=.004;this.limiter.release.value=.18;
  this.effects=new window.OrbitEffects(c,this.limiter);this.master.connect(this.effects.input);this.limiter.connect(c.destination);
  this.updateMaster();
 }
 makeNoise(){const c=this.ctx,buffer=c.createBuffer(1,c.sampleRate*3,c.sampleRate);let seed=90154,a=buffer.getChannelData(0);for(let i=0;i<a.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;a[i]=seed/2147483648-1}return buffer}
 updateMaster(){const t=this.ctx.currentTime,chor=clamp(num('chorus'),0,1);
  this.chorusDry.gain.setTargetAtTime(1-chor*.3,t,.03);
  this.chorusD.forEach(x=>{x.wet.gain.setTargetAtTime(chor*.3,t,.035);x.g.gain.setTargetAtTime(.0002+chor*.0035,t,.05)});
  this.master.gain.setTargetAtTime(clamp(num('master'),0,1)*.7,t,.03);
 }
 noteOn(n){if(this.voices.length>=4){this.voices[0].release(true)}let v=new OrbitVoice(this,n);this.voices.push(v);meter();return v}
 stopAll(){for(const x of [...this.voices])x.release(true);meter()}
}
async function ensureSound(){
 if(!engine){const A=window.AudioContext||window.webkitAudioContext;if(!A)throw Error('Web Audio unsupported');const c=new A({latencyHint:'interactive'});engine=new OrbitSynth(c);engine.effects.setAll(currentFx())}
 if(engine.ctx.state!=='running')await engine.ctx.resume();$('status').textContent='SYNTH ONLINE · '+engine.voices.length+' VOICES';return engine
}
function meter(){$('meter').style.width=(engine?Math.min(100,engine.voices.length*23):0)+'%';if(engine)$('status').textContent='ACTIVE VOICES: '+engine.voices.length+' / 4'}
function showError(e){$('status').textContent=e?.message||String(e)}
function updateOutputs(){for(const input of document.querySelectorAll('input[type=range]')){const out=input.parentElement.querySelector('output');if(out)out.textContent=(Number(input.value)<2?Number(input.value).toFixed(2):input.value)}}
function applyControls(e){updateOutputs();if(!engine)return;
 if(e.target.closest('.effects'))engine.effects.setAll(currentFx());
 else if(e.target.id==='master'||e.target.id==='chorus')engine.updateMaster();
 else if(e.target.id?.endsWith('Level')){const i=Number(e.target.id.match(/osc(\d)Level/)?.[1]);if(i)for(const v of engine.voices){const o=v.oscs[i-1];if(o)o.g.gain.setTargetAtTime(num('osc'+i+'Level'),engine.ctx.currentTime,.03)}}
}
for(const c of document.querySelectorAll('input,select'))c.addEventListener('input',applyControls);
const roots=$('root');notes.forEach((n,i)=>{const el=document.createElement('option');el.value=i;el.textContent=n+'3';roots.append(el)});roots.value=0;
$('patch').addEventListener('change',()=>applyPatch(get('patch')));
$('panic').onclick=()=>{engine?.stopAll();meter()};
$('randomize').onclick=()=>{for(const i of oscIDs){$('osc'+i+'Wave').value=['sawtooth','square','triangle','sine'][Math.floor(Math.random()*4)];$('osc'+i+'Oct').value=String(Math.floor(Math.random()*3)-1);$('osc'+i+'Detune').value=String(Math.floor(Math.random()*80)-40);$('osc'+i+'Level').value=String((Math.random()*.65+.25).toFixed(2))}updateOutputs()};
function voicesForNote(base){const shift=Number(roots.value),root=48+shift+base,shape=get('playMode')==='single'?[0]:(semis[get('chord')]||semis.major);
 return shape.slice(0,4).map(n=>root+n)}
function buildPlanets(){const el=$('planets');el.replaceChildren();for(let i=0;i<6;i++){
 const button=document.createElement('button');button.className='planet';button.textContent=['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ','Ⅵ'][i];button.setAttribute('aria-label','Orbit chord planet '+(i+1));
 let voices=[],y=0,shift=0,held=false;
 button.addEventListener('pointerdown',async e=>{e.preventDefault();held=true;button.setPointerCapture(e.pointerId);y=e.clientY;shift=0;
  try{const s=await ensureSound();if(!held)return;voices=voicesForNote([0,2,4,5,7,9][i]).map(n=>s.noteOn(n));button.classList.add('active')}catch(err){showError(err)}});
 button.addEventListener('pointermove',e=>{if(!held||!voices.length)return;const newShift=Math.round((y-e.clientY)/25);
  if(newShift!==shift){shift=newShift;voicesForNote([0,2,4,5,7,9][i]+shift).forEach((n,k)=>voices[k]?.slide(n))}});
 function release(){held=false;voices.forEach(v=>v.release());voices=[];button.classList.remove('active');meter()}
 button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);el.append(button)}
}
function buildKeys(){const el=$('keys');el.replaceChildren();for(let i=0;i<24;i++){
  const key=document.createElement('button');key.className='key'+([1,3,6,8,10].includes(i%12)?' black':'');key.textContent=notes[i%12]+(Math.floor(i/12)+3);key.setAttribute('aria-label',key.textContent);
  let voice=null,held=false;
  key.addEventListener('pointerdown',async e=>{e.preventDefault();held=true;key.setPointerCapture(e.pointerId);try{const s=await ensureSound();if(!held)return;voice=s.noteOn(48+i);key.classList.add('down')}catch(err){showError(err)}});
  function release(){held=false;voice?.release();voice=null;key.classList.remove('down');meter()}
  key.addEventListener('pointerup',release);key.addEventListener('pointercancel',release);key.addEventListener('lostpointercapture',release);el.append(key);
 }}
window.addEventListener('pagehide',()=>{engine?.stopAll()});document.addEventListener('visibilitychange',()=>{if(document.hidden)engine?.stopAll()});
applyPatch('nebula');buildPlanets();buildKeys();updateOutputs();
})();
