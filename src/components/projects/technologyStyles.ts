import type { ProjectTechnology } from '../../types';

export const TECHNOLOGY_DISPLAY: Record<ProjectTechnology, string> = {
  solar: 'Solar PV',
  battery: 'Battery Storage',
  heat_pumps: 'Heat Pump',
};

export const TECHNOLOGY_STYLES: Record<ProjectTechnology, { icon: string; bg: string }> = {
  solar: { icon: 'text-amber-400', bg: 'bg-amber-500/10' },
  battery: { icon: 'text-violet-400', bg: 'bg-violet-500/10' },
  heat_pumps: { icon: 'text-rose-400', bg: 'bg-rose-500/10' },
};
