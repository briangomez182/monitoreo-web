'use client';

import { useEffect, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Cuenta desde 0 hasta `target` con easing easeOutCubic y devuelve el valor
 * entero actual. Se reinicia cada vez que `target` cambia. Si `target` es
 * null/undefined devuelve 0 sin animar.
 *
 * `replayKey` fuerza que la animación vuelva a arrancar desde 0 aunque
 * `target` no haya cambiado: útil para repetirla tras un re-chequeo que
 * devuelve el mismo código de estado.
 */
export function useCountUp(target: number | null | undefined, duration = 900, replayKey?: unknown) {
  const [value, setValue] = useState(target == null ? 0 : target);

  useEffect(() => {
    if (target == null) {
      setValue(0);
      return undefined;
    }
    if (prefersReducedMotion()) {
      setValue(target);
      return undefined;
    }

    let raf = 0;
    const start = performance.now();
    setValue(0);

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, replayKey]);

  return value;
}
