import type { ComponentType } from 'react';
import {
  BatteryTerminalsIcon,
  HeatPumpIcon,
  SolarPanelIcon,
} from '../icons/TechnologyIcons';
import { getProjectTechnologies } from '../../lib/projects';
import { PROJECT_TECHNOLOGY_LABELS, type Project, type ProjectTechnology } from '../../types';
import { cn } from '../../utils/cn';
import { TECHNOLOGY_STYLES } from './technologyStyles';

const TECHNOLOGY_ICONS: Record<
  ProjectTechnology,
  ComponentType<{ className?: string }>
> = {
  solar: SolarPanelIcon,
  battery: BatteryTerminalsIcon,
  heat_pumps: HeatPumpIcon,
};

interface ProjectTechnologyIconsProps {
  project: Pick<Project, 'technologies' | 'projectType'>;
  className?: string;
  iconClassName?: string;
  size?: 'default' | 'compact';
}

export function ProjectTechnologyIcons({
  project,
  className,
  iconClassName,
  size = 'default',
}: ProjectTechnologyIconsProps) {
  const technologies = getProjectTechnologies(project);
  const label = technologies
    .map((technology) => PROJECT_TECHNOLOGY_LABELS[technology])
    .join(', ');

  return (
    <div
      className={cn('flex items-center gap-2', className)}
      title={label}
      aria-label={label ? `Technologies: ${label}` : 'Technologies'}
    >
      {technologies.map((technology) => {
        const Icon = TECHNOLOGY_ICONS[technology];
        const styles = TECHNOLOGY_STYLES[technology];

        if (size === 'compact') {
          return (
            <span
              key={technology}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-lg',
                styles.bg,
                styles.icon,
              )}
              title={PROJECT_TECHNOLOGY_LABELS[technology]}
            >
              <Icon className={cn('h-5 w-5', iconClassName)} />
            </span>
          );
        }

        return (
          <span
            key={technology}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              styles.bg,
              styles.icon,
            )}
            title={PROJECT_TECHNOLOGY_LABELS[technology]}
          >
            <Icon className={cn('h-7 w-7', iconClassName)} />
          </span>
        );
      })}
    </div>
  );
}
