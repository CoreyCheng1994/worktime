#!/usr/bin/env bash
set -euo pipefail

SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

OK_COUNT=0
WARN_COUNT=0
FAIL_COUNT=0

RESULTS=()
ADVICE=()

add_result() {
  local level="$1"
  local item="$2"
  local detail="$3"

  RESULTS+=("$level|$item|$detail")

  case "$level" in
    OK) OK_COUNT=$((OK_COUNT + 1)) ;;
    WARN) WARN_COUNT=$((WARN_COUNT + 1)) ;;
    FAIL) FAIL_COUNT=$((FAIL_COUNT + 1)) ;;
  esac
}

add_advice() {
  local text="$1"
  ADVICE+=("$text")
}

trim_version() {
  local v="$1"
  v="${v#v}"
  v="${v%%-*}"
  echo "$v"
}

version_ge() {
  local a b
  a="$(trim_version "$1")"
  b="$(trim_version "$2")"

  local a1 a2 a3 b1 b2 b3
  IFS='.' read -r a1 a2 a3 <<< "$a"
  IFS='.' read -r b1 b2 b3 <<< "$b"

  a1="${a1:-0}"; a2="${a2:-0}"; a3="${a3:-0}"
  b1="${b1:-0}"; b2="${b2:-0}"; b3="${b3:-0}"

  if [ "$a1" -gt "$b1" ]; then return 0; fi
  if [ "$a1" -lt "$b1" ]; then return 1; fi
  if [ "$a2" -gt "$b2" ]; then return 0; fi
  if [ "$a2" -lt "$b2" ]; then return 1; fi
  if [ "$a3" -ge "$b3" ]; then return 0; fi
  return 1
}

check_command() {
  local cmd="$1"
  if command -v "$cmd" >/dev/null 2>&1; then
    add_result "OK" "$cmd" "已安装 ($(command -v "$cmd"))"
    return 0
  fi

  add_result "FAIL" "$cmd" "未安装"
  return 1
}

probe_url() {
  local url="$1"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSIL --max-time 5 "$url" >/dev/null 2>&1
    return $?
  fi

  return 1
}

check_runtime_env() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  if [ "$os" = "Darwin" ]; then
    add_result "OK" "OS" "macOS ($arch)"
  else
    add_result "WARN" "OS" "当前是 $os，脚本主要按 macOS 设计"
    add_advice "若非 macOS，请让 agent 改为 Linux 兼容安装流程。"
  fi

  if [ -d "$HOME" ] && [ -w "$HOME" ]; then
    add_result "OK" "HOME" "$HOME 可写"
  else
    add_result "FAIL" "HOME" "$HOME 不可写"
  fi

  if [ -d "$REPO_ROOT" ]; then
    add_result "OK" "Project" "项目目录存在: $REPO_ROOT"
  else
    add_result "FAIL" "Project" "项目目录不存在: $REPO_ROOT"
  fi
}

check_toolchain() {
  local has_node=0
  local has_pnpm=0

  if check_command node; then
    has_node=1
    local node_v
    node_v="$(node -v 2>/dev/null || true)"
    if version_ge "$node_v" "20.0.0"; then
      add_result "OK" "Node.js" "版本 $node_v (>= 20)"
    else
      add_result "FAIL" "Node.js" "版本 $node_v (< 20)"
      add_advice "升级 Node.js 到 20+（建议 20 LTS）。"
    fi
  else
    add_advice "安装 Node.js 20+，建议使用 nvm 或 Homebrew。"
  fi

  if check_command pnpm; then
    has_pnpm=1
    local pnpm_v
    pnpm_v="$(pnpm -v 2>/dev/null || true)"
    if version_ge "$pnpm_v" "9.0.0"; then
      add_result "OK" "pnpm" "版本 $pnpm_v (>= 9)"
    else
      add_result "WARN" "pnpm" "版本 $pnpm_v，建议升级到 9+"
      add_advice "升级 pnpm 到 9+（corepack enable && corepack prepare pnpm@9 --activate）。"
    fi
  else
    add_result "FAIL" "pnpm" "未安装"
    add_advice "安装 pnpm（可通过 corepack）。"
  fi

  check_command git >/dev/null || add_advice "安装 git（用于拉取和更新代码）。"

  if command -v mysql >/dev/null 2>&1; then
    add_result "OK" "MySQL Client" "已安装"
  else
    add_result "WARN" "MySQL Client" "未安装（可选，但排障时建议安装）"
  fi

  if [ "$has_node" -eq 1 ] && [ "$has_pnpm" -eq 1 ]; then
    add_result "OK" "Build prerequisites" "Node + pnpm 已就绪"
  fi
}

check_project_files() {
  if [ -f "$REPO_ROOT/.env" ]; then
    add_result "OK" "Env file" "检测到 .env"
  else
    add_result "WARN" "Env file" "未找到 .env"
    add_advice "创建 .env，再启动 worktime。"
  fi

  if [ -d "$HOME/.worktime" ]; then
    add_result "OK" "~/.worktime" "目录已存在"
  else
    add_result "WARN" "~/.worktime" "目录尚未初始化（首次启动会自动创建）"
  fi
}

check_network() {
  local npm_global=0
  local npm_cn=0
  local github=0

  if probe_url "https://registry.npmjs.org/"; then
    npm_global=1
    add_result "OK" "Network npmjs" "可访问 registry.npmjs.org"
  else
    add_result "WARN" "Network npmjs" "无法访问 registry.npmjs.org"
  fi

  if probe_url "https://registry.npmmirror.com/"; then
    npm_cn=1
    add_result "OK" "Network npmmirror" "可访问 registry.npmmirror.com"
  else
    add_result "WARN" "Network npmmirror" "无法访问 registry.npmmirror.com"
  fi

  if probe_url "https://github.com/"; then
    github=1
    add_result "OK" "Network github" "可访问 github.com"
  else
    add_result "WARN" "Network github" "无法访问 github.com"
  fi

  if [ "$npm_global" -eq 0 ] && [ "$npm_cn" -eq 1 ]; then
    add_advice "当前疑似无 VPN 环境，建议优先使用国内源：pnpm config set registry https://registry.npmmirror.com"
  fi

  if [ "$npm_global" -eq 0 ] && [ "$npm_cn" -eq 0 ]; then
    add_result "FAIL" "Network package registry" "npm 官方源与国内镜像均不可访问"
    add_advice "请先确认网络代理或企业网络策略，否则无法安装依赖。"
  fi

  if [ "$github" -eq 0 ]; then
    add_advice "若无法访问 GitHub，可让 agent 使用你可访问的代码镜像或离线包方案。"
  fi
}

check_ports() {
  local p
  for p in 13018 13019 13118 13119; do
    if command -v lsof >/dev/null 2>&1; then
      if lsof -nP -iTCP:"$p" -sTCP:LISTEN >/dev/null 2>&1; then
        add_result "WARN" "Port $p" "端口已被占用"
      else
        add_result "OK" "Port $p" "可用"
      fi
    fi
  done
}

print_report() {
  echo "========================================"
  echo "Worktime 运行环境检测报告"
  echo "========================================"
  echo "项目路径: $REPO_ROOT"
  echo "检测时间: $(date '+%Y-%m-%d %H:%M:%S')"
  echo

  printf '%-6s | %-24s | %s\n' "级别" "项目" "详情"
  printf '%-6s-+-%-24s-+-%s\n' "------" "------------------------" "----------------------------------------"

  local line level item detail
  for line in "${RESULTS[@]}"; do
    IFS='|' read -r level item detail <<< "$line"
    printf '%-6s | %-24s | %s\n' "$level" "$item" "$detail"
  done

  echo
  echo "统计: OK=$OK_COUNT WARN=$WARN_COUNT FAIL=$FAIL_COUNT"

  if [ "$FAIL_COUNT" -gt 0 ]; then
    echo "结论: 不满足运行条件（FAIL）"
  elif [ "$WARN_COUNT" -gt 0 ]; then
    echo "结论: 基本可运行，但建议先处理警告（WARN）"
  else
    echo "结论: 运行环境充足（PASS）"
  fi

  echo
  if [ "${#ADVICE[@]}" -gt 0 ]; then
    echo "建议操作:"
    local a
    for a in "${ADVICE[@]}"; do
      echo "- $a"
    done
    echo
  fi

  echo "可直接发给 agent 的请求："
  echo "----------------------------------------"
  cat <<AGENT_PROMPT
请根据当前机器环境帮我安装并初始化 worktime，要求：
1) 先执行 scripts/check-worktime-env.sh 并根据结果修复 FAIL/WARN。
2) 如果检测到无法访问中国大陆之外网络，优先使用国内可访问方案（如 npmmirror），不要依赖必须翻墙的源。
3) 完成后验证：worktime open 可启动，设置页可正常打开，MCP 开关可读写。
4) 输出你做了哪些改动与验证结果。
AGENT_PROMPT
  echo "----------------------------------------"
}

check_runtime_env
check_toolchain
check_project_files
check_network
check_ports
print_report

if [ "$FAIL_COUNT" -gt 0 ]; then
  exit 2
fi

exit 0
