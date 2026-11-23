'use strict';
/* Parasite original Web Audio engine. H910 / RE201 are hardware-inspired, not circuit replicas. */
(()=>{
const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number(n)||0));
class Voice {
 constructor(channel,frequency,settings={}){
  const c=channel.engine.ctx,now=c.currentTime;this.ch=channel;this.stopped=false;this.nodes=[];this.oscs=[];
  this.releaseTime=clamp(settings.release??1.1,.08,7);
  const envelope=c.createGain();this.env=envelope;envelope.gain.setValueAtTime(.0001,now);
  envelope.gain.exponentialRampToValueAtTime(clamp(settings.level??.15,.001,.5),now+clamp(settings.attack??.025,.005,2));
  const filter=c.createBiquadFilter();filter.type='lowpass';filter.frequency.value=clamp(settings.tone??3800,200,11000);
  envelope.connect(filter);filter.connect(channel.input);this.nodes.push(envelope,filter);
  const kind=settings.type||'synth',count=(kind==='strings'||kind==='choir')?3:kind==='sitar'?4:1;
  const offsets=kind==='strings'?[-8,0,7]:kind==='choir'?[-6,0,6]:kind==='sitar'?[-7,0,7,1200]:[0];
  const wave=kind==='choir'?'sawtooth':kind==='flute'?'sine':kind==='sitar'?'sawtooth':settings.wave||'triangle';
  for(let i=0;i<count;i++){
   const osc=c.createOscillator(),gain=c.createGain();osc.type=kind==='strings'?(i===0?'sawtooth':'triangle'):wave;
   const oct=kind==='sitar'&&i===3?clamp(settings.octave??.48,0,1):1;
   gain.gain.value=kind==='sitar'?(i===3?.22*oct:.22):(count===1?1:.32);
   osc.frequency.setValueAtTime(frequency*Math.pow(2,offsets[i]/1200),now);
   osc.connect(gain);gain.connect(envelope);osc.start(now);
   this.oscs.push({osc,gain,ratio:Math.pow(2,offsets[i]/1200)});this.nodes.push(gain,osc);
  }
  if(kind==='sitar'){
   filter.type='lowpass';filter.frequency.value=5200;
   const buzz=c.createBiquadFilter();buzz.type='peaking';buzz.frequency.value=Math.min(5000,frequency*3.4);buzz.Q.value=8;buzz.gain.value=12;envelope.disconnect();envelope.connect(buzz);buzz.connect(filter);this.nodes.push(buzz);
   const flange=c.createDelay(.025),fg=c.createGain(),lfo=c.createOscillator(),depth=c.createGain();
   flange.delayTime.value=.003;fg.gain.value=clamp(settings.flanger??.45,0,1)*.42;lfo.frequency.value=.38;depth.gain.value=clamp(settings.flanger??.45,0,1)*.0027;
   filter.connect(flange);flange.connect(fg).connect(channel.input);lfo.connect(depth).connect(flange.delayTime);lfo.start();this.oscs.push({osc:lfo,mod:true});this.nodes.push(flange,fg,depth);
   this.releaseTime=Math.min(this.releaseTime,.85);
  }
  channel.voices.add(this);
 }
 setFrequency(freq,glide=0){
  if(this.stopped)return;const now=this.ch.engine.ctx.currentTime;
  for(const o of this.oscs){if(o.mod)continue;const param=o.osc.frequency,target=Math.max(20,freq*o.ratio);
   param.cancelScheduledValues(now);if(glide>0)param.setTargetAtTime(target,now,Math.max(.005,glide/4));else param.setValueAtTime(target,now)}
 }
 stop(immediate=false){
  if(this.stopped)return;this.stopped=true;
  const now=this.ch.engine.ctx.currentTime,d=immediate?.025:this.releaseTime;
  this.env.gain.cancelScheduledValues(now);this.env.gain.setTargetAtTime(.0001,now,Math.max(.01,d/5));
  for(const o of this.oscs){try{o.osc.stop(now+d+.12)}catch(e){}}
  this.ch.voices.delete(this);
  setTimeout(()=>{for(const n of this.nodes){try{n.disconnect()}catch(e){}}},(d+.3)*1000);
 }
}
class Channel {
 constructor(engine,id){
  this.engine=engine;this.id=id;this.voices=new Set();this.bufferSources=new Set();this.volume=.75;this.mute=false;this.solo=false;
  const c=engine.ctx;this.input=c.createGain();this.fader=c.createGain();this.fader.gain.value=.75;this.fader.connect(engine.master);
  const gain=(v)=>{let n=c.createGain();n.gain.value=v;return n};
  this.hDry=gain(1),this.hWet=gain(.25),this.hMerge=c.createChannelMerger(2),this.hOut=gain(1);
  this.input.connect(this.hDry).connect(this.hOut);this.hWet.connect(this.hOut);
  const createHalf=(seconds)=>{const d=c.createDelay(.5),g=gain(.5);d.delayTime.value=seconds;this.input.connect(d);d.connect(g);return{d,g}};
  this.hL=createHalf(.03);this.hR=createHalf(.036);this.hL.g.connect(this.hMerge,0,0);this.hR.g.connect(this.hMerge,0,1);this.hMerge.connect(this.hWet);
  this.hFeedback=gain(.18);this.hL.d.connect(this.hFeedback);this.hFeedback.connect(this.hR.d);
  this.hMods=[];
  for(const [i,head] of [this.hL,this.hR].entries()){
   let l=c.createOscillator(),m=gain(.001),index=i;l.frequency.value=1.4+index*.2;l.connect(m).connect(head.d.delayTime);l.start();this.hMods.push([l,m]);
  }
  this.reDry=gain(1);this.hOut.connect(this.reDry).connect(this.fader);
  this.reFeedback=gain(.3),this.reLP=c.createBiquadFilter(),this.reHead=[],this.reMode=5;this.reLP.type='lowpass';this.reLP.frequency.value=3200;
  this.reFeedback.connect(this.reLP);
  for(const mul of [1,1.51,2.06]){
   const delay=c.createDelay(2),out=gain(.07);delay.delayTime.value=.3*mul;
   this.hOut.connect(delay);this.reLP.connect(delay);delay.connect(out).connect(this.fader);
   this.reHead.push({delay,out,mul});
  }
  this.reHead[0].delay.connect(this.reFeedback);
  this.reSpring=gain(.1);this.reConv=c.createConvolver();this.reConv.buffer=engine.impulse;
  this.hOut.connect(this.reConv).connect(this.reSpring).connect(this.fader);
  this.h={enabled:true,pitchL:.99,pitchR:1.01,delay:30,feedback:.22,mix:.28};
  this.re={enabled:true,mode:5,rate:.32,intensity:.32,echo:.32,spring:.17,bass:5,treble:4.5};
  this.setFx();
 }
 setFx(){
  const t=this.engine.ctx.currentTime,s=(param,v)=>param.setTargetAtTime(v,t,.03);
  const h=this.h,r=this.re;
  s(this.hDry.gain,h.enabled?1-h.mix:1);s(this.hWet.gain,h.enabled?h.mix:0);
  s(this.hL.d.delayTime,clamp(h.delay/1000,.005,.11));s(this.hR.d.delayTime,clamp((h.delay+6)/1000,.005,.12));s(this.hFeedback.gain,clamp(h.feedback,0,.62));
  this.hMods.forEach(([l,m],i)=>{const ratio=i?h.pitchR:h.pitchL;l.frequency.setTargetAtTime(.3+Math.abs(ratio-1)*18,t,.05);m.gain.setTargetAtTime(.0002+Math.abs(ratio-1)*.04,t,.05)});
  s(this.reFeedback.gain,r.enabled?clamp(r.intensity,0,.7):0);
  const heads={1:[1,0,0],2:[0,1,0],3:[0,0,1],4:[1,1,0],5:[0,1,1],6:[1,0,1],7:[1,1,1],8:[1,0,0],9:[0,1,0],10:[0,0,1],11:[1,1,1],12:[0,0,0]}[r.mode]||[0,1,1];
  const n=Math.max(1,heads.reduce((a,b)=>a+b,0));
  this.reHead.forEach((head,i)=>{s(head.delay.delayTime,clamp(r.rate,.09,.75)*head.mul);s(head.out.gain,r.enabled?heads[i]*r.echo/n:0)});
  s(this.reSpring.gain,r.enabled&&r.mode>=8?r.spring:0);
  this.reLP.frequency.setTargetAtTime(400+clamp(r.treble,0,10)*750,t,.04);
  this.reLP.Q.setTargetAtTime(.7+clamp(r.bass,0,10)*.15,t,.04);
 }
 stop(){for(const v of [...this.voices])v.stop(true);for(const s of [...this.bufferSources]){try{s.stop()}catch(e){}}this.bufferSources.clear()}
 dispose(){this.stop();for(const [l] of this.hMods){try{l.stop()}catch(e){}}for(const n of [this.input,this.fader,this.hDry,this.hWet,this.hMerge,this.hOut,this.hFeedback,this.hL.d,this.hL.g,this.hR.d,this.hR.g,this.reDry,this.reFeedback,this.reLP,this.reSpring,this.reConv,...this.reHead.flatMap(x=>[x.delay,x.out]),...this.hMods.map(x=>x[1])])try{n.disconnect()}catch(e){}}
}
class ParasiteAudio {
 constructor(){this.ctx=null;this.master=null;this.channels=new Map();this.sample=null;this.lastFreq=new Map();}
 async init(){if(!this.ctx){
  const A=window.AudioContext||window.webkitAudioContext;if(!A)throw Error('Web Audio not supported');
  this.ctx=new A({latencyHint:'interactive'});this.impulse=this.makeImpulse();this.master=this.ctx.createGain();this.master.gain.value=.72;
  const limiter=this.ctx.createDynamicsCompressor();limiter.threshold.value=-8;limiter.knee.value=12;limiter.ratio.value=8;limiter.attack.value=.003;limiter.release.value=.16;this.master.connect(limiter).connect(this.ctx.destination);
 }if(this.ctx.state!=='running')await this.ctx.resume();return this.ctx}
 makeImpulse(){const c=this.ctx,b=c.createBuffer(2,Math.floor(c.sampleRate*.8),c.sampleRate);let seed=11;for(let ch=0;ch<2;ch++){let a=b.getChannelData(ch);for(let i=0;i<a.length;i++){seed=(1664525*seed+1013904223)>>>0;a[i]=((seed/2147483648)-1)*Math.pow(1-i/a.length,2.8)*.25}}return b}
 async add(id){await this.init();if(!this.channels.has(id))this.channels.set(id,new Channel(this,id));this.updateFaders();return this.channels.get(id)}
 get(id){return this.channels.get(id)}
 remove(id){const c=this.channels.get(id);if(c){c.dispose();this.channels.delete(id)}this.updateFaders()}
 updateFaders(){if(!this.ctx)return;const solo=[...this.channels.values()].some(c=>c.solo);for(const c of this.channels.values())c.fader.gain.setTargetAtTime(c.mute||(solo&&!c.solo)?0:c.volume,this.ctx.currentTime,.025)}
 masterLevel(v){if(this.master)this.master.gain.setTargetAtTime(clamp(v,0,1),this.ctx.currentTime,.02)}
 stopAll(){for(const c of this.channels.values())c.stop()}
 async note(id,freq,settings={}){
  const ch=await this.add(id),kind=settings.type;
  if(kind==='user'&&this.sample)return this.playBuffer(ch,freq,settings);
  return new Voice(ch,freq,settings)
 }
 playBuffer(ch,freq,settings={}){
  const c=this.ctx,s=c.createBufferSource(),g=c.createGain(),sample=this.sample;
  s.buffer=sample;s.playbackRate.value=freq/261.6256;const start=Math.min(sample.duration-.01,sample.duration*clamp(settings.start??0,0,.95));
  const duration=Math.max(.01,Math.min(sample.duration-start,sample.duration*clamp(settings.length??.5,.05,1)));
  g.gain.value=clamp(settings.level??.25,.001,.7);s.connect(g).connect(ch.input);ch.bufferSources.add(s);
  const v={stop:()=>{try{s.stop()}catch(e){}ch.bufferSources.delete(s)}};
  s.onended=()=>{ch.bufferSources.delete(s);s.disconnect();g.disconnect()};
  s.start(0,start,duration);return v;
 }
 async decode(buffer){await this.init();const b=await this.ctx.decodeAudioData(buffer);if(b.duration>30)throw Error('Choose an audio file of 30 seconds or less.');this.sample=b;return b.duration}
}
window.parasiteEngine=new ParasiteAudio();
})();
