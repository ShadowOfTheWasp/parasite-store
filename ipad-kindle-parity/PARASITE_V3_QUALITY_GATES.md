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

## Gate 8: executable catalogue CI check (2026-11-23 20:24 UTC)

- Feature branch `feature/v3-gate8-ci-catalogue-20261123-2024` based on live production SHA `7099b0bcc62c875a29e035dc8f41f788ee144498`.
- Added dependency-free `ipad-kindle-parity/tests/catalogue-contract.cjs` to fail on invalid catalogue version, malformed tool IDs/URLs, duplicates, missing versioned instrument pages, missing offline precache references and absent Hub catalogue discovery.
- Added `.github/workflows/v3-catalogue-contract.yml` to run this check on pull requests touching the app and on pushes to this feature branch.
- Local Node syntax check passed; six positive/negative fixture assertions passed against the same source before committing. **The complete-repository test and GitHub Actions run have not been confirmed green**; fixture tests are not browser/device/audio tests.
- No production deployment, catalogue contents, queue claims, DB records, instruments, or secrets changed. Gate 8 remains incomplete until full automated smoke/API/mobile/audio coverage and enforced release blocking are demonstrated.
