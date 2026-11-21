# PARASITE / KINDLE STUDIO — LOCKED THREE-UNIT BASELINE

Approved configuration: 2026-11-21.

**Do not rename, simplify, replace or redesign these instruments, their sequencing concepts, or the common Hub visual language unless the owner specifically requests a change.**

## Scope
- **Current primary interface target: iPhone 13 (390×844 CSS pixels portrait).** All three instruments launch inside one iOS Safari/Home Screen web studio; no separate instrument APKs. Keep the existing Kindle home installation functional as a secondary route.
- Same dark green / ivory / muted accent palette, rounded cards and compact performance layout.
- Exactly three active units in the Hub, with a reliable ALL INSTRUMENTS return path.
- Retain audio controls and complexity. No automatic return to the older simplified versions.
- Maintain the URL https://parasite-kindle.vercel.app.

## 01 / Orbit
- Orchestral-string sound source **only**. Four independent orbiting eight-step sequencer lanes with moving-ball visualization.
- Three detuned string oscillators per lane, amplitude and filter ADSR, resonant filtering and per-orbit time/gate/chance, patch save/recall.
- The signal has **post-engine convolution reverb** using an impulse response for a space.
- Default: an original simulated hall impulse; allow importing a measured impulse-response audio file to use as the actual convolution kernel. Never claim the simulated hall is a captured real room.
- Keep the full instrument and its familiar orbit interface, not a trivial single bell.
- **Orbit performance view is circle-first:** only the four orbit visual, transport and a short gesture readout are initially prominent; advanced sequencer/synthesis are tucked into collapsible panels.
- **Direct planetary interaction is locked:** touch the moving ball and drag up/down to change the selected orbit's base pitch in semitones; drag horizontally to lengthen/shorten its revolution time. Moving both axes adjusts both parameters. Preserve on-screen pitch/seconds readout and all underlying DSP.

## 02 / Bounce (former MELT)
- Tuned bell/mallet engine **only** with four moving balls and adjustable collision walls; chime, vibraphone, wood marimba, celesta.
- Individual pitch, movement, material, brightness, level and envelope controls.
- Tape delay/repeats **followed by reverb**, with optional shimmer/short micro-grain haze.
- Keep the four voice and atmosphere panels, collision visuals, and sound-world presets.

## 03 / Mellowtron
- A **microphone/audio-file sampler**, not a fixed flute synth. One recorded or imported tape sample mapped across two octaves at different pitches.
- Short microphone recordings, sample import, start/end trim, reverse, attack/release, filter/wear.
- Eight note rows by 32 columns step matrix with tempo/swing, matrix playback, and local tape/pattern save where storage permits.
- A controllable **H910-inspired** digital pitch-weirdness effect, with two detuned pitch taps, delayed fragments, grain effects and reverb. It is an original *inspired* algorithm, not a bit-perfect Eventide H910 emulation; do not claim proprietary algorithms have been cloned.

## iPhone 13 and Android runtime
- On iPhone, microphone recording is requested through Safari over HTTPS and needs user approval. The keyboard and 32-step matrix must be touch-friendly at narrow portrait widths. iPhone Web Audio starts on a user gesture; do not claim iPhone audio tested until run on physical hardware.
- The Parasite Home Android wrapper needs RECORD_AUDIO for microphone access and WebChromeClient file chooser support for importing audio or impulse responses.
- The wrapper requires explicit user-controlled Android installation; it cannot remotely replace an APK.
- Keep the two Home buttons, HUB and UPDATES, unchanged.
- Run a static JavaScript parse check, build/release check, deployed-file check before claiming site deploy success. Only call the whole experience hardware-tested after actual Kindle playback, recording, file import, and sequence checks.

## Required final audio QA
- No output before consent; avoid clicks, excessive clipping or runaway feedback.
- Check: Orbit 4 independent lanes, envelopes and IR switching; Bounce bell material selection, four collisions, delay into reverb; Mellowtron sample recording/import, keyboard pitch, reverse/trim, 32-step clock and H910-style wet controls.
- Tune on Fire OS hardware for glitch-free audio and acceptable latency; code and deploy checks alone are not listening tests.
