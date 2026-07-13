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
  Files,
  FileCode,
  Receipt,
  Upload,
  Wrench,
  Briefcase,
  Calendar as CalendarIcon,
  Bot,
  BookOpen,
} from 'lucide-react';
import { Logo } from '../ui/Logo';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
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
    { label: 'Documents', path: '/admin/documents', icon: <Files className="sidebar-icon" /> },
    { label: 'Assistant', path: '/admin/assistant', icon: <Bot className="sidebar-icon" /> },
    { label: 'Question Bank', path: '/admin/assistant/questions', icon: <BookOpen className="sidebar-icon" /> },
    { label: 'Templates', path: '/admin/templates', icon: <FileCode className="sidebar-icon" /> },
    { label: 'Verification', path: '/admin/verification', icon: <Shield className="sidebar-icon" /> },
    { label: 'Invoices', path: '/admin/invoices', icon: <Receipt className="sidebar-icon" /> },
    { label: 'All Quotes', path: '/admin/quotes', icon: <FileText className="sidebar-icon" /> },
    { label: 'Submissions', path: '/admin/submissions', icon: <ClipboardCheck className="sidebar-icon" /> },
    { label: 'Certificates', path: '/admin/certificates', icon: <Award className="sidebar-icon" /> },
    { label: 'Settings', path: '/admin/settings', icon: <Settings className="sidebar-icon" /> },
  ],
  installer: [
    { label: 'Dashboard', path: '/installer', icon: <LayoutDashboard className="sidebar-icon" /> },
    { label: 'New Quote', path: '/installer/quotes/new', icon: <Calculator className="sidebar-icon" /> },
    { label: 'My Quotes', path: '/installer/quotes', icon: <FileText className="sidebar-icon" /> },
    { label: 'Scheduler', path: '/installer/scheduler', icon: <CalendarIcon className="sidebar-icon" /> },
    { label: 'Proposals', path: '/installer/proposals', icon: <FolderOpen className="sidebar-icon" /> },
    { label: 'Invoices', path: '/installer/invoices', icon: <Receipt className="sidebar-icon" /> },
    { label: 'Onboarding', path: '/installer/onboarding', icon: <Upload className="sidebar-icon" /> },
    { label: 'Commissions', path: '/installer/commissions', icon: <ClipboardCheck className="sidebar-icon" /> },
    { label: 'Technical Persons', path: '/installer/engineers', icon: <Users className="sidebar-icon" /> },
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
  compliance_officer: [
    { label: 'Dashboard', path: '/compliance/dashboard', icon: <LayoutDashboard className="sidebar-icon" /> },
    { label: 'Pending Reviews', path: '/compliance/dashboard', icon: <ClipboardCheck className="sidebar-icon" /> },
    { label: 'Settings', path: '/compliance/settings', icon: <Settings className="sidebar-icon" /> },
  ],
  engineer: [
    { label: 'Dashboard', path: '/engineer', icon: <LayoutDashboard className="sidebar-icon" /> },
    { label: 'My Jobs', path: '/engineer', icon: <Briefcase className="sidebar-icon" /> },
    { label: 'Availability', path: '/engineer/availability', icon: <CalendarIcon className="sidebar-icon" /> },
    { label: 'Settings', path: '/engineer/settings', icon: <Settings className="sidebar-icon" /> },
  ],
};

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { getCompany } = useData();
  const navigate = useNavigate();

  if (!user) return null;

  const navigation = navigationConfig[user.role];
  const company = user.companyId ? getCompany(user.companyId) : null;
  const brandColor = (company?.brandColor && company.brandColor !== '#0c8cf1') ? company.brandColor : '#eab308';
  const companyLogo = company?.logo || null;

  const handleLogout = async () => {
    await logout();
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
    compliance_officer: 'Compliance Officer',
    engineer: 'Field Engineer',
  };

  const roleColors: Record<UserRole, string> = {
    admin: 'bg-primary-500/20 text-primary-400',
    installer: 'bg-energy-500/20 text-energy-400',
    assessor: 'bg-solar-500/20 text-solar-400',
    compliance_officer: 'bg-blue-500/20 text-blue-400',
    engineer: 'bg-orange-500/20 text-orange-400',
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
          <Link to="/" onClick={handleNavClick} className="flex items-center gap-3">
            {user.role === 'installer' && companyLogo ? (
              <img 
                src={companyLogo} 
                alt={company?.name || 'Company'} 
                className="h-8 max-w-[140px] object-contain"
              />
            ) : (
              <Logo size="md" variant="dark" />
            )}
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
            {user.avatar ? (
              <img
                src={user.avatar}
                alt={user.name}
                className="w-10 h-10 rounded-xl object-cover"
              />
            ) : (
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center font-semibold text-sm",
                roleColors[user.role]
              )}>
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
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
                  style={({ isActive }) => 
                    isActive && brandColor
                      ? {
                          borderLeftColor: brandColor,
                          backgroundColor: `${brandColor}15`,
                        }
                      : undefined
                  }
                >
                  {item.icon}
                  <span className="flex-1 font-medium">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span 
                      className="px-2 py-0.5 text-xs text-white rounded-full font-semibold"
                      style={{ backgroundColor: brandColor || undefined }}
                    >
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
            <div className="flex items-center gap-3">
              {companyLogo ? (
                <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-800 flex-shrink-0 border border-slate-700">
                  <img src={companyLogo} alt="" className="w-full h-full object-contain p-0.5" />
                </div>
              ) : (
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: brandColor ? `${brandColor}20` : undefined }}
                >
                  <Building2 className="w-4 h-4" style={{ color: brandColor || undefined }} />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs text-slate-500">Company</p>
                <p className="text-sm text-slate-300 truncate font-medium">{user.companyName || company?.name}</p>
              </div>
              {brandColor && (
                <div 
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: brandColor }}
                />
              )}
            </div>
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
