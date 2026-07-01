import { API_BASE_URL } from "../config/env";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body } = options;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
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

  let json: any;
  try {
    json = await response.json();
  } catch {
    throw new ApiError("Invalid JSON response from server", response.status);
  }

  if (!response.ok || json.success === false) {
    throw new ApiError(json.message || "Request failed", response.status);
  }

  return json.data as T;
}
