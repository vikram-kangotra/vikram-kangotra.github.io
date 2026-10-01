// Shared, executable scaffolding for the assembly foundation.
// Every lesson body runs on the real v86 CPU; helpers only provide visible output.
export function bootProgram(body, data = '', initialization = '') {
  return `; x86 assembly foundation: NASM, 386-or-newer CPU, real mode
; Edit the lesson routine. The scaffold makes its results visible on VGA.
; At lesson entry: CS=DS=ES=SS=0, SP=0x7bfe, DF=0.
; Helpers preserve general registers and flags; putc reads AL,
; print_hex16 reads AX, puts reads the zero-terminated string at DS:SI.
bits 16
org 0x7c00
jmp 0x0000:start

start:
    cli
    xor ax, ax
    mov ss, ax
    mov sp, 0x7c00
    sti
    mov ax, 0x0003
    int 0x10
    xor ax, ax
    mov ds, ax
    mov es, ax
    cld
${initialization}
    call lesson
.halt:
    cli
    hlt
    jmp .halt

; --- Your lesson program starts here ---
lesson:
${body.trimEnd()}
    ret
; --- End of lesson program ---

; Output helpers. You will unpack CALL, PUSH and BIOS INT later.
putc:
    pushfd
    pushad
    push ds
    push es
    cld
    mov ah, 0x0e
    mov bx, 0x0007
    int 0x10
    pop es
    pop ds
    popad
    popfd
    ret

print_hex16:
    pushfd
    pushad
    mov dx, ax
    mov cx, 4
.digit:
    rol dx, 4
    mov al, dl
    and al, 0x0f
    add al, '0'
    cmp al, '9'
    jbe .emit
    add al, 7
.emit:
    call putc
    loop .digit
    popad
    popfd
    ret

newline:
    pushfd
    pushad
    mov al, 13
    call putc
    mov al, 10
    call putc
    popad
    popfd
    ret

puts:
    pushfd
    pushad
    cld
.next:
    lodsb
    test al, al
    jz .done
    call putc
    jmp .next
.done:
    popad
    popfd
    ret

${data.trimEnd()}
times 510-($-$$) db 0
dw 0xaa55
`;
}
