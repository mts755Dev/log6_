import {
  PROJECT_TECHNOLOGY_LABELS,
  PROJECT_TYPE_LABELS,
  type Project,
  type ProjectTechnology,
  type ProjectType,
} from '../types';
import { supabase } from './supabase';
import type { SimpliHeatProjectDetail, SimpliHeatProjectRow } from './simpliheatProjects';

const PROJECT_TECHNOLOGIES: ProjectTechnology[] = ['solar', 'battery', 'heat_pumps'];

function parseTechnologies(value: unknown): ProjectTechnology[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const technologies = value.filter((item): item is ProjectTechnology =>
    PROJECT_TECHNOLOGIES.includes(item as ProjectTechnology),
  );
  return technologies.length > 0 ? technologies : undefined;
}

export function mapProjectRow(row: Record<string, unknown>): Project {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    installerId: row.installer_id as string,
    installerName: row.installer_name as string,
    reference: row.reference as string,
    name: row.name as string,
    projectType: (row.project_type as Project['projectType']) || 'battery',
    technologies: parseTechnologies(row.technologies),
    customerName: row.customer_name as string,
    customerEmail: (row.customer_email as string) || undefined,
    customerPhone: (row.customer_phone as string) || undefined,
    siteAddress: (row.site_address as string) || '',
    postcode: (row.postcode as string) || '',
    status: row.status as Project['status'],
    estimatedValue: Number(row.estimated_value) || 0,
    description: (row.description as string) || undefined,
    notes: (row.notes as string) || undefined,
    linkedSimpliHeatProjectId:
      row.linked_simpliheat_project_id != null
        ? Number(row.linked_simpliheat_project_id)
        : undefined,
    linkedSimpliHeatProjectName: (row.linked_simpliheat_project_name as string) || undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function generateProjectReference(): string {
  return `PRJ-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`;
}

export function projectTypeToTechnologies(type: ProjectType): ProjectTechnology[] {
  if (type === 'simpliheat') return ['heat_pumps'];
  if (type === 'battery') return ['battery'];
  if (type === 'solar') return ['solar'];
  if (type === 'simplipv') return ['solar', 'battery'];
  return [];
}

export function getProjectTechnologies(
  project: Pick<Project, 'technologies' | 'projectType'>,
): ProjectTechnology[] {
  if (project.technologies?.length) return project.technologies;
  return projectTypeToTechnologies(project.projectType);
}

export function formatProjectTechnologies(project: Pick<Project, 'technologies' | 'projectType'>): string {
  const technologies = getProjectTechnologies(project);
  if (technologies.length) {
    return technologies.map((technology) => PROJECT_TECHNOLOGY_LABELS[technology]).join(', ');
  }
  return PROJECT_TYPE_LABELS[project.projectType];
}

export function getProjectWorkflowState(project: Project): {
  label: string;
  variant: 'setup' | 'progress';
} {
  const technologies = getProjectTechnologies(project);
  const needsHeatDesign =
    technologies.includes('heat_pumps') && !project.linkedSimpliHeatProjectId;

  if (needsHeatDesign) {
    return { label: 'Setup required', variant: 'setup' };
  }
  return { label: 'In progress', variant: 'progress' };
}

export function formatProjectAddress(project: Pick<Project, 'siteAddress' | 'postcode'>): string {
  return [project.siteAddress, project.postcode].filter(Boolean).join(', ');
}

export type ProjectListItem =
  | { source: 'helios'; project: Project; sortAt: number }
  | { source: 'simpliheat'; project: SimpliHeatProjectRow; sortAt: number };

export function buildMergedProjectList(
  heliosProjects: Project[],
  simpliHeatProjects: SimpliHeatProjectRow[],
): ProjectListItem[] {
  const linkedSimpliHeatIds = new Set(
    heliosProjects
      .map((project) => project.linkedSimpliHeatProjectId)
      .filter((id): id is number => id != null),
  );

  const items: ProjectListItem[] = [
    ...heliosProjects.map((project) => ({
      source: 'helios' as const,
      project,
      sortAt: new Date(project.createdAt).getTime(),
    })),
    ...simpliHeatProjects
      .filter((project) => !linkedSimpliHeatIds.has(project.id))
      .map((project) => ({
        source: 'simpliheat' as const,
        project,
        sortAt: project.updatedAt,
      })),
  ];

  return items.sort((a, b) => b.sortAt - a.sortAt);
}

export function getProjectListItemSearchText(item: ProjectListItem): string {
  if (item.source === 'helios') {
    const project = item.project;
    return [
      project.name,
      project.reference,
      project.customerName,
      formatProjectAddress(project),
      formatProjectTechnologies(project),
    ]
      .join(' ')
      .toLowerCase();
  }

  const project = item.project;
  return [
    project.name,
    project.reference,
    project.customerName,
    project.postcode,
    'heat pumps',
    'simpliheat',
  ]
    .join(' ')
    .toLowerCase();
}

export async function findHeliosProjectBySimpliHeatId(
  simpliHeatProjectId: number,
  companyId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('company_id', companyId)
    .eq('linked_simpliheat_project_id', simpliHeatProjectId)
    .maybeSingle();

  if (error) throw error;
  return (data?.id as string | undefined) ?? null;
}

export async function ensureHeliosProjectForSimpliHeat(
  shProject: SimpliHeatProjectDetail | SimpliHeatProjectRow,
  user: { id: string; name: string; companyId: string | null },
): Promise<string> {
  if (!user.companyId) {
    throw new Error('company_required');
  }

  const existingId = await findHeliosProjectBySimpliHeatId(shProject.id, user.companyId);
  if (existingId) return existingId;

  const { data, error } = await supabase
    .from('projects')
    .insert({
      company_id: user.companyId,
      installer_id: user.id,
      installer_name: user.name,
      name: shProject.name,
      reference: generateProjectReference(),
      project_type: 'simpliheat',
      technologies: ['heat_pumps'],
      customer_name: shProject.customerName || shProject.name,
      customer_email: 'customerEmail' in shProject ? shProject.customerEmail || null : null,
      customer_phone: 'customerPhone' in shProject ? shProject.customerPhone || null : null,
      site_address: ('siteAddress' in shProject ? shProject.siteAddress : shProject.name) || shProject.name,
      postcode: shProject.postcode || '',
      estimated_value: 0,
      status: 'draft',
      linked_simpliheat_project_id: shProject.id,
      linked_simpliheat_project_name: `${shProject.reference} · ${shProject.name}`,
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}
