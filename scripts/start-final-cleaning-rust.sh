#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
manifest="$repo_root/apps/final-data-cleaning-rust/Cargo.toml"
if ! command -v cargo >/dev/null 2>&1; then
  echo "未找到 Cargo。请先安装 Rust 1.89 或更新的稳定版：https://rustup.rs" >&2
  exit 127
fi

if [[ "${1:-}" == "--debug" ]]; then
  shift
  cd "$repo_root"
  exec cargo run --locked --manifest-path "$manifest" -- "$@"
fi

cd "$repo_root"
exec cargo run --locked --manifest-path "$manifest" --release -- "$@"
