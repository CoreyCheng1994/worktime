#!/usr/bin/env bash
set -euo pipefail

FAIL_MODE="0"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

usage() {
  cat <<'EOF'
Usage:
  scripts/scan_web_governance.sh [--fail] [root]

Options:
  --fail   Exit with code 1 if any "fail" checks match (CI gate).
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --fail)
      FAIL_MODE="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      ROOT="$1"
      shift
      ;;
  esac
done

if command -v rg >/dev/null 2>&1; then
  SEARCH_BIN="rg"
else
  SEARCH_BIN="grep"
fi

echo "[info] root: $ROOT"
echo "[info] search: $SEARCH_BIN"
echo "[info] mode: $([[ "$FAIL_MODE" == "1" ]] && echo "fail" || echo "report")"

if [[ ! -d "$ROOT/web/src" ]]; then
  echo "[error] missing: $ROOT/web/src"
  exit 2
fi

echo
echo "== Project hygiene =="

if [[ -f "$ROOT/web/package.json" ]]; then
  if command -v node >/dev/null 2>&1; then
    node -e 'const p=require(process.argv[1]); const s=p.scripts||{}; console.log("[web scripts]", Object.keys(s).sort().join(", "));' "$ROOT/web/package.json" || true
  else
    echo "[warn] node not found; skip package.json scripts summary"
  fi
fi

if [[ -f "$ROOT/web/eslint.config.js" ]]; then
  echo "[info] eslint.config.js: present"
else
  echo "[warn] eslint.config.js: missing"
fi

TEST_COUNT="$(find "$ROOT/web/src" -type f \( -name '*.test.ts' -o -name '*.test.tsx' -o -name '*.spec.ts' -o -name '*.spec.tsx' \) 2>/dev/null | wc -l | tr -d ' ')"
HAD_FAIL="0"
if [[ "$TEST_COUNT" == "0" ]]; then
  echo "[warn] no test files found under web/src"
  if [[ "$FAIL_MODE" == "1" ]]; then
    HAD_FAIL="1"
  fi
else
  echo "[info] test files: $TEST_COUNT"
fi

run_section() {
  local title="$1"
  local pattern="$2"
  local fail_on_match="$3"

  echo
  echo "== $title =="

  local rc=0
  if [[ "$SEARCH_BIN" == "rg" ]]; then
    set +e
    rg -n --glob "*.{ts,tsx}" "$pattern" "$ROOT/web/src"
    rc=$?
    set -e
  else
    set +e
    grep -RIn --include='*.ts' --include='*.tsx' -E "$pattern" "$ROOT/web/src"
    rc=$?
    set -e
  fi

  if [[ $rc -eq 0 ]]; then
    if [[ "$FAIL_MODE" == "1" && "$fail_on_match" == "1" ]]; then
      HAD_FAIL="1"
    fi
    return 0
  fi

  if [[ $rc -eq 1 ]]; then
    return 0
  fi

  echo "[error] search failed (exit $rc)"
  exit 2
}

run_section "Type escape hatches (P0 candidates)" "as any|@ts-ignore|@ts-expect-error" 1

run_section "Unknown/dict contracts (review carefully)" "Record<string,\\s*(unknown|any)>|\\[key:\\s*string\\]|unknown as|as unknown as" 1

run_section "Mapping contracts (option 2: allow only constrained key)" "Record<string,\\s*[^>]+>|Map<\\s*string\\s*," 0

run_section "Security-sensitive patterns" "dangerouslySetInnerHTML|innerHTML\\s*=|eval\\(|new Function\\(" 1

run_section "Debug leftovers (warn)" "console\\.log\\(" 0
run_section "Debug leftovers (fail)" "debugger;" 1

run_section "Parsing/external input entry points (warn)" "JSON\\.parse\\(|localStorage\\.|sessionStorage\\.|location\\.|URLSearchParams\\(" 0

echo
if [[ "$FAIL_MODE" == "1" && "$HAD_FAIL" == "1" ]]; then
  echo "== Done (FAIL) =="
  exit 1
fi

echo "== Done (OK) =="
