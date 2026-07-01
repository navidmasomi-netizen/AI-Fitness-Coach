import { create } from "zustand";
import { User } from "../types/user";
import { loginUser, registerUser } from "../api/auth";
import { setAuthToken } from "../api/client";
import { saveToken, getToken, removeToken, saveUser, getUser, removeUser } from "./authStorage";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; name?: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()((set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  login: async (email, password) => {
    set({ error: null });
    try {
      const { user, accessToken } = await loginUser({ email, password });
      setAuthToken(accessToken);
      await saveToken(accessToken);
      await saveUser(user);
      set({ user, accessToken, isAuthenticated: true });
    } catch (err: any) {
      set({ error: err.message || "Login failed" });
      throw err;
    }
  },

  register: async (input) => {
    set({ error: null });
    try {
      const { user, accessToken } = await registerUser(input);
      setAuthToken(accessToken);
      await saveToken(accessToken);
      await saveUser(user);
      set({ user, accessToken, isAuthenticated: true });
    } catch (err: any) {
      set({ error: err.message || "Registration failed" });
      throw err;
    }
  },

  logout: async () => {
    setAuthToken(null);
    await removeToken();
    await removeUser();
    set({ user: null, accessToken: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    set({ isLoading: true });
    try {
      const token = await getToken();
      const user = await getUser();
      if (token && user) {
        setAuthToken(token);
        set({ user, accessToken: token, isAuthenticated: true });
      } else {
        set({ user: null, accessToken: null, isAuthenticated: false });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
