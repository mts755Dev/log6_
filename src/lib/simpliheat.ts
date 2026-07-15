const DEFAULT_SIMPLIHEAT_APP_URL = 'https://simpliheat-next.vercel.app';

export function getSimpliHeatBaseUrl(): string {
  return import.meta.env.VITE_SIMPLIHEAT_APP_URL?.replace(/\/$/, '') || DEFAULT_SIMPLIHEAT_APP_URL;
}

export interface SimpliHeatProjectPrefill {
  projectName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  siteAddress?: string;
  postcode?: string;
}

export interface SimpliHeatDesignerOptions {
  /** Existing SimpliHeat plan id (`sh_projects.id`) — opens in the designer via `?p=`. */
  projectId?: number | null;
  /** heliOS CRM project id — SimpliHeat opens or creates the linked heat-loss design. */
  heliosProjectId?: string | null;
  /** Customer + project fields from heliOS — only used when starting a new SimpliHeat survey. */
  prefill?: SimpliHeatProjectPrefill;
}

export interface SimpliHeatOpenContext {
  companyId?: string | null;
  companyName?: string | null;
}

export interface HeliosProjectSimpliHeatFields {
  id?: string;
  name: string;
  projectType: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  siteAddress: string;
  postcode: string;
  linkedSimpliHeatProjectId?: number;
}

export function getSimpliHeatPrefillFromProject(
  project: HeliosProjectSimpliHeatFields,
): SimpliHeatProjectPrefill {
  return {
    projectName: project.name.trim(),
    customerName: project.customerName.trim(),
    customerEmail: project.customerEmail?.trim(),
    customerPhone: project.customerPhone?.trim(),
    siteAddress: project.siteAddress.trim(),
    postcode: project.postcode.trim(),
  };
}

/** Open the SimpliHeat design for a saved heliOS heat-pump project. */
export function openSimpliHeatForHeliosProject(
  project: HeliosProjectSimpliHeatFields,
  context?: SimpliHeatOpenContext,
): void {
  if (project.linkedSimpliHeatProjectId) {
    openSimpliHeat({ projectId: project.linkedSimpliHeatProjectId }, context);
    return;
  }

  if (project.projectType === 'simpliheat' && project.id) {
    openSimpliHeat(
      {
        heliosProjectId: project.id,
        prefill: getSimpliHeatPrefillFromProject(project),
      },
      context,
    );
  }
}

export function isSimpliHeatHeliosProject(project: {
  projectType: string;
  technologies?: Array<'solar' | 'battery' | 'heat_pumps'>;
  linkedSimpliHeatProjectId?: number;
}): boolean {
  return (
    project.projectType === 'simpliheat' ||
    project.technologies?.includes('heat_pumps') === true ||
    Boolean(project.linkedSimpliHeatProjectId)
  );
}

function applyPrefillParams(url: URL, prefill?: SimpliHeatProjectPrefill): void {
  if (!prefill) return;

  const entries: Array<[string, string | undefined]> = [
    ['helios_proj', prefill.projectName],
    ['helios_name', prefill.customerName],
    ['helios_email', prefill.customerEmail],
    ['helios_phone', prefill.customerPhone],
    ['helios_addr', prefill.siteAddress],
    ['helios_pc', prefill.postcode],
  ];

  for (const [key, value] of entries) {
    const trimmed = value?.trim();
    if (trimmed) url.searchParams.set(key, trimmed);
  }
}

function buildHeatplanUrl(baseUrl: string, options?: SimpliHeatDesignerOptions): URL {
  const url = new URL('heatplan', baseUrl);
  if (options?.projectId) {
    url.searchParams.set('p', String(options.projectId));
  } else {
    url.searchParams.set('new', '1');
    if (options?.heliosProjectId) {
      url.searchParams.set('helios_project_id', options.heliosProjectId);
    }
    applyPrefillParams(url, options?.prefill);
  }
  return url;
}

/** Full SimpliHeat URL (sign-in if needed, then designer). Opens on the SimpliHeat site, not in an iframe. */
export function getSimpliHeatDesignerUrl(
  options?: SimpliHeatDesignerOptions,
  context?: SimpliHeatOpenContext,
): string {
  const baseUrl = getSimpliHeatBaseUrl();
  const next = buildHeatplanUrl(baseUrl, options);
  const authUrl = new URL(`${baseUrl}/app`);
  authUrl.searchParams.set('next', `${next.pathname.replace(/^\//, '')}${next.search}`);
  if (context?.companyId) authUrl.searchParams.set('helios_company_id', context.companyId);
  if (context?.companyName) authUrl.searchParams.set('helios_company_name', context.companyName);
  return authUrl.toString();
}

/** Open SimpliHeat in a new browser tab (external site). */
export function openSimpliHeat(
  options?: SimpliHeatDesignerOptions,
  context?: SimpliHeatOpenContext,
): void {
  const url = getSimpliHeatDesignerUrl(options, context);
  window.open(url, '_blank', 'noopener,noreferrer');
}
