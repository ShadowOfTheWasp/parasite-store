'use strict';

const defaults = [
  {wave:'triangle', pitch:43, level:59, delay:226, feedback:54, drift:62},
  {wave:'sine', pitch:55, level:47, delay:379, feedback:66, drift:79},
  {wave:'sawtooth', pitch:62, level:34, delay:548, feedback:69, drift:58}
];
const shapes = ['sine', 'triangle', 'sawtooth', 'square'];
const labels = [
  ['pitch','Pitch',28,88], ['level','Level',0,100],
  ['delay','Echo',80,740], ['feedback','Feedback',0,90], ['drift','Bend',0,100]
];

function createTwig(context, destination) {
  const master = context.createGain();
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -16;
  limiter.knee.value = 10;
  limiter.ratio.value = 12;
  master.gain.value = 0;
  limiter.connect(master).connect(destination);
  const smooth = (param, value, seconds = .035) => param.setTargetAtTime(value, context.currentTime, seconds);
  const voices = defaults.map((initial, index) => {
    const carrier = context.createOscillator();
    const lfo = context.createOscillator();
    const wow = context.createOscillator();
    const pitchBend = context.createGain();
    const panBend = context.createGain();
    const wowDepth = context.createGain();
    const envelope = context.createGain();
    const voiceFilter = context.createBiquadFilter();
    const echoFilter = context.createBiquadFilter();
    const delay = context.createDelay(1);
    const feedback = context.createGain();
    const wet = context.createGain();
    const dry = context.createGain();
    const pan = context.createStereoPanner();
    const cleanPan = context.createStereoPanner();
    const colour = context.createWaveShaper();

    colour.curve = Float32Array.from({length:513}, (_, step) => Math.tanh(1.5 * (step / 256 - 1)) / 1.5);
    voiceFilter.type = 'lowpass';
    voiceFilter.frequency.value = [1700, 1200, 2200][index];
    echoFilter.type = 'lowpass';
    echoFilter.frequency.value = [1550, 2100, 1850][index];
    lfo.frequency.value = [.31, .47, .67][index];
    wow.frequency.value = [.73, 1.17, 1.63][index];
    cleanPan.pan.value = [-.63, .02, .60][index];
    pan.pan.value = [.43, -.34, .24][index];
    dry.gain.value = .5;
    wet.gain.value = .62;
    envelope.gain.value = 0;
    feedback.gain.value = 0;

    carrier.connect(voiceFilter).connect(envelope);
    envelope.connect(dry).connect(cleanPan).connect(limiter);
    envelope.connect(delay);
    delay.connect(echoFilter);
    echoFilter.connect(wet).connect(pan).connect(limiter);
    echoFilter.connect(colour).connect(feedback).connect(delay);
    lfo.connect(pitchBend).connect(carrier.detune);
    lfo.connect(panBend).connect(pan.pan);
    wow.connect(wowDepth).connect(delay.delayTime);

    const update = state => {
      const drift = state.drift / 100;
      carrier.type = state.wave;
      smooth(carrier.frequency, 440 * 2 ** ((state.pitch - 69) / 12));
      smooth(envelope.gain, state.enabled ? state.level / 100 * .27 : 0);
      smooth(delay.delayTime, state.delay / 1000, .08);
      smooth(feedback.gain, state.enabled ? state.feedback / 100 : 0);
      smooth(pitchBend.gain, drift * (35 + 30 * index));
      smooth(panBend.gain, drift * .51);
      smooth(wowDepth.gain, drift * (.012 + .004 * index));
    };
    delay.delayTime.value = initial.delay / 1000;
    update({...initial, enabled:true});
    carrier.start();
    lfo.start();
    wow.start();
    return update;
  });

  return {
    update(index, state) { voices[index](state); },
    level(value) { smooth(master.gain, value / 100 * .78); },
    stop() { smooth(master.gain, 0, .020); }
  };
}

if (typeof module === 'object' && module.exports) module.exports = {createTwig, defaults};

if (typeof document !== 'undefined') {
  const get = id => document.getElementById(id);
  const status = get('status');
  const states = defaults.map(voice => ({...voice, enabled:true}));
  const surfaces = [];
  const Audio = window.AudioContext || window.webkitAudioContext;
  let audio, synth, playing = false, transportVersion = 0;
  if (location.hash === '#kindle') get('hub').href = 'https://shadowofthewasp.github.io/parasite-store/';

  function format(name, value) {
    if (name === 'delay') return value + ' ms';
    if (name !== 'pitch') return value + '%';
    return ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][value % 12] + (Math.floor(value / 12) - 1);
  }

  function refresh(index) {
    const state = states[index], card = surfaces[index];
    card.querySelector('button').setAttribute('aria-pressed', state.enabled);
    card.querySelector('button').textContent = state.enabled ? 'On' : 'Off';
    card.querySelector('select').value = state.wave;
    card.classList.toggle('playing', playing && state.enabled);
    card.style.setProperty('--speed', Math.max(.48, state.delay / 260) + 's');
    for (const [name] of labels) {
      card.querySelector('[data-control="' + name + '"]').value = state[name];
      card.querySelector('[data-read="' + name + '"]').value = format(name, state[name]);
    }
    if (synth) synth.update(index, state);
  }

  states.forEach((state, index) => {
    const card = document.createElement('section');
    card.className = 'voice';
    const title = ['ROOT','BRANCH','CROWN'][index];
    card.innerHTML = '<div class="voice-head"><h2>' + title + '</h2><button type="button" aria-label="' + title +
      ' voice" aria-pressed="true">On</button></div><div class="trace" aria-hidden="true"><i></i></div>' +
      '<div class="controls"><label><span>Wave</span><select>' + shapes.map(shape => '<option>' + shape + '</option>').join('') +
      '</select></label>' + labels.map(([name,label,min,max]) => '<label><span>' + label + ' <output data-read="' + name +
      '"></output></span><input aria-label="' + title + ' ' + label + '" data-control="' + name + '" type="range" min="' +
      min + '" max="' + max + '"></label>').join('') + '</div>';
    get('voices').appendChild(card);
    surfaces.push(card);
    card.querySelector('button').addEventListener('click', () => { state.enabled = !state.enabled; refresh(index); });
    card.querySelector('select').setAttribute('aria-label', title + ' waveform');
    card.querySelector('select').addEventListener('change', event => { state.wave = event.target.value; refresh(index); });
    card.querySelectorAll('input').forEach(input => input.addEventListener('input', () => {
      state[input.dataset.control] = Number(input.value);
      refresh(index);
    }));
    refresh(index);
  });

  function volume() {
    const value = Number(get('volume').value);
    get('volume-value').value = value + '%';
    if (playing) synth.level(value);
  }

  window.stopTwig = function stopTwig() {
    transportVersion++;
    playing = false;
    if (synth) synth.stop();
    get('start').textContent = 'Start sound';
    get('start').disabled = false;
    states.forEach((_, index) => refresh(index));
    const version = transportVersion;
    setTimeout(() => {
      if (audio?.state === 'running' && transportVersion === version) audio.suspend().catch(() => {});
    }, 125);
  };

  get('start').addEventListener('click', async () => {
    if (playing) { window.stopTwig(); return; }
    const version = ++transportVersion;
    const control = get('start');
    control.disabled = true;
    try {
      if (!Audio) throw Error();
      if (!audio) audio = new Audio();
      if (!synth) synth = createTwig(audio, audio.destination);
      await audio.resume();
      if (version !== transportVersion) return;
      playing = true;
      control.textContent = 'Stop sound';
      status.textContent = 'Shape each voice or tap Mutate for a new sound.';
      states.forEach((_, index) => refresh(index));
      volume();
    } catch {
      status.textContent = 'Audio did not start. Tap Start sound to try again.';
    } finally {
      control.disabled = false;
    }
  });

  get('volume').addEventListener('input', volume);
  get('shuffle').addEventListener('click', () => {
    const pick = array => array[Math.floor(Math.random() * array.length)];
    const root = pick([33, 36, 38, 41, 43, 45, 48]);
    const intervals = pick([[0,7,14], [0,12,19], [0,6,13], [0,5,17], [0,11,18]]);
    states.forEach((state,index) => {
      Object.assign(state,{wave:pick(shapes),pitch:root+intervals[index],enabled:true,
        delay:130+index*130+Math.round(Math.random()*86),feedback:47+Math.round(Math.random()*35),
        drift:45+Math.round(Math.random()*52),level:29+Math.round(Math.random()*26)});
      refresh(index);
    });
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) window.stopTwig();
  });
}
