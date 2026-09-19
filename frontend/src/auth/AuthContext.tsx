/**
 * AuthContext — JWT authentication state for Nirmaan Drishti.
 *
 * Stores the JWT in localStorage so page refreshes keep the user logged in.
 * On mount, validates an existing token against the backend /auth/me endpoint.
 * On 401 from any API call, the token is cleared and the user is redirected to login.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

const rawApiUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8080/api';
const API_BASE = rawApiUrl.replace(/\/+$/, '');

const TOKEN_KEY = 'nd_auth_token';
const USER_KEY = 'nd_auth_user';

export type UserRole = 'impd_officer' | 'ministry_officer';

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  full_name: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const clearAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  // On mount: restore token from localStorage and validate it
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (!storedToken) {
      setIsLoading(false);
      return;
    }

    // Optimistically restore from storage
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser) as AuthUser);
        setToken(storedToken);
      } catch {
        clearAuth();
        setIsLoading(false);
        return;
      }
    }

    // Validate against backend
    fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${storedToken}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          clearAuth();
          return;
        }
        const data = (await res.json()) as AuthUser;
        setUser(data);
        setToken(storedToken);
        localStorage.setItem(USER_KEY, JSON.stringify(data));
      })
      .catch(() => {
        // Network error — keep existing token optimistically
        // (don't log out just because backend is temporarily unreachable)
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [clearAuth]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const cleanUsername = credentials.username.trim().toLowerCase();
    const cleanPassword = credentials.password.trim();

    // IMPD Officer Demo: ipmd001 / ipmd123 (Full Access)
    if (cleanUsername === 'ipmd001' && cleanPassword === 'ipmd123') {
      const demoUser: AuthUser = {
        id: 1,
        username: 'ipmd001',
        role: 'impd_officer',
        full_name: 'IMPD Senior Officer (Full Access)',
      };
      const demoToken = `demo_token_impd_${Date.now()}`;
      localStorage.setItem(TOKEN_KEY, demoToken);
      localStorage.setItem(USER_KEY, JSON.stringify(demoUser));
      setToken(demoToken);
      setUser(demoUser);

      fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
      }).catch(() => {});

      return;
    }

    // Ministry Officer Demo: goi001 / goi123 (Ministry Access — PDF Extractor Restricted)
    if (cleanUsername === 'goi001' && cleanPassword === 'goi123') {
      const demoUser: AuthUser = {
        id: 2,
        username: 'goi001',
        role: 'ministry_officer',
        full_name: 'Ministry Nodal Officer (Restricted)',
      };
      const demoToken = `demo_token_goi_${Date.now()}`;
      localStorage.setItem(TOKEN_KEY, demoToken);
      localStorage.setItem(USER_KEY, JSON.stringify(demoUser));
      setToken(demoToken);
      setUser(demoUser);

      fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
      }).catch(() => {});

      return;
    }

    throw new Error('Invalid username or password.');
  }, []);





  const logout = useCallback(() => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    if (currentToken) {
      // Fire-and-forget logout acknowledgement
      fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` },
      }).catch(() => {});
    }
    clearAuth();
  }, [clearAuth]);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
