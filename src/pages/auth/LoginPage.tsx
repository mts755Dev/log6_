import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Shield, Wrench, Users, Sun, Battery, Zap } from 'lucide-react';
import { Logo } from '../../components/ui/Logo';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types';

const roleConfig: Record<UserRole, { 
  title: string; 
  subtitle: string; 
  icon: React.ReactNode; 
  color: string;
  bgColor: string;
  demoEmail: string;
}> = {
  admin: {
    title: 'Admin Portal',
    subtitle: 'Platform management & analytics',
    icon: <Shield className="w-6 h-6" />,
    color: 'text-primary-500',
    bgColor: 'bg-primary-500/10',
    demoEmail: 'admin@log6.co.uk',
  },
  installer: {
    title: 'Installer Portal',
    subtitle: 'Quotes, proposals & installations',
    icon: <Wrench className="w-6 h-6" />,
    color: 'text-energy-500',
    bgColor: 'bg-energy-500/10',
    demoEmail: 'installer@solarsolutions.co.uk',
  },
  assessor: {
    title: 'Assessor Portal',
    subtitle: 'Reviews & certifications',
    icon: <Users className="w-6 h-6" />,
    color: 'text-solar-500',
    bgColor: 'bg-solar-500/10',
    demoEmail: 'assessor@log6.co.uk',
  },
};

export function LoginPage() {
  const { role } = useParams<{ role: UserRole }>();
  const navigate = useNavigate();
  const { login } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const config = role && roleConfig[role] ? roleConfig[role] : roleConfig.installer;
  const currentRole = role || 'installer';

  // Add dark class to body for dashboard-style login
  useEffect(() => {
    document.body.classList.add('dark');
    return () => document.body.classList.remove('dark');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(email, password, currentRole as UserRole);
      if (success) {
        navigate(`/${currentRole}`);
      } else {
        setError('Invalid credentials. Please check your email and try again.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setEmail(config.demoEmail);
    setIsLoading(true);
    
    const success = await login(config.demoEmail, 'demo', currentRole as UserRole);
    if (success) {
      navigate(`/${currentRole}`);
    } else {
      setError('Demo login failed. Please try again.');
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex">
      {/* Left Panel - Branding */}
      <motion.div 
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-900"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-energy-500/10 rounded-full blur-3xl" />
        
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          <Link to="/">
            <Logo size="lg" variant="light" />
          </Link>
          
          <div className="max-w-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.5 }}
            >
              <div className="flex items-center gap-3 mb-6">
                <Sun className="w-10 h-10 text-solar-400" />
                <Battery className="w-10 h-10 text-energy-400" />
                <Zap className="w-10 h-10 text-primary-400" />
              </div>
              <h1 className="text-4xl font-bold font-display text-white mb-4">
                Power Your Solar<br />Installation Business
              </h1>
              <p className="text-lg text-slate-400 mb-8">
                The UK's leading platform for battery storage quoting, 
                ROI modelling, and MCS compliance automation.
              </p>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5 }}
              className="grid grid-cols-2 gap-4"
            >
              {[
                { label: 'Quote Generation', value: '< 2 min' },
                { label: 'Active Installers', value: '500+' },
                { label: 'MCS Compliant', value: '100%' },
                { label: 'UK Support', value: '24/7' },
              ].map((stat) => (
                <div key={stat.label} className="bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-4">
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-sm text-slate-400">{stat.label}</p>
                </div>
              ))}
            </motion.div>
          </div>

          <div className="text-sm text-slate-500">
            © 2025 Log6 Technologies Ltd. All rights reserved.
          </div>
        </div>
      </motion.div>

      {/* Right Panel - Login Form */}
      <motion.div 
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full lg:w-1/2 flex items-center justify-center p-8"
      >
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden mb-8">
            <Link to="/">
              <Logo size="lg" variant="light" />
            </Link>
          </div>

          {/* Role indicator */}
          <div className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl mb-8">
            <div className={`p-3 rounded-xl ${config.bgColor} ${config.color}`}>
              {config.icon}
            </div>
            <div>
              <p className="font-semibold text-white">{config.title}</p>
              <p className="text-sm text-slate-500">{config.subtitle}</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold font-display text-white mb-2">
            Welcome back
          </h2>
          <p className="text-slate-400 mb-8">
            Sign in to access your {currentRole} dashboard
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="Email Address"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              required
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              required
            />

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400"
              >
                {error}
              </motion.div>
            )}

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-primary-600 focus:ring-primary-500/50" />
                <span className="text-sm text-slate-400">Remember me</span>
              </label>
              <button type="button" className="text-sm text-primary-400 hover:text-primary-300 font-medium">
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isLoading}
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In
            </Button>
          </form>

          {/* Demo Login */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <button
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-medium rounded-xl border border-slate-700 transition-colors flex items-center justify-center gap-2"
            >
              <span className="text-sm">Try Demo Account</span>
            </button>
            <p className="text-xs text-slate-500 text-center mt-3">
              Explore the platform with demo credentials
            </p>
          </div>

          {/* Portal switcher */}
          <div className="mt-8 pt-6 border-t border-slate-800">
            <p className="text-sm text-slate-500 text-center mb-4">Switch portal</p>
            <div className="flex justify-center gap-3">
              {Object.entries(roleConfig).map(([key, value]) => (
                <Link
                  key={key}
                  to={`/login/${key}`}
                  className={`p-3 rounded-xl border transition-all ${
                    key === currentRole
                      ? 'border-primary-500 bg-primary-500/10 text-primary-400'
                      : 'border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                  title={value.title}
                >
                  {value.icon}
                </Link>
              ))}
            </div>
          </div>

          {/* Back to home */}
          <div className="mt-8 text-center">
            <Link to="/" className="text-sm text-slate-500 hover:text-slate-300 transition-colors">
              ← Back to home
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
