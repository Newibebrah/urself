import { apiUrl } from '../../lib/api-base';
import type { GenerateChunk, GenerateRequest, GenerationStream } from './types';

export async function* streamGeneration(request: GenerateRequest): GenerationStream {
  const response = await fetch(apiUrl('/api/generate'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok || !response.body) {
    let errText = `Generation failed (${response.status})`;
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload.error) errText = payload.error;
    } catch {
      // ignore non-json error body
    }
    yield { type: 'error', error: errText };
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);
      if (line.length > 0) {
        try {
          yield JSON.parse(line) as GenerateChunk;
        } catch {
          // ignore partial malformed line
        }
      }
      newlineIndex = buffer.indexOf('\n');
    }
  }

  const tail = buffer.trim();
  if (tail.length > 0) {
    try {
      yield JSON.parse(tail) as GenerateChunk;
    } catch {
      // ignore trailing malformed line
    }
  }
}
