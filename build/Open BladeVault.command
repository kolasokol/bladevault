#!/bin/bash

set -euo pipefail

APP_PATH='/Applications/BladeVault.app'

if [ ! -d "$APP_PATH" ]; then
  /usr/bin/osascript -e 'display dialog "BladeVault.app was not found in Applications. Drag it there first, then run Open BladeVault.command again." buttons {"OK"} default button "OK" with icon caution'
  exit 1
fi

/usr/bin/xattr -d com.apple.quarantine "$APP_PATH" 2>/dev/null || true
/usr/bin/open "$APP_PATH"
