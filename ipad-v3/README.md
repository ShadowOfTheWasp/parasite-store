# Parasite iPad V3 · Audio Preview
**Version 3 audio prototype**, independent from V2 and Kindle.
- Three selectable audio units: Orbit (root+chord+glide/string ensemble), Melt (poly synth), Slice (two independent tape-style voices, sequencer, audio import and mic recording).
- Slice Sitar Guitar preset with original plucked/buzzy synthesis, flanger modulation, and octave harmonic overlay selectable in either voice.
- Shared per-unit chain: H910-inspired stereo pitch/delay controls → RE201-inspired multi-head filtered echo and spring-like ambience → mixer channel → master limiter.
- Mixer can add/remove any available unit; independent effect state, level, mute, solo, master.
- Offline PWA service worker caching.
## Limitations
Hardware-inspired effects are **not** measured emulations or bit-for-bit clones. H910 pitch ratio controls use delay modulation, not a true pitch shifter. The ensemble, flute, choir and guitar presets are synthetic original sounds, not licensed Mellotron tapes; no claims of verified authentic samples. Actual latency and audio fidelity require listening tests on iPad.
V3 is intentionally an audio testing preview. Subscription billing, AI instrument code generation, marketplace payments/payouts and subscriber gate are NOT live in this V3 app. V2 gated backend is separate.
## Manual tests
1. On iPad Safari tap Orbit > choose root and chord, press and vertically drag planet; check glide and stereo effects.
2. Tap mixer > add Melt and Slice; independently mute, solo, move levels, master.
3. Slice > choose Sitar Guitar in Voice A or B, test high octave and flanger sliders. Record up to eight seconds or import a local file for user voice.
4. Start sequence, enable/disable steps, listen with all mixer channels active; stop all voices.
5. Add to Home Screen and test cached offline after first successful load.
