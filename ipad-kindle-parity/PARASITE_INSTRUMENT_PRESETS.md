# Parasite instrument standard — eight user presets

All new Parasite invented instruments should ship with the shared `/preset-bank.js` component.

- Exactly eight numbered touch targets: `1 2 3 4 5 6 7 8`.
- Slot **1** loads the designed factory sound on first boot. For Slice, that sound is a synthesized eight-second tape-aged Mellotron-inspired flute **sample** (not an authentic Mellotron tape recording).
- The user explicitly taps **SAVE TO SLOT** to write a patch. Switching slots loads existing contents or reports **Empty**; it never overwrites another preset.
- Persist normal instrument controls in localStorage, scoped to each instrument id.
- When an instrument uses recordings, save their actual audio bytes to IndexedDB keyed by preset slot (or an appropriate reusable asset ID), not just the filename.
- The preset bank should be available within the instrument, not only from the Hub. Never hide the instrument's playable controls underneath the bank on a touch device.
- The shared bank exposes `window.ParasitePresetBank`, and instruments may register `window.ParasitePresetBridge` before loading the bank for special save/load behaviour.
- Instrument patch loading must dispatch normal `input` and `change` events, because parameters may be bound to either.
- Do not sync patches to a public cloud or allow anyone else's account to access them without authenticated user-scoped storage.
- Factory slots and recorded audio must be available when the device is offline after caching. Validate on target hardware and explicitly show missing assets rather than silently substituting them.

Implemented currently on **Orbit** and **Slice** in the iPad Hub. Existing separate Kindle and other instruments are not retroactively changed.
