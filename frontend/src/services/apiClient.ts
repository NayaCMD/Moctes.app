const BASE_URL = import.meta.env?.VITE_API_URL ?? "http://localhost:3000/api";

export type ApiResponse<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

async function handleResponse<T>(res: Response): Promise<ApiResponse<T>> {
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, status: res.status, error: text || res.statusText };
    }

    const data = await res.json().catch(() => null);
    return { ok: true, data: data as T };
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
    const res = await fetch(`${BASE_URL}${path}`, { credentials: "include" });
    return handleResponse<T>(res);
}

export async function apiPost<TBody = unknown, T = unknown>(
    path: string,
    body?: TBody,
): Promise<ApiResponse<T>> {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
}

export async function apiPut<TBody = unknown, T = unknown>(
    path: string,
    body?: TBody,
): Promise<ApiResponse<T>> {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
    });
    return handleResponse<T>(res);
}

export async function apiDelete<T>(path: string): Promise<ApiResponse<T>> {
    const res = await fetch(`${BASE_URL}${path}`, {
        method: "DELETE",
        credentials: "include",
    });
    return handleResponse<T>(res);
}
