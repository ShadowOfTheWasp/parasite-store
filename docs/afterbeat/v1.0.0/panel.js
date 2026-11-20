'use strict';

const el = id => document.getElementById(id);
const storageKey = 'parasite-afterbeat-v1';
const blank = () => Array(12).fill(0);
const bits = indices => indices.reduce((mask, i) => mask | 1 << i, 0);
const demoPatterns = () => [
  [[0,6,8,11],[4,12],[],[0,2,4,6,8,10,12,14],[7,15],[],[],[],[],[],[3,10],[0,4,8,12]].map(bits),
  [[0,3,7,8,14],[4,12],[12],[0,2,4,6,8,9,10,12,14],[7,15],[],[],[],[13],[6],[3,10],[0,4,8,12,14]].map(bits)
];
const initialSettings = () => lanes.map((_, i) => ({level:[82,70,63,56,54,48,59,59,58,62,55][i],
  tune:0, decay:50, tone:50, snappy:50, alternate:false}));
let state = {patterns:demoPatterns(), voices:initialSettings(), bpm:114, swing:10, accent:30, volume:70, bank:0, chain:false};
const limit = (x, min, max) => Number.isInteger(x) ? Math.max(min,Math.min(max,x)) : min;
const controls = {bpm:[40,240,' BPM'],swing:[0,50,'%'],accent:[0,65,'%'],volume:[0,100,'%'],
  level:[0,100,'%'],tune:[-12,12,' st'],decay:[0,100,'%'],tone:[0,100,'%'],snappy:[0,100,'%']};
try {
  const saved=JSON.parse(localStorage.getItem(storageKey));
  if (saved && Array.isArray(saved.patterns) && saved.patterns.length === 2 &&
      saved.patterns.every(row => Array.isArray(row) && row.length === 12)) {
    state.patterns=saved.patterns.map(row=>row.map(mask=>limit(mask,0,65535)));
    for (const key of ['bpm','swing','accent','volume']) {
      if (Number.isInteger(saved[key])) state[key]=limit(saved[key],...controls[key]);
    }
    state.bank=saved.bank===1?1:0;
    state.chain=saved.chain===true;
    if (Array.isArray(saved.voices)) state.voices.forEach((voice,index)=>{
      const data=saved.voices[index];
      if (!data) return;
      for (const key of ['level','tune','decay','tone','snappy']) {
        if (Number.isInteger(data[key])) voice[key]=limit(data[key],...controls[key]);
      }
      voice.alternate=data.alternate===true;
    });
  }
} catch {}
function save() {
  try {localStorage.setItem(storageKey,JSON.stringify(state));} catch {}
}
let selected=0;
let context, drums, timer, lastAudition=0;
let isPlaying=false, transportVersion=0, position=0, songBank=0, clock=0, heard=[];
const grid=el('grid'), pads=[], cells=[], counts=[];
const contextClass=window.AudioContext || window.webkitAudioContext;
if (location.hash==='#kindle') el('hub').href='https://shadowofthewasp.github.io/parasite-store/';
const status=text=>{el('status').textContent=text;};

function button(text, css) {
  const ui=document.createElement('button');
  ui.type='button';
  ui.className=css;
  ui.textContent=text;
  return ui;
}
grid.append(document.createElement('div'));
for (let step=0;step<16;step++) {
  const count=document.createElement('div');
  count.className='count';
  count.textContent=step+1;
  grid.append(count);
  counts.push(count);
}
for (const [index, lane] of [...lanes,['AC','Accent']].entries()) {
  const pad=button(lane[1],'pad');
  pad.addEventListener('click',async()=>{
    if (index===11) {el('accent').focus();return;}
    selected=index;
    updateControls();
    try {
      await audioReady();
      lastAudition=Date.now();
      drums.hit(index,context.currentTime+.012,state.voices[index]);
    } catch {status('Audio could not start. Try tapping Play.');}
  });
  grid.append(pad);
  pads.push(pad);
  cells[index]=[];
  for (let step=0;step<16;step++) {
    const cell=button('','step'+(step%4===0?' beat':'')+(index===11?' accent':''));
    cell.setAttribute('aria-label',lane[1]+' step '+(step+1));
    cell.addEventListener('click',()=>{
      state.patterns[state.bank][index]^=1<<step;
      cell.setAttribute('aria-pressed',Boolean(state.patterns[state.bank][index]&(1<<step)));
      save();
    });
    cells[index].push(cell);
    grid.append(cell);
  }
}
function updateGrid() {
  for (let index=0;index<cells.length;index++) {
    cells[index].forEach((cell,step)=>cell.setAttribute('aria-pressed',Boolean(state.patterns[state.bank][index]&(1<<step))));
  }
  el('bank-a').setAttribute('aria-pressed',state.bank===0);
  el('bank-b').setAttribute('aria-pressed',state.bank===1);
  el('chain').setAttribute('aria-pressed',state.chain);
}
function updateControls() {
  const voice=state.voices[selected], lane=lanes[selected];
  el('voice-name').textContent=lane[voice.alternate&&lane[2]?2:1];
  for (const [name,[,,unit]] of Object.entries(controls)) {
    const value=Object.prototype.hasOwnProperty.call(state,name)?state[name]:voice[name];
    el(name).value=value;
    el(name+'-out').value=value+unit;
  }
  el('snappy-control').hidden=selected!==1;
  el('alternate-control').hidden=!lane[2];
  if (lane[2]) {
    el('alternate').options.length=0;
    el('alternate').add(new Option(lane[1],'0'));
    el('alternate').add(new Option(lane[2],'1'));
    el('alternate').value=voice.alternate?'1':'0';
  }
  pads.forEach((pad,index)=>{
    pad.classList.toggle('selected',index===selected);
    if(index<lanes.length) pad.textContent=lanes[index][state.voices[index].alternate&&lanes[index][2]?2:1];
  });
}
for (const [name,[min,max,unit]] of Object.entries(controls)) {
  el(name).addEventListener('input',event=>{
    const value=limit(Number(event.target.value),min,max);
    (Object.prototype.hasOwnProperty.call(state,name)?state:state.voices[selected])[name]=value;
    el(name+'-out').value=value+unit;
    if (name==='volume'&&drums) drums.level(value);
    save();
  });
}
el('alternate').addEventListener('change',event=>{state.voices[selected].alternate=event.target.value==='1';updateControls();save();});
['bank-a','bank-b'].forEach((id,index)=>el(id).addEventListener('click',()=>{state.bank=index;updateGrid();save();}));
el('chain').addEventListener('click',()=>{state.chain=!state.chain;updateGrid();save();});
el('clear').addEventListener('click',()=>{state.patterns[state.bank]=blank();updateGrid();save();status('Pattern cleared.');});
el('demo').addEventListener('click',()=>{state.patterns[state.bank]=demoPatterns()[state.bank];updateGrid();save();status('Demo loaded into pattern '+(state.bank?'B.':'A.'));});

async function audioReady() {
  if (!contextClass) throw Error('Web Audio unavailable');
  if (!context) {
    context=new contextClass();
    drums=makeDrums(context,context.destination);
  }
  if (context.state!=='running') await context.resume();
  drums.level(state.volume);
}
function schedule() {
  if (clock<context.currentTime-.07) clock=context.currentTime+.025;
  while (clock<context.currentTime+.095) {
    const pattern=state.patterns[songBank], bit=1<<position;
    const accent=(pattern[11]&bit)?1+state.accent/100:1;
    for (let i=0;i<11;i++) if (pattern[i]&bit) drums.hit(i,clock,state.voices[i],accent);
    heard.push({time:clock,bank:songBank,step:position});
    clock+=stepLength(state.bpm,state.swing,position);
    position=(position+1)%16;
    if (position===0) songBank=state.chain?1-songBank:state.bank;
  }
}
let displayed;
function paint(frame) {
  if (displayed) {
    counts[displayed.step].classList.remove('now');
    cells.forEach(row=>row[displayed.step].classList.remove('now'));
  }
  displayed=frame;
  el('playing').textContent=frame?'Playing '+(frame.bank?'B':'A'):'';
  if (frame&&frame.bank===state.bank) {
    counts[frame.step].classList.add('now');
    cells.forEach(row=>row[frame.step].classList.add('now'));
  }
}
function animation(version) {
  if (!isPlaying || version!==transportVersion) return;
  let next;
  while (heard[0]&&heard[0].time<=context.currentTime) next=heard.shift();
  if (next) paint(next);
  requestAnimationFrame(()=>animation(version));
}
window.stopAfterbeat=function stopAfterbeat() {
  transportVersion++;
  isPlaying=false;
  clearInterval(timer);
  heard=[];
  if (drums) drums.stop();
  paint(null);
  el('transport').textContent='Play';
  el('transport').disabled=false;
  const version=transportVersion;
  setTimeout(()=>{
    if (transportVersion===version && context?.state==='running' && Date.now()-lastAudition>180) context.suspend().catch(()=>{});
  },120);
};
el('transport').addEventListener('click',async()=>{
  if (isPlaying) {window.stopAfterbeat();return;}
  const version=++transportVersion;
  el('transport').disabled=true;
  try {
    await audioReady();
    if (version!==transportVersion) return;
    isPlaying=true;
    position=0;
    songBank=state.chain?0:state.bank;
    clock=context.currentTime+.035;
    el('transport').textContent='Stop';
    timer=setInterval(schedule,24);
    schedule();
    requestAnimationFrame(()=>animation(version));
  } catch {status('Audio did not start. Tap Play again.');}
  finally {el('transport').disabled=false;}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden) window.stopAfterbeat();});
updateGrid();
updateControls();
