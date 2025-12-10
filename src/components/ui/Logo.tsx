import { motion } from 'framer-motion';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  variant?: 'light' | 'dark';
}

export function Logo({ size = 'md', showText = true, variant = 'dark' }: LogoProps) {
  const sizes = {
    sm: { icon: 28, text: 'text-lg' },
    md: { icon: 36, text: 'text-xl' },
    lg: { icon: 48, text: 'text-2xl' },
  };

  const { icon, text } = sizes[size];
  const textColor = variant === 'dark' ? 'text-slate-900' : 'text-white';
  const subtitleColor = variant === 'dark' ? 'text-slate-500' : 'text-slate-400';

  return (
    <motion.div 
      className="flex items-center gap-3"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div 
        className="relative flex items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-600/25"
        style={{ width: icon + 10, height: icon + 10 }}
      >
        <svg
          width={icon}
          height={icon}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Battery body */}
          <rect x="10" y="8" width="20" height="26" rx="3" stroke="white" strokeWidth="2.5" fill="none" />
          {/* Battery cap */}
          <rect x="15" y="4" width="10" height="4" rx="1.5" fill="white" />
          {/* Solar/Energy symbol - lightning bolt */}
          <path 
            d="M20 13L16 21H20L16 29L24 19H20L24 13H20Z" 
            fill="#fbbf24"
            stroke="white"
            strokeWidth="0.5"
          />
        </svg>
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={`font-display font-bold ${textColor} ${text}`}>
            Log<span className="text-primary-600">6</span>
          </span>
          {size === 'lg' && (
            <span className={`text-xs ${subtitleColor} -mt-0.5 tracking-wide`}>
              Battery Storage Platform
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
