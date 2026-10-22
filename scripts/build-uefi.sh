#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source_dir="${1:-$project_dir/public/course/uefi}"
output_dir="${2:-$project_dir/.uefi-build}"
mkdir -p "$output_dir"
clang --target=x86_64-pc-win32 -std=c11 -O2 -Wall -Wextra -Werror -ffreestanding -fshort-wchar -mno-red-zone -fno-stack-protector -c "$source_dir/main.c" -o "$output_dir/main.obj"
lld-link /subsystem:efi_application /entry:efi_main /nodefaultlib /out:"$output_dir/BOOTX64.EFI" "$output_dir/main.obj"
clang --target=x86_64-unknown-none-elf -std=c11 -O2 -Wall -Wextra -Werror -ffreestanding -fno-pic -fno-pie -mno-red-zone -fno-stack-protector -c "$source_dir/kernel.c" -o "$output_dir/kernel.elf.o"
ld.lld -m elf_x86_64 --image-base=0 -Ttext=0 -e kernel_start -o "$output_dir/kernel.elf" "$output_dir/kernel.elf.o"
if ! llvm-readelf -h "$output_dir/kernel.elf" | grep -q 'Entry point address: *0x0'; then
  printf 'The raw kernel entry must start at offset zero.\n' >&2
  exit 1
fi
if llvm-readelf -r "$output_dir/kernel.elf" | grep -q ' R_X86_64_'; then
  printf 'Raw kernel has relocations; use a segment-aware ELF loader.\n' >&2
  exit 1
fi
llvm-objcopy -O binary "$output_dir/kernel.elf" "$output_dir/KERNEL.BIN"
kernel_bytes=$(stat -c %s "$output_dir/KERNEL.BIN")
if [[ "$kernel_bytes" -eq 0 || "$kernel_bytes" -gt 65536 ]]; then
  printf 'Kernel must fit the 64 KiB teaching buffer.\n' >&2
  exit 1
fi
truncate -s 128M "$output_dir/uefi.img"
mkfs.vfat -F 32 "$output_dir/uefi.img" >/dev/null
mmd -i "$output_dir/uefi.img" ::/EFI ::/EFI/BOOT
mcopy -i "$output_dir/uefi.img" "$output_dir/BOOTX64.EFI" ::/EFI/BOOT/BOOTX64.EFI
mcopy -i "$output_dir/uefi.img" "$output_dir/KERNEL.BIN" ::/KERNEL.BIN
printf "Built %s and %s\n" "$output_dir/BOOTX64.EFI" "$output_dir/uefi.img"
