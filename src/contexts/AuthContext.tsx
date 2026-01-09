import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import type { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Convert Supabase user + profile to our User type
  const mapSupabaseUserToUser = async (
    supabaseUser: SupabaseUser,
    session: Session,
    signal?: AbortSignal
  ): Promise<User | null> => {
    try {
      console.log('📝 Mapping user:', supabaseUser.email);
      
      // Check if operation was aborted
      if (signal?.aborted) {
        console.log('⚠️ Operation aborted');
        return null;
      }

      // Fetch user profile from profiles table with timeout
      console.log('🔍 Fetching profile for:', supabaseUser.id);
      
      const fetchProfileWithTimeout = Promise.race([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', supabaseUser.id)
          .single(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
        )
      ]);
      
      const { data: profile, error } = await fetchProfileWithTimeout as any;

      if (error || !profile) {
        // Ignore abort errors
        if (error && error.message?.includes('abort')) {
          console.log('⚠️ Profile fetch aborted');
          return null;
        }
        
        console.warn('⚠️ Could not fetch profile from DB, using user metadata instead:', error);
        
        // Fallback: use user metadata if profile fetch fails
        if (supabaseUser.user_metadata) {
          console.log('✅ Using user metadata as fallback');
          return {
            id: supabaseUser.id,
            email: supabaseUser.email!,
            name: supabaseUser.user_metadata.full_name || supabaseUser.email!.split('@')[0],
            role: supabaseUser.user_metadata.role as UserRole || 'installer',
            companyId: null,
            phone: supabaseUser.user_metadata.phone || null,
            isActive: true,
            createdAt: supabaseUser.created_at,
            lastLogin: new Date().toISOString(),
          };
        }
        
        console.error('❌ Error fetching profile and no metadata available:', error);
        return null;
      }

      console.log('✅ Profile found:', profile.email, 'role:', profile.role);

      // Check if user is active
      if (!profile.is_active) {
        console.warn('⚠️ User account is not active');
        return null;
      }

      // Map to our User type
      const mappedUser = {
        id: profile.id,
        email: profile.email,
        name: profile.full_name || profile.email.split('@')[0],
        role: profile.role as UserRole,
        companyId: profile.company_id,
        phone: profile.phone,
        isActive: profile.is_active,
        createdAt: profile.created_at,
        lastLogin: new Date().toISOString(),
      };
      
      console.log('✅ User mapped successfully:', mappedUser.email);
      return mappedUser;
    } catch (error: any) {
      // Ignore abort errors
      if (error?.name === 'AbortError' || error?.message?.includes('abort')) {
        console.log('⚠️ Operation aborted');
        return null;
      }
      console.error('❌ Error mapping user:', error);
      return null;
    }
  };

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;
    const abortController = new AbortController();

    const initializeAuth = async () => {
      try {
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && mounted && !abortController.signal.aborted) {
          const mappedUser = await mapSupabaseUserToUser(
            session.user, 
            session,
            abortController.signal
          );
          if (mappedUser && mounted) {
            setUser(mappedUser);
          }
        }
      } catch (error: any) {
        // Ignore abort errors
        if (error?.name !== 'AbortError' && !error?.message?.includes('abort')) {
          console.error('Error initializing auth:', error);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted || abortController.signal.aborted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          const mappedUser = await mapSupabaseUserToUser(
            session.user, 
            session,
            abortController.signal
          );
          if (mappedUser && mounted) {
            setUser(mappedUser);
          }
        } else if (event === 'SIGNED_OUT') {
          if (mounted) {
            setUser(null);
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          const mappedUser = await mapSupabaseUserToUser(
            session.user, 
            session,
            abortController.signal
          );
          if (mappedUser && mounted) {
            setUser(mappedUser);
          }
        }
      }
    );

    return () => {
      mounted = false;
      abortController.abort();
      subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string, expectedRole: UserRole): Promise<boolean> => {
      try {
        console.log('🔐 Starting login for:', email, 'as', expectedRole);
        
        // Sign in with Supabase
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          console.error('❌ Login error:', error.message);
          return false;
        }

        if (!data.user || !data.session) {
          console.error('❌ No user or session returned');
          return false;
        }

        console.log('✅ Login successful, user:', data.user.email);
        
        // The onAuthStateChange listener will handle setting the user
        // Just wait a bit for it to process
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return true;
      } catch (error) {
        console.error('❌ Unexpected login error:', error);
        return false;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
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