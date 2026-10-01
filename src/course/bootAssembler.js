/* global Uint8Array */
// A deliberately small x86 real-mode assembler. The result is machine code,
// not a simulation; supported forms are listed by the editor.
export const bootExample = `bits 16
org 0x7c00

cli
xor ax, ax
mov ds, ax
mov ss, ax
mov sp, 0x7c00
sti
mov ax, 0x0003
int 0x10
cld
mov si, message

print:
    lodsb
    test al, al
    jz done
    mov ah, 0x0e
    mov bx, 0x0007
    int 0x10
    jmp print

done:
    cli
    hlt
    jmp done

message: db "I booted my own code!", 0
times 510-($-$$) db 0
dw 0xaa55
`;

export function assembleBoot(source) {
  if (source.length > 16384) throw new Error('Keep this boot-sector program below 16 KB of source.');
  const labels = Object.create(null);
  const lines = source.split('\n').map((line, index) => ({
    text: line.replace(/("[^"\n]*"|'[^'\n]*')|;.*/g, (match, quoted) => quoted || '').trim(),
    number: index + 1,
  }));
  const registers16 = ['ax', 'cx', 'dx', 'bx', 'sp', 'bp', 'si', 'di'];
  const registers8 = ['al', 'cl', 'dl', 'bl', 'ah', 'ch', 'dh', 'bh'];
  function pass(first) {
    const bytes = [];
    function emit(...values) {
      bytes.push(...values.map((x) => x & 255));
      if (bytes.length > 512) throw new Error('Image exceeds the 512-byte boot sector.');
    }
    function word(value) { emit(value, value >> 8); }
    function value(text, max = 65535) {
      text = text.trim();
      let number;
      if (/^0x[\da-f]+$/i.test(text) || /^\d+$/.test(text)) number = Number(text);
      else if (/^[\da-f]+h$/i.test(text)) number = parseInt(text.slice(0, -1), 16);
      else if (/^'[^']'$/.test(text)) number = text.charCodeAt(1);
      else if (/^[a-z_]\w*$/i.test(text)) {
        if (text in labels) number = labels[text];
        else if (first) number = 0;
        else throw new Error(`Unknown label: ${text}`);
      } else throw new Error(`Expected a number or label, got ${text}`);
      if (!Number.isInteger(number) || number < 0 || number > max) throw new Error(`Value ${text} does not fit in ${max === 255 ? '8' : '16'} bits.`);
      return number;
    }
    for (const line of lines) {
      let text = line.text;
      if (!text) continue;
      try {
        const label = text.match(/^([a-z_]\w*):\s*(.*)$/i);
        if (label) {
          if (first && label[1] in labels) throw new Error(`Duplicate label: ${label[1]}`);
          if (first) labels[label[1]] = 0x7c00 + bytes.length;
          text = label[2];
          if (!text) continue;
        }
        const normalized = text.toLowerCase().replace(/\s+/g, '');
        if (normalized === 'bits16' || normalized === 'org0x7c00') continue;
        if (normalized === 'times510-($-$$)db0') {
          if (bytes.length > 510) throw new Error('Code and data exceed the 510-byte boot-sector budget.');
          while (bytes.length < 510) emit(0);
          continue;
        }
        const fixed = { cli: [0xfa], sti: [0xfb], cld: [0xfc], hlt: [0xf4], lodsb: [0xac], nop: [0x90], 'xorax,ax': [0x31, 0xc0], 'testal,al': [0x84, 0xc0], 'movds,ax': [0x8e, 0xd8], 'moves,ax': [0x8e, 0xc0], 'movss,ax': [0x8e, 0xd0] };
        if (normalized in fixed) { emit(...fixed[normalized]); continue; }
        let match = text.match(/^mov\s+(\w+)\s*,\s*(.+)$/i);
        if (match) {
          const register = match[1].toLowerCase();
          if (registers16.includes(register)) { emit(0xb8 + registers16.indexOf(register)); word(value(match[2])); }
          else if (registers8.includes(register)) emit(0xb0 + registers8.indexOf(register), value(match[2], 255));
          else throw new Error(`Unsupported register: ${register}`);
          continue;
        }
        match = text.match(/^int\s+(.+)$/i);
        if (match) { emit(0xcd, value(match[1], 255)); continue; }
        match = text.match(/^(jmp|jz|jnz)\s+(.+)$/i);
        if (match) {
          const size = match[1].toLowerCase() === 'jmp' ? 3 : 4;
          const relative = value(match[2]) - (0x7c00 + bytes.length + size);
          if (!first && (relative < -32768 || relative > 32767)) throw new Error('Branch is out of range.');
          if (size === 3) emit(0xe9); else emit(0x0f, match[1].toLowerCase() === 'jz' ? 0x84 : 0x85);
          word(relative); continue;
        }
        match = text.match(/^(db|dw)\s+(.+)$/i);
        if (match) {
          const parts = [];
          let remaining = match[2].trim();
          while (remaining) {
            const token = remaining.match(/^("[^"\n]*"|'[^'\n]*'|[^,\s"']+)/);
            if (!token) throw new Error('Expected a data value after the comma.');
            parts.push(token[0]);
            remaining = remaining.slice(token[0].length).trim();
            if (!remaining) break;
            if (remaining[0] !== ',') throw new Error('Separate data values with a comma.');
            remaining = remaining.slice(1).trim();
            if (!remaining) throw new Error('A data list cannot end with a comma.');
          }
          if (!parts.length) throw new Error('The data directive needs a value.');
          for (let part of parts) {
            part = part.trim();
            if (part.startsWith('"') && part.endsWith('"') && match[1].toLowerCase() === 'db') {
              for (const character of part.slice(1, -1)) {
                if (character.charCodeAt(0) > 127) throw new Error('Use ASCII characters in this VGA text exercise.');
                emit(character.charCodeAt(0));
              }
            } else if (match[1].toLowerCase() === 'db') emit(value(part, 255));
            else word(value(part));
          }
          continue;
        }
        throw new Error(`Unsupported instruction or directive: ${text}`);
      } catch (error) { throw new Error(`Line ${line.number}: ${error.message}`); }
    }
    return new Uint8Array(bytes);
  }
  pass(true);
  const sector = pass(false);
  if (sector.length !== 512 || sector[510] !== 0x55 || sector[511] !== 0xaa) throw new Error('A boot sector must be exactly 512 bytes and end with dw 0xaa55.');
  const disk = new Uint8Array(16 * 1024 * 1024);
  disk.set(sector);
  return { sector, disk, labels };
}
