import type { ComponentType } from 'react';
import {
  BatteryTerminalsIcon,
  HeatPumpIcon,
  SolarPanelIcon,
} from '../icons/TechnologyIcons';
import { getProjectTechnologies } from '../../lib/projects';
import { PROJECT_TECHNOLOGY_LABELS, type Project, type ProjectTechnology } from '../../types';
import { cn } from '../../utils/cn';
import { TECHNOLOGY_DISPLAY, TECHNOLOGY_STYLES } from './technologyStyles';

const TECHNOLOGY_ICONS: Record<
  ProjectTechnology,
  ComponentType<{ className?: string }>
> = {
  solar: SolarPanelIcon,
  battery: BatteryTerminalsIcon,
  heat_pumps: HeatPumpIcon,
};

interface ProjectTechnologyListProps {
  project: Pick<Project, 'technologies' | 'projectType'>;
  className?: string;
}

export function ProjectTechnologyList({ project, className }: ProjectTechnologyListProps) {
  const technologies = getProjectTechnologies(project);

  if (!technologies.length) {
    return <p className="text-slate-500 text-sm">No technologies selected</p>;
  }

  return (
    <ul className={cn('space-y-3', className)}>
      {technologies.map((technology) => {
        const Icon = TECHNOLOGY_ICONS[technology];
        const styles = TECHNOLOGY_STYLES[technology];
        const label = TECHNOLOGY_DISPLAY[technology] || PROJECT_TECHNOLOGY_LABELS[technology];

        return (
          <li key={technology} className="flex items-center gap-3">
            <span
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                styles.bg,
                styles.icon,
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className="text-white font-medium">{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
