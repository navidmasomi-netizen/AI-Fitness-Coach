import { apiRequest } from "./client";
import { User } from "../types/user";

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export function registerUser(params: { email: string; name?: string; password: string }): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/users", { method: "POST", body: params });
}

export function loginUser(params: { email: string; password: string }): Promise<AuthResponse> {
  return apiRequest<AuthResponse>("/users/login", { method: "POST", body: params });
}
