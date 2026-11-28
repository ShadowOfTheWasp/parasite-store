# Parasite private voice worker

This runner processes voice narration from the private Parasite queue. Audio and scripts are never committed to this public repository, printed in public logs, or uploaded as public Actions artifacts.

The trusted main-branch workflow authenticates using GitHub OpenID Connect. The private queue checks the token signature, audience, issuer, immutable repository and owner IDs, workflow path, branch, event and hosted-runner claims. Each claimed job receives a separate short-lived lease. No GitHub personal access token or Supabase service key is stored here.

The workflow checks every five minutes. GitHub may delay scheduled workflows; a queued job can take several minutes or longer to start. Once uploaded and accepted, the phone can close or shut down. Heartbeats allow a stopped runner to be retried once. Finished WAVs stay in private storage for seven days. Reference audio and scripts are cleared when the take completes. Expired records and files are deleted on subsequent worker checks.

Pocket TTS ONNX INT8 on CPU is the same cloning model used in the working browser version. Original uses one inference step; refined uses four. No claim is made of a measured percentage gain or global best quality. Native ONNX Runtime is locked in package-lock.json. The tokenizer is downloaded from a pinned upstream commit and checked against SHA-256; model weights come from the existing public Pocket TTS export.

Local model check: `npm ci && node bootstrap.mjs && node render.mjs /path/to/private-job.json /path/to/output`.
