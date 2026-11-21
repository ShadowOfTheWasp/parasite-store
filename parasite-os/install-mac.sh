#!/bin/bash
set -euo pipefail
ADB="$HOME/Downloads/adb-old/platform-tools/adb"
APK="$HOME/Downloads/parasite-home-v5.apk"
URL="https://github.com/ShadowOfTheWasp/parasite-store/releases/download/parasite-home-v5/parasite-home-v5.apk"
export ADB_LIBUSB=0
echo "=== PARASITE HOME V5 INSTALL ==="
if [ ! -x "$ADB" ]; then echo "ADB missing: $ADB"; exit 1; fi
"$ADB" start-server
if ! "$ADB" get-state 2>/dev/null | grep -qx device; then echo "Kindle not authorised/connected. Unlock it and approve USB debugging."; exit 1; fi
if ! curl -fL --retry 2 --connect-timeout 15 "$URL" -o "$APK"; then echo "Build release is not available yet. No changes made."; exit 1; fi
"$ADB" install -r "$APK"
"$ADB" shell cmd package set-home-activity studio.parasite.home/.HomeActivity || true
"$ADB" shell am start -n studio.parasite.home/.HomeActivity
echo "Currently selected HOME:"
"$ADB" shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME || true
echo "Test restart only after checking Parasite is the selected Home. Amazon firmware has not been removed."
