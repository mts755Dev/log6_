import { NavLink, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  Users,
  Building2,
  Package,
  ClipboardCheck,
  Award,
  Settings,
  LogOut,
  ChevronRight,
  Calculator,
  FolderOpen,
  Shield,
  X,
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../utils/cn';
import type { UserRole } from '../../types';

interface NavItem {
  label: string;
  path: string;
  icon: React.ReactNode;
  badge?: number;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const navigationConfig: Record<UserRole, NavItem[]> = {
  admin: [
    { label: 'Dashboard', path: '/admin', icon: <LayoutDashboard className="sidebar-icon" /> },
    { label: 'Companies', path: '/admin/companies', icon: <Building2 className="sidebar-icon" /> },
    { label: 'Users', path: '/admin/users', icon: <Users className="sidebar-icon" /> },
    { label: 'Products', path: '/admin/products', icon: <Package className="sidebar-icon" /> },
    { label: 'All Quotes', path: '/admin/quotes', icon: <FileText className="sidebar-icon" /> },
    { label: 'Submissions', path: '/admin/submissions', icon: <ClipboardCheck className="sidebar-icon" /> },
    { label: 'Certificates', path: '/admin/certificates', icon: <Award className="sidebar-icon" /> },
    { label: 'Settings', path: '/admin/settings', icon: <Settings className="sidebar-icon" /> },
  ],
  installer: [
    { label: 'Dashboard', path: '/installer', icon: <LayoutDashboard className="sidebar-icon" /> },
    { label: 'New Quote', path: '/installer/quotes/new', icon: <Calculator className="sidebar-icon" /> },
    { label: 'My Quotes', path: '/installer/quotes', icon: <FileText className="sidebar-icon" /> },
    { label: 'Proposals', path: '/installer/proposals', icon: <FolderOpen className="sidebar-icon" /> },
    { label: 'Commissions', path: '/installer/commissions', icon: <ClipboardCheck className="sidebar-icon" /> },
    { label: 'MIS-3002', path: '/installer/mis-documents', icon: <Shield className="sidebar-icon" /> },
    { label: 'Products', path: '/installer/products', icon: <Package className="sidebar-icon" /> },
    { label: 'Settings', path: '/installer/settings', icon: <Settings className="sidebar-icon" /> },
  ],
  assessor: [
    { label: 'Dashboard', path: '/assessor', icon: <LayoutDashboard className="sidebar-icon" /> },
    { label: 'Pending Reviews', path: '/assessor/pending', icon: <ClipboardCheck className="sidebar-icon" /> },
    { label: 'Approved', path: '/assessor/approved', icon: <Award className="sidebar-icon" /> },
    { label: 'Rejected', path: '/assessor/rejected', icon: <FileText className="sidebar-icon" /> },
    { label: 'Certificates', path: '/assessor/certificates', icon: <Award className="sidebar-icon" /> },
    { label: 'Settings', path: '/assessor/settings', icon: <Settings className="sidebar-icon" /> },
  ],
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const navigation = navigationConfig[user.role];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleNavClick = () => {
    // Close sidebar on mobile when navigating
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  const roleLabels: Record<UserRole, string> = {
    admin: 'Administrator',
    installer: 'Installer',
    assessor: 'Umbrella Assessor',
  };

  const roleColors: Record<UserRole, string> = {
    admin: 'bg-primary-500/20 text-primary-400',
    installer: 'bg-energy-500/20 text-energy-400',
    assessor: 'bg-solar-500/20 text-solar-400',
  };

  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -280 }}
        animate={{ x: isOpen ? 0 : -280 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className={cn(
          "fixed left-0 top-0 h-screen w-64 bg-slate-925 border-r border-slate-800 flex flex-col z-50",
          "lg:translate-x-0 lg:z-40"
        )}
      >
        {/* Logo */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <Link to="/" onClick={handleNavClick}>
            <Logo size="md" variant="light" />
          </Link>
          {/* Mobile close button */}
          <button
            onClick={onClose}
            className="lg:hidden p-2 -mr-2 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Info */}
        <div className="px-4 py-4 border-b border-slate-800">
          <div className="flex items-center gap-3 px-2">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-sm",
              roleColors[user.role]
            )}>
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-500">{roleLabels[user.role]}</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <ul className="space-y-1">
            {navigation.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  end={item.path === '/admin' || item.path === '/installer' || item.path === '/assessor' || item.path === '/installer/quotes'}
                  onClick={handleNavClick}
                  className={({ isActive }) =>
                    cn('sidebar-link group', isActive && 'sidebar-link-active')
                  }
                >
                  {item.icon}
                  <span className="flex-1 font-medium">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="px-2 py-0.5 text-xs bg-primary-600 text-white rounded-full font-semibold">
                      {item.badge}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-50 transition-opacity" />
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Company Info (for installers) */}
        {user.role === 'installer' && (
          <div className="px-5 py-3 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
              <Building2 className="w-3.5 h-3.5" />
              <span>Company</span>
            </div>
            <p className="text-sm text-slate-300 truncate font-medium">{user.companyName}</p>
          </div>
        )}

        {/* Logout */}
        <div className="p-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
          >
            <LogOut className="sidebar-icon" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </motion.aside>
    </>
  );
}
