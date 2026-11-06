import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiRequest } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('bl_access_token'));
  const [isLoading, setIsLoading] = useState(true);

  // Check current session on mount
  useEffect(() => {
    async function loadUser() {
      const storedToken = localStorage.getItem('bl_access_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await apiRequest('/auth/me');
        if (res.success && res.data?.user) {
          setUser(res.data.user);
        } else {
          logout();
        }
      } catch (err) {
        console.warn('Session verification failed:', err.message);
        logout();
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (email, password) => {
    const res = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    });

    if (res.success && res.data) {
      const { user: userData, customer: custData, tokens } = res.data;
      setUser(userData);
      setCustomer(custData);
      setToken(tokens.accessToken);
      localStorage.setItem('bl_access_token', tokens.accessToken);
      localStorage.setItem('bl_refresh_token', tokens.refreshToken);
      return userData;
    }
  };

  const signup = async ({ email, password, firstName, lastName, companyName }) => {
    const res = await apiRequest('/auth/signup', {
      method: 'POST',
      body: { email, password, firstName, lastName, companyName },
    });

    if (res.success && res.data) {
      const { user: userData, customer: custData, tokens } = res.data;
      setUser(userData);
      setCustomer(custData);
      setToken(tokens.accessToken);
      localStorage.setItem('bl_access_token', tokens.accessToken);
      localStorage.setItem('bl_refresh_token', tokens.refreshToken);
      return userData;
    }
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('bl_refresh_token');
    if (refreshToken) {
      try {
        await apiRequest('/auth/logout', {
          method: 'POST',
          body: { refreshToken },
        });
      } catch {
        // Ignore logout errors
      }
    }

    localStorage.removeItem('bl_access_token');
    localStorage.removeItem('bl_refresh_token');
    setUser(null);
    setCustomer(null);
    setToken(null);
  };

  const value = {
    user,
    customer,
    token,
    isLoading,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff',
    isCustomer: user?.role === 'customer',
    login,
    signup,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
