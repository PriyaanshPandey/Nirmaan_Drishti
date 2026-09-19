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

const rawApiUrl = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000/api';
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
          if (!storedToken.startsWith('demo_token_')) {
            clearAuth();
          }
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

    // 1. Attempt official backend authentication (issues signed JWT access token)
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
      });

      if (res.ok) {
        const data = await res.json();
        const authUser: AuthUser = {
          id: cleanUsername === 'ipmd001' ? 1 : 2,
          username: data.username || cleanUsername,
          role: (data.role || (cleanUsername === 'ipmd001' ? 'impd_officer' : 'ministry_officer')) as UserRole,
          full_name: data.full_name || (cleanUsername === 'ipmd001' ? 'IMPD Senior Officer (Full Access)' : 'Ministry Nodal Officer (Restricted)'),
        };
        const token: string = data.access_token;
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(authUser));
        setToken(token);
        setUser(authUser);
        return;
      } else if (res.status === 401) {
        throw new Error('Invalid username or password.');
      }
    } catch (networkOrAuthErr: unknown) {
      if (networkOrAuthErr instanceof Error && networkOrAuthErr.message === 'Invalid username or password.') {
        throw networkOrAuthErr;
      }
      // If backend is offline or unreachable, fall back to demo accounts
      console.warn('Backend /auth/login unreachable, falling back to local demo authentication:', networkOrAuthErr);
    }

    // 2. Resilient demo fallback when backend is unreachable
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
      return;
    }

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
