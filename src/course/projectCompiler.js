/* global Uint8Array */
// A build owns a disposable worker and a private in-memory filesystem.
// Clang emits native i386 ELF objects; no source leaves the browser.
export function buildProject(files, { signal, onProgress } = {}) {
  if (!files || typeof files !== 'object' || Array.isArray(files)) {
    return Promise.reject(new Error('A project must contain named source files.'));
  }
  const entries = Object.entries(files);
  if (!entries.length || entries.length > 64) {
    return Promise.reject(new Error('Keep the project between 1 and 64 files.'));
  }
  let bytes = 0;
  for (const [path, source] of entries) {
    if (typeof source !== 'string') return Promise.reject(new Error(`${path}: expected text source.`));
    if (!/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(path) || path.length > 160
        || path.split('/').some(part => part === '.' || part === '..' || part.startsWith('.course-'))) {
      return Promise.reject(new Error(`Invalid project path: ${path}. Use relative file paths without .. or reserved .course- names.`));
    }
    const size = new TextEncoder().encode(source).length;
    if (size > 262144) return Promise.reject(new Error(`${path}: source exceeds 256 KiB.`));
    bytes += size;
  }
  if (bytes > 1048576) return Promise.reject(new Error('Project sources exceed 1 MiB.'));
  if (signal?.aborted) return Promise.reject(new DOMException('Build cancelled.', 'AbortError'));

  return new Promise((resolve, reject) => {
    const worker = new Worker('/course/clang/worker.js');
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
    const abort = () => finish(new DOMException('Build cancelled.', 'AbortError'));
    const timeout = setTimeout(() => finish(new Error(
      'Build exceeded 120 seconds. The first C build downloads the compiler; check your connection, then inspect runaway macros or oversized source.',
    )), 120000);
    signal?.addEventListener('abort', abort, { once: true });
    worker.onerror = event => finish(new Error(`Could not run the browser compiler: ${event.message || 'reload and try again'}`));
    worker.onmessageerror = () => finish(new Error('Could not read the compiler result.'));
    worker.onmessage = ({ data }) => {
      if (data?.type === 'progress') {
        onProgress?.({ phase: data.phase, message: data.message, loaded: data.loaded, total: data.total });
        return;
      }
      if (!data?.ok) {
        const error = new Error(data?.error || 'The project could not be built.');
        error.diagnostics = data?.diagnostics || [];
        error.log = data?.log || [];
        finish(error);
        return;
      }
      const artifacts = {};
      for (const [name, contents] of Object.entries(data.artifacts || {})) artifacts[name] = new Uint8Array(contents);
      finish(null, {
        type: data.type, entry: data.entry,
        sector: new Uint8Array(data.sector), disk: new Uint8Array(data.disk),
        diagnostics: data.diagnostics || [], artifacts, log: data.log || [], listing: data.listing || '',
      });
    };
    worker.postMessage({ files });
  });
}
