export interface BufferedTextSink {
  push: (delta: string) => void;
  flush: () => void;
  cancel: () => void;
}

/**
 * Coalesces high-frequency model stream chunks into fewer UI store updates.
 * This keeps token streaming responsive without re-rendering on every chunk.
 */
export function createBufferedTextSink(
  commit: (text: string) => void,
  delayMs = 32
): BufferedTextSink {
  let pending = '';
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const flush = () => {
    clear();
    if (!pending) return;
    const text = pending;
    pending = '';
    commit(text);
  };

  return {
    push(delta) {
      if (!delta) return;
      pending += delta;
      if (timer === null) timer = setTimeout(flush, delayMs);
    },
    flush,
    cancel() {
      clear();
      pending = '';
    },
  };
}
