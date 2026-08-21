export const API_BASE_URL =
  import.meta.env?.VITE_API_URL ?? "http://localhost:3000/api";

export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; retryAfterMs?: number };

async function handleResponse<T>(res: Response): Promise<ApiResponse<T>> {
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const retryAfterMs = parseRetryAfter(res.headers.get("Retry-After"));
    return {
      ok: false,
      status: res.status,
      error: text || res.statusText,
      ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    };
  }

  const data = await res.json().catch(() => null);
  return { ok: true, data: data as T };
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      credentials: "include",
    });
    return handleResponse<T>(res);
  } catch (error) {
    return { ok: false, status: 0, error: getNetworkError(error) };
  }
}

export async function apiPost<TBody = unknown, T = unknown>(
  path: string,
  body?: TBody,
): Promise<ApiResponse<T>> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  } catch (error) {
    return { ok: false, status: 0, error: getNetworkError(error) };
  }
}

export async function apiPut<TBody = unknown, T = unknown>(
  path: string,
  body?: TBody,
): Promise<ApiResponse<T>> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  } catch (error) {
    return { ok: false, status: 0, error: getNetworkError(error) };
  }
}

export async function apiPatch<TBody = unknown, T = unknown>(
  path: string,
  body?: TBody,
): Promise<ApiResponse<T>> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
  } catch (error) {
    return { ok: false, status: 0, error: getNetworkError(error) };
  }
}

export async function apiDelete<T>(path: string): Promise<ApiResponse<T>> {
  try {
    const res = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: "DELETE",
      credentials: "include",
    });
    return handleResponse<T>(res);
  } catch (error) {
    return { ok: false, status: 0, error: getNetworkError(error) };
  }
}

function getNetworkError(error: unknown): string {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "Request timed out";
  }
  return error instanceof Error ? error.message : "Network request failed";
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = init.signal;
  const abortFromExternal = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromExternal);
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1_000);
  }
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt)
    ? Math.max(0, retryAt - Date.now())
    : undefined;
}
