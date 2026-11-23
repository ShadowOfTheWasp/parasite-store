# Parasite V3 — Release Quality Gates

Status: IN PROGRESS, NOT 9/10. This file is an engineering checklist, not a promotional claim. Scores are earned by reproducible evidence, not subjective opinion.

## Non-negotiable gates

1. **Invention input** — User can enter text on iPad/phone and submit a NEW request, receiving an authenticated acknowledgment without revealing secrets. Test authenticated end-to-end from installed app.
2. **Autonomous build** — Three sequential queued requests are picked up and deployed by the scheduled worker without any manual intervention or unbounded delay; stale jobs recover safely.
3. **Single-question clarification** — Builder asks at most one essential technical question, Hub displays NEEDS RESPONSE, owner replies against the SAME request ID, builder resumes and deploys. No duplicate requests.
4. **Correct tool execution** — Instrument audio, local file loading, RTA microphone, and at least one OSC/utility module pass behavioural tests on supported hardware. For unsafe real-world controls, run simulation until explicit confirmed connection.
5. **Delivery into Hub** — Every verified release is added to /tools/catalogue.json; Hub discovers tools while logged out and opens them in-app without hand-pinning; device refresh doesn't lose them.
6. **Offline integrity** — Installed PWA launches cached tools without network, with clear messages for cloud-dependent Invent and unavailable mic/audio permissions.
7. **User safety & privacy** — Per-user auth and ownership for a commercial launch, no cross-user leakage, credentials remain server-side, generated code sandboxed, rate and spend limits enforced. Existing private owner beta is NOT multi-user ready.
8. **Test coverage** — Automated smoke, API, mobile layout, and audio engine regression tests, with a failing check blocking production release.
9. **Business controls** — Accurate per-build cost metering, credits/entitlements validated server-side, refunds and failed-build handling, no billing until usability gates pass.
10. **Usability** — Tested on real iPad and Kindle; touch, scroll, orientation, visible control labels, navigation and accessibility consistently work for five end-to-end creations.

## Score criteria

9/10 requires at least 9 independently verified passes, including 1,2,3,4,5,7,8 and 10 as mandatory. A verified browser HTTP 200 or JavaScript syntax check alone is NOT a pass for gates 1,2,3,4,8 or 10.

## Current confirmed evidence (2026-11-23)

- V3 public catalogue exists at /tools/catalogue.json and currently includes RTA History, Tape Keys and Chorus 6.
- Hub code reads the catalogue and opens permitted /tools/.../index.html paths in an internal iframe. Live HTTP 200 on catalogue and instrument files.
- Current offline service worker uses network-first catalogue and precaches those three tool pages.
- Deployed frontend and instrument JavaScript syntax checked; production deployment READY.
- V3 queue request execution has required manual recovery, so autonomous build gate **fails**.
- Original-request clarification reply is not implemented end-to-end; owner follow-up currently creates a new request. **Fails**.
- Real device audio/microphone, per-user separation, server-side billing, and automated UI regression tests are **unverified or not implemented**.

## Next prioritized engineering work

1. Implement authenticated in-place replies (same request ID, audit trail, safely return to queued), then validate entire question/answer/resume cycle.
2. Replace fragile scheduled-automation-only build execution with a measurable worker: leases, retries, dead-letter state, heartbeat, cost and build logs.
3. Add server-backed user accounts and tool ownership before any paid multi-user rollout.
4. Add automated browser/device tests before calling the experience production-ready.
5. Capture actual conversion, build cost and retention data before setting paid plan limits.

Do not claim a 9/10 release while these mandatory gates remain unmet.

## Offline catalogue consistency improvement (2026-11-23)

- Feature branch `feature/v3-offline-catalogue-consistency` modifies the service worker to validate all catalogue paths against the versioned same-origin tool path pattern and reject duplicates.
- New catalogue contents are committed to Cache Storage only after every referenced tool page is cached; if a fetch fails, the previously cached catalogue remains available, avoiding a new offline tool card pointing at missing code.
- Offline readiness now counts every tool in the cached catalogue, not only the release's fixed precache list. The service worker cache version advances so installed clients update.
- Reproducible JavaScript mock tests executed via V8 against the actual updated service-worker source: (a) complete catalogue and all tools: `ready=true`, catalogue committed; (b) one missing tool: `ready=false`, catalogue not committed; (c) unsafe external URL: `ready=false`, catalogue not committed. JavaScript syntax check passed. This is a mocked network/cache test, **not** a physical iPad/Kindle offline test.
- Gate 6 remains **provisional**, not independently passed, until browser service-worker and real-device airplane-mode checks confirm installation, refresh, fallback and offline audio. No score increment awarded.

## Same-request reply backend foundation (2026-11-23, iteration 3)

- Current production remains commit `7099b0bcc62c875a29e035dc8f41f788ee144498` on `feature/v3-offline-catalogue-consistency` (Vercel deployment `dpl_CJLTJWVGznWBGf7Ur9BbgH9FnrnS`, READY). The `/api/queue` implementation is not present as `ipad-kindle-parity/api/queue.js`; the existing frontend still submits follow-ups using a **new UUID** and `action:'submit'`.
- Additive SQL migration `migrations/20261123_atomic_clarification_replies.sql` was applied to connected Supabase project `zijdvgjngmnasvioblxh`. It creates `parasite_queue.replies` (append-only reply records referencing original request UUID), a restrictive service-role-only authenticated RPC `public.parasite_creator_reply(text,uuid,text)`, and an atomic `needs_input → queued` transition under a row lock. The original brief remains untouched; no queued customer instruments were claimed or modified.
- Validation: dry-run `BEGIN ... ROLLBACK` migration succeeded; committed migration succeeded; invalid and null queue-token tests correctly raised SQLSTATE 28000; catalog query confirmed RPC and reply table, with **0** reply rows. No valid owner-token or real `needs_input` request was used; no authenticated end-to-end flow has passed.
- **Gate 3 remains FAIL / incomplete.** The existing API handler must be located/extended to route authenticated `action:'reply'` to this RPC; the Hub must send `{action:'reply',id:selectedDeployId,reply:message}` without generating a new request UUID; the builder must read `parasite_queue.replies` and resume the same request; and an end-to-end test must verify the complete cycle and no duplicate request. Do **not** deploy the frontend reply button or claim success until that API path is verified. No Vercel deployment was made in this iteration.
