import type { BuildPreview } from './types';

export const buildPreview: BuildPreview = async ({ files }) => {
  try {
    const response = await fetch('/api/preview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ files }),
    });

    const data = (await response.json()) as { html?: string | null; error?: string | null };
    if (!response.ok || !data.html) {
      return {
        htmlUrl: null,
        error: data.error ?? `Preview build failed (${response.status})`,
      };
    }

    const blob = new Blob([data.html], { type: 'text/html' });
    return {
      htmlUrl: URL.createObjectURL(blob),
      error: null,
    };
  } catch (err) {
    return {
      htmlUrl: null,
      error: err instanceof Error ? err.message : 'Preview request failed',
    };
  }
};
