import { cn } from '../../utils/cn';

interface BadgeProps {
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'slate';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'slate', size = 'md', children, className }: BadgeProps) {
  const variants = {
    primary: 'bg-primary-500/15 text-primary-400 border-primary-500/25',
    success: 'bg-energy-500/15 text-energy-400 border-energy-500/25',
    warning: 'bg-solar-500/15 text-solar-400 border-solar-500/25',
    danger: 'bg-red-500/15 text-red-400 border-red-500/25',
    slate: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold rounded-full border',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </span>
  );
}

// Status-specific badges
export function QuoteStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    draft: { variant: 'slate', label: 'Draft' },
    sent: { variant: 'primary', label: 'Sent' },
    viewed: { variant: 'primary', label: 'Viewed' },
    accepted: { variant: 'success', label: 'Accepted' },
    rejected: { variant: 'danger', label: 'Rejected' },
    expired: { variant: 'warning', label: 'Expired' },
  };

  const config = statusConfig[status] || { variant: 'slate' as const, label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function CommissionStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    pending_review: { variant: 'warning', label: 'Pending Review' },
    approved: { variant: 'success', label: 'Approved' },
    rejected: { variant: 'danger', label: 'Rejected' },
    requires_changes: { variant: 'primary', label: 'Changes Required' },
  };

  const config = statusConfig[status] || { variant: 'slate' as const, label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export function SubscriptionBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { variant: BadgeProps['variant']; label: string }> = {
    active: { variant: 'success', label: 'Active' },
    trial: { variant: 'primary', label: 'Trial' },
    expired: { variant: 'danger', label: 'Expired' },
    cancelled: { variant: 'slate', label: 'Cancelled' },
  };

  const config = statusConfig[status] || { variant: 'slate' as const, label: status };

  return <Badge variant={config.variant}>{config.label}</Badge>;
}
