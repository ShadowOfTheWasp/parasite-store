'use strict';

const echoModes = [
  [1, false], [2, false], [4, false], [6, false],
  [1, true], [2, true], [3, true], [6, true],
  [5, true], [4, true], [7, true], [0, true]
];
const headSpacing = [1, 1.94, 2.85];

function createEffects(ctx, input, output, wow, flutter, read, randomGenerator) {
  const gain = () => ctx.createGain();
  const filter = (type, frequency) => {
    const node = ctx.createBiquadFilter();
    node.type = type;
    node.frequency.value = frequency;
    return node;
  };
  const target = (param, value, time = .026) => {
    param.setTargetAtTime(value, ctx.currentTime, time);
  };
  const tapeInput = gain(), feedback = gain(), taps = gain(), echoOut = gain();
  const tapeTone = filter('lowpass', 4300);
  const bass = filter('lowshelf', 250), treble = filter('highshelf', 2300);
  const saturation = ctx.createWaveShaper();
  saturation.curve = Float32Array.from({length:2049}, (_, i) => Math.tanh((i / 1024 - 1) * 2) / 2);
  const drift = gain(), flutterGain = gain();
  wow.connect(drift);
  flutter.connect(flutterGain);
  const heads = headSpacing.map(() => {
    const delay = ctx.createDelay(2);
    const level = gain();
    saturation.connect(delay).connect(level).connect(taps);
    drift.connect(delay.delayTime);
    flutterGain.connect(delay.delayTime);
    return {delay, level};
  });
  input.connect(tapeInput).connect(saturation);
  taps.connect(tapeTone).connect(feedback).connect(saturation);
  taps.connect(bass).connect(treble).connect(echoOut).connect(output);

  const plateDirect = gain(), plateEcho = gain(), plateLevel = gain();
  const preDelay = ctx.createDelay(.3);
  const low = filter('highpass', 100), high = filter('lowpass', 8500);
  const bank = [ctx.createConvolver(), ctx.createConvolver()];
  const returns = [gain(), gain()];
  const widthInput = ctx.createChannelSplitter(2);
  const widthOutput = ctx.createChannelMerger(2);
  const straight = [gain(), gain()], cross = [gain(), gain()];
  let currentBank = 0, plateUpdate;
  input.connect(plateDirect).connect(preDelay);
  echoOut.connect(plateEcho).connect(preDelay);
  preDelay.connect(low).connect(high);
  for (let i = 0; i < bank.length; i++) {
    returns[i].gain.value = i === 0 ? 1 : 0;
    high.connect(bank[i]).connect(returns[i]).connect(widthInput);
    widthInput.connect(straight[i], i).connect(widthOutput, 0, i);
    widthInput.connect(cross[i], i).connect(widthOutput, 0, 1 - i);
  }
  widthOutput.connect(plateLevel).connect(output);

  // A dense, stereo, damped plate response with a short build-up and
  // independent high-frequency decay. Generated offline with no sampled IRs.
  function plateImpulse(seconds, damping) {
    const rate = ctx.sampleRate, length = Math.ceil(rate * (seconds + .12));
    const impulse = ctx.createBuffer(2, length, rate);
    const modes = [157, 211, 283, 379, 503, 677, 907, 1217, 1627, 2179];
    for (let ch = 0; ch < 2; ch++) {
      const samples = impulse.getChannelData(ch);
      const noise = randomGenerator(551 + ch * 189);
      let lowBand = 0, highBand = 0, tail = 1, brightTail = 1, attack = 1;
      const decay = Math.pow(.001, 1 / (rate * seconds));
      const brightDecay = Math.pow(.001, 1 / (rate * seconds * (1 - .67 * damping)));
      const attackStep = Math.exp(-1 / (rate * .012));
      const modesForChannel = modes.map((f, i) => ({
        x: Math.cos((ch + 1) * (i + 1) * 1.13), y: Math.sin((ch + 1) * (i + 1) * 1.13),
        c: Math.cos(2 * Math.PI * (f + ch * .18) / rate),
        s: Math.sin(2 * Math.PI * (f + ch * .18) / rate)
      }));
      for (let i = 0; i < length; i++) {
        const n = noise();
        lowBand += .052 * (n - lowBand);
        highBand += .64 * (n - highBand);
        let ringing = 0;
        for (const mode of modesForChannel) {
          const x = mode.x * mode.c - mode.y * mode.s;
          mode.y = mode.y * mode.c + mode.x * mode.s;
          mode.x = x;
          ringing += x;
        }
        samples[i] = (1 - attack) * (tail * (lowBand + .012 * ringing)
          + brightTail * (highBand - lowBand) * .72);
        tail *= decay;
        brightTail *= brightDecay;
        attack *= attackStep;
      }
    }
    return impulse;
  }

  function changePlate() {
    const next = 1 - currentBank;
    bank[next].buffer = plateImpulse(read('decay') / 10, read('damping') / 100);
    target(returns[currentBank].gain, 0, .045);
    target(returns[next].gain, 1, .045);
    currentBank = next;
  }

  function update(name) {
    const [mask, plateInMode] = echoModes[read('mode')];
    const echoOn = read('echo-on');
    if (['echo-on','mode','intensity','record','echo-level'].includes(name)) {
      const activeCount = heads.filter((_, index) => mask & (1 << index)).length;
      heads.forEach(({level}, i) => target(level.gain, mask & (1 << i) ? 1 / activeCount : 0));
      target(tapeInput.gain, echoOn ? .25 + read('record') / 24 : 0);
      target(feedback.gain, echoOn && mask ? (read('intensity') / 100) ** 1.6 * 1.08 : 0);
      target(echoOut.gain, echoOn ? read('echo-level') / 100 * .78 : 0);
    }
    if (name === 'rate') {
      const first = .33 * (.077 / .33) ** (read('rate') / 100);
      heads.forEach(({delay}, i) => target(delay.delayTime, first * headSpacing[i], .049));
    }
    if (name === 'flutter') {
      const wear = read('flutter') / 100;
      target(drift.gain, .0003 + wear * .005);
      target(flutterGain.gain, .00012 + wear * .00085);
      target(tapeTone.frequency, 6500 - wear * 3900);
    }
    if (name === 'bass') target(bass.gain, read('bass'));
    if (name === 'treble') target(treble.gain, read('treble'));
    if (['plate-on','plate-route','plate-level','echo-on','mode','echo-send'].includes(name)) {
      const enabled = read('plate-on') && (read('plate-route') === 0 || (echoOn && plateInMode));
      target(plateDirect.gain, enabled ? 1 : 0);
      target(plateEcho.gain, enabled ? read('echo-send') / 100 : 0);
      target(plateLevel.gain, enabled ? read('plate-level') / 100 * .88 : 0);
    }
    if (name === 'predelay') target(preDelay.delayTime, read('predelay') / 1000);
    if (name === 'low-cut') target(low.frequency, read('low-cut'));
    if (name === 'high-cut') target(high.frequency, read('high-cut'));
    if (name === 'width') {
      const width = read('width') / 100;
      straight.forEach(node => target(node.gain, .5 + width * .5));
      cross.forEach(node => target(node.gain, .5 - width * .5));
    }
    if (name === 'decay' || name === 'damping') {
      clearTimeout(plateUpdate);
      plateUpdate = setTimeout(changePlate, 165);
    }
  }

  bank[0].buffer = plateImpulse(read('decay') / 10, read('damping') / 100);
  return update;
}
