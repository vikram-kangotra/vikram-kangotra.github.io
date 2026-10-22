#include "uefi.h"

static void serial_line(const char *message) {
    while (*message) {
        __asm__ volatile ("outb %0, %1" : : "a"(*message++), "Nd"((unsigned short)0x3f8));
    }
    __asm__ volatile ("outb %0, %1" : : "a"((unsigned char)10), "Nd"((unsigned short)0x3f8));
}

void __attribute__((sysv_abi, noreturn)) kernel_start(const BOOT_INFO *info) {
    if (info->version != 1 || info->size != sizeof(BOOT_INFO) ||
        !info->memory_map || !info->descriptor_size ||
        !info->map_size || info->map_size % info->descriptor_size) {
        serial_line("KERNEL: invalid boot information");
    } else {
        serial_line("KERNEL: boot services exited");
        serial_line("KERNEL: memory map received");
    }
    for (;;) __asm__ volatile ("hlt");
}
