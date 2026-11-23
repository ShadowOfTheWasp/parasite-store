# PARASITE V2 — NOCTURNE
## Living instrument system · Design / audio / subscription integration standard

**Version:** 2.1.0 · **Release mode:** early access, payments OFF.

### Brand thesis
A nocturnal instrument laboratory: analogue machinery illuminated by enchanted light. A sense of *Blade Runner* atmosphere plus botanical / Peter Pan-like wonder, without copying any named franchise, brand assets, character art, or musical compositions. Performance must remain legible, touchable, stable and low-latency.

### Tokens and application
| Token | Value | Use |
|---|---|---|
| Void | `#060c0b` | high-contrast background |
| Night | `#0c1817` | panel depth |
| Glass | `#182b26` | performance cards |
| Frosted edge | `#365b50` | thin hardware engraving |
| Phosphor | `#c6ff91` | Orbit & primary control |
| Moss mint | `#a2f8cf` | signals / secondary text |
| Cyan | `#85e4f9` | Bounce / kinetics |
| Violet | `#c4a8f7` | Relay / routing |
| Amber | `#f6d18b` | Slice / sample pads |
| Ink | `#eaf8e8` | text |
| Muted | `#9db9a7` | subdued text |

Font: system / Avenir Next / Segoe UI fallback, no remote fonts. No generated or copyrighted game/music assets. Theme files are `/parasite-v2.css`, `/parasite-v2.js`, and `/instrument-v2-template.html`.

### Instrument layout
**Every screen must fit one iPad viewport (100dvh) in both orientations.** Instrument performance goes on the left or in the upper primary zone. Sound shaping / FX goes on the right or below in portrait. Only nonessential parameters belong in native, keyboard-accessible `<details>` drawers. No page scrollbar; do not scale hit-targets below usable size. Do not let overlays cover playable pads or controls. Prefer collapsed secondary panels over clipping. Users with reduced motion should receive static glows instead of animation.

**Top strip:** module title, identity, 8 numbered local presets, visible state. **Main surface:** custom playable visual logic. **Control surface:** tone, sequencing, routing. **Status strip:** engine status, errors and offline state.

### Universal spectrum is mandatory for EVERY instrument
All four luminous colours (#c6ff91 green, #f6d18b amber, #85e4f9 cyan, #c4a8f7 violet) belong to the **single Parasite brand**, not to individual modules. The same multi-colour accents should appear in every instrument's panels, selection state, indicators, active controls and artwork. No per-instrument accent assignment is permitted. Existing and invented instruments use precisely this colour system; uniqueness comes from the instrument's interactive performance surface and sound rather than new colours.

The shared stylesheet and `window.ParasiteV2.palette` expose all four colours. The factory template inherits this automatically. The designer must NOT introduce arbitrary per-instrument colours or separate themes.

### Module contracts
- **Orbit / shared spectrum:** six planetary string lanes, synchronised subdivisions and free-running timings, Space Echo-style sound design. Preserve original string engine and Orbit-clock logic.
- **Slice / shared spectrum:** sixteen physical-style MPC pads in a 4×4 grid, one imported/recorded tape sample divided into sixteen chops, sixteen-step sequencing, H910-like delay, Space Echo-inspired FX. Do not turn it into a keyboard or load a second voice.
- **Bounce / shared spectrum:** collision/physics playfield visually dominant, readable note/rhythm/ball configuration. Keep all ball-note and collision behaviour.
- **Relay / shared spectrum:** readable signal routes, input/output states, and concise technical panels. Do not remove hardware-related safety/permission UI.
- **Hub / Deploy:** scrollable list of modules and real authenticated queue states on left; private Deploy on right. Keep queue statuses grounded in actual backend, not fabricated estimates.

### Audio quality release gate
Visual identity is **not** proof of improved audio quality. Before a paid launch, validate with physical iPad and offline testing:
1. A clean 0 dBFS sine file and several instrument samples: no clipping, digital pops or DC offset.
2. Slice: all 16 chops trigger accurately, on/touch release has a short click-free fade, recording/import decodes after relaunch, presets restore *audio* not just titles.
3. Orbit: all six lanes phase-lock and free-run independently, correct divisions including triplets, no skipped notes when changing BPM, sound tails behave.
4. Bounce: every enabled ball has the same assigned note across wall and ball collisions; off balls do not interact.
5. Relay: hardware permissions, routing and network errors are visible and recoverable.
6. Space Echo / H910 are **inspired approximations**, not verified hardware clones; do not claim a measured match.
7. Audio playback unlocked on first user interaction (iOS), maintain headroom and a safety limiter, validate latency with headphones.
8. Run QA in iPad landscape and portrait with keyboard, touch, VoiceOver and reduced motion. Do not publish as audio-approved without recording tests.

### New-module inheritance
Every new deployed module *must* start from `/instrument-v2-template.html` or equivalent composition, link `/parasite-v2.css`, call `window.ParasiteV2.apply(document, 'custom')` and load `/preset-bank.js` after its DSP/preset bridge. Add new module to Hub with a short name, location and interactive motif; every module uses the same four-colour spectrum, never a new palette accent. The Host iframe automatically applies the V2 skin to same-origin legacy modules. For unrelated domains, build with the template: iframe CSS cannot legitimately reach cross-origin pages.

### Subscription architecture — prepared, not enabled
Existing account's Supabase project has RLS-enabled `public.parasite_v2_subscriptions`, `parasite_v2_instruments`, and `parasite_v2_listings` tables. This V2 release adds `GET /api/subscription-status` with `billingEnabled:false`, `checkoutEnabled:false` and `subscriptionRequired:false`. The UI labels this as Early Access, not a paid/free entitlement determination.

**Do not enable premium access using localStorage, query parameters or client-submitted plan details.** Before subscriptions ship: establish verified per-user auth, provider checkout with server-owned price IDs, signed webhook verification, idempotent subscription state transitions, server-side ownership and RLS checking, server-verified entitlement API, customer billing portal, cancellation/refund/customer support, and an integration test of paid→expired→reactivated states. Only after tests may the explicit billing flag be changed to true.

The Hub and modules stay accessible in this release while billing is off. No payment has been collected or checkout enabled.

### Release acceptance
V2 may be deployed as a **visual early-access beta** when source syntax, DOM compatibility, static asset paths, security filters and Vercel READY status pass. Declare physical-device audio and visual pixel-testing outstanding until actually done. Never advertise a pixel-perfect multi-module redesign solely from CSS rules without testing the legacy modules.
