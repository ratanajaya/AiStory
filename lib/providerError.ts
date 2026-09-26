// Provider errors can contain request headers, prompts, and raw response bodies.
// Only this allowlisted diagnostic crosses the API/log boundary.
export function safeProviderError(error: unknown): Error {
  const candidate = error as { statusCode?: number; status?: number } | null;
  const status = candidate?.statusCode ?? candidate?.status;
  const message = status === 401 || status === 403
    ? 'The provider rejected the API key. Replace it in Use your own API key and try again.'
    : status === 402 || status === 429
      ? 'The provider has reached a billing or usage limit. Check your provider credits and limits, then try again.'
      : 'Generation failed. Check your provider API key, billing, model access, and usage limits, then try again.';
  return new Error(message);
}
