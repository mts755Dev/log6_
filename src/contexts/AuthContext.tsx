import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { User as SupabaseUser, Session } from '@supabase/supabase-js';
import type { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
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
      console.log('📝 User ID:', supabaseUser.id);
      
      // Check if operation was aborted
      if (signal?.aborted) {
        console.log('⚠️ Operation aborted');
        return null;
      }

      console.log('🔍 Fetching profile for ID:', supabaseUser.id);
      
      // Direct query without timeout - let's see the actual error
      const { data: profile, error, status, statusText } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', supabaseUser.id)
        .single();
      
      // Log EVERYTHING for debugging
      console.log('📊 Query response:', {
        profile,
        error,
        status,
        statusText,
        hasProfile: !!profile,
        profileId: profile?.id,
        profileEmail: profile?.email,
        profileRole: profile?.role,
        profileIsActive: profile?.is_active,
      });

      if (error) {
        console.error('❌ Supabase error:', error.message, error.code, error.details);
        
        // If profile not found, try to get ALL profiles to debug
        console.log('🔍 Debugging: Fetching all profiles...');
        const { data: allProfiles, error: allError } = await supabase
          .from('profiles')
          .select('id, email, role, is_active')
          .limit(10);
        
        console.log('📋 All profiles in database:', allProfiles);
        if (allError) {
          console.error('❌ Error fetching all profiles:', allError);
        }
        
        return null;
      }

      if (!profile) {
        console.error('❌ Profile is null for user:', supabaseUser.email);
        return null;
      }

      // Check is_active - but be lenient for now
      if (profile.is_active === false) {
        console.error('❌ Profile is inactive for user:', supabaseUser.email);
        return null;
      }

      // Check company_id for installers
      if (profile.role === 'installer' && !profile.company_id) {
        console.error('❌ Installer profile requires company_id:', supabaseUser.email);
        return null;
      }
      
      console.log('✅ Profile found:', profile.email, 'role:', profile.role);
      
      // Map to our User type
      const mappedUser = {
        id: profile.id,
        email: profile.email,
        name: profile.full_name || profile.email.split('@')[0],
        role: profile.role as UserRole,
        companyId: profile.company_id,
        phone: profile.phone,
        avatar: profile.avatar_url || undefined,
        isActive: profile.is_active,
        createdAt: profile.created_at,
        lastLogin: new Date().toISOString(),
      };
      
      console.log('✅ User mapped successfully:', mappedUser.email, 'role:', mappedUser.role);
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

  // Helper function to fetch profile with retry on abort
  const fetchProfileWithRetry = async (userId: string, maxRetries = 3): Promise<any> => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔍 Fetching profile (attempt ${attempt}/${maxRetries})...`);
      
      // Add a small delay before each attempt to let any pending aborts settle
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .single();
        
        // If no error or error is not an abort, return the result
        if (!profileError || !profileError.message?.includes('abort')) {
          return { profile, profileError };
        }
        
        console.log(`⚠️ Attempt ${attempt} aborted, retrying...`);
      } catch (err: any) {
        if (!err?.message?.includes('abort') && !err?.name?.includes('Abort')) {
          throw err;
        }
        console.log(`⚠️ Attempt ${attempt} aborted, retrying...`);
      }
    }
    
    return { profile: null, profileError: { message: 'Max retries exceeded' } };
  };

  // Initialize auth state on mount
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user && mounted) {
          console.log('🔄 Existing session found, fetching profile...');
          
          // Small delay to avoid race conditions with React StrictMode
          await new Promise(resolve => setTimeout(resolve, 100));
          
          if (!mounted) return;
          
          // Fetch profile with retry
          const { profile, profileError } = await fetchProfileWithRetry(session.user.id);
          
          if (!profileError && profile && profile.is_active && mounted) {
            const mappedUser: User = {
              id: profile.id,
              email: profile.email,
              name: profile.full_name || profile.email.split('@')[0],
              role: profile.role as UserRole,
              companyId: profile.company_id,
              phone: profile.phone,
              avatar: profile.avatar_url || undefined,
              isActive: profile.is_active,
              createdAt: profile.created_at,
              lastLogin: new Date().toISOString(),
            };
            setUser(mappedUser);
            console.log('✅ Session restored for:', mappedUser.email);
          }
        }
      } catch (error: any) {
        // Ignore abort errors - they're expected in StrictMode
        if (!error?.message?.includes('abort') && error?.name !== 'AbortError') {
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
        if (!mounted) return;

        console.log('🔄 Auth state change:', event);

        // SKIP SIGNED_IN - login() function handles this directly now
        // This prevents the AbortController race condition
        if (event === 'SIGNED_IN') {
          console.log('📝 SIGNED_IN event - login() will handle profile fetch');
          // Don't do anything here - login() sets the user directly
          return;
        }
        
        if (event === 'SIGNED_OUT') {
          if (mounted) {
            console.log('👋 User signed out');
            setUser(null);
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('🔄 Token refreshed, keeping existing user session');
          // Don't re-fetch profile on token refresh - just keep existing user
        }
      }
    );

    return () => {
      mounted = false;
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
        
        // Wait a moment for any pending operations to settle
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Fetch profile with retry logic
        const { profile, profileError } = await fetchProfileWithRetry(data.user.id);
        
        console.log('📊 Profile fetch result:', { profile, profileError });
        
        if (profileError) {
          console.error('❌ Profile fetch error:', profileError.message);
          return false;
        }
        
        if (!profile) {
          console.error('❌ No profile found for user');
          return false;
        }
        
        if (!profile.is_active) {
          console.error('❌ Profile is inactive');
          return false;
        }
        
        // Check role matches expected
        if (profile.role !== expectedRole) {
          console.error('❌ Role mismatch. Expected:', expectedRole, 'Got:', profile.role);
          return false;
        }
        
        // Check company_id for installers
        if (profile.role === 'installer' && !profile.company_id) {
          console.error('❌ Installer must have company_id');
          return false;
        }
        
        // Map profile to user
        const mappedUser: User = {
          id: profile.id,
          email: profile.email,
          name: profile.full_name || profile.email.split('@')[0],
          role: profile.role as UserRole,
          companyId: profile.company_id,
          phone: profile.phone,
          avatar: profile.avatar_url || undefined,
          isActive: profile.is_active,
          createdAt: profile.created_at,
          lastLogin: new Date().toISOString(),
        };
        
        console.log('✅ User mapped:', mappedUser.email, 'role:', mappedUser.role);
        setUser(mappedUser);
        
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
        setUser,
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