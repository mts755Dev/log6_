import { HTMLAttributes, forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { cn } from '../../utils/cn';

interface CardProps extends HTMLMotionProps<'div'> {
  variant?: 'default' | 'hover' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = 'default', padding = 'md', children, ...props }, ref) => {
    const variants = {
      default: 'bg-slate-900/50 backdrop-blur-sm border border-slate-800',
      hover: 'bg-slate-900/50 backdrop-blur-sm border border-slate-800 hover:bg-slate-900/70 hover:border-slate-700 transition-all duration-200 cursor-pointer',
      outlined: 'bg-transparent border border-slate-700',
    };

    const paddings = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={cn(
          'rounded-xl shadow-lg shadow-black/10',
          variants[variant],
          paddings[padding],
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

interface StatCardProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
}

export function StatCard({ title, value, change, changeType = 'neutral', icon, className }: StatCardProps) {
  const changeColors = {
    positive: 'text-energy-400',
    negative: 'text-red-400',
    neutral: 'text-slate-400',
  };

  return (
    <Card className={cn('relative overflow-hidden', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-slate-400 font-medium">{title}</p>
          <p className="text-3xl font-bold font-display text-white mt-1">{value}</p>
          {change && (
            <p className={cn('text-sm mt-2 font-medium', changeColors[changeType])}>
              {change}
            </p>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-primary-500/10 rounded-xl text-primary-400">
            {icon}
          </div>
        )}
      </div>
      {/* Subtle decorative element */}
      <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-primary-600/5 rounded-full blur-2xl" />
    </Card>
  );
}
