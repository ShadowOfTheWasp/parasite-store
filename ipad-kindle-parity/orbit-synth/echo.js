'use strict';
/* Analogue-inspired stereo H910 -> RE201 signal graph. Original DSP, not a circuit-identical clone. */
(()=>{
const clamp=(x,a,b)=>Math.min(b,Math.max(a,Number(x)||0));
const makeGain=(c,v=1)=>{const g=c.createGain();g.gain.value=v;return g};
function softClipCurve(amount=2.5){const n=8192,a=new Float32Array(n);for(let i=0;i<n;i++){const x=2*i/(n-1)-1;a[i]=Math.tanh(x*amount)/Math.tanh(amount)}return a}
function springImpulse(c){
 const length=Math.round(c.sampleRate*1.6),b=c.createBuffer(2,length,c.sampleRate);let seed=10501;
 for(let channel=0;channel<2;channel++){const a=b.getChannelData(channel);let lp=0;for(let i=0;i<length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const white=(seed/2147483648-1);lp=lp*.74+white*.26;const t=i/c.sampleRate;const early=Math.sin(t*2100)*.17+Math.sin(t*1367)*.11;const spring=Math.exp(-t*3.5)*(lp*.45+early*.12);a[i]=spring*(i<150?i/150:1)}}
 return b
}
const headModes={
 1:{h:[1,0,0],spring:false},2:{h:[0,1,0],spring:false},3:{h:[0,0,1],spring:false},4:{h:[1,1,0],spring:false},
 5:{h:[0,1,0],spring:true},6:{h:[0,0,1],spring:true},7:{h:[1,0,0],spring:true},8:{h:[1,1,0],spring:true},9:{h:[0,1,1],spring:true},10:{h:[1,0,1],spring:true},11:{h:[1,1,1],spring:true},12:{h:[0,0,0],spring:true}
};
class OrbitEffects {
 constructor(c,destination){
  this.c=c;this.settings={hEnable:true,hLeft:-11,hRight:14,hTime:42,hFeedback:.17,hMix:.23,echoOn:true,echoMode:8,echoRate:.26,echoIntensity:.39,echoLevel:.38,reverbLevel:.25,bass:5,treble:5,wear:.38,flutter:.44,saturation:.4};
  this.input=c.createGain();this.postH=c.createGain();
  this.hDry=makeGain(c,.77);this.input.connect(this.hDry).connect(this.postH);
  this.hWet=makeGain(c,.23);this.hWet.connect(this.postH);
  this.hMerger=c.createChannelMerger(2);
  this.hDelays=[];
  for(let i=0;i<2;i++){
   const delay=c.createDelay(.3),gain=makeGain(c,.5);delay.delayTime.value=.042+i*.006;this.input.connect(delay);delay.connect(gain);gain.connect(this.hMerger,0,i);
   const lfo=c.createOscillator(),mod=makeGain(c,.0009);lfo.type='triangle';lfo.frequency.value=i===0?2.73:3.14;lfo.connect(mod).connect(delay.delayTime);lfo.start();
   this.hDelays.push({delay,gain,lfo,mod});
  }
  this.hMerger.connect(this.hWet);
  this.hFeedback=makeGain(c,.15);this.hDelays[0].delay.connect(this.hFeedback).connect(this.hDelays[1].delay);
  this.dry=makeGain(c,.82);this.postH.connect(this.dry).connect(destination);
  // Tape path. A shared tape input is fed from signal plus repeats, then each head.
  this.tapeIn=c.createGain();this.postH.connect(this.tapeIn);
  this.preHP=c.createBiquadFilter();this.preHP.type='highpass';this.preHP.frequency.value=100;
  this.preLP=c.createBiquadFilter();this.preLP.type='lowpass';this.preLP.frequency.value=5500;
  this.tapeDrive=c.createWaveShaper();this.tapeDrive.curve=softClipCurve(2);this.tapeDrive.oversample='2x';
  this.tapeIn.connect(this.preHP).connect(this.preLP).connect(this.tapeDrive);
  this.heads=[];
  this.echoSum=makeGain(c,1);
  for(let i=0;i<3;i++){
   const d=c.createDelay(2.5),g=makeGain(c,.1),base=.26*(i+1);
   d.delayTime.value=base;this.tapeDrive.connect(d);d.connect(g).connect(this.echoSum);
   const wow=c.createOscillator(),flutter=c.createOscillator(),wm=makeGain(c,0),fm=makeGain(c,0);
   wow.frequency.value=.28+i*.02;flutter.frequency.value=4.7+i*.31;
   wow.connect(wm).connect(d.delayTime);flutter.connect(fm).connect(d.delayTime);
   wow.start();flutter.start();
   this.heads.push({d,g,wow,flutter,wm,fm,i});
  }
  this.toneBass=c.createBiquadFilter();this.toneBass.type='lowshelf';this.toneBass.frequency.value=300;
  this.toneTreble=c.createBiquadFilter();this.toneTreble.type='highshelf';this.toneTreble.frequency.value=2500;
  this.echoSum.connect(this.toneBass).connect(this.toneTreble);
  this.echoOut=makeGain(c,.38);this.toneTreble.connect(this.echoOut).connect(destination);
  this.feedbackLP=c.createBiquadFilter();this.feedbackLP.type='lowpass';this.feedbackLP.frequency.value=2600;
  this.feedbackHP=c.createBiquadFilter();this.feedbackHP.type='highpass';this.feedbackHP.frequency.value=180;
  this.feedback=makeGain(c,.33);
  this.toneTreble.connect(this.feedbackLP).connect(this.feedbackHP).connect(this.feedback).connect(this.tapeIn);
  this.reverbSend=makeGain(c,.5);this.postH.connect(this.reverbSend);
  this.reverb=c.createConvolver();this.reverb.buffer=springImpulse(c);this.reverbOut=makeGain(c,.17);
  this.reverbSend.connect(this.reverb).connect(this.reverbOut).connect(destination);
  this.setAll(this.settings);
 }
 setAll(values){
  Object.assign(this.settings,values);const s=this.settings,t=this.c.currentTime;
  const smooth=(p,v)=>p.setTargetAtTime(v,t,.025);
  smooth(this.hDry.gain,s.hEnable?1-clamp(s.hMix,0,1):1);
  smooth(this.hWet.gain,s.hEnable?clamp(s.hMix,0,1):0);
  this.hDelays.forEach((h,i)=>{const cents=i?s.hRight:s.hLeft;const wobble=Math.abs(cents)/60;
   smooth(h.delay.delayTime,clamp(s.hTime/1000+(i===1?.007:0),.01,.15));
   smooth(h.mod.gain,.00025+wobble*.0035);smooth(h.lfo.frequency,.5+wobble*8)});
  smooth(this.hFeedback.gain,clamp(s.hFeedback,0,.6));
  const mode=headModes[Math.round(s.echoMode)]||headModes[8];
  const active=mode.h.reduce((a,b)=>a+b,0)||1;
  const enabled=!!s.echoOn;
  this.heads.forEach(h=>{
   smooth(h.d.delayTime,clamp(s.echoRate*(h.i+1),.06,2.3));
   smooth(h.g.gain,enabled?mode.h[h.i]/active:0);
   smooth(h.wm.gain,clamp(s.flutter,0,1)*.0052);
   smooth(h.fm.gain,clamp(s.flutter,0,1)*.0008);
   smooth(h.wow.frequency,.1+clamp(s.wear,0,1)*.32+h.i*.011);
   smooth(h.flutter.frequency,4.2+clamp(s.wear,0,1)*2.4+h.i*.19)
  });
  smooth(this.feedback.gain,enabled?clamp(s.echoIntensity,0,.84):0);
  smooth(this.echoOut.gain,enabled?clamp(s.echoLevel,0,1):0);
  smooth(this.reverbOut.gain,enabled&&mode.spring?clamp(s.reverbLevel,0,.7):0);
  smooth(this.preLP.frequency,7600-6000*clamp(s.wear,0,1));
  smooth(this.feedbackLP.frequency,4100-2800*clamp(s.wear,0,1));
  smooth(this.toneBass.gain,(clamp(s.bass,0,10)-5)*2.3);
  smooth(this.toneTreble.gain,(clamp(s.treble,0,10)-5)*2.3);
  this.tapeDrive.curve=softClipCurve(1+clamp(s.saturation,0,1)*4);
 }
 destroy(){for(const h of this.heads){try{h.wow.stop();h.flutter.stop()}catch(e){}}for(const h of this.hDelays){try{h.lfo.stop()}catch(e){}}}
}
window.OrbitEffects=OrbitEffects;
})();
