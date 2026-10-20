// Parliament limits GET requests per minute. A short exponential retry alone
// cannot recover when that shared IP quota has been exhausted.
export function retryDelayMs(response, attempt, now = Date.now()) {
  const backoff = 700 * 2 ** (attempt - 1);
  const header = response?.headers?.get('retry-after')?.trim();
  let advertised = 0;
  if (header) {
    const seconds = Number(header);
    advertised = Number.isFinite(seconds) && seconds >= 0
      ? seconds * 1000
      : Math.max(0, Date.parse(header) - now) || 0;
  }
  return Math.max(backoff, response?.status === 429 ? 60_000 : 0, advertised);
}
