import { useSyncExternalStore } from 'react';

/** Reactively track a CSS media query (re-renders on change). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches
  );
}

/** True on touch-first devices (phones / tablets) where there is no
 *  precise pointer — used to swap mouse-only interactions for touch ones. */
export function usePointerCoarse(): boolean {
  return useMediaQuery('(pointer: coarse)');
}
