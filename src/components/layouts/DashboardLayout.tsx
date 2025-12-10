import { useEffect } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types';

interface DashboardLayoutProps {
  requiredRole: UserRole;
}

export function DashboardLayout({ requiredRole }: DashboardLayoutProps) {
  const { user, isLoading, isAuthenticated } = useAuth();

  // Add dark class to body for dashboard styling
  useEffect(() => {
    document.body.classList.add('dark');
    return () => document.body.classList.remove('dark');
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-10 h-10 mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={`/login/${requiredRole}`} replace />;
  }

  if (user?.role !== requiredRole) {
    return <Navigate to={`/${user?.role}`} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Subtle grid pattern */}
      <div className="fixed inset-0 bg-grid pointer-events-none" />
      
      <Sidebar />
      
      <main className="ml-64 min-h-screen relative">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="p-8"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
