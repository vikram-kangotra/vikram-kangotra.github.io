import { useCallback, useEffect, useRef, useState } from 'react';
import { readCpuRegisters } from '@/course/cpuRegisters';

// v86 runs on this page's event loop. A synchronous read copies a coherent
// sample between emulator slices; it is not an instruction trace or breakpoint.
export default function useCpuRegisters(machine) {
  const [snapshot, setSnapshot] = useState(null);
  const [error, setError] = useState('');
  const lastSignature = useRef('');
  const sample = useCallback((target = machine) => {
    if (!target) return;
    try {
      const next = readCpuRegisters(target);
      const signature = JSON.stringify({ ...next, capturedAt: 0 });
      if (signature !== lastSignature.current) {
        lastSignature.current = signature;
        setSnapshot(next);
      }
      setError('');
      return next;
    } catch (caught) {
      setError(caught.message || 'CPU registers are unavailable for this machine.');
    }
  }, [machine]);
  const reset = useCallback(() => {
    lastSignature.current = '';
    setSnapshot(null);
    setError('');
  }, []);
  useEffect(() => {
    if (!machine) return;
    sample(machine);
    const timer = setInterval(() => sample(machine), 250);
    return () => clearInterval(timer);
  }, [machine, sample]);
  return { snapshot, error, sample, reset };
}
