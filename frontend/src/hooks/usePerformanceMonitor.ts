import { useEffect, useRef } from 'react';

export const usePerformanceMonitor = (label: string) => {
  const lastTimeRef = useRef(Date.now());
  const messageCountRef = useRef(0);
  const peakMemoryRef = useRef(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastTimeRef.current;
      const messagesPerSecond = (messageCountRef.current / elapsed) * 1000;

      if (performance.memory) {
        const memoryMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2);
        if (performance.memory.usedJSHeapSize > peakMemoryRef.current) {
          peakMemoryRef.current = performance.memory.usedJSHeapSize;
        }
        const peakMB = (peakMemoryRef.current / 1024 / 1024).toFixed(2);

        console.log(`[${label}] Msgs/seg: ${messagesPerSecond.toFixed(0)}, Memory: ${memoryMB}MB (Peak: ${peakMB}MB)`);
      }

      messageCountRef.current = 0;
      lastTimeRef.current = now;
    }, 5000); // Cada 5 segundos

    return () => clearInterval(interval);
  }, [label]);

  return () => {
    messageCountRef.current++;
  };
};
