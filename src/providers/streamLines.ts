/**
 * Reads a streaming HTTP body and yields complete, non-empty, trimmed text
 * lines as they arrive. This is the line-framing counterpart to `parseSSE`:
 * use it for NDJSON streams (e.g. Ollama's `/api/chat`, which emits one JSON
 * object per line, with no `data:` prefix), where an SSE parser does not apply.
 *
 * Centralizes the reader / TextDecoder / abort-check / trailing-buffer handling
 * so individual providers don't each re-implement the read loop.
 */
export async function* streamLines(
  response: Response,
  signal?: AbortSignal
): AsyncGenerator<string> {
  if (!response.body) throw new Error('no response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() ?? '';
      for (const line of lines) {
        const t = line.trim();
        if (t) yield t;
      }
    }
    // Flush a final line that arrived without a trailing newline.
    const tail = buf.trim();
    if (tail) yield tail;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}
