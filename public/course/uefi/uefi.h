#ifndef COURSE_UEFI_H
#define COURSE_UEFI_H
typedef unsigned long long UINTN;
typedef unsigned long long EFI_STATUS;
typedef unsigned short CHAR16;
typedef void *EFI_HANDLE;
typedef struct { unsigned int first; unsigned short second, third; unsigned char tail[8]; } EFI_GUID;
#define EFIAPI __attribute__((ms_abi))
#define EFI_SUCCESS 0
#define EFI_INVALID_PARAMETER 0x8000000000000002ULL
#define EFI_BUFFER_TOO_SMALL 0x8000000000000005ULL
typedef struct { unsigned long long signature; unsigned int revision, header_size, crc32, reserved; } EFI_TABLE_HEADER;
typedef struct EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL;
struct EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL { void *reset; EFI_STATUS (EFIAPI *output_string)(EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL *, CHAR16 *); };
typedef struct EFI_FILE EFI_FILE;
struct EFI_FILE {
    UINTN revision;
    EFI_STATUS (EFIAPI *open)(EFI_FILE *, EFI_FILE **, CHAR16 *, UINTN, UINTN);
    EFI_STATUS (EFIAPI *close)(EFI_FILE *);
    void *delete_file;
    EFI_STATUS (EFIAPI *read)(EFI_FILE *, UINTN *, void *);
};
typedef struct EFI_FILE_SYSTEM EFI_FILE_SYSTEM;
struct EFI_FILE_SYSTEM {
    UINTN revision;
    EFI_STATUS (EFIAPI *open_volume)(EFI_FILE_SYSTEM *, EFI_FILE **);
};
typedef struct {
    unsigned int revision;
    unsigned int padding;
    EFI_HANDLE parent;
    void *system;
    EFI_HANDLE device;
} EFI_LOADED_IMAGE;
typedef struct {
    EFI_TABLE_HEADER header;
    void *raise_tpl, *restore_tpl, *allocate_pages, *free_pages;
    EFI_STATUS (EFIAPI *get_memory_map)(UINTN *, void *, UINTN *, UINTN *, unsigned int *);
    void *allocate_pool, *free_pool;
    void *events_and_protocols[9];
    EFI_STATUS (EFIAPI *handle_protocol)(EFI_HANDLE, EFI_GUID *, void **);
    void *protocols_and_images[9];
    EFI_STATUS (EFIAPI *exit_boot_services)(EFI_HANDLE, UINTN);
} EFI_BOOT_SERVICES;
typedef struct {
    EFI_TABLE_HEADER header;
    CHAR16 *firmware_vendor;
    unsigned int firmware_revision, padding;
    EFI_HANDLE console_in_handle;
    void *console_in;
    EFI_HANDLE console_out_handle;
    EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL *console_out;
    EFI_HANDLE standard_error_handle;
    EFI_SIMPLE_TEXT_OUTPUT_PROTOCOL *standard_error;
    void *runtime_services;
    EFI_BOOT_SERVICES *boot_services;
} EFI_SYSTEM_TABLE;
typedef struct {
    unsigned int version;
    unsigned int size;
    void *memory_map;
    UINTN map_size;
    UINTN descriptor_size;
    unsigned int descriptor_version;
} BOOT_INFO;
void __attribute__((sysv_abi, noreturn)) kernel_start(const BOOT_INFO *info);
typedef void __attribute__((sysv_abi, noreturn)) (*KERNEL_ENTRY)(const BOOT_INFO *info);
#endif
