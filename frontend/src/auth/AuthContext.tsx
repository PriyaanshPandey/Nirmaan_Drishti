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

export type UserRole = 'mospi_officer' | 'agency_officer' | 'ministry_officer' | 'public';

export interface AuthUser {
  id: number;
  username: string;
  role: UserRole;
  full_name: string;
  targetMinistry?: string;
  targetAgency?: string;
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
  setPublicAccess: () => void;
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

  const setPublicAccess = useCallback(() => {
    const publicUser: AuthUser = {
      id: 0,
      username: 'public_visitor',
      role: 'public',
      full_name: 'Public Guest Visitor',
    };
    setUser(publicUser);
    setToken('public_guest_token');
    localStorage.setItem(USER_KEY, JSON.stringify(publicUser));
    localStorage.setItem(TOKEN_KEY, 'public_guest_token');
  }, []);

  // On mount: restore token from localStorage and validate it
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);
    if (!storedToken) {
      setPublicAccess();
      setIsLoading(false);
      return;
    }

    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser) as AuthUser;
        setUser(parsed);
        setToken(storedToken);
      } catch {
        clearAuth();
        setIsLoading(false);
        return;
      }
    }

    if (storedToken.startsWith('demo_token_') || storedToken === 'public_guest_token') {
      setIsLoading(false);
      return;
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
      .catch(() => {})
      .finally(() => {
        setIsLoading(false);
      });
  }, [clearAuth]);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const cleanUsername = credentials.username.trim().toLowerCase();
    const cleanPassword = credentials.password.trim();

    // 1. Attempt official backend authentication
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername, password: cleanPassword }),
      });

      if (res.ok) {
        const data = await res.json();
        let targetMinistry: string | undefined = undefined;
        let targetAgency: string | undefined = undefined;

        if (data.role === 'agency_officer' || cleanUsername === 'agn001') {
          targetAgency = 'National Highways Authority of India (NHAI)';
        }
        if (data.role === 'ministry_officer' || cleanUsername === 'min001') {
          targetMinistry = 'Ministry of Road Transport and Highways';
        }

        const authUser: AuthUser = {
          id: data.role === 'mospi_officer' ? 1 : (data.role === 'agency_officer' ? 2 : 3),
          username: data.username || cleanUsername,
          role: (data.role || 'mospi_officer') as UserRole,
          full_name: data.full_name || 'MoSPI Officer',
          targetMinistry,
          targetAgency,
        };
        const tokenStr: string = data.access_token;
        localStorage.setItem(TOKEN_KEY, tokenStr);
        localStorage.setItem(USER_KEY, JSON.stringify(authUser));
        setToken(tokenStr);
        setUser(authUser);
        return;
      } else if (res.status === 401) {
        throw new Error('Invalid username or password.');
      }
    } catch (networkOrAuthErr: unknown) {
      if (networkOrAuthErr instanceof Error && networkOrAuthErr.message === 'Invalid username or password.') {
        throw networkOrAuthErr;
      }
      console.warn('Backend /auth/login unreachable, falling back to local demo authentication:', networkOrAuthErr);
    }

    // 2. Demo fallback
    if ((cleanUsername === 'mospi001' || cleanUsername === 'ipmd001') && (cleanPassword === 'mospi123' || cleanPassword === 'ipmd123')) {
      const demoUser: AuthUser = {
        id: 1,
        username: 'mospi001',
        role: 'mospi_officer',
        full_name: 'MoSPI Superadmin (Full Access)',
      };
      const demoToken = `demo_token_mospi_${Date.now()}`;
      localStorage.setItem(TOKEN_KEY, demoToken);
      localStorage.setItem(USER_KEY, JSON.stringify(demoUser));
      setToken(demoToken);
      setUser(demoUser);
      return;
    }

    if (cleanUsername === 'agn001' && cleanPassword === 'agn123') {
      const demoUser: AuthUser = {
        id: 2,
        username: 'agn001',
        role: 'agency_officer',
        full_name: 'Agency Nodal Officer (NHAI Focus)',
        targetAgency: 'National Highways Authority of India (NHAI)',
      };
      const demoToken = `demo_token_agn_${Date.now()}`;
      localStorage.setItem(TOKEN_KEY, demoToken);
      localStorage.setItem(USER_KEY, JSON.stringify(demoUser));
      setToken(demoToken);
      setUser(demoUser);
      return;
    }

    if ((cleanUsername === 'min001' || cleanUsername === 'goi001') && (cleanPassword === 'min123' || cleanPassword === 'goi123')) {
      const demoUser: AuthUser = {
        id: 3,
        username: 'min001',
        role: 'ministry_officer',
        full_name: 'Ministry Nodal Officer (MoRTH Focus)',
        targetMinistry: 'Ministry of Road Transport and Highways',
      };
      const demoToken = `demo_token_min_${Date.now()}`;
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
    if (currentToken && !currentToken.startsWith('demo_token_') && currentToken !== 'public_guest_token') {
      // Fire-and-forget logout acknowledgement
      fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentToken}` },
      }).catch(() => {});
    }
    setPublicAccess();
  }, [setPublicAccess]);

  const value: AuthContextType = {
    user,
    token,
    isAuthenticated: !!user && !!token,
    isLoading,
    login,
    logout,
    setPublicAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
