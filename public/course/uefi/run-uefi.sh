#!/usr/bin/env bash
set -euo pipefail
source_dir_default="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
output_dir="${1:-$source_dir_default/.uefi-build}"
firmware="${OVMF_CODE:-/usr/share/edk2/x64/OVMF_CODE.4m.fd}"
if [[ ! -f "$firmware" ]]; then
  printf "OVMF firmware not found: %s (set OVMF_CODE to its path)\n" "$firmware" >&2
  exit 1
fi
if [[ ! -f "$output_dir/uefi.img" ]]; then
  printf "Build first: bash build-uefi.sh\n" >&2
  exit 1
fi
qemu-system-x86_64 -machine q35 -m 256M -display none -monitor none -serial stdio -no-reboot -drive "if=pflash,format=raw,readonly=on,file=$firmware" -drive "if=ide,format=raw,file=$output_dir/uefi.img"

