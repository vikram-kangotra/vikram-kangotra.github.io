/* global Uint8Array */
// NASM runs in a disposable worker, so a malformed macro cannot freeze the reader.
// The returned raw image has the same geometry as the course's v86 IDE disk.
export function assembleBootWithNasm(source, { signal } = {}) {
  if (typeof source !== 'string' || !source.trim()) {
    return Promise.reject(new Error('Write a boot-sector program before assembling.'));
  }
  if (source.length > 65536) {
    return Promise.reject(new Error('Keep this single boot-sector source below 64 KB.'));
  }
  if (signal?.aborted) return Promise.reject(new DOMException('Assembly cancelled.', 'AbortError'));

  return new Promise((resolve, reject) => {
    const worker = new Worker('/course/nasm/worker.js');
    let finished = false;
    const finish = (error, result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
      worker.terminate();
      if (error) reject(error);
      else resolve(result);
    };
    const abort = () => finish(new DOMException('Assembly cancelled.', 'AbortError'));
    const timeout = setTimeout(() => finish(new Error(
      'Assembly exceeded 30 seconds. Check for runaway macros or repetition, then try again.',
    )), 30000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = (event) => finish(new Error(
      `Could not load the browser NASM compiler. ${event.message || 'Reload the page and try again.'}`,
    ));
    worker.onmessageerror = () => finish(new Error('Could not read the compiler result. Try assembling again.'));
    worker.onmessage = ({ data }) => {
      if (!data?.ok) {
        finish(new Error(data?.error || 'NASM could not assemble this program.'));
        return;
      }
      const sector = new Uint8Array(data.sector);
      const disk = new Uint8Array(16 * 1024 * 1024);
      disk.set(sector);
      finish(null, { sector, disk, listing: data.listing, diagnostics: data.diagnostics || [] });
    };
    worker.postMessage({ source });
  });
}
