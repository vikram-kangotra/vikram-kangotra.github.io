#!/usr/bin/env node
// Run from any directory: node /path/to/site/scripts/test-nasm.cjs
// No dependencies or native NASM installation required. This loads the real
// vendored WASM compiler and executes the actual browser worker adapter in a
// Node VM; only the browser's importScripts/postMessage transport is supplied.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');

const compilerDir = path.resolve(__dirname, '../public/course/nasm');
const workerPath = path.join(compilerDir, 'worker.js');
const workerSource = fs.readFileSync(workerPath, 'utf8');
const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest('hex');
let checks = 0;

const bootSource = `bits 16
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

const protectedModeSource = `bits 16
org 0x7c00
cli
xor ax,ax
mov ds,ax
lgdt [gdt_desc]
mov eax,cr0
or eax,1
mov cr0,eax
jmp 0x08:protected
align 8
gdt:
 dq 0
 dq 0x00cf9a000000ffff
 dq 0x00cf92000000ffff
gdt_end:
gdt_desc:
 dw gdt_end-gdt-1
 dd gdt
bits 32
protected:
 mov ax,0x10
 mov ds,ax
 mov dword [0xb8000],0x0f4b0f4f
 hlt
 jmp $
times 510-($-$$) db 0
dw 0xaa55
`;

async function assemble(source) {
  let result;
  let messages = 0;
  const self = {
    location: { href: pathToFileURL(workerPath).href },
    postMessage(message, transfers = []) {
      messages += 1;
      if (message.ok) assert.equal(transfers[0], message.sector, 'sector must be transferable');
      result = message;
    },
  };
  const context = vm.createContext({ self, URL, Uint8Array, Error });
  context.importScripts = (filename) => {
    assert.equal(filename, './nasm.js', 'worker must load the vendored compiler');
    context.createNasm = require(path.join(compilerDir, filename));
  };
  vm.runInContext(workerSource, context, { filename: workerPath });
  await self.onmessage({ data: { source } });
  assert.equal(messages, 1, 'each compilation must return exactly one result');
  return result;
}

async function rejects(name, source, diagnostic) {
  const result = await assemble(source);
  assert.equal(result.ok, false, name);
  assert.match(result.error, diagnostic, name);
  checks += 1;
  console.log(`PASS ${name}`);
}

async function main() {
  // Byte-for-byte distribution hashes are recorded in PROVENANCE.txt.
  for (const [filename, expected] of [
    ['nasm.js', '087af728b170da305522885e375a09104c65cdff927834ff0e6d0eaedce406bf'],
    ['nasm.wasm', 'd51fefa5f13153c62d05a1ad525779cb040b9a0259719c92aa91bbbd7e011cb4'],
  ]) {
    assert.equal(sha256(fs.readFileSync(path.join(compilerDir, filename))), expected, filename);
  }
  checks += 1;
  console.log('PASS pinned NASM distribution hashes');

  const boot = await assemble(bootSource);
  assert.equal(boot.ok, true, boot.error);
  assert.equal(boot.sector.byteLength, 512);
  assert.equal(new Uint8Array(boot.sector)[510], 0x55);
  assert.equal(new Uint8Array(boot.sector)[511], 0xaa);
  assert.match(boot.listing, /lodsb/);
  // These complete binary hashes were independently matched against native
  // NASM 3.02 -f bin on 2026-10-01. Fixture bytes contain no timestamps.
  assert.equal(sha256(Buffer.from(boot.sector)), 'c6e520844ab5cac4134dd6324984743f2c697715180246fa34e275e8714eed92');
  checks += 1;
  console.log('PASS BIOS boot sector matches native NASM fixture and includes listing');

  const protectedMode = await assemble(protectedModeSource);
  assert.equal(protectedMode.ok, true, protectedMode.error);
  assert.equal(sha256(Buffer.from(protectedMode.sector)), 'f0be1a492a1a7f8fa7df824f0b6c763a2ae332ffd17596209dc1ecd5b92068fe');
  checks += 1;
  console.log('PASS mixed 16/32-bit GDT, control registers, and far jump match native NASM fixture');

  await rejects('undefined symbol reports source line', bootSource.replace('xor ax, ax', 'mov ax, potato'), /\/boot\.asm:5: error: symbol `potato\x27 not defined/);
  await rejects('invalid operands report syntax error', bootSource.replace('xor ax, ax', 'mov ax, cr0'), /\/boot\.asm:5: error: invalid combination of opcode and operands/);
  await rejects('missing padding is rejected', 'bits 16\norg 0x7c00\ncli\nhlt', /produced 2 bytes.*exactly 512/);
  await rejects('wrong boot signature is rejected', bootSource.replace('dw 0xaa55', 'dw 0x1234'), /boot signature is missing/);
  await rejects('oversized binary is stopped while writing', bootSource.replace('times 510-($-$$) db 0', 'times 100000 db 0'), /exceeds the 512-byte boot sector/);
  await rejects('negative padding reports NASM error', bootSource.replace('times 510-($-$$) db 0', 'times -1 db 0'), /TIMES value.*negative/);
  await rejects('repetition limit is enforced', '%rep 10001\ndb 0\n%endrep', /count 10001 exceeds limit/);
  await rejects('source bound is enforced', ' '.repeat(65537), /below 64 KB/);
  await rejects('non-string source is rejected', null, /below 64 KB/);

  // Errors and global NASM state from one run must not poison the next worker.
  const again = await assemble(bootSource);
  assert.equal(again.ok, true, again.error);
  assert.deepEqual(Buffer.from(again.sector), Buffer.from(boot.sector));
  checks += 1;
  console.log('PASS compilation recovers after all invalid programs');
  console.log(`\n${checks} real NASM checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
