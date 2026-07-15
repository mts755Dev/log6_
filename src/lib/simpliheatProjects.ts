import { supabase } from './supabase';

export interface SimpliHeatProjectRow {
  id: number;
  name: string;
  reference: string;
  customerName: string;
  postcode: string;
  totalHeatLossW: number | null;
  updatedAt: number;
}

export interface SimpliHeatProjectDetail extends SimpliHeatProjectRow {
  customerEmail: string;
  customerPhone: string;
  siteAddress: string;
  createdAt: number;
}

export async function resolveSimpliHeatUserIdForCompany(
  userId: string,
  companyId?: string | null,
): Promise<string | null> {
  if (!userId) return null;

  if (companyId) {
    const { data: company } = await supabase
      .from('companies')
      .select('simpliheat_user_id')
      .eq('id', companyId)
      .maybeSingle();

    if (company?.simpliheat_user_id) {
      return company.simpliheat_user_id as string;
    }

    return null;
  }

  return null;
}

export function formatSimpliHeatProjectAddress(project: SimpliHeatProjectRow): string {
  return [project.name, project.postcode].filter(Boolean).join(', ');
}

function parseProjectMeta(data: string | null): {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  siteAddress: string;
  postcode: string;
} {
  if (!data) {
    return {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      siteAddress: '',
      postcode: '',
    };
  }

  try {
    const d = JSON.parse(data) as {
      customer?: { name?: string; email?: string; phone?: string; postcode?: string };
      property?: { address?: string; line1?: string; postcode?: string };
    };

    const propertyAddress = (d.property?.address || d.property?.line1 || '').trim();

    return {
      customerName: d.customer?.name?.trim() || '',
      customerEmail: d.customer?.email?.trim() || '',
      customerPhone: d.customer?.phone?.trim() || '',
      siteAddress: propertyAddress,
      postcode: (d.property?.postcode || d.customer?.postcode || '').trim(),
    };
  } catch {
    return {
      customerName: '',
      customerEmail: '',
      customerPhone: '',
      siteAddress: '',
      postcode: '',
    };
  }
}

function mapSimpliHeatProjectRow(row: Record<string, unknown>): SimpliHeatProjectDetail {
  const meta = parseProjectMeta(row.data as string | null);
  const name = row.name as string;

  return {
    id: Number(row.id),
    name,
    reference: `SH-${row.id}`,
    customerName: meta.customerName,
    customerEmail: meta.customerEmail,
    customerPhone: meta.customerPhone,
    siteAddress: meta.siteAddress || name,
    postcode: meta.postcode,
    totalHeatLossW: row.total_w == null ? null : Number(row.total_w),
    updatedAt: Number(row.updated_at),
    createdAt: Number(row.created_at ?? row.updated_at),
  };
}

/** SimpliHeat heat-loss plans from sh_projects (shared Supabase DB). */
export async function fetchSimpliHeatProjectsForUser(userId: string): Promise<SimpliHeatProjectRow[]> {
  const { data, error } = await supabase
    .from('sh_projects')
    .select('id, name, data, total_w, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => mapSimpliHeatProjectRow(row as Record<string, unknown>));
}

export async function fetchSimpliHeatProjectById(
  projectId: number,
  userId: string,
  companyId?: string | null,
): Promise<SimpliHeatProjectDetail | null> {
  const simpliHeatUserId = await resolveSimpliHeatUserIdForCompany(userId, companyId);
  if (!simpliHeatUserId) return null;

  const { data, error } = await supabase
    .from('sh_projects')
    .select('id, name, data, total_w, updated_at, created_at')
    .eq('id', projectId)
    .eq('user_id', simpliHeatUserId)
    .maybeSingle();

  if (error || !data) return null;
  return mapSimpliHeatProjectRow(data as Record<string, unknown>);
}

export async function getSimpliHeatProjectSummary(
  projectId: number,
): Promise<{ id: number; name: string; reference: string } | null> {
  const { data, error } = await supabase
    .from('sh_projects')
    .select('id, name')
    .eq('id', projectId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    id: Number(data.id),
    name: data.name as string,
    reference: `SH-${data.id}`,
  };
}

export type SyncHeliosToSimpliHeatResult = {
  synced: boolean;
  error?: string;
  shProjectId?: number;
};

/** Push heliOS project customer/site fields into the linked SimpliHeat plan (sh_projects). */
export async function syncHeliosProjectToSimpliHeat(
  heliosProjectId: string,
): Promise<SyncHeliosToSimpliHeatResult> {
  const { data, error } = await supabase.rpc('sync_helios_project_to_simpliheat', {
    p_project_id: heliosProjectId,
  });

  if (error) {
    return { synced: false, error: error.message };
  }

  const payload = data as { synced?: boolean; error?: string; sh_project_id?: number } | null;
  if (!payload?.synced) {
    return { synced: false, error: payload?.error || 'sync_failed' };
  }

  return {
    synced: true,
    shProjectId: payload.sh_project_id,
  };
}

export type DeleteHeliosProjectResult = {
  deleted: boolean;
  simpliheatDeleted?: boolean;
  error?: string;
};

/** Delete heliOS project and linked SimpliHeat plan (when company is linked). */
export async function deleteHeliosProjectWithSimpliHeat(
  heliosProjectId: string,
): Promise<DeleteHeliosProjectResult> {
  const { data, error } = await supabase.rpc('delete_helios_project_with_simpliheat', {
    p_project_id: heliosProjectId,
  });

  if (error) {
    return { deleted: false, error: error.message };
  }

  const payload = data as {
    deleted?: boolean;
    simpliheat_deleted?: boolean;
    error?: string;
  } | null;

  if (!payload?.deleted) {
    return { deleted: false, error: payload?.error || 'delete_failed' };
  }

  return {
    deleted: true,
    simpliheatDeleted: Boolean(payload.simpliheat_deleted),
  };
}
