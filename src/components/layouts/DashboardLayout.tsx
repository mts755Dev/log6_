import { useEffect, useRef, useState } from 'react';
import { Outlet, Navigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { Logo } from '../ui/Logo';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import { useSidebarWidth } from '../../hooks/useSidebarWidth';
import type { UserRole } from '../../types';

interface DashboardLayoutProps {
  requiredRole: UserRole;
}

// Helper to convert hex to RGB values
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

export function DashboardLayout({ requiredRole }: DashboardLayoutProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { getCompany } = useData();
  const toast = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const {
    width: sidebarWidth,
    expandedWidth,
    isCollapsed,
    toggleCollapse,
  } = useSidebarWidth();
  const mainRef = useRef<HTMLElement>(null);
  const location = useLocation();

  const company = user?.companyId ? getCompany(user.companyId) : null;

  // Lock dashboard to viewport height so nested min-h-screen does not create phantom scrollbars
  useEffect(() => {
    document.documentElement.classList.add('dashboard-shell');
    document.body.classList.add('dark', 'dashboard-shell');
    return () => {
      document.documentElement.classList.remove('dashboard-shell');
      document.body.classList.remove('dark', 'dashboard-shell');
    };
  }, []);

  // Only show the main scrollbar when content actually overflows the viewport
  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;

    const syncOverflow = () => {
      requestAnimationFrame(() => {
        const hasOverflow = main.scrollHeight > main.clientHeight + 1;
        main.style.overflowY = hasOverflow ? 'auto' : 'hidden';
      });
    };

    syncOverflow();
    const animationTimer = window.setTimeout(syncOverflow, 350);

    const resizeObserver = new ResizeObserver(syncOverflow);
    resizeObserver.observe(main);

    const mutationObserver = new MutationObserver(syncOverflow);
    mutationObserver.observe(main, { childList: true, subtree: true, attributes: true });

    window.addEventListener('resize', syncOverflow);
    return () => {
      window.clearTimeout(animationTimer);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener('resize', syncOverflow);
    };
  }, [user?.id, location.pathname]);

  // Apply brand color as CSS custom properties for installer role
  const resolvedBrandColor = (company?.brandColor && company.brandColor !== '#0c8cf1') ? company.brandColor : '#eab308';
  
  useEffect(() => {
    if (user?.role === 'installer') {
      const rgb = hexToRgb(resolvedBrandColor);
      if (rgb) {
        document.documentElement.style.setProperty('--brand-color', resolvedBrandColor);
        document.documentElement.style.setProperty('--brand-color-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      }
    }
    return () => {
      document.documentElement.style.removeProperty('--brand-color');
      document.documentElement.style.removeProperty('--brand-color-rgb');
    };
  }, [user?.role, resolvedBrandColor]);

  useEffect(() => {
    const message = (location.state as { message?: string } | null)?.message;
    if (!message) return;
    toast.success(message);
    window.history.replaceState({}, document.title);
  }, [location.state, toast]);

  // Close sidebar on window resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(true);
      } else {
        setSidebarOpen(false);
      }
    };

    // Set initial state
    handleResize();

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
    <div className="fixed inset-0 overflow-hidden bg-slate-950">
      {/* Subtle grid pattern */}
      <div className="fixed inset-0 bg-grid pointer-events-none" />
      
      {/* Mobile Header */}
      <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-slate-925 border-b border-slate-800 z-30 px-4 flex items-center justify-between">
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 -ml-2 text-slate-400 hover:text-white transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        <Link to="/">
          <Logo size="sm" variant="dark" />
        </Link>
        <div className="w-10" /> {/* Spacer for centering */}
      </header>

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        width={sidebarWidth}
        expandedWidth={expandedWidth}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
      />
      
      <main
        ref={mainRef}
        className="app-scrollbar dashboard-main absolute inset-0 overflow-x-hidden overflow-y-hidden pt-16 lg:pt-0 lg:pl-[var(--sidebar-width)]"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 lg:pt-8 pb-4 sm:pb-5 lg:pb-6"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  );
}
