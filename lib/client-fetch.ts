/**
 * Utility to safely parse response from API routes in client components.
 * Prevents "Failed to execute 'json' on 'Response': Unexpected end of JSON input".
 * Surfaces exact HTTP status code and server error messages.
 */
export async function parseResponse<T = any>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text || !text.trim()) {
    if (!res.ok) {
      throw new Error(`Server Error (${res.status}): ${res.statusText || 'No response returned from server'}`);
    }
    return {} as T;
  }

  try {
    const data = JSON.parse(text);
    if (!res.ok) {
      throw new Error(data.error || data.message || `Server returned error (${res.status})`);
    }
    return data as T;
  } catch (err: any) {
    if (err.message && !err.message.includes('JSON')) {
      throw err;
    }
    if (!res.ok) {
      const snippet = text.replace(/<[^>]*>?/gm, '').trim().slice(0, 150);
      throw new Error(`Server Error (${res.status}): ${snippet || res.statusText || 'Internal Server Error'}`);
    }
    throw new Error('Invalid JSON received from server.');
  }
}
