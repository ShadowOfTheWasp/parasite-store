process.chdir(require('node:path').resolve(__dirname,'..'));
const assert=require('node:assert/strict'),fs=require('node:fs'),{JSDOM}=require('jsdom');
class Param{constructor(value=0){this.value=value;}setValueAtTime(v){this.value=v;}linearRampToValueAtTime(v){this.value=v;}exponentialRampToValueAtTime(v){this.value=v;}setTargetAtTime(v){this.value=v;}cancelScheduledValues(){}}
class Node{constructor(kind){this.kind=kind;for(const p of ['gain','frequency','Q','pan','playbackRate','delayTime','threshold','knee','ratio','attack','release'])this[p]=new Param();this.connections=[];}connect(x){this.connections.push(x);return x;}disconnect(){this.connections=[];}start(t){this.started=t??0;}stop(t){this.stopped=t??0;}}
class Audio{constructor(){this.sampleRate=8000;this.currentTime=0;this.state='running';this.destination=new Node('destination');this.nodes=[];Audio.all.push(this);}node(type){const n=new Node(type);this.nodes.push(n);return n;}createGain(){return this.node('gain')}createBiquadFilter(){return this.node('filter')}createConvolver(){return this.node('convolver')}createDelay(){return this.node('delay')}createWaveShaper(){return this.node('waveshaper')}createOscillator(){return this.node('oscillator')}createStereoPanner(){return this.node('pan')}createDynamicsCompressor(){return this.node('limiter')}createBufferSource(){return this.node('source')}createScriptProcessor(){return this.node('processor')}createBuffer(ch,n,sr){const a=Array.from({length:ch},()=>new Float32Array(n));return {numberOfChannels:ch,length:n,sampleRate:sr,duration:n/sr,getChannelData:i=>a[i],copyToChannel:(d,i)=>a[i].set(d)}}async decodeAudioData(){return this.createBuffer(2,32000,8000)}async resume(){this.state='running'}async suspend(){this.state='suspended'}async close(){this.state='closed'}}Audio.all=[];
const tick=()=>new Promise(r=>setTimeout(r,15));
function dom(path){const d=new JSDOM(fs.readFileSync(path,'utf8'),{url:'https://parasite-kindle.vercel.app/',runScripts:'outside-only',pretendToBeVisual:true});const w=d.window;w.AudioContext=Audio;w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({},{get:(o,k)=>k==='measureText'?()=>({width:10}):()=>{}});w.requestAnimationFrame=()=>{};w.ResizeObserver=class{observe(){}};w.setInterval=(fn,ms)=>{(w.intervals??=[]).push({fn,ms});return 1;};return d;}
const inline=p=>[...fs.readFileSync(p,'utf8').matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(x=>x[1]).filter(x=>x.trim()).join('\n');
(async()=>{
 const orbitPath='docs/orbit/v4.1.0/index.html',o=dom(orbitPath),w=o.window;
 w.eval(fs.readFileSync('docs/orbit/v4.1.0/samples.js','utf8'));w.eval(fs.readFileSync('docs/orbit/v4.1.0/space-echo.js','utf8'));
 w.eval(inline(orbitPath)+'\nwindow.inspectOrbit=()=>({playing,droneMode,voices:[...voices],lanes,spaceEcho,context});');
 assert.equal(Audio.all.length,0);w.document.getElementById('start').click();await tick();
 let s=w.inspectOrbit();assert.equal(s.voices.length,4);assert(s.voices.every(x=>x.src.loop&&x.src.stopped>86400));assert.equal(s.context.nodes.filter(x=>x.kind==='convolver').length,1);
 w.document.getElementById('echoMode').value='12';w.document.getElementById('echoMode').dispatchEvent(new w.Event('change'));assert(s.spaceEcho.taps.every(x=>x.gain.gain.value===0));assert(s.spaceEcho.springWet.gain.value>0);
 w.document.getElementById('echoPower').click();assert.equal(s.spaceEcho.springWet.gain.value,0);
 w.document.getElementById('panic').click();assert.equal(w.inspectOrbit().voices.length,0);assert.equal(w.inspectOrbit().playing,false);o.window.close();
 const bpath='docs/kindle-hub/bounce/v3.6.0/index.html',b=dom(bpath),bw=b.window;
 bw.eval(inline(bpath)+'\nwindow.inspectBounce=()=>({v,balls,audio,playing});');assert.equal(bw.inspectBounce().v.decay,8);assert.equal(bw.document.getElementById('reverbType').value,'plate');
 bw.document.getElementById('play').click();await tick();const bs=bw.inspectBounce();assert(bs.playing);assert(bs.balls.every(x=>x.material==='marimba'));
 bw.document.getElementById('mute0').click();bw.intervals.find(x=>x.ms===25).fn();const notes=bs.audio.nodes.filter(x=>x.kind==='oscillator').map(x=>x.frequency.value);assert(notes.length>0);assert(notes.every(Number.isFinite));assert.equal(bs.balls[0].enabled,false);assert(bs.balls[0].lastHit<0);b.window.close();
 const spath='docs/kindle-hub/slice/v1.0.0/index.html',d=dom(spath),sw=d.window;sw.eval(fs.readFileSync('docs/kindle-hub/slice/v1.0.0/h910.js','utf8'));sw.eval(fs.readFileSync('docs/kindle-hub/slice/v1.0.0/splice.js','utf8')+'\nwindow.inspectSlice=()=>({sample,playing,harmonizer,audio,pattern});');
 assert.equal(sw.inspectSlice().sample,undefined);sw.document.getElementById('demo').click();await tick();let ss=sw.inspectSlice();assert(ss.sample&&ss.harmonizer);assert.equal(sw.document.querySelectorAll('#steps button').length,16);
 const input=ss.audio.createBuffer(2,1024,8000),output=ss.audio.createBuffer(2,1024,8000);input.getChannelData(0)[0]=1;input.getChannelData(1)[0]=1;let max=0,energy=0;
 ss.harmonizer.update({pitch:12,feedback:10,mix:1});assert.equal(ss.harmonizer.v.feedback,.75);
 for(let block=0;block<120;block++){ss.harmonizer.process({inputBuffer:input,outputBuffer:output});input.getChannelData(0).fill(0);input.getChannelData(1).fill(0);for(const ch of [0,1])for(const x of output.getChannelData(ch)){assert(Number.isFinite(x));max=Math.max(max,Math.abs(x));energy+=x*x;}}
 assert(energy>0&&max<2);ss.harmonizer.reset();assert(ss.harmonizer.rings.every(a=>a.every(x=>x===0)));
 sw.document.getElementById('play').click();await tick();assert(sw.inspectSlice().playing);sw.document.getElementById('play').click();assert(!sw.inspectSlice().playing);d.window.close();
 console.log('PASS: consent, four sustained sampled drones, echo modes/bypass/panic, long plate and muted-voice arpeggiation, empty Slice/sample sequencing and bounded finite H910-inspired DSP');
})().catch(e=>{console.error(e);process.exit(1)});
