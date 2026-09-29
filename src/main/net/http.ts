import { ProviderError, type ProviderErrorCode } from '@shared/types/domain';

export interface HttpOptions {
  provider: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  /** Object bodies are JSON encoded; URLSearchParams are form encoded. */
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export function codeForStatus(status: number): ProviderErrorCode {
  if (status === 401 || status === 403) return 'auth';
  if (status === 404) return 'not-found';
  if (status === 429 || status === 456) return 'rate-limit';
  return 'bad-response';
}

export function parseRetryAfter(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds) * 1000;
  const date = Date.parse(header);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}

/** Fetches and returns the raw Response for 2xx; throws a ProviderError otherwise (never leaks stack traces to UI). */
export async function httpRequest(url: string, options: HttpOptions): Promise<Response> {
  const { provider, method = 'GET', headers = {}, body, signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const doFetch = options.fetchImpl ?? fetch;

  const init: RequestInit = { method, headers: { ...headers } };
  if (body instanceof URLSearchParams) {
    init.body = body;
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    (init.headers as Record<string, string>)['Content-Type'] ??= 'application/json';
  }
  const timeout = AbortSignal.timeout(timeoutMs);
  init.signal = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let response: Response;
  try {
    response = await doFetch(url, init);
  } catch (error) {
    if (signal?.aborted) throw new ProviderError(provider, 'aborted', 'Request cancelled', undefined, { cause: error });
    const timedOut = timeout.aborted;
    throw new ProviderError(
      provider,
      'network',
      timedOut ? `${provider} timed out` : `Could not reach ${provider}`,
      undefined,
      { cause: error },
    );
  }

  if (!response.ok) {
    const retryAfterMs = parseRetryAfter(response.headers.get('retry-after'));
    throw new ProviderError(
      provider,
      codeForStatus(response.status),
      `${provider} responded with HTTP ${response.status}`,
      retryAfterMs,
      { status: response.status },
    );
  }
  return response;
}

export async function httpJson<T>(url: string, options: HttpOptions): Promise<T> {
  const response = await httpRequest(url, options);
  try {
    return (await response.json()) as T;
  } catch (error) {
    throw new ProviderError(options.provider, 'bad-response', `${options.provider} returned invalid JSON`, undefined, {
      cause: error,
    });
  }
}

/** Response bodies for 204 etc. */
export async function httpJsonOrNull<T>(url: string, options: HttpOptions): Promise<T | null> {
  const response = await httpRequest(url, options);
  if (response.status === 204) return null;
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch (error) {
    throw new ProviderError(options.provider, 'bad-response', `${options.provider} returned invalid JSON`, undefined, {
      cause: error,
    });
  }
}
