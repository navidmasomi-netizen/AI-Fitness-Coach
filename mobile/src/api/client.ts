import { API_BASE_URL } from "../config/env";

export class ApiError extends Error {
  status: number;
  code: string | null;
  constructor(message: string, status: number, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let authToken: string | null = null;
type UnauthorizedHandler = () => void | Promise<void>;
let unauthorizedHandler: UnauthorizedHandler | null = null;
let unauthorizedInvalidation: Promise<void> | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

async function invalidateUnauthorizedAuth(requestToken: string | null) {
  if (!requestToken || requestToken !== authToken || !unauthorizedHandler) return;

  if (!unauthorizedInvalidation) {
    unauthorizedInvalidation = Promise.resolve(unauthorizedHandler()).finally(() => {
      unauthorizedInvalidation = null;
    });
  }

  try {
    await unauthorizedInvalidation;
  } catch {
    // The auth store clears in-memory state before secure-storage cleanup, so a
    // storage cleanup failure must not turn a definitive 401 into a retry loop.
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers: extraHeaders = {} } = options;
  const requestToken = authToken;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (requestToken) {
    headers["Authorization"] = `Bearer ${requestToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new ApiError("Network request failed. Is the backend reachable?", 0);
  }

  if (response.status === 401) {
    await invalidateUnauthorizedAuth(requestToken);
  }

  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new ApiError("Invalid JSON response from server", response.status);
  }

  if (!response.ok || json.success === false) {
    throw new ApiError(json.message || "Request failed", response.status, json.code ?? null);
  }

  return json.data as T;
}
