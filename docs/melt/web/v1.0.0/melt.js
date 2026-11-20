'use strict';

const laneDefaults = () => Array.from({length:4},(_,index)=>({wall:48+index*12,size:35+index*12,level:82}));
const effectDefaults = {feedback:55,echo:62,choir:78,flutter:50,tone:28,volume:63};
const travel = wall => .15 + wall / 100 * 2.2;

function createMelt(context, destination, settings) {
  const panInput = context.createGain();
  const wet = context.createGain();
  const dry = context.createGain();
  const master = context.createGain();
  const limiting = context.createDynamicsCompressor();
  const splitter = context.createChannelSplitter(2);
  const merger = context.createChannelMerger(2);
  const delays = [context.createDelay(1),context.createDelay(1)];
  const loops = [context.createGain(),context.createGain()];
  const filters = [context.createBiquadFilter(),context.createBiquadFilter()];
  const wobble = context.createOscillator();
  const wobbleDepth = context.createGain();
  const active = new Set();
  const voiceWave = context.createPeriodicWave(new Float32Array(5),new Float32Array([0,1,.46,.28,.095]));
  master.gain.value=0;
  limiting.threshold.value=-15;
  limiting.ratio.value=10;
  panInput.connect(dry).connect(limiting);
  panInput.connect(splitter);
  for (let i=0;i<2;i++) {
    delays[i].delayTime.value=.5;
    filters[i].type='lowpass';
    splitter.connect(delays[i],i);
    delays[i].connect(filters[i]).connect(loops[i]).connect(delays[1-i]);
    filters[i].connect(merger,0,i);
    wobbleDepth.connect(delays[i].delayTime);
  }
  wobble.frequency.value=.77;
  wobble.connect(wobbleDepth);
  wobble.start();
  merger.connect(wet).connect(limiting);
  limiting.connect(master).connect(destination);
  const set=(param,value,time=.035)=>param.setTargetAtTime(value,context.currentTime,time);
  function sync(playing) {
    set(wet.gain,settings.echo*.009);
    set(master.gain,playing?settings.volume*.008:0);
    set(wobbleDepth.gain,settings.flutter*.000065);
    loops.forEach(loop=>set(loop.gain,settings.feedback*.0091));
    filters.forEach(filter=>set(filter.frequency,600+settings.tone*48));
  }
  function ping(index,lane,when) {
    if (!lane.level) return;
    const frequency=(110 + index * 36) * (1.35 - .55 * lane.size / 100);
    const amp=context.createGain();
    const panner=context.createStereoPanner();
    const filter=context.createBiquadFilter();
    filter.type='lowpass';
    filter.frequency.value=710+settings.tone*48;
    panner.pan.value=[-.54,.43,-.3,.52][index];
    const gain=.22*lane.level/100*settings.choir/100;
    if (!gain) return;
    const length=.26+lane.size*.004;
    amp.gain.setValueAtTime(.00001,when);
    amp.gain.linearRampToValueAtTime(gain,when+.017);
    amp.gain.exponentialRampToValueAtTime(.00001,when+length);
    filter.connect(amp).connect(panner).connect(panInput);
    let remaining=2;
    for (const ratio of [.996,1.004]) {
      const oscillator=context.createOscillator();
      oscillator.setPeriodicWave(voiceWave);
      oscillator.frequency.value=frequency*ratio;
      oscillator.connect(filter);
      oscillator.start(when);
      oscillator.stop(when+length+.01);
      active.add(oscillator);
      oscillator.onended=()=>{active.delete(oscillator);if(!--remaining)panner.disconnect();};
    }
  }
  return {sync,ping,stop(){for(const oscillator of active)oscillator.stop(context.currentTime+.018);sync(false);}};
}

if(typeof module==='object'&&module.exports)module.exports={createMelt,travel,laneDefaults,effectDefaults};

if(typeof document!=='undefined'){
  const get=id=>document.getElementById(id);
  const lanes=laneDefaults(), settings={...effectDefaults}, tracks=[];
  const Audio=window.AudioContext||window.webkitAudioContext;
  let context,engine,timer,playing=false,version=0,next=[],last=[],directions=[];
  function resetMotion(start) {
    next=lanes.map(()=>start);
    last=lanes.map(()=>start);
    directions=lanes.map(()=>false);
  }
  function schedule() {
    for(let i=0;i<lanes.length;i++){
      if(next[i]<context.currentTime-.10)next[i]=context.currentTime+.025;
      if(next[i]<context.currentTime+.09){
        engine.ping(i,lanes[i],next[i]);
        last[i]=next[i];
        directions[i]=!directions[i];
        next[i]+=travel(lanes[i].wall);
      }
    }
  }
  function paint(){
    tracks.forEach(({track,ball,wall},i)=>{
      const lane=lanes[i], portion=playing?Math.max(0,Math.min(1,(context.currentTime-last[i])/Math.max(.01,next[i]-last[i]))):0;
      wall.style.left=lane.wall+'%';
      ball.style.left=(playing&&!directions[i]?1-portion:portion)*lane.wall+'%';
      track.style.setProperty('--size',(8+lane.size*.13)+'px');
    });
    requestAnimationFrame(paint);
  }
  function slider(root,name,value,min,max,onChange,showValue){
    const label=document.createElement('label');
    label.textContent=name;
    const out=document.createElement('output');
    if(showValue){out.value=value;label.append(out);}
    const input=document.createElement('input');
    Object.assign(input,{type:'range',min,max,value});
    input.addEventListener('input',()=>{const number=Number(input.value);out.value=number;onChange(number);});
    label.append(input);root.append(label);
    return input;
  }
  lanes.forEach((voice,index)=>{
    const row=document.createElement('section');
    row.className='lane';
    row.innerHTML='<span>0'+(index+1)+'</span><div class="track" aria-hidden="true"><i class="wall"></i><i class="ball"></i></div><div class="lane-controls"></div>';
    const track=row.querySelector('.track');
    const controls=row.querySelector('.lane-controls');
    tracks.push({track,ball:track.querySelector('.ball'),wall:track.querySelector('.wall')});
    const wall=slider(controls,'Wall',voice.wall,15,100,value=>voice.wall=value);
    slider(controls,'Ball',voice.size,0,100,value=>voice.size=value);
    slider(controls,'Level',voice.level,0,100,value=>voice.level=value);
    const move=event=>{
      const area=track.getBoundingClientRect();
      wall.value=Math.round(100*(event.clientX-area.left)/area.width);
      voice.wall=Number(wall.value);
    };
    track.addEventListener('pointerdown',event=>{track.setPointerCapture(event.pointerId);move(event);});
    track.addEventListener('pointermove',event=>{if(track.hasPointerCapture(event.pointerId))move(event);});
    get('lanes').append(row);
  });
  Object.entries({feedback:'Feedback',echo:'Echo',choir:'Choir',flutter:'Flutter',tone:'Tone',volume:'Volume'}).forEach(([key,name])=>{
    slider(get('effects'),name,settings[key],0,key==='feedback'?96:100,value=>{settings[key]=value;if(engine)engine.sync(playing);},true);
  });
  function stop(){
    version++;
    playing=false;
    clearInterval(timer);
    if(engine)engine.stop();
    get('play').textContent='Dive in';
    get('status').textContent='Tap Dive in to start.';
  }
  get('play').addEventListener('click',async()=>{
    if(playing){stop();return;}
    const current=++version;
    get('play').disabled=true;
    try{
      if(!Audio)throw Error();
      if(!context){context=new Audio();engine=createMelt(context,context.destination,settings);}
      await context.resume();
      if(current!==version)return;
      playing=true;
      engine.sync(true);
      resetMotion(context.currentTime+.03);
      schedule();
      timer=setInterval(schedule,25);
      get('play').textContent='Freeze';
      get('status').textContent='Playing. Drag a wall or change a ball’s size.';
    }catch{get('status').textContent='Audio could not start. Try tapping Dive in again.';}
    finally{get('play').disabled=false;}
  });
  get('reset').addEventListener('click',()=>{if(playing){engine.stop();engine.sync(true);resetMotion(context.currentTime+.04);}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  paint();
}
