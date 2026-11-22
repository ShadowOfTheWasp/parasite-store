# PARASITE / KINDLE STUDIO — LOCKED CURRENT BASELINE

Current approved configuration: 2026-11-22. Active development target: Kindle Fire.

**Do not rename, simplify, replace or redesign these instruments, their sequencing concepts, or the common Hub visual language unless the owner specifically requests a change.**

## Scope
- **Primary and sole development target: Kindle Fire.** Parasite Home V8 is one Android APK containing two front-page buttons, HUB and INVENT. HUB opens all active instruments inside the app. INVENT opens the existing authenticated Parasite Creator Hub Remote inside the same APK. Preserve the private access-code sign-in and the pre-existing iPhone remote; do not modify the private remote's UI or credentials.
- Same dark green / ivory / muted accent palette, rounded cards and compact performance layout.
- Active instruments: Orbit, Bounce (eight balls with chord collisions), Mellowtron and Splice. Relay is archived with the older modules and is not visible as an active Hub item. Keep the reliable ALL INSTRUMENTS return path.
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
- **Eight intelligent bouncing balls** within one clearly defined rectangular room. Eight voices explicitly requested through Creator; preserve the current room and sound engine.
- Four room walls correspond to musical pitch/material impacts. Each ball changes course on collision, with restrained non-repeating trajectory variation.
- Touch and flick any ball to redirect its motion on Kindle. Adjustable speed, energy, gravity and intelligence.
- Source is tuned bell/mallet synthesis (chime, vibraphone, marimba, celesta), one voice triggered by each wall collision; simultaneous two-ball collisions trigger both voices as a chord. Each ball's pitch is fixed and identical for both wall and ball collisions; muted balls are fully excluded from physics, collisions, touch interaction and sound until re-enabled. Velocity controls impact strength.
- Delay feeds a **post-delay reverb**, with original atmospheric DSP. Keep the established Parasite design language.

## 03 / Mellowtron
- A **microphone/audio-file sampler**, not a fixed flute synth. One recorded or imported tape sample mapped across two octaves at different pitches.
- Short microphone recordings, sample import, start/end trim, reverse, attack/release, filter/wear.
- Eight note rows by 32 columns step matrix with tempo/swing, matrix playback, and local tape/pattern save where storage permits.
- A controllable **H910-inspired** digital pitch-weirdness effect, with two detuned pitch taps, delayed fragments, grain effects and reverb. It is an original *inspired* algorithm, not a bit-perfect Eventide H910 emulation; do not claim proprietary algorithms have been cloned.

## Kindle APK / operations
- Home V8 shows exactly **HUB** and **INVENT**, not UPDATES. Back navigates within the embedded web screen or returns to Parasite Home. Keep the product visually aligned with the existing Parasite design language.
- HUB uses the active production URL https://parasite-kindle.vercel.app, including versioned Bounce V3.3.0 and archived Relay source retained outside active navigation.
- INVENT uses https://parasite-creator.vercel.app with the **existing access-code sign-in, authenticated queue and request history**; no hard-coded access code in the APK. The private iPhone version is unchanged.
- Web instrument updates are delivered by web deployment. A new Android Home APK requires a normal Silk download and Android installation approval. No automatic APK update is claimed.
- The Android wrapper requires RECORD_AUDIO and a WebChromeClient audio chooser for Mellowtron samples and Orbit space IR import. Build must succeed on GitHub and the release asset must exist before publishing any download instruction.
- Keep GitHub Pages install page and https://parasite-kindle.vercel.app/install.html pointing to latest verified APK release.
- Run JavaScript static parsing, Android build checks, production deployment checks and HTTP route checks. Do not claim Kindle physical/audio verification without direct device testing.

## Required final audio QA
- No output before consent; avoid clicks, excessive clipping or runaway feedback.
- Check: Orbit 4 independent lanes, envelopes and IR switching; Bounce eight-ball movement, two-note collision chords, material selection, delay into reverb; Mellowtron sample recording/import, keyboard pitch, reverse/trim, 32-step clock and H910-style wet controls.
- Tune on Fire OS hardware for glitch-free audio and acceptable latency; code and deploy checks alone are not listening tests.
