/* global createNasm, importScripts */
// Bounded, disposable compiler for test harnesses larger than one boot sector.
importScripts('../nasm/nasm.js');
self.onmessage = async ({ data }) => {
  const diagnostics = [];
  try {
    const { files, source, loader } = data;
    if (!files || Object.keys(files).length > 64 || typeof source !== 'string' || source.length > 65536 || typeof loader !== 'string' || loader.length > 4096) throw new Error('Invalid machine-test compilation.');
    const entries = Object.entries(files); let total = 0;
    for (const [path, contents] of entries) {
      if (!/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(path) || path.split('/').some(part => part === '.' || part === '..' || part.startsWith('.course-')) || typeof contents !== 'string' || contents.length > 262144) throw new Error(`Invalid source file: ${path}`);
      total += contents.length;
    }
    if (total > 1048576) throw new Error('Keep test sources below 1 MiB.');
    const compile = async (entry, text, cap) => {
      const nasm = await createNasm({ locateFile: name => new URL(`../nasm/${name}`, self.location.href).href,
        print: line => { if (diagnostics.join('\n').length < 65536) diagnostics.push(String(line)); },
        printErr: line => { if (diagnostics.join('\n').length < 65536) diagnostics.push(String(line)); } });
      nasm.FS.mkdir('/project'); nasm.FS.chdir('/project');
      const dirs = new Set();
      for (const [path] of entries) { const parts = path.split('/'); parts.pop(); for (let n=1;n<=parts.length;n++) dirs.add(parts.slice(0,n).join('/')); }
      for (const dir of [...dirs].sort((a,b)=>a.split('/').length-b.split('/').length)) nasm.FS.mkdir(`/project/${dir}`);
      for (const [path, contents] of entries) nasm.FS.writeFile(path, contents);
      nasm.FS.writeFile(entry, text);
      const write = nasm.FS.write;
      nasm.FS.write = (stream, buffer, offset, length, position, canOwn) => {
        const end = (position === undefined ? stream.position : position) + length;
        if (stream.path === '/project/.course-test.bin' && end > cap) throw new Error(`Machine test image exceeds ${cap} bytes.`);
        return write(stream, buffer, offset, length, position, canOwn);
      };
      const code = nasm.callMain(['-f','bin','-o','.course-test.bin','-I','./','--limit-passes','100','--limit-lines','100000','--limit-rep','10000','--limit-macro-levels','100','--limit-macro-tokens','100000',entry]);
      if (code !== 0) throw new Error(diagnostics.join('\n') || `NASM exited ${code}.`);
      return new Uint8Array(nasm.FS.readFile('.course-test.bin'));
    };
    const stage = await compile('.course-test.asm', source, 16384);
    const boot = await compile('.course-loader.asm', loader, 512);
    if (boot.length !== 512 || boot[510] !== 0x55 || boot[511] !== 0xaa) throw new Error('Invalid machine-test loader.');
    const disk = new Uint8Array(16*1024*1024); disk.set(boot); disk.set(stage,512);
    self.postMessage({ok:true,disk:disk.buffer},[disk.buffer]);
  } catch (error) { self.postMessage({ok:false,error:String(error.message || error)}); }
};
