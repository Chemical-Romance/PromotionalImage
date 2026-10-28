import { useEffect, useReducer } from 'react';
import { isFailed, isLoaded, loadImage } from '../lib/images';

/**
 * Re-renders a canvas when any referenced image finishes loading.
 * Sources are passed as a list; the hook de-duplicates internally.
 */
export function useImageVersion(srcs: string[]): number {
  const key = srcs.join('\n');
  const [version, bump] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    let cancelled = false;
    const list = key ? Array.from(new Set(key.split('\n'))) : [];
    const missing = list.filter((src) => !isLoaded(src) && !isFailed(src));
    if (missing.length === 0) return undefined;

    let left = missing.length;
    const done = () => {
      left -= 1;
      if (left <= 0 && !cancelled) bump();
    };
    missing.forEach((src) => loadImage(src, done));

    return () => {
      cancelled = true;
    };
  }, [key]);

  return version;
}
