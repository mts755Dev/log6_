import { cn } from '../../utils/cn';

interface TechnologyIconProps {
  className?: string;
}

export function SolarPanelIcon({ className }: TechnologyIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn('h-14 w-14', className)}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 20h48v28H8z" />
      <path d="M8 28h48M8 36h48M8 44h48" />
      <path d="M20 20v28M32 20v28M44 20v28" />
      <path d="M32 48v5" />
      <path d="M25 53h14" />
      <path d="M50 10l2.5-2.5M58 18h3M50 26l2.5 2.5" opacity="0.65" />
    </svg>
  );
}

export function BatteryTerminalsIcon({ className }: TechnologyIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn('h-14 w-14', className)}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="13" y="22" width="38" height="34" rx="4" />
      <rect x="19" y="13" width="11" height="11" rx="2" />
      <rect x="34" y="13" width="11" height="11" rx="2" />
      <path d="M22.5 18.5h5M25 16v5" />
      <path d="M37 18.5h5" />
      <rect x="17" y="28" width="30" height="22" rx="2.5" fill="currentColor" fillOpacity="0.14" stroke="none" />
      <path d="M21 35h22M21 41h16" opacity="0.4" />
    </svg>
  );
}

export function HeatPumpIcon({ className }: TechnologyIconProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={cn('h-14 w-14', className)}
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="7" y="15" width="50" height="37" rx="4" />
      <path d="M14 20h36" opacity="0.55" />
      <circle cx="32" cy="35" r="14" />
      <circle cx="32" cy="35" r="4" fill="currentColor" fillOpacity="0.18" />
      <path d="M32 23v4M32 43v4M20 35h4M40 35h4" />
      <path d="M23.8 26.8l2.8 2.8M37.4 40.4l2.8 2.8M23.8 43.2l2.8-2.8M37.4 29.6l2.8-2.8" />
      <path d="M7 24H3v10h4M57 24h4v10h-4" />
    </svg>
  );
}
