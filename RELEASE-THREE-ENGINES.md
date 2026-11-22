# Three-engine release

Active catalogue: Orbit 4.1.0 sampled orchestral drones / Space Echo; Bounce 3.6.0 mallet arpeggiator / long plate; Slice 1.0.0 sample slicing sequencer / H910-inspired pitch delay. Earlier sources and installers are preserved; Tron and original Splice are archived. Each engine has one post-instrument effect unit. Original inspired DSP is not a measured or proprietary hardware emulation.

Orbit uses the unchanged CC0 VSCO bank. Four sustained looped sample voices start only after consent. Planet pitch gestures update the sounding drone; optional orbit sequencing remains available. RE-201-inspired three-head tape/spring controls replace the previous standalone convolution space. Native audio import uses Android's file picker.

Bounce preserves four-voice collision physics and mute isolation. Clocked mode plays enabled voices in ascending pitch, with room collisions available as a separate mode. Default mallets are marimba, and the plate decay is eight seconds with independent voice sends.

Slice preserves Splice recording, file import, eight waveform cuts, reverse/repeats and sixteen steps. One stereo 200 ms overlap-window pitch-delay unit provides semitone/fine pitch, delay, feedback, tone and mix. Feedback is bounded and a final limiter controls peaks. It is intentionally a vintage-inspired granular effect; it is not a transparent studio pitch-correction processor. Slice is included in the online Home APK HUB and needs no separate APK.

Checks: JavaScript parse; mock AudioContext/DOM consent, voice, routing, modes, mute, sampler and finite DSP behavior; offline 440 Hz +12 semitone render; existing Hub regression checks; Android CI and published installers; exact live catalogue and production web assets. Device latency, listening quality and physical Kindle file/microphone interaction still require hardware testing.
