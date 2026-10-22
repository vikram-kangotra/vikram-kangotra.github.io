#include "uefi.h"

static EFI_GUID loaded_image_guid = { 0x5b1b31a1, 0x9562, 0x11d2, { 0x8e, 0x3f, 0, 0xa0, 0xc9, 0x69, 0x72, 0x3b } };
static EFI_GUID filesystem_guid = { 0x964e5b22, 0x6459, 0x11d2, { 0x8e, 0x39, 0, 0xa0, 0xc9, 0x69, 0x72, 0x3b } };
static unsigned char kernel_image[65536] __attribute__((aligned(16)));

static unsigned char memory_map[32768] __attribute__((aligned(16)));
static BOOT_INFO info = { 1, sizeof(BOOT_INFO), memory_map, 0, 0, 0 };
static void serial(char character) {
    __asm__ volatile ("outb %0, %1" : : "a"(character), "Nd"((unsigned short)0x3f8));
}
static void serial_line(const char *message) {
    while (*message) serial(*message++);
    serial(10);
}
EFI_STATUS EFIAPI efi_main(EFI_HANDLE image, EFI_SYSTEM_TABLE *system) {
    system->console_out->output_string(system->console_out, (CHAR16 *)L"UEFI loader started\r\n");
    serial_line("UEFI: loader started");
    EFI_BOOT_SERVICES *boot = system->boot_services;
    EFI_LOADED_IMAGE *loaded = 0;
    EFI_FILE_SYSTEM *filesystem = 0;
    EFI_FILE *root = 0, *file = 0;
    EFI_STATUS status = boot->handle_protocol(image, &loaded_image_guid, (void **)&loaded);
    if (status != EFI_SUCCESS) return status;
    status = boot->handle_protocol(loaded->device, &filesystem_guid, (void **)&filesystem);
    if (status != EFI_SUCCESS) return status;
    status = filesystem->open_volume(filesystem, &root);
    if (status != EFI_SUCCESS) return status;
    status = root->open(root, &file, (CHAR16 *)L"KERNEL.BIN", 1, 0);
    if (status != EFI_SUCCESS) { root->close(root); return status; }
    UINTN kernel_size = sizeof(kernel_image);
    status = file->read(file, &kernel_size, kernel_image);
    file->close(file);
    root->close(root);
    if (status != EFI_SUCCESS || !kernel_size || kernel_size == sizeof(kernel_image)) return EFI_INVALID_PARAMETER;
    serial_line("UEFI: kernel file loaded");
    status = EFI_INVALID_PARAMETER;
    for (int attempt = 0; attempt < 4; ++attempt) {
        UINTN map_size = sizeof(memory_map);
        UINTN map_key = 0, descriptor_size = 0;
        unsigned int descriptor_version = 0;
        status = boot->get_memory_map(&map_size, memory_map, &map_key, &descriptor_size, &descriptor_version);
        if (status != EFI_SUCCESS) break;
        info.map_size = map_size;
        info.descriptor_size = descriptor_size;
        info.descriptor_version = descriptor_version;
        status = boot->exit_boot_services(image, map_key);
        if (status != EFI_INVALID_PARAMETER) break;
    }
    if (status != EFI_SUCCESS) {
        serial_line("UEFI: handoff failed");
        return status;
    }
    ((KERNEL_ENTRY)kernel_image)(&info);
}
