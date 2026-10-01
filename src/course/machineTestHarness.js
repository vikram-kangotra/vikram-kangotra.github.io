// Inputs are emitted as real x86 setup instructions. The learner's routine is
// assembled unchanged and runs after this setup in both Run and machine tests.
const widths = { eax: 32, ebx: 32, ecx: 32, edx: 32, esi: 32, edi: 32, ebp: 32, ax: 16, bx: 16, cx: 16, dx: 16, si: 16, di: 16, bp: 16, al: 8, ah: 8, bl: 8, bh: 8, cl: 8, ch: 8, dl: 8, dh: 8 };
export const testFlagBits = { carry: 0, parity: 2, auxiliary: 4, zero: 6, sign: 7, interrupt: 9, direction: 10, overflow: 11 };
export function machineAddress(value) {
  if (typeof value === 'string' && /^(?:0x[0-9a-fA-F]+|[0-9]+)$/.test(value)) value = Number(value);
  if (Number.isSafeInteger(value) && value >= 0 && value < 0x100000) return String(value);
  if (typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*(?:\s*[+-]\s*(?:0x[0-9a-fA-F]+|\d+))?$/.test(value)) return value;
  throw new Error(`Unsupported machine-test address: ${value}. Use a label with an optional byte offset.`);
}
export function assemblyCaseInitialization(input = {}) {
  const lines = [];
  for (const memory of input.memory || []) {
    const address = machineAddress(memory.address);
    if (!Array.isArray(memory.bytes) || memory.bytes.length > 512 || memory.bytes.some(byte => !Number.isInteger(byte) || byte < 0 || byte > 255)) throw new Error('Machine test memory must contain at most 512 bytes.');
    memory.bytes.forEach((byte, index) => lines.push(`    mov byte [cs:${address}+${index}], ${byte}`));
  }
  for (const [register, value] of Object.entries(input.registers || {})) {
    if (!widths[register] || !Number.isInteger(value) || value < -(2 ** (widths[register] - 1)) || value >= 2 ** widths[register]) throw new Error(`Invalid ${register} input for a machine test.`);
    lines.push(`    mov ${register}, ${value}`);
  }
  if (input.flags) {
    // PUSHFD/POPFD preserves all registers, while changing only declared flags.
    let clear = 0; let set = 0;
    for (const [name, value] of Object.entries(input.flags)) {
      if (!Object.hasOwn(testFlagBits, name) || typeof value !== 'boolean') throw new Error(`Invalid ${name} flag input.`);
      clear |= 1 << testFlagBits[name]; if (value) set |= 1 << testFlagBits[name];
    }
    lines.push('    push eax', '    pushfd', '    pop eax', `    and eax, ${(~clear) >>> 0}`, `    or eax, ${set}`, '    push eax', '    popfd', '    pop eax');
  }
  return lines.join('\n');
}

export const machineTestLayout = { complete: 0x5000, registers: 0x5008, flags: 0x5028, count: 0x502c, length: 0x502e, observations: 0x5100, addresses: 0x5e00, output: 0x6000, guard: 0x6fe0, guardSize: 32, guardValue: 0xa7, maxObservations: 64, maxOutput: 2048 };
const helperIds = { putc: 1, print_hex16: 2, newline: 3, puts: 4 };
export { helperIds };

export function routineTestSource(input, addresses, cookie, hasData) {
  const L = machineTestLayout;
  const log = name => `
    pushfd
    pushad
    mov bp, sp
    xor ebx, ebx
    mov bx, [cs:${L.count}]
    cmp bx, ${L.maxObservations}
    jae %%done
    imul bx, 40
    mov word [cs:${L.observations}+bx], ${helperIds[name]}
    mov ax, [ss:bp+36]
    mov word [cs:${L.observations}+bx+2], ax
    mov eax, [ss:bp+28]
    mov [cs:${L.observations}+bx+4], eax
    mov eax, [ss:bp+16]
    mov [cs:${L.observations}+bx+8], eax
    mov eax, [ss:bp+24]
    mov [cs:${L.observations}+bx+12], eax
    mov eax, [ss:bp+20]
    mov [cs:${L.observations}+bx+16], eax
    mov eax, [ss:bp+4]
    mov [cs:${L.observations}+bx+20], eax
    mov eax, [ss:bp]
    mov [cs:${L.observations}+bx+24], eax
    mov eax, [ss:bp+8]
    mov [cs:${L.observations}+bx+28], eax
    mov eax, [ss:bp+12]
    add eax, 6
    mov [cs:${L.observations}+bx+32], eax
    mov eax, [ss:bp+32]
    mov [cs:${L.observations}+bx+36], eax
    inc word [cs:${L.count}]
%%done:
    popad
    popfd`;
  return `bits 16
org 0x8000
jmp 0:__grade_start
%macro __grade_observe 1
%ifidni %1,putc
${log('putc')}
%elifidni %1,print_hex16
${log('print_hex16')}
%elifidni %1,newline
${log('newline')}
%elifidni %1,puts
${log('puts')}
%endif
%endmacro
__grade_start:
    cli
    xor ax, ax
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov sp, 0x7c00
    mov ax, 3
    int 0x10
    xor ax, ax
    mov ds, ax
    mov es, ax
    cld
    mov di, ${L.complete}
    mov cx, 0x1800
    rep stosb
    mov di, ${L.guard}
    mov cx, ${L.guardSize}
    mov al, ${L.guardValue}
    rep stosb
${addresses.map((address, index) => `    mov dword [cs:${L.addresses + index * 4}], ${machineAddress(address)}`).join('\n')}
    xor eax, eax
    xor ebx, ebx
    xor ecx, ecx
    xor edx, edx
    xor esi, esi
    xor edi, edi
    xor ebp, ebp
    mov esp, 0x7c00
    push word 2
    popf
${assemblyCaseInitialization(input)}
    ; Signal learner entry without changing the supplied registers or FLAGS.
    mov dword [cs:${L.complete + 4}], ${((cookie ^ 0x13579bdf) >>> 0)}
    call lesson
    mov [cs:${L.registers}], eax
    mov [cs:${L.registers + 4}], ebx
    mov [cs:${L.registers + 8}], ecx
    mov [cs:${L.registers + 12}], edx
    mov [cs:${L.registers + 16}], esi
    mov [cs:${L.registers + 20}], edi
    mov [cs:${L.registers + 24}], ebp
    mov [cs:${L.registers + 28}], esp
    pushfd
    pop dword [cs:${L.flags}]
    mov dword [cs:${L.complete}], ${cookie >>> 0}
    cli
__grade_halt:
    hlt
    jmp __grade_halt
lesson:
%include "lesson.asm"
    ret
putc:
    __grade_observe putc
__grade_emit:
    pushfd
    pushad
    push ds
    push es
    mov bx, [cs:${L.length}]
    cmp bx, ${L.maxOutput}
    jae .full
    mov [cs:${L.output}+bx], al
    inc word [cs:${L.length}]
.full:
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
    __grade_observe print_hex16
    pushfd
    pushad
    mov dx, ax
    mov cx, 4
.digit:
    rol dx, 4
    mov al, dl
    and al, 15
    add al, '0'
    cmp al, '9'
    jbe .emit
    add al, 7
.emit:
    call __grade_emit
    loop .digit
    popad
    popfd
    ret
newline:
    __grade_observe newline
    pushfd
    pushad
    mov al, 13
    call __grade_emit
    mov al, 10
    call __grade_emit
    popad
    popfd
    ret
puts:
    __grade_observe puts
    pushfd
    pushad
    cld
.next:
    lodsb
    test al, al
    jz .done
    call __grade_emit
    jmp .next
.done:
    popad
    popfd
    ret
__grade_data_before: times 16 db 0xa7
${hasData ? '%include "data.inc"' : ''}
__grade_data_after: times 16 db 0xa7
`;
}

export const machineTestLoader = `bits 16
org 0x7c00
jmp 0:start
start:
    cli
    xor ax, ax
    mov ds, ax
    mov es, ax
    mov ss, ax
    mov sp, 0x7c00
    cld
    sti
    mov si, dap
    mov ah, 0x42
    int 0x13
    jc failed
    jmp 0:0x8000
failed:
    cli
    hlt
    jmp failed
align 4
dap:
    db 16,0
    dw 32
    dw 0,0x0800
    dq 1
times 510-($-$$) db 0
dw 0xaa55
`;
