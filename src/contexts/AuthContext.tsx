import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { STORAGE_KEYS, getItem, setItem, getCollection } from '../services/storage';
import { initializeSeedData } from '../services/seedData';
import type { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize seed data on first load
    initializeSeedData();

    // Check for existing session
    const savedUser = getItem<User>(STORAGE_KEYS.CURRENT_USER);
    if (savedUser) {
      setUser(savedUser);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, _password: string, expectedRole: UserRole): Promise<boolean> => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500));

    const users = getCollection<User>(STORAGE_KEYS.USERS);
    const foundUser = users.find(
      (u) => u.email.toLowerCase() === email.toLowerCase() && u.role === expectedRole
    );

    if (foundUser && foundUser.isActive) {
      const updatedUser = { ...foundUser, lastLogin: new Date().toISOString() };
      setUser(updatedUser);
      setItem(STORAGE_KEYS.CURRENT_USER, updatedUser);
      return true;
    }

    return false;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

