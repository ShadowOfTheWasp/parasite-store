# Parasite Home 9 / Hub Remote

The owner designs instruments and submits revisions through https://parasite-creator.vercel.app/ on a phone or INVENT inside the Kindle Home APK. Keep the existing authenticated request queue and remote GitHub Pages deployment. Do not expose queue contents on the public hub.

Home has HUB and INVENT. Home and the web Hub check the published Fire catalogue and public CI state every 300,000 ms while foregrounded; resume performs an immediate check. Do not reload a playing instrument. Mobile OS background suspension prevents a guaranteed five-minute timer while closed. Android APK updates require installation consent.

Hub Remote refreshes authenticated request state every five minutes while visible. The worker remains hourly and processes one request at a time; polling does not invoke it. Private sign-in links connect the existing HttpOnly-cookie session without typing an access code. The fragment credential must never be committed, logged, published in an APK or included in public links. Credentials and the queue backend are unchanged. Device reconnection may be required after clearing storage or uninstalling the APK.

Production checks: successful Pages CI, successful Home CI, ready Vercel deployments, live Home versioned APK/manifest, live catalogue unchanged, authenticated queue GET and unauthenticated 401. Physical Kindle testing must be reported separately.

## Kindle release signing

The official installer is https://parasite-kindle.vercel.app/install.html. Starting with Home 9.1.0, sign installer APKs with the permanent Greenfield certificate so the app can be updated in place. The SHA-256 signing certificate fingerprint is `35012518712bb5bcd042bc77c237ab6cf82cbe80ff018b53d3ec54127bf979d8`.

The CI debug APK is an input for the official release. Sign it in a trusted workspace with Android SDK Build Tools and the protected Greenfield keystore, verify the certificate and download, then publish the signed APK and installer together. Keep the private material out of Git, logs, APK assets and the installer page.
