export const RATE = 24000;

export function prepareReference(input) {
  let peak = 0, clipped = 0, mean = 0;
  for (const x of input) { peak = Math.max(peak, Math.abs(x)); clipped += Math.abs(x) >= .995; mean += x; }
  if (clipped / input.length > .005) throw new Error('The recording is clipped. Record again with the microphone level lower.');
  mean /= input.length;
  const clean = Float32Array.from(input, x => x - mean);
  const hop = 480, energy = [];
  for (let i = 0; i < clean.length; i += hop) {
    let sum = 0;
    for (let j = i; j < Math.min(i + hop, clean.length); j++) sum += clean[j] ** 2;
    energy.push(Math.sqrt(sum / Math.min(hop, clean.length - i)));
  }
  const top = Math.max(...energy);
  if (top < .00015) throw new Error('The sample is too quiet. Record closer to the microphone.');
  const threshold = Math.max(.00005, top * .08);
  const active = energy.map(x => x > threshold);
  const first = active.indexOf(true), last = active.lastIndexOf(true);
  const start = Math.max(0, first * hop - RATE * .12);
  const end = Math.min(clean.length, (last + 1) * hop + RATE * .18);
  const voicedSeconds = active.filter(Boolean).length * hop / RATE;
  if (voicedSeconds < 4) throw new Error('Record at least five seconds of clear speech with fewer long pauses.');
  const window = Math.min(end - start, RATE * 6);
  let best = start, score = -Infinity;
  for (let i = start; i <= Math.max(start, end - window); i += hop * 5) {
    const frames = energy.slice(Math.floor(i / hop), Math.floor((i + window) / hop));
    const value = frames.reduce((sum, x) => sum + (x > threshold ? 1 : -.5), 0);
    if (value > score) { score = value; best = i; }
  }
  const samples = clean.slice(best, best + window);
  let rms = 0, selectedPeak = 0;
  for (const x of samples) { rms += x*x; selectedPeak = Math.max(selectedPeak, Math.abs(x)); }
  rms = Math.sqrt(rms / samples.length);
  const gain = Math.min(40, .12 / Math.max(.0001, rms), .9 / Math.max(.001, selectedPeak));
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return { samples, seconds: samples.length / RATE, start: best / RATE,
    note: 'Prepared reference · ' + (samples.length / RATE).toFixed(1) + ' s · level balanced' +
      (voicedSeconds / (input.length / RATE) < .45 ? ' · Long pauses detected in original recording' : '') };
}

export function scriptSections(script) {
  const result = [];
  for (const paragraph of script.trim().split(/\n\s*\n/u)) {
    const sentences = paragraph.match(/[^.!?]+(?:[.!?]+[”"’']*|$)/gu) || [];
    let section = '';
    for (const sentence of sentences) {
      for (const word of sentence.trim().split(/\s+/u)) {
        if (section.length + word.length > 320 && section) { result.push({text:section, pause:.18}); section = ''; }
        section += (section ? ' ' : '') + word;
      }
    }
    if (section) result.push({text:section, pause:.55});
    else if (result.length) result.at(-1).pause = .55;
  }
  return result;
}

export function narrationSections(script, refined = false) {
  if (!refined) return scriptSections(script);
  const result = [];
  const segmenter = typeof Intl.Segmenter === 'function' ?
    new Intl.Segmenter('en-GB', { granularity: 'sentence' }) : null;
  for (const paragraph of script.trim().split(/\n\s*\n/u)) {
    const sentences = segmenter ? [...segmenter.segment(paragraph)].map(item => item.segment.trim()) :
      paragraph.match(/[^.!?]+(?:[.!?]+[”"’']*|$)/gu) || [];
    let current = '';
    for (const sentence of sentences) {
      if (current && current.length + sentence.length + 1 > 320) {
        result.push({text:current, pause:.18});
        current = '';
      }
      if (sentence.length > 320) {
        if (current) {result.push({text:current, pause:.18});current='';}
        for (const word of sentence.split(/\s+/u)) {
          if (current && current.length + word.length + 1 > 320) {
            result.push({text:current, pause:.12});
            current='';
          }
          current += (current ? ' ' : '') + word;
        }
      } else current += (current ? ' ' : '') + sentence;
    }
    if (current) result.push({text:current, pause:.55});
  }
  return result;
}
