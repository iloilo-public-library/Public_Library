import type { SWRConfiguration } from "swr";

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (data && typeof data === "object") {
    const rec = data as Record<string, unknown>;
    if (typeof rec.error === "string" && rec.error) return rec.error;
    if (typeof rec.message === "string" && rec.message) return rec.message;
  }
  return fallback;
}

/**
 * Default SWR fetcher with cookie credentials for Flask session authentication.
 */
export async function apiFetcher<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // Non-JSON error body
    }
    throw new ApiError(extractErrorMessage(data, `Request failed (${res.status})`), res.status, data);
  }

  return res.json() as Promise<T>;
}

/**
 * POST/PUT/DELETE helper sending JSON or FormData with Flask session cookies.
 */
export async function apiMutate<T = unknown>(
  url: string,
  options: {
    method?: "POST" | "PUT" | "PATCH" | "DELETE";
    body?: Record<string, unknown> | FormData;
  } = {}
): Promise<T> {
  const { method = "POST", body } = options;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: isFormData
      ? { Accept: "application/json" }
      : {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(extractErrorMessage(data, `Request failed (${res.status})`), res.status, data);
  }

  return data as T;
}

/**
 * SWR caching presets (works alongside Vercel Edge / Next.js CDN caching).
 */
export const swrPublicConfig: SWRConfiguration = {
  fetcher: apiFetcher,
  revalidateOnFocus: false,
  dedupingInterval: 60_000,
  keepPreviousData: true,
};

export const swrPrivateConfig: SWRConfiguration = {
  fetcher: apiFetcher,
  revalidateOnFocus: true,
  dedupingInterval: 10_000,
  shouldRetryOnError: false,
};

/**
 * Bridge helper for calling legacy-flask JSON endpoints through the Next.js
 * `/flask/:path*` -> `http://localhost:5000/api/:path*` rewrite (temporary during migration).
 */
export async function flaskFetch<T = unknown>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const url = normalized.startsWith("/flask/") ? normalized : `/flask${normalized}`;
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new ApiError(
      extractErrorMessage(data, `Flask bridge request failed (${res.status})`),
      res.status,
      data
    );
  }

  return data as T;
}
