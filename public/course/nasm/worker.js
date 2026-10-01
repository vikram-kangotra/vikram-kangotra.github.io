/* global createNasm, importScripts */
// Original course adapter. The adjacent compiler is unmodified upstream NASM.
importScripts('./nasm.js');

self.onmessage = async ({ data }) => {
  const diagnostics = [];
  const collect = (line) => {
    if (diagnostics.join('\n').length < 65536) diagnostics.push(String(line));
  };
  try {
    if (typeof data?.source !== 'string' || data.source.length > 65536) {
      throw new Error('Keep this single boot-sector source below 64 KB.');
    }
    const nasm = await createNasm({
      locateFile: (name) => new URL(name, self.location.href).href,
      print: collect,
      printErr: collect,
    });
    nasm.FS.writeFile('/boot.asm', data.source);
    // Cap actual file writes as well as the final output. All files are isolated
    // in this worker's in-memory filesystem, discarded after each compilation.
    const write = nasm.FS.write;
    nasm.FS.write = (stream, buffer, offset, length, position, canOwn) => {
      const end = (position === undefined ? stream.position : position) + length;
      if (stream.path === '/boot.bin' && end > 512) {
        throw new Error('Image exceeds the 512-byte boot sector. Keep code and data within 510 bytes, followed by dw 0xaa55.');
      }
      if (stream.path === '/boot.lst' && end > 1048576) {
        throw new Error('Assembly listing exceeds 1 MB. Reduce macro expansion or repetition.');
      }
      return write(stream, buffer, offset, length, position, canOwn);
    };
    const exitCode = nasm.callMain([
      '-f', 'bin', '-o', '/boot.bin', '-l', '/boot.lst',
      '--limit-passes', '100', '--limit-lines', '100000',
      '--limit-rep', '10000', '--limit-macro-levels', '100',
      '--limit-macro-tokens', '100000', '--limit-mmacros', '10000',
      '/boot.asm',
    ]);
    if (exitCode !== 0) throw new Error(diagnostics.join('\n') || `NASM exited with status ${exitCode}.`);
    const sector = new Uint8Array(nasm.FS.readFile('/boot.bin'));
    if (sector.length !== 512) {
      throw new Error(`NASM produced ${sector.length} bytes. A boot sector must be exactly 512 bytes. Finish with times 510-($-$$) db 0 and dw 0xaa55.`);
    }
    if (sector[510] !== 0x55 || sector[511] !== 0xaa) {
      throw new Error('The boot signature is missing. Bytes 510 and 511 must be 55 AA; finish the source with dw 0xaa55.');
    }
    const listing = nasm.FS.readFile('/boot.lst', { encoding: 'utf8' });
    self.postMessage({ ok: true, sector: sector.buffer, listing, diagnostics }, [sector.buffer]);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    const messages = diagnostics.join('\n');
    self.postMessage({ ok: false, error: messages && !detail.includes(messages) ? `${messages}\n${detail}` : detail });
  }
};
