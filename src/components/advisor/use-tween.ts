"use client";

import { useEffect, useRef, useState } from "react";

/** Eases a displayed number towards `value` so result changes feel alive. */
export function useTween(value: number, ms = 450) {
  const [display, setDisplay] = useState(value);
  const current = useRef(value);

  useEffect(() => {
    const from = current.current;
    if (from === value) return;
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const v = from + (value - from) * (1 - Math.pow(1 - p, 3));
      current.current = v;
      setDisplay(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);

  return display;
}
