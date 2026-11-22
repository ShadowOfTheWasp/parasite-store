'use strict';

const $ = (id) => document.getElementById(id);
const canvas = $('wave');
const ctx = canvas.getContext('2d');
const cuts = Array.from({ length: 9 }, (_, i) => i / 8);
const pattern = Array.from({ length: 16 }, (_, i) => ({ slice: i % 8, reverse: false, repeats: 1 }));
const sources = new Set();
let audio, master, sample, reversed, harmonizer;
let selected = 0;
let playing = false;
let starting = false;
let nextStep = 0;
let nextTime = 0;
let timer;
let recorder;
let recordStream;
let recordTimeout;
let recordingPending = false;
let loading = false;
let generation = 0;
let dragged = null;
let waveform = [];

async function engine() {
  if (!audio) {
    audio = new (window.AudioContext || window.webkitAudioContext)();
    master = audio.createGain();
    master.gain.value = Number($('level').value) / 100;
    harmonizer=new ParasiteH910(audio);harmonizer.update(fxValues);master.connect(harmonizer.input);
    const limiter=audio.createDynamicsCompressor();limiter.threshold.value=-6;limiter.knee.value=8;limiter.ratio.value=10;harmonizer.output.connect(limiter);limiter.connect(audio.destination);
    audio.onstatechange = () => { if (audio.state !== 'running' && playing) stop(); };
  }
  await audio.resume();
}

function status(text) { $('status').textContent = text; }

function controls() {
  const unavailable = !sample || loading || recordingPending || Boolean(recorder && recorder.state !== 'inactive');
  for (const id of ['play', 'reset-cuts', 'fill', 'shuffle', 'reverse', 'repeat', 'rest']) $(id).disabled = unavailable;
  document.querySelectorAll('.slice').forEach((button) => { button.disabled = unavailable; });
  $('file').disabled = $('demo').disabled = loading || recordingPending || Boolean(recorder && recorder.state !== 'inactive');
  $('record').disabled = loading || recordingPending;
}

function render() {
  for (let i = 0; i < 16; i++) {
    const button = $('steps').children[i];
    const step = pattern[i];
    button.classList.toggle('selected', i === selected);
    button.setAttribute('aria-pressed', String(i === selected));
    button.querySelector('b').textContent = step.slice === null ? '–' : step.slice + 1;
    button.querySelector('em').textContent = (step.reverse ? 'REV ' : '') + (step.repeats > 1 ? step.repeats + '×' : '');
    button.setAttribute('aria-label', 'Step ' + (i + 1) + ', ' + (step.slice === null ? 'rest' : 'slice ' + (step.slice + 1)) + (step.reverse ? ', reverse' : '') + ', repeats ' + step.repeats);
  }
  $('selection').textContent = 'Step ' + (selected + 1);
  $('reverse').setAttribute('aria-pressed', String(pattern[selected].reverse));
  $('repeat').value = pattern[selected].repeats;
}

for (let i = 0; i < 16; i++) {
  const button = document.createElement('button');
  button.className = 'step';
  button.dataset.step = i;
  button.innerHTML = '<small>' + String(i + 1).padStart(2, '0') + '</small><b></b><em></em>';
  button.onclick = () => { selected = i; render(); };
  $('steps').append(button);
}
for (let i = 0; i < 8; i++) {
  const button = document.createElement('button');
  button.className = 'slice';
  button.textContent = i + 1;
  button.setAttribute('aria-label', 'Audition and assign slice ' + (i + 1));
  let origin = null;
  let suppressClick = false;
  button.onpointerdown = (event) => {
    origin = { x: event.clientX, y: event.clientY };
    button.setPointerCapture(event.pointerId);
  };
  button.onpointerup = (event) => {
    if (!origin) return;
    const moved = Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 12;
    origin = null;
    if (!moved) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-step]');
    if (target && sample) {
      selected = Number(target.dataset.step);
      pattern[selected].slice = i;
      render();
    }
    suppressClick = true;
  };
  button.onpointercancel = () => { origin = null; };
  button.onclick = async () => {
    if (suppressClick) { suppressClick = false; return; }
    if (!sample || loading) return;
    try {
      await engine();
      pattern[selected].slice = i;
      render();
      sound(pattern[selected], audio.currentTime, Math.min(2, sample.duration * (cuts[i + 1] - cuts[i])));
      button.classList.add('audition');
      setTimeout(() => button.classList.remove('audition'), 150);
    } catch { status('Audio could not start. Tap again to retry.'); }
  };
  $('slices').append(button);
}

function draw() {
  const bounds = canvas.getBoundingClientRect();
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(bounds.width * scale));
  canvas.height = Math.max(1, Math.round(bounds.height * scale));
  ctx.scale(scale, scale);
  const width = bounds.width, height = bounds.height;
  ctx.fillStyle = '#0b120d';
  ctx.fillRect(0, 0, width, height);
  if (!sample) return;
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = i % 2 ? '#20291b' : '#152019';
    ctx.fillRect(cuts[i] * width, 0, (cuts[i + 1] - cuts[i]) * width, height);
  }
  ctx.strokeStyle = '#c5df9e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  waveform.forEach((peak, i) => {
    const x = i / waveform.length * width;
    ctx.moveTo(x, height / 2 - peak * height * .42);
    ctx.lineTo(x, height / 2 + peak * height * .42);
  });
  ctx.stroke();
  for (let i = 1; i < 8; i++) {
    const x = cuts[i] * width;
    ctx.fillStyle = '#e6a36f';
    ctx.fillRect(x - 1, 0, 2, height);
    ctx.fillRect(x - 6, 0, 12, 15);
  }
  ctx.font = 'bold 10px monospace';
  ctx.fillStyle = '#e6a36f';
  for (let i = 0; i < 8; i++) ctx.fillText(String(i + 1), cuts[i] * width + 7, height - 7);
}

function install(buffer, label) {
  sample = buffer;
  reversed = audio.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) reversed.getChannelData(channel).set(buffer.getChannelData(channel).slice().reverse());
  const data = buffer.getChannelData(0);
  waveform = Array.from({ length: 700 }, (_, i) => {
    const start = Math.floor(i * data.length / 700), end = Math.max(start + 1, Math.floor((i + 1) * data.length / 700));
    let peak = 0;
    for (let n = start; n < end; n++) peak = Math.max(peak, Math.abs(data[n] || 0));
    return peak;
  });
  cuts.forEach((_, i) => { cuts[i] = i / 8; });
  $('duration').textContent = buffer.duration.toFixed(2) + ' SEC / 8 CUTS';
  $('empty').hidden = true;
  $('empty').style.display = 'none';
  status(label);
  draw();
}

async function decode(blob, label) {
  stop();
  loading = true;
  controls();
  status('Loading audio…');
  try {
    await engine();
    const buffer = await audio.decodeAudioData(await blob.arrayBuffer());
    const length = Math.min(buffer.length, Math.round(30 * buffer.sampleRate));
    if (length < 8) throw new Error('Audio is too short.');
    const trimmed = audio.createBuffer(Math.min(2, buffer.numberOfChannels), length, buffer.sampleRate);
    for (let c = 0; c < trimmed.numberOfChannels; c++) trimmed.getChannelData(c).set(buffer.getChannelData(c).subarray(0, length));
    install(trimmed, label + (buffer.duration > 30 ? ' · trimmed to 30 seconds' : ''));
  } catch { status('Could not decode this audio. Try a WAV, MP3 or M4A file.'); }
  finally { loading = false; controls(); }
}

function sound(step, when, duration) {
  if (!sample || step.slice === null) return;
  const start = cuts[step.slice] * sample.duration;
  const end = cuts[step.slice + 1] * sample.duration;
  const rate = Math.pow(2, Number($('tune').value) / 12);
  const length = Math.min(duration, (end - start) / rate);
  if (length <= 0) return;
  const source = audio.createBufferSource();
  source.buffer = step.reverse ? reversed : sample;
  source.playbackRate.value = rate;
  const envelope = audio.createGain();
  const fade = Math.min(.005, length / 3);
  envelope.gain.setValueAtTime(0, when);
  envelope.gain.linearRampToValueAtTime(1, when + fade);
  envelope.gain.setValueAtTime(1, when + length - fade);
  envelope.gain.linearRampToValueAtTime(0, when + length);
  source.connect(envelope).connect(master);
  sources.add(source);
  source.onended = () => { sources.delete(source); source.disconnect(); envelope.disconnect(); };
  source.start(when, step.reverse ? sample.duration - end : start);
  source.stop(when + length);
}

function schedule() {
  if (!playing) return;
  if (nextTime < audio.currentTime - .1) nextTime = audio.currentTime + .03;
  while (nextTime < audio.currentTime + .12) {
    const index = nextStep;
    const step = { ...pattern[index] };
    const interval = 60 / Number($('tempo').value) / 4;
    for (let r = 0; r < step.repeats; r++) sound(step, nextTime + r * interval / step.repeats, interval / step.repeats);
    const token = generation;
    setTimeout(() => {
      if (!playing || token !== generation) return;
      [...$('steps').children].forEach((button, i) => button.classList.toggle('playing', i === index));
      $('step-label').textContent = 'STEP ' + String(index + 1).padStart(2, '0');
    }, Math.max(0, (nextTime - audio.currentTime) * 1000));
    nextTime += interval;
    nextStep = (nextStep + 1) % 16;
  }
}

function stop() {
  playing = false;
  if(harmonizer)harmonizer.reset();
  generation++;
  clearInterval(timer);
  sources.forEach((source) => { try { source.stop(); } catch {} });
  starting = false;
  $('play').textContent = '▶ PLAY LOOP';
  $('step-label').textContent = 'SELECT A STEP';
  [...$('steps').children].forEach((button) => button.classList.remove('playing'));
}

$('play').onclick = async () => {
  if (playing) return stop();
  if (!sample || starting) return;
  starting = true;
  const token = generation;
  try {
    await engine();
    if (token !== generation || document.hidden) return;
    playing = true;
    nextStep = 0;
    nextTime = audio.currentTime + .05;
    $('play').textContent = '■ STOP LOOP';
    schedule();
    timer = setInterval(schedule, 25);
  } catch { status('Could not start audio. Tap Play again.'); }
  finally { starting = false; }
};
$('reverse').onclick = () => { pattern[selected].reverse = !pattern[selected].reverse; render(); };
$('repeat').onchange = () => { pattern[selected].repeats = Number($('repeat').value); render(); };
$('rest').onclick = () => { pattern[selected].slice = null; render(); };
$('fill').onclick = () => { pattern.forEach((step, i) => Object.assign(step, { slice: i % 8, reverse: false, repeats: 1 })); render(); };
$('shuffle').onclick = () => { pattern.forEach((step) => { step.slice = Math.floor(Math.random() * 8); }); render(); };
$('clear').onclick = () => { stop(); pattern.forEach((step) => Object.assign(step, { slice: null, reverse: false, repeats: 1 })); render(); };
$('reset-cuts').onclick = () => { cuts.forEach((_, i) => { cuts[i] = i / 8; }); draw(); };
$('tempo').oninput = () => { $('tempo-value').textContent = $('tempo').value + ' BPM'; };
$('tune').oninput = () => { $('tune-value').textContent = $('tune').value + ' st'; };
$('level').oninput = () => {
  $('level-value').textContent = $('level').value + '%';
  if (master) master.gain.setTargetAtTime(Number($('level').value) / 100, audio.currentTime, .01);
};
$('file').onchange = () => {
  const file = $('file').files[0];
  $('file').value = '';
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) return status('Choose an audio file smaller than 50 MB.');
  decode(file, file.name);
};

function endRecording() {
  clearTimeout(recordTimeout);
  if (recorder && recorder.state !== 'inactive') recorder.stop();
}
$('record').onclick = async () => {
  if (recorder && recorder.state !== 'inactive') return endRecording();
  stop();
  recordingPending = true;
  controls();
  status('Waiting for microphone permission…');
  try {
    if (!window.MediaRecorder) throw new Error('Recording unavailable');
    await engine();
    recordStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (document.hidden) {
      recordStream.getTracks().forEach((track) => track.stop());
      status('Recording cancelled while Slice was in the background.');
      return;
    }
    const chunks = [];
    recorder = new MediaRecorder(recordStream);
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    recorder.onstop = () => {
      recordStream.getTracks().forEach((track) => track.stop());
      $('record').classList.remove('recording');
      $('record').textContent = '● Record';
      decode(new Blob(chunks, { type: recorder.mimeType }), 'Microphone recording');
    };
    recorder.onerror = () => { endRecording(); status('Recording interrupted. Please retry.'); };
    recorder.start();
    $('record').classList.add('recording');
    $('record').textContent = '■ Finish';
    status('Recording… tap Finish when ready. Stops at 12 seconds.');
    recordTimeout = setTimeout(endRecording, 12000);
  } catch {
    recordStream?.getTracks().forEach((track) => track.stop());
    status('Recording unavailable. Check microphone permission or import an audio file.');
  } finally { recordingPending = false; controls(); }
};

$('demo').onclick = async () => {
  stop();
  loading = true;
  controls();
  try {
    await engine();
    const buffer = audio.createBuffer(1, audio.sampleRate * 4, audio.sampleRate);
    const data = buffer.getChannelData(0);
    for (let n = 0; n < data.length; n++) {
      const t = n / audio.sampleRate, beat = Math.floor(t * 2), local = t % .5;
      const kick = Math.sin(2 * Math.PI * (48 * local + 80 * (.015 * (1 - Math.exp(-local / .015))))) * Math.exp(-local * 18);
      const noise = (Math.random() * 2 - 1) * Math.exp(-local * 45);
      const bell = Math.sin(2 * Math.PI * (220 + beat * 55) * local) * Math.exp(-local * 12);
      data[n] = (beat % 2 ? noise * .4 + bell * .35 : kick * .7 + bell * .15);
    }
    install(buffer, 'Demo tape · eight original percussion hits');
    $('fill').onclick();
  } catch { status('Audio could not start. Tap Try demo again.'); }
  finally { loading = false; controls(); }
};

canvas.onpointerdown = (event) => {
  if (!sample || loading) return;
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) / rect.width;
  let closest = 1;
  for (let i = 2; i < 8; i++) if (Math.abs(cuts[i] - x) < Math.abs(cuts[closest] - x)) closest = i;
  if (Math.abs(cuts[closest] - x) * rect.width > 22) return;
  dragged = closest;
  canvas.setPointerCapture(event.pointerId);
};
canvas.onpointermove = (event) => {
  if (dragged === null) return;
  const rect = canvas.getBoundingClientRect();
  const minimum = Math.min(.012, .01 / sample.duration);
  cuts[dragged] = Math.max(cuts[dragged - 1] + minimum, Math.min(cuts[dragged + 1] - minimum, (event.clientX - rect.left) / rect.width));
  draw();
};
canvas.onpointerup = canvas.onpointercancel = () => { dragged = null; };
new ResizeObserver(draw).observe(canvas);
document.addEventListener('visibilitychange', () => { if (document.hidden) { stop(); endRecording(); } });
window.addEventListener('pagehide', () => { stop(); endRecording(); recordStream?.getTracks().forEach((track) => track.stop()); });
render();
controls();
draw();

const fxValues={pitch:0,fine:8,delay:80,feedback:.25,mix:.35,tone:7000};
for(const [key,title,min,max,step] of [['pitch','PITCH / SEMITONES',-12,12,1],['fine','FINE / CENTS',-50,50,1],['delay','DELAY / MS',0,250,1],['feedback','FEEDBACK',0,.75,.01],['mix','WET / DRY',0,1,.01],['tone','TONE / HZ',1000,14000,100]]){
 const label=document.createElement('label');label.textContent=title+' ';const output=document.createElement('output');output.textContent=fxValues[key];const input=document.createElement('input');Object.assign(input,{type:'range',min,max,step,value:fxValues[key]});input.setAttribute('aria-label',title);input.oninput=()=>{fxValues[key]=Number(input.value);output.textContent=input.value;if(harmonizer)harmonizer.update(fxValues);};label.append(output,input);$('h910-controls').append(label);
}
$('h910-clear').onclick=()=>{if(harmonizer)harmonizer.reset();};
