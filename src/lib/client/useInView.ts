'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Observa un elemento y devuelve `[ref, inView]`. `inView` se actualiza cada
 * vez que el elemento entra o sale del viewport, así la animación asociada se
 * repite al scrollear tanto hacia abajo como hacia arriba.
 */
export function useInView<T extends Element = HTMLElement>(
  threshold = 0.15,
  rootMargin = '0px 0px -8% 0px',
) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold, rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin]);

  return [ref, inView] as const;
}
