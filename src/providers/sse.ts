import { createParser, type EventSourceMessage } from 'eventsource-parser';

export async function* parseSSE(
  response: Response,
  signal?: AbortSignal
): AsyncGenerator<EventSourceMessage> {
  if (!response.body) throw new Error('no response body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  const queue: EventSourceMessage[] = [];
  const parser = createParser({
    onEvent: (evt) => queue.push(evt),
  });
  try {
    while (true) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(decoder.decode(value, { stream: true }));
      while (queue.length) yield queue.shift()!;
    }
    while (queue.length) yield queue.shift()!;
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}
