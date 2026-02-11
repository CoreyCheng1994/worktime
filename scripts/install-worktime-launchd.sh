#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLIST_PATH="$HOME/Library/LaunchAgents/com.worktime.server.plist"
LOG_DIR="$HOME/Library/Logs"

mkdir -p "$LOG_DIR"

cd "$ROOT_DIR"
pnpm -C web build
pnpm -C api build

cat > "$PLIST_PATH" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>com.worktime.server</string>
    <key>ProgramArguments</key>
    <array>
      <string>/bin/zsh</string>
      <string>-lc</string>
      <string>cd "$ROOT_DIR" && "$ROOT_DIR/scripts/worktime" --no-build</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$LOG_DIR/worktime.out.log</string>
    <key>StandardErrorPath</key>
    <string>$LOG_DIR/worktime.err.log</string>
  </dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)" "$PLIST_PATH" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST_PATH"
launchctl enable "gui/$(id -u)/com.worktime.server"
launchctl kickstart -k "gui/$(id -u)/com.worktime.server"

echo "Installed and started launchd service: com.worktime.server"
echo "Check status: launchctl print gui/$(id -u)/com.worktime.server"
