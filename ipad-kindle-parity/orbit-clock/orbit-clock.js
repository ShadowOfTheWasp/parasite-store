'use strict';
/* Orbit clock extension for the actual Kindle string instrument.
 * Distinct clocked sample voices; does not alter or intercept its manual playback.
 */
(()=>{
if(window.__parasiteOrbitClock)return;window.__parasiteOrbitClock=true;
const doc=document, root=doc.createElement('section');root.id='parasite-clock';root.setAttribute('aria-label','Orbit six-lane clock and sequencer');
const styles=doc.createElement('style');styles.textContent=`
#parasite-clock{position:fixed;z-index:2147483600;inset:auto 8px max(8px,env(safe-area-inset-bottom));color:#e4f4e0;font:12px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:none}
#parasite-clock *{box-sizing:border-box}#parasite-clock button,#parasite-clock select,#parasite-clock input{font:inherit;color:inherit}
#parasite-clock button{touch-action:manipulation;cursor:pointer}
#parasite-clock button:focus-visible,#parasite-clock input:focus-visible,#parasite-clock select:focus-visible{outline:2px solid #c3ff8b}
#parasite-clock .clock-bar{display:flex;align-items:center;justify-content:space-between;gap:8px;max-width:700px;margin-left:auto;pointer-events:auto}
#parasite-clock .clock-button{border:1px solid #7eb875;border-radius:11px;background:#0a2317f2;color:#d6ffc4;font-weight:750;padding:10px 13px;box-shadow:0 0 18px #0009}
#parasite-clock .clock-button.primary{background:#bcff88;color:#16301c}
#parasite-clock .clock-panel{margin-top:8px;background:#0b1710f7;border:1px solid #537954;border-radius:16px;box-shadow:0 10px 40px #000c;pointer-events:auto;max-height:77dvh;overflow:auto;padding:14px;backdrop-filter:blur(18px);display:none}
#parasite-clock.expanded .clock-panel{display:block}#parasite-clock .clock-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}
#parasite-clock h2{font-size:22px;color:#b9ff89;margin:0;letter-spacing:-.8px}#parasite-clock .hint{font-size:11px;color:#afc3b0;line-height:1.5}
#parasite-clock .global{display:flex;flex-wrap:wrap;gap:9px;align-items:end;margin-bottom:12px}
#parasite-clock .control{display:flex;flex-direction:column;gap:4px;font-size:10px;letter-spacing:.4px;color:#a5c0a8}
#parasite-clock input[type=number]{width:76px;background:#17291b;border:1px solid #5d7957;border-radius:9px;padding:8px}
#parasite-clock input[type=range]{accent-color:#b8ff84;width:100%}
#parasite-clock select{background:#17271b;color:#e5f7df;border:1px solid #5b7257;border-radius:9px;padding:8px;max-width:100%}
#parasite-clock .lane{border:1px solid #2d5135;background:#142319;border-radius:12px;margin-top:9px;padding:10px}
#parasite-clock .lanehead{display:grid;grid-template-columns:52px minmax(70px,1fr) minmax(89px,1.2fr) minmax(78px,1fr) 86px 50px;gap:7px;align-items:end;margin-bottom:10px}
#parasite-clock .lane-title{font-weight:800;font-size:14px;color:#caffaf;align-self:center}
#parasite-clock .lanehead .control{min-width:0}#parasite-clock .lanehead select{padding:8px 4px;font-size:11px;width:100%}
#parasite-clock .stepgrid{display:grid;grid-template-columns:repeat(16,minmax(0,1fr));gap:4px}
#parasite-clock .step{min-width:0;padding:7px 0 6px;min-height:37px;border:1px solid #46674b;border-radius:6px;background:#1c3021;color:#a3b5a3;font-size:9px;display:flex;flex-direction:column;align-items:center;justify-content:space-around}
#parasite-clock .step.on{background:#456f39;color:#f0ffe4;border-color:#9fd67c}
#parasite-clock .step.playhead{outline:2px solid #fff7b1;outline-offset:1px}
#parasite-clock .step.selected{box-shadow:inset 0 0 0 2px #cbffae}
#parasite-clock .step small{font-size:9px;line-height:1;color:inherit}
#parasite-clock .lanefoot{display:flex;flex-wrap:wrap;gap:7px;align-items:center;margin-top:8px}
#parasite-clock .lanefoot .control{min-width:125px;flex:1}
#parasite-clock .tiny{font-size:10px;color:#a9bfaa}
#parasite-clock .tiny-btn{padding:6px 8px;border:1px solid #507251;border-radius:8px;background:#28482e;color:#d3edcc}
#parasite-clock .tiny-btn.selected{background:#baff87;color:#173016}
#parasite-clock .clock-bpm{font-weight:750;color:#eaffd6}
@media(max-width:800px){#parasite-clock .clock-panel{padding:9px;max-height:72dvh}#parasite-clock .lanehead{grid-template-columns:47px 1fr 1fr 1fr;gap:5px}#parasite-clock .lanehead>.control:nth-last-child(-n+2){grid-column:auto}#parasite-clock .stepgrid{gap:2px}#parasite-clock .step{font-size:8px;min-height:34px}#parasite-clock .step small{font-size:8px}#parasite-clock .clock-bar{max-width:none}}
`;doc.head.append(styles);
root.innerHTML=`
<div class="clock-bar"><span class="hint" id="clockMini">ORBIT CLOCK · STOPPED</span><button id="clockToggle" class="clock-button">◎ CLOCK / 16 STEPS</button></div>
<div class="clock-panel"><div class="clock-head"><div><h2>Orbit clock</h2><div class="hint">6 independent string orbits · 16 notes per bar · locked or free</div></div><button id="clockClose" class="tiny-btn">CLOSE</button></div>
<div class="global"><label class="control">MASTER BPM<input id="clockBpm" type="number" min="35" max="240" step="1" value="112"></label><button class="clock-button primary" id="clockStart">▶ RUN</button><button class="clock-button" id="clockStop">■ STOP</button><label class="control">SWING<select id="clockSwing"><option value="0">STRAIGHT</option><option value="0.16">LIGHT</option><option value="0.3">HEAVY</option></select></label><button class="tiny-btn" id="clockSave">SAVE POSITIONS</button><button class="tiny-btn" id="clockReset">RESET</button><span class="hint" id="clockMessage">Ready · tap any step to edit its note</span></div>
<div id="clockLanes"></div><div class="hint" style="padding-top:12px">Musical positions lock each orbit to the master sixteenth-note grid; FREE uses independent milliseconds. Select a note step, then choose its pitch. Sound comes from Orbit's embedded string samples where available.</div></div>`;
doc.body.append(root);
const $=id=>root.querySelector('#'+id),clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,Number(v)||0));
const labels=['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];const label=n=>labels[n%12]+(Math.floor(n/12)-1);
const noteOptions=Array.from({length:37},(_,i)=>{const n=43+i;return '<option value="'+n+'">'+label(n)+'</option>'}).join('');
const quantize=[['1/1',16],['1/2',8],['1/4',4],['1/8',2],['1/16',1],['1/32',.5],['1/8 dotted',3],['1/4 triplet',8/3]];
const divisions=quantize.map(([name,v])=>'<option value="'+v+'">'+name+'</option>').join('');
const positions=[['Downbeat',0],['+1/16',1],['+1/8',2],['+3/16',3],['+1/4',4],['+3/8',6],['Half bar',8],['+3/4',12]];
const phaseOptions=positions.map(([name,v])=>'<option value="'+v+'">'+name+'</option>').join('');
const positionsPresets={
 quarter:[0,4,8,12],eighth:[0,2,4,6,8,10,12,14],sixteenth:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15],
 offbeat:[2,6,10,14],syncopated:[0,3,7,10,14],half:[0,8],triplet:[0,3,5,8,11,13],euclid:[0,3,6,10,13],empty:[]
};
const patternOptions=Object.keys(positionsPresets).map(n=>'<option value="'+n+'">'+n.toUpperCase()+'</option>').join('');
const state={bpm:112,swing:0,playing:false,index:0,lanes:Array.from({length:6},(_,i)=>({
 enabled:true,mode:'lock',division:[1,2,4,1,2,4][i],phase:i%4,freeMs:Math.round(200+i*70),
 pattern:'quarter',notes:Array.from({length:16},(_,j)=>52+i*2+([0,2,4,5,7,5,4,2][j%8])),steps:Array.from({length:16},(_,j)=>j%4===0),
 idx:0,freeAt:0,nextTick:0,selected:0
}))};
let audio=null,master=null,echo=null,noise=null,decoded=new Map(),pending=new Set(),clockTimer=null,nextTime=0,tick=0,buffering=new Map();
const lanesRoot=$('clockLanes');const laneEls=[];
function drawLane(i){const lane=state.lanes[i],node=doc.createElement('section');node.className='lane';node.innerHTML=`
<div class="lanehead"><div class="lane-title">ORBIT ${i+1}</div>
<label class="control">GRID / FREE<select data-key="mode"><option value="lock">LOCK</option><option value="free">FREE</option></select></label>
<label class="control">MUSICAL SPEED<select data-key="division">${divisions}</select></label>
<label class="control">POSITION<select data-key="phase">${phaseOptions}</select></label>
<label class="control">PATTERN<select data-key="pattern">${patternOptions}</select></label>
<label class="control">ON<input data-key="enabled" type="checkbox" checked></label></div>
<div class="stepgrid" role="group" aria-label="Orbit ${i+1} sixteen notes"></div>
<div class="lanefoot"><label class="control">SELECTED STEP PITCH<select data-key="pitch">${noteOptions}</select></label>
<label class="control">FREE-RUN SPEED · <span data-display="freeMs">${lane.freeMs} ms</span><input data-key="freeMs" type="range" min="55" max="1600" step="5" value="${lane.freeMs}"></label>
<button class="tiny-btn" data-action="rotate">ROTATE ↻</button>
<span class="tiny">TAP = ON/OFF · LONG PRESS = EDIT</span></div>`;
node.querySelector('[data-key="mode"]').value=lane.mode;
node.querySelector('[data-key="division"]').value=String(lane.division);
node.querySelector('[data-key="phase"]').value=String(lane.phase);
node.querySelector('[data-key="pattern"]').value=lane.pattern;
const grid=node.querySelector('.stepgrid');const buttons=[];
for(let j=0;j<16;j++){
 const b=doc.createElement('button');b.type='button';b.className='step';b.setAttribute('aria-label','Orbit '+(i+1)+' step '+(j+1)+' note '+label(lane.notes[j]));
 let timer=null,long=false;
 b.addEventListener('pointerdown',()=>{long=false;timer=setTimeout(()=>{long=true;lane.selected=j;renderLane(i)},480)});
 b.addEventListener('pointerup',()=>clearTimeout(timer));b.addEventListener('pointercancel',()=>clearTimeout(timer));
 b.onclick=()=>{lane.selected=j;if(!long)lane.steps[j]=!lane.steps[j];renderLane(i)};
 b.oncontextmenu=e=>{e.preventDefault();lane.selected=j;renderLane(i)};
 grid.append(b);buttons.push(b)
}
node.querySelectorAll('[data-key]').forEach(input=>{
 input.onchange=()=>{const k=input.dataset.key;
  if(k==='pitch'){lane.notes[lane.selected]=Number(input.value)}
  else if(k==='enabled'){lane.enabled=input.checked}
  else if(k==='mode'||k==='pattern'){lane[k]=input.value;if(k==='pattern')applyPattern(lane,input.value)}
  else{lane[k]=Number(input.value)}
  if(k==='freeMs')lane.freeAt=audio?.currentTime||0;
  if(k==='phase'||k==='division')lane.nextTick=0;
  renderLane(i)
 };
 if(input.type==='range')input.oninput=input.onchange
});
node.querySelector('[data-action="rotate"]').onclick=()=>{lane.steps.unshift(lane.steps.pop());lane.notes.unshift(lane.notes.pop());lane.phase=(lane.phase+1)%16;node.querySelector('[data-key="phase"]').value=String(lane.phase);renderLane(i)};
lanesRoot.append(node);laneEls.push({node,buttons});renderLane(i);
}
function applyPattern(lane,name){const active=positionsPresets[name]||[];lane.steps=lane.steps.map((_,j)=>active.includes(j));lane.pattern=name}
function renderLane(i){
 const lane=state.lanes[i],el=laneEls[i];if(!el)return;
 for(let j=0;j<16;j++){const b=el.buttons[j];b.classList.toggle('on',lane.steps[j]);b.classList.toggle('selected',j===lane.selected);b.setAttribute('aria-pressed',String(lane.steps[j]));b.innerHTML='<span>'+String(j+1)+'</span><small>'+label(lane.notes[j])+'</small>'}
 el.node.querySelector('[data-key="pitch"]').value=String(lane.notes[lane.selected]);
 el.node.querySelector('[data-display="freeMs"]').textContent=lane.freeMs+' ms';
 el.node.querySelector('[data-key="mode"]').value=lane.mode;
 el.node.querySelector('[data-key="division"]').disabled=lane.mode==='free';
 el.node.querySelector('[data-key="phase"]').disabled=lane.mode==='free';
 el.node.querySelector('[data-key="freeMs"]').disabled=lane.mode==='lock';
}
state.lanes.forEach((_,i)=>drawLane(i));
function closestSample(note){
 const source=window.ORBIT_STRINGS;
 if(!source||typeof source!=='object')return null;
 const candidates=[];
 for(const [instrument,mapping] of Object.entries(source)){
  if(typeof mapping!=='object'||!mapping)continue;
  for(const [key,data]of Object.entries(mapping)){
   if(typeof data!=='string'||data.length<100)continue;
   const keyNumber=Number(key);if(!Number.isFinite(keyNumber))continue;
   const score=Math.abs(note-keyNumber)+(instrument.toLowerCase().includes('violin')?0:.2);
   candidates.push({key:instrument+':'+key,note:keyNumber,data,score});
  }
 }
 candidates.sort((a,b)=>a.score-b.score);return candidates[0]||null;
}
async function setupAudio(){
 if(audio){if(audio.state!=='running')await audio.resume();return audio}
 const A=window.AudioContext||window.webkitAudioContext;if(!A)throw Error('Web Audio unavailable on this device');
 audio=new A({latencyHint:'interactive'});
 const limiter=audio.createDynamicsCompressor();limiter.threshold.value=-12;limiter.ratio.value=9;limiter.attack.value=.002;limiter.release.value=.12;limiter.connect(audio.destination);
 master=audio.createGain();master.gain.value=.24;
 // Serial RE-201-style echo for clocked strings, independent of manually played Orbit voice routing.
 if(window.OrbitEffects){echo=new window.OrbitEffects(audio,limiter);echo.setAll({hEnable:false,hMix:0,echoOn:true,echoMode:8,echoRate:.28,echoIntensity:.29,echoLevel:.22,reverbLevel:.19,bass:5,treble:4,wear:.28,flutter:.2,saturation:.25});master.connect(echo.input)}
 else master.connect(limiter);
 return audio
}
async function loadBuffer(sample){
 if(decoded.has(sample.key))return decoded.get(sample.key);
 if(buffering.has(sample.key))return buffering.get(sample.key);
 const promise=(async()=>{
  const data=sample.data.replace(/^data:audio\/[^,]+,/,'');const binary=atob(data),bytes=new Uint8Array(binary.length);
  for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
  return audio.decodeAudioData(bytes.buffer);
 })();
 buffering.set(sample.key,promise);
 try{const b=await promise;decoded.set(sample.key,b);return b}finally{buffering.delete(sample.key)}
}
async function playNote(note,when,duration){
 if(!audio||!master)return;
 const pick=closestSample(note);
 if(pick){
  try{const buffer=await loadBuffer(pick),src=audio.createBufferSource(),gain=audio.createGain();src.buffer=buffer;
   src.playbackRate.value=2**((note-pick.note)/12);
   const time=Math.max(audio.currentTime+.002,when);
   gain.gain.setValueAtTime(.0001,time);gain.gain.linearRampToValueAtTime(.12,time+.015);
   const stop=Math.min(buffer.duration/src.playbackRate.value-.02,duration);
   const safe=Math.max(.06,stop);
   gain.gain.setValueAtTime(.12,time+Math.max(.01,safe-.055));gain.gain.linearRampToValueAtTime(.0001,time+safe);
   src.connect(gain).connect(master);src.start(time);src.stop(time+safe+.025);
   const record={src,gain};pending.add(record);src.onended=()=>{pending.delete(record);try{src.disconnect();gain.disconnect()}catch(e){}};
   return;
  }catch(e){$('clockMessage').textContent='Sample decoding issue; using synthesized string fallback'}
 }
 const at=Math.max(audio.currentTime+.002,when),g=audio.createGain(),osc=audio.createOscillator(),second=audio.createOscillator();
 osc.type='sawtooth';second.type='triangle';osc.frequency.value=440*2**((note-69)/12);second.frequency.value=osc.frequency.value*1.003;
 g.gain.setValueAtTime(.0001,at);g.gain.linearRampToValueAtTime(.05,at+.045);g.gain.setTargetAtTime(.0001,at+Math.max(.08,duration-.07),.025);
 osc.connect(g);second.connect(g);g.connect(master);osc.start(at);second.start(at);osc.stop(at+duration+.11);second.stop(at+duration+.11);
 const record={src:osc,gain:g,second};pending.add(record);osc.onended=()=>{pending.delete(record);try{osc.disconnect();second.disconnect();g.disconnect()}catch(e){}}
}
const intervalFor=(division)=>60/state.bpm/4*division;
function scheduleLane(lane,i,when,masterStep){
 if(!lane.enabled)return;
 const division=lane.division;
 // Map sixteenth-tick time to each orbit's own divisions. Dotted and triplet use fractional ticks.
 const t=(masterStep-lane.phase);
 const ratio=t/division;
 if(t<0||Math.abs(ratio-Math.round(ratio))>0.00001)return;
 const seq=Math.round(ratio)%16;
 if(seq<0||!lane.steps[seq])return;
 const note=lane.notes[seq];playNote(note,when,Math.min(2.2,intervalFor(division)*.85));
}
function tickClock(){
 if(!state.playing||!audio)return;
 const lookahead=.135;
 while(nextTime<audio.currentTime+lookahead){
  const current=tick, swing=(current%2?Number(state.swing)*60/state.bpm/4:0);
  state.lanes.forEach((lane,i)=>{if(lane.mode==='lock')scheduleLane(lane,i,nextTime+swing,current)});
  tick++;nextTime+=60/state.bpm/4;
 }
 for(const [i,lane] of state.lanes.entries()){
  if(!lane.enabled||lane.mode!=='free')continue;
  if(lane.freeAt===0)lane.freeAt=audio.currentTime+.045;
  let guard=0;
  while(lane.freeAt<audio.currentTime+lookahead&&guard++<12){
   const idx=lane.idx%16;
   if(lane.steps[idx])playNote(lane.notes[idx],lane.freeAt,Math.min(1.2,lane.freeMs/1000*.86));
   lane.idx++;lane.freeAt+=lane.freeMs/1000;
  }
 }
 const index=Math.floor((audio.currentTime-nextTime)/(60/state.bpm/4)+tick+1)%16;
 root.querySelectorAll('.step.playhead').forEach(el=>el.classList.remove('playhead'));
 for(let i=0;i<6;i++){const lane=state.lanes[i],el=laneEls[i];if(lane.mode==='lock'){const step=Math.floor((tick-lane.phase-1)/lane.division)%16;if(step>=0)el.buttons[step]?.classList.add('playhead')}
 else{el.buttons[(lane.idx+15)%16]?.classList.add('playhead')}}
 $('clockMini').textContent='◉ '+state.bpm+' BPM · SIX ORBITS RUNNING';
}
function stop(){
 state.playing=false;if(clockTimer){clearInterval(clockTimer);clockTimer=null}
 for(const r of pending){try{r.src.stop();r.second?.stop()}catch(e){}}
 pending.clear();root.querySelectorAll('.step.playhead').forEach(el=>el.classList.remove('playhead'));
 $('clockStart').textContent='▶ RUN';$('clockMini').textContent='ORBIT CLOCK · STOPPED';
}
async function run(){
 if(state.playing){stop();return}
 try{await setupAudio();state.playing=true;tick=0;nextTime=audio.currentTime+.075;
 state.lanes.forEach(l=>{l.idx=0;l.freeAt=audio.currentTime+.08});clockTimer=setInterval(tickClock,25);tickClock();
 $('clockStart').textContent='Ⅱ PAUSE';$('clockMessage').textContent='Master clock running. All LOCK lanes synchronized.'}
 catch(e){$('clockMessage').textContent=e.message;stop()}
}
$('clockToggle').onclick=()=>{root.classList.toggle('expanded');$('clockToggle').textContent=root.classList.contains('expanded')?'◎ HIDE CLOCK':'◎ CLOCK / 16 STEPS'};
$('clockClose').onclick=()=>{root.classList.remove('expanded');$('clockToggle').textContent='◎ CLOCK / 16 STEPS'};
$('clockStart').onclick=run;$('clockStop').onclick=stop;
$('clockBpm').onchange=()=>{const previous=state.bpm;state.bpm=clamp($('clockBpm').value,35,240);$('clockBpm').value=String(state.bpm);if(state.playing&&audio){nextTime=audio.currentTime+60/state.bpm/4;tick=Math.round(tick/16)*16}$('clockMini').textContent='◉ '+state.bpm+' BPM'};
$('clockSwing').onchange=()=>state.swing=Number($('clockSwing').value);
$('clockSave').onclick=()=>{try{const pack={bpm:state.bpm,swing:state.swing,lanes:state.lanes.map(l=>({...l}))};localStorage.setItem('parasite-orbit-grid-v1',JSON.stringify(pack));$('clockMessage').textContent='Six orbit positions saved on this device.'}catch(e){$('clockMessage').textContent='Local storage is unavailable'}};
$('clockReset').onclick=()=>{stop();try{localStorage.removeItem('parasite-orbit-grid-v1')}catch(e){}state.lanes.forEach((l,i)=>{applyPattern(l,'quarter');l.mode='lock';l.division=[1,2,4,1,2,4][i];l.phase=i%4;l.enabled=true;l.freeMs=200+i*70;l.idx=0;const el=laneEls[i].node;for(const key of ['mode','division','phase','enabled','freeMs','pattern']){const input=el.querySelector('[data-key="'+key+'"]');if(input)input.type==='checkbox'?input.checked=l[key]:input.value=String(l[key])}renderLane(i)});$('clockMessage').textContent='Reset to musical quarter-note positions.'};
try{const saved=JSON.parse(localStorage.getItem('parasite-orbit-grid-v1')||'null');if(saved&&Array.isArray(saved.lanes)&&saved.lanes.length===6){state.bpm=clamp(saved.bpm,35,240);state.swing=clamp(saved.swing,0,.5);$('clockBpm').value=state.bpm;$('clockSwing').value=String(state.swing);saved.lanes.forEach((l,i)=>{const lane=state.lanes[i],node=laneEls[i].node;for(const key of ['enabled','mode','division','phase','freeMs','pattern','selected'])if(l[key]!==undefined)lane[key]=l[key];if(Array.isArray(l.notes)&&l.notes.length===16)lane.notes=l.notes.map(n=>clamp(n,43,79));if(Array.isArray(l.steps)&&l.steps.length===16)lane.steps=l.steps.map(Boolean);node.querySelectorAll('[data-key]').forEach(el=>{const key=el.dataset.key;if(key==='pitch')return;const value=lane[key];if(value!==undefined){if(el.type==='checkbox')el.checked=!!value;else el.value=String(value)}});renderLane(i)})}}catch(e){}
window.addEventListener('pagehide',stop);doc.addEventListener('visibilitychange',()=>{if(doc.hidden)stop()});
})();
