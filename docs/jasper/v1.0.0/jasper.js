'use strict';

const TAU=2*Math.PI;
const scaleNotes=[0,2,4,7,9,12,14,16,19,21];
const names=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
function pointAt(phase,width,height){
  const angle=TAU*phase;
  return {x:width*(.50+.37*Math.sin(angle)),y:height*(.50-.33*Math.cos(angle))};
}
function closestPhase(x,y,width,height){
  let best=0,distance=Infinity;
  for(let i=0;i<720;i++){
    const phase=i/720, point=pointAt(phase,width,height);
    const squared=(point.x-x)**2+(point.y-y)**2;
    if(squared<distance){distance=squared;best=phase;}
  }
  return {phase:best,distance:Math.sqrt(distance)};
}
function crossings(start,end,triggers){
  const result=[];
  for(const trigger of triggers){
    for(let lap=Math.floor(start-trigger.position)+1;lap+trigger.position<=end+1e-10;lap++){
      const at=lap+trigger.position;
      if(at>start+1e-10)result.push({at,trigger});
    }
  }
  return result.sort((a,b)=>a.at-b.at);
}
function createJasper(context,destination){
  const master=context.createGain(), bus=context.createGain();
  const delay=context.createDelay(1), feedback=context.createGain(), wet=context.createGain();
  const low=context.createBiquadFilter(), limiter=context.createDynamicsCompressor();
  const active=new Set();
  low.frequency.value=2900;low.type='lowpass';
  delay.delayTime.value=.32;
  limiter.threshold.value=-14;limiter.ratio.value=9;
  bus.connect(limiter);bus.connect(delay).connect(low).connect(wet).connect(limiter);
  low.connect(feedback).connect(delay);
  limiter.connect(master).connect(destination);
  master.gain.value=0;
  function settings(volume,echo,on){
    master.gain.setTargetAtTime(on?volume*.0075:0,context.currentTime,.02);
    wet.gain.setTargetAtTime(echo*.009,context.currentTime,.025);
    feedback.gain.setTargetAtTime(echo*.008,context.currentTime,.025);
  }
  function ping(trigger,transpose,time){
    if(!trigger.level)return;
    const oscillator=context.createOscillator(),gain=context.createGain(),pan=context.createStereoPanner();
    oscillator.type=trigger.wave;
    oscillator.frequency.value=440*2**((60+scaleNotes[trigger.note]+transpose-69)/12);
    const length=trigger.decay/100;
    gain.gain.setValueAtTime(.00001,time);
    gain.gain.linearRampToValueAtTime(trigger.level*.0018,time+.009);
    gain.gain.exponentialRampToValueAtTime(.00001,time+length+.01);
    pan.pan.value=Math.sin(TAU*trigger.position)*.65;
    oscillator.connect(gain).connect(pan).connect(bus);
    oscillator.start(time);oscillator.stop(time+length+.03);
    active.add(oscillator);
    oscillator.onended=()=>{active.delete(oscillator);pan.disconnect();};
  }
  return {settings,ping,stop(){for(const oscillator of active)oscillator.stop(context.currentTime+.018);}};
}
if(typeof module==='object'&&module.exports)module.exports={pointAt,closestPhase,crossings,createJasper};

if(typeof document!=='undefined'){
  const get=id=>document.getElementById(id);
  const canvas=get('track'), ctx=canvas.getContext('2d'), markerRoot=get('markers');
  const triggers=[.10,.29,.53,.77].map((position,index)=>({id:index+1,position,note:index*2,wave:'sine',decay:48,level:72}));
  let selected=1,nextId=5,width=600,height=300,audio,engine,playing=false,version=0,timer;
  let originTime=0,originPhase=0,scheduled=0,visualPhase=0,flashes=[];
  const buttons=new Map();
  const Audio=window.AudioContext||window.webkitAudioContext;
  const controls=['speed','echo','volume','scale'];
  const read=id=>Number(get(id).value);
  if(location.hash==='#kindle')get('hub').href='https://shadowofthewasp.github.io/parasite-store/';
  function phaseNow(time){return originPhase+(time-originTime)/read('speed');}
  function layout(){
    const rect=canvas.getBoundingClientRect();width=rect.width;height=rect.height;
    const ratio=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    ctx.setTransform(ratio,0,0,ratio,0,0);
    positions();
  }
  function positions(){
    for(const trigger of triggers){
      const point=pointAt(trigger.position,width,height),button=buttons.get(trigger.id);
      if(button){button.style.left=point.x+'px';button.style.top=point.y+'px';}
    }
  }
  function details(){
    const trigger=triggers.find(t=>t.id===selected);
    get('trigger-title').textContent=trigger?'Trigger '+trigger.id:'Add a trigger to make music';
    for(const id of ['note','wave','decay','level','remove'])get(id).disabled=!trigger;
    for(const [id,button] of buttons)button.classList.toggle('selected',id===selected);
    if(!trigger)return;
    for(const key of ['note','wave','decay','level'])get(key).value=trigger[key];
    get('decay-out').value=(trigger.decay/100).toFixed(2)+' s';
    get('level-out').value=trigger.level+'%';
  }
  function notes(){
    get('note').textContent='';
    scaleNotes.forEach((offset,index)=>{
      const note=60+offset+read('scale'),option=document.createElement('option');
      option.value=index;option.textContent=names[note%12]+(Math.floor(note/12)-1);
      get('note').append(option);
    });
  }
  function sync(){
    get('speed-out').value=read('speed')+' s';
    get('echo-out').value=read('echo')+'%';
    get('volume-out').value=read('volume')+'%';
    if(engine)engine.settings(read('volume'),read('echo'),playing);
  }
  function add(position){
    if(triggers.length>=16){get('status').textContent='Sixteen triggers are on the track. Select one to edit or remove it.';return;}
    const trigger={id:nextId++,position,note:triggers.length%scaleNotes.length,wave:'sine',decay:48,level:72};
    triggers.push(trigger);selected=trigger.id;mount(trigger);details();positions();
  }
  function mount(trigger){
    const button=document.createElement('button');button.type='button';
    button.textContent=trigger.id;button.setAttribute('aria-label','Trigger '+trigger.id);
    markerRoot.append(button);buttons.set(trigger.id,button);
    let drag=null;
    button.addEventListener('pointerdown',event=>{
      selected=trigger.id;details();button.setPointerCapture(event.pointerId);
      drag={x:event.clientX,y:event.clientY,moved:false};
    });
    button.addEventListener('pointermove',event=>{
      if(!drag||!button.hasPointerCapture(event.pointerId))return;
      if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>4)drag.moved=true;
      if(!drag.moved)return;
      const rect=canvas.getBoundingClientRect();
      trigger.position=closestPhase(event.clientX-rect.left,event.clientY-rect.top,width,height).phase;
      positions();
    });
    button.addEventListener('pointerup',()=>{drag=null;});
    button.addEventListener('pointercancel',()=>{drag=null;});
    button.addEventListener('click',()=>{selected=trigger.id;details();});
    button.addEventListener('keydown',event=>{
      if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
        event.preventDefault();trigger.position=(trigger.position+(event.key==='ArrowLeft'?-.01:.01)+1)%1;positions();
      }
    });
  }
  function schedule(){
    const now=audio.currentTime;
    if(scheduled<now-.12)scheduled=now;
    const until=now+.085,start=phaseNow(scheduled),end=phaseNow(until);
    for(const event of crossings(start,end,triggers)){
      const time=originTime+(event.at-originPhase)*read('speed');
      engine.ping(event.trigger,read('scale'),Math.max(now,time));
      flashes.push({time,id:event.trigger.id});
    }
    scheduled=until;
  }
  window.stopJasper=function stopJasper(){
    version++;
    if(playing&&audio)visualPhase=phaseNow(audio.currentTime)%1;
    playing=false;clearInterval(timer);flashes=[];
    if(engine){engine.settings(read('volume'),read('echo'),false);engine.stop();}
    get('play').textContent='Roll marble';get('play').disabled=false;
    const current=version;
    setTimeout(()=>{if(current===version&&audio?.state==='running')audio.suspend().catch(()=>{});},140);
  };
  get('play').addEventListener('click',async()=>{
    if(playing){window.stopJasper();return;}
    const current=++version;get('play').disabled=true;
    try{
      if(!Audio)throw Error();
      if(!audio){audio=new Audio();engine=createJasper(audio,audio.destination);}
      await audio.resume();if(version!==current)return;
      playing=true;originTime=audio.currentTime+.025;originPhase=visualPhase;scheduled=audio.currentTime;
      sync();schedule();timer=setInterval(schedule,24);
      get('play').textContent='Pause';
    }catch{get('status').textContent='Audio could not start. Tap Roll marble to try again.';}
    finally{get('play').disabled=false;}
  });
  canvas.addEventListener('click',event=>{
    const rect=canvas.getBoundingClientRect(),near=closestPhase(event.clientX-rect.left,event.clientY-rect.top,width,height);
    if(near.distance<45)add(near.phase);
  });
  get('add').addEventListener('click',()=>{
    const sorted=triggers.map(t=>t.position).sort((a,b)=>a-b);
    let position=.12,gap=0;
    sorted.forEach((p,index)=>{const end=index===sorted.length-1?sorted[0]+1:sorted[index+1];if(end-p>gap){gap=end-p;position=(p+gap/2)%1;}});
    add(position);
  });
  get('remove').addEventListener('click',()=>{
    const index=triggers.findIndex(t=>t.id===selected);if(index<0)return;
    buttons.get(selected).remove();buttons.delete(selected);triggers.splice(index,1);
    selected=triggers[0]?.id;details();
  });
  for(const key of ['note','wave','decay','level'])get(key).addEventListener('input',()=>{
    const trigger=triggers.find(t=>t.id===selected);if(!trigger)return;
    trigger[key]=key==='wave'?get(key).value:read(key);details();
  });
  let previousSpeed=read('speed');
  controls.forEach(key=>get(key).addEventListener('input',()=>{
    if(key==='speed'&&playing){
      const now=audio.currentTime;
      originPhase+=(now-originTime)/previousSpeed;originTime=now;
    }
    previousSpeed=read('speed');
    if(key==='scale'){notes();details();}
    sync();
  }));
  document.addEventListener('visibilitychange',()=>{if(document.hidden)window.stopJasper();});
  function draw(){
    ctx.clearRect(0,0,width,height);
    ctx.beginPath();
    for(let i=0;i<=240;i++){const p=pointAt(i/240,width,height);if(i===0)ctx.moveTo(p.x,p.y);else ctx.lineTo(p.x,p.y);}
    ctx.closePath();ctx.lineWidth=25;ctx.strokeStyle='#08122c';ctx.stroke();
    ctx.lineWidth=19;ctx.strokeStyle='#2478e7';ctx.stroke();
    ctx.lineWidth=3;ctx.strokeStyle='#72b6ff';ctx.stroke();
    if(playing){
      visualPhase=((phaseNow(audio.currentTime)%1)+1)%1;
      while(flashes[0]&&flashes[0].time<=audio.currentTime){
        const button=buttons.get(flashes.shift().id);
        if(button){button.classList.add('flash');setTimeout(()=>button.classList.remove('flash'),145);}
      }
    }
    const marble=pointAt(visualPhase,width,height);
    const gradient=ctx.createRadialGradient(marble.x-4,marble.y-5,1,marble.x,marble.y,13);
    gradient.addColorStop(0,'#fff9bd');gradient.addColorStop(.4,'#ffdc49');gradient.addColorStop(1,'#ed8d24');
    ctx.beginPath();ctx.arc(marble.x,marble.y,12,0,TAU);ctx.fillStyle=gradient;ctx.fill();
    ctx.strokeStyle='#fff4ab';ctx.lineWidth=1.5;ctx.stroke();
    requestAnimationFrame(draw);
  }
  notes();triggers.forEach(mount);details();sync();layout();draw();
  window.addEventListener('resize',layout);
}
