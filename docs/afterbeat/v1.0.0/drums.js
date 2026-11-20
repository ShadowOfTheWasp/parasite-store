'use strict';

const lanes = [
  ['BD','Kick'], ['SD','Snare'], ['CP','Clap','Maracas'], ['CH','Closed hat'], ['OH','Open hat'],
  ['CY','Cymbal'], ['LT','Low tom','Low conga'], ['MT','Mid tom','Mid conga'],
  ['HT','High tom','High conga'], ['RS','Rimshot','Claves'], ['CB','Cowbell']
];
const midiRatio = amount => 2 ** (amount / 12);
const clickLevels = [.85,.62,.55,.39,.39,.33,.62,.62,.62,.49,.46];

function makeDrums(context, output) {
  const bus = context.createGain();
  const compressor = context.createDynamicsCompressor();
  compressor.threshold.value = -11;
  compressor.knee.value = 10;
  compressor.ratio.value = 10;
  bus.connect(compressor).connect(output);
  bus.gain.value = .65;
  let lastOpenHat;
  const active = new Map();
  const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const samples = noiseBuffer.getChannelData(0);
  let seed = 615;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    samples[i] = seed / 2147483648 - 1;
  }

  function hit(index, when, settings, accent = 1) {
    const {tune, decay, tone, snappy, alternate, level} = settings;
    if (level === 0) return;
    const tuning = midiRatio(tune);
    const stretch = .34 + decay * .014;
    const brightness = .64 + tone * .009;
    const out = context.createGain();
    out.gain.value = accent * level / 100 * clickLevels[index];
    out.connect(bus);
    let sources = 0;
    function play(source, amount, duration, config = {}) {
      const t = when + (config.offset || 0);
      const gain = context.createGain();
      gain.gain.setValueAtTime(.00001, t);
      gain.gain.linearRampToValueAtTime(amount, t + .002);
      gain.gain.exponentialRampToValueAtTime(.00001, t + duration);
      if (config.type) {
        const filter = context.createBiquadFilter();
        filter.type = config.type;
        filter.frequency.value = Math.min(context.sampleRate * .45, config.freq);
        filter.Q.value = config.q || .72;
        source.connect(filter).connect(gain);
      } else source.connect(gain);
      gain.connect(out);
      sources++;
      active.set(source, t);
      source.onended = () => { active.delete(source); if (--sources === 0) out.disconnect(); };
      if (source.buffer) source.start(t, Math.random() * .24);
      else source.start(t);
      source.stop(t + duration + .006);
    }
    function osc(type, frequency, amount, duration, bend = 1, filter = {}) {
      const node = context.createOscillator();
      node.type = type;
      const target = frequency * tuning;
      node.frequency.setValueAtTime(target * bend, when);
      if (bend !== 1) node.frequency.exponentialRampToValueAtTime(target, when + Math.min(.048,duration * .3));
      play(node, amount, duration, filter);
    }
    function noise(amount, duration, type, freq, offset = 0, q = .72) {
      const node = context.createBufferSource();
      node.buffer = noiseBuffer;
      play(node, amount, duration, {type, freq, offset, q});
    }
    function metal(duration, cutoff) {
      const filter = {type:'highpass', freq:cutoff};
      for (const frequency of [205, 304, 369, 523, 555, 801]) {
        osc('square', frequency, .024, duration, 1, filter);
      }
      noise(.25, duration, 'highpass', cutoff * brightness);
    }
    switch (lanes[index][0]) {
      case 'BD':
        osc('sine', 48, .92, .64 * stretch, 3.1);
        noise(.095 * brightness,.018,'highpass',1600 * brightness);
        break;
      case 'SD':
        osc('sine', 178,.33,.16 * stretch,1.15);
        osc('triangle', 331,.11,.10 * stretch);
        noise(.15 + snappy * .0037,.25 * stretch,'highpass',1230 * brightness);
        break;
      case 'CP':
        if (alternate) noise(.60,.09 * stretch,'highpass',5700 * brightness);
        else {
          for (const offset of [0,.012,.024]) noise(.56,.035,'bandpass',1250 * brightness,offset,.85);
          noise(.32,.25 * stretch,'bandpass',1450 * brightness,.031,.76);
        }
        break;
      case 'CH':
      case 'OH':
        if (lastOpenHat && when >= lastOpenHat.when && when - lastOpenHat.when < .82) {
          const hatGain = lastOpenHat.gain;
          hatGain.setValueAtTime(lastOpenHat.initial, when);
          hatGain.linearRampToValueAtTime(0, when + .008);
        }
        lastOpenHat = null;
        metal((index === 3 ? .10 : .44) * stretch, 5200 * brightness);
        if (index === 4) lastOpenHat = {when, gain:out.gain, initial:out.gain.value};
        break;
      case 'CY':
        metal(.98 * stretch, 3650 * brightness);
        break;
      case 'LT':
      case 'MT':
      case 'HT': {
        const low = [84,112,154][index - 6] * (alternate ? 1.48 : 1);
        osc('sine',low,.70,(alternate ? .26 : .39) * stretch,alternate ? 1.26 : 1.38);
        osc('triangle',low * (alternate ? 2.54 : 1.79),.17,.12 * stretch);
        noise(.08,.055,'bandpass',low * 5);
        break;
      }
      case 'RS':
        if (alternate) osc('sine',2460,.67,.11 * stretch);
        else {
          osc('triangle',755,.37,.115 * stretch,1.02);
          osc('triangle',1630,.27,.078 * stretch);
          noise(.14,.032,'bandpass',1720 * brightness);
        }
        break;
      case 'CB': {
        const filter = {type:'bandpass',freq:1050 * brightness,q:1.15};
        osc('square',540,.30,.36 * stretch,1,filter);
        osc('square',800,.29,.29 * stretch,1,filter);
        break;
      }
    }
  }

  return {
    hit,
    stop() {
      const now=context.currentTime;
      for (const [source,start] of active) source.stop(start>now ? now : now+.018);
      lastOpenHat=null;
    },
    level(value) { bus.gain.setTargetAtTime(value / 100, context.currentTime, .018); }
  };
}

function stepLength(bpm, swing, step) {
  return 60 / (4 * bpm) * (1 + (step % 2 ? -1 : 1) * swing / 100);
}

if (typeof module === 'object' && module.exports) module.exports = {makeDrums, lanes, stepLength};
