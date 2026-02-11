#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_DIR="$HOME/.local/bin"
TARGET_LINK="$TARGET_DIR/worktime"
SOURCE_SCRIPT="$ROOT_DIR/scripts/worktime"

mkdir -p "$TARGET_DIR"
ln -sf "$SOURCE_SCRIPT" "$TARGET_LINK"

if [[ ":$PATH:" != *":$TARGET_DIR:"* ]]; then
  echo "PATH does not contain $TARGET_DIR"
  echo "Add this line to ~/.zshrc:"
  echo "export PATH=\"$TARGET_DIR:\$PATH\""
fi

echo "Installed command: $TARGET_LINK"
echo "Try: worktime"
