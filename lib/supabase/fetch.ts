const DEFAULT_SUPABASE_FETCH_TIMEOUT_MS = 8_000;

function getSupabaseFetchTimeoutMs() {
  const configured = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_SUPABASE_FETCH_TIMEOUT_MS;
}

export async function fetchWithSupabaseTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
) {
  const timeoutSignal = AbortSignal.timeout(getSupabaseFetchTimeoutMs());
  const signal = init?.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;

  return fetch(input, { ...init, signal });
}
